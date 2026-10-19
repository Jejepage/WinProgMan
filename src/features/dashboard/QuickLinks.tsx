import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { classifyLinkTarget, normalizeLinkTarget } from "../../domain/links";
import type { Link } from "../../domain/types";
import { ProjectLink } from "../../ui/ProjectLink";

const storageKey = "winprogman-quick-links";

type Saved = Pick<Link, "id" | "label" | "target">;

function load(): Saved[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(storageKey) || "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is Saved =>
            !!item &&
            typeof item.id === "string" &&
            typeof item.label === "string" &&
            typeof item.target === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Dashboard box with free links; kept per device, outside the project data. */
export function QuickLinks() {
  const [links, setLinks] = useState(load);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");

  function store(next: Saved[]) {
    setLinks(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setMessage("Links could not be stored on this device.");
    }
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    if (classifyLinkTarget(target).kind === "unknown") {
      setMessage("Enter a website address or an absolute Windows folder path.");
      return;
    }
    store([
      ...links,
      {
        id: crypto.randomUUID(),
        label: label.trim() || target.trim(),
        target: normalizeLinkTarget(target),
      },
    ]);
    setLabel("");
    setTarget("");
    setMessage("");
    setAdding(false);
  }
  const now = new Date().toISOString();
  return (
    <section className="panel dashboard-links">
      <div className="section-heading">
        <h2>Links</h2>
        <button
          className="text-button"
          aria-label="Add dashboard link"
          title="Add link"
          onClick={() => setAdding((value) => !value)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {!links.length && !adding && (
        <p className="muted">Keep frequently used links here.</p>
      )}
      <ul className="links-list">
        {links.map((item) => (
          <li key={item.id}>
            <div>
              <ProjectLink
                link={{
                  ...item,
                  projectId: "",
                  createdAt: now,
                  updatedAt: now,
                }}
              />
            </div>
            <button
              className="icon-button danger"
              aria-label={`Remove ${item.label}`}
              title="Remove"
              onClick={() => store(links.filter((l) => l.id !== item.id))}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {adding && (
        <form className="editor" onSubmit={add}>
          <label className="field">
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            URL or path
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="https://… or folder path"
            />
          </label>
          <div className="actions">
            <button className="button">Save link</button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </section>
  );
}
