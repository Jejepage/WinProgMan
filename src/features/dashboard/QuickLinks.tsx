import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { classifyLinkTarget, normalizeLinkTarget } from "../../domain/links";
import {
  metadata,
  type DomainChange,
  type QuickLink,
} from "../../domain/types";
import { ProjectLink } from "../../ui/ProjectLink";

/** Links kept on this device before they became part of the data. */
const legacyKey = "winprogman-quick-links";

function legacyLinks(): { label: string; target: string }[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(legacyKey) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            !!item &&
            typeof item.label === "string" &&
            typeof item.target === "string",
        )
      : [];
  } catch {
    return [];
  }
}

/** Dashboard box with free links; part of the data, backup and sync. */
export function QuickLinks({
  links,
  busy,
  onChange,
}: {
  links: QuickLink[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");

  // Take over links stored locally by the earlier version, once.
  useEffect(() => {
    const old = legacyLinks();
    if (!old.length) return;
    void (async () => {
      for (const item of old)
        if (
          !(await onChange({
            type: "quicklink.save",
            value: { ...metadata(), ...item },
          }))
        )
          return;
      try {
        localStorage.removeItem(legacyKey);
      } catch {
        /* nothing to clean up */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (classifyLinkTarget(target).kind === "unknown") {
      setMessage("Enter a website address or an absolute Windows folder path.");
      return;
    }
    const ok = await onChange({
      type: "quicklink.save",
      value: {
        ...metadata(),
        label: label.trim() || target.trim(),
        target: normalizeLinkTarget(target),
      },
    });
    if (!ok) return;
    setLabel("");
    setTarget("");
    setMessage("");
    setAdding(false);
  }
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
              <ProjectLink link={{ ...item, projectId: "" }} />
            </div>
            <button
              className="icon-button danger"
              aria-label={`Remove ${item.label}`}
              title="Remove"
              disabled={busy}
              onClick={() =>
                void onChange({ type: "quicklink.delete", id: item.id })
              }
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
            <button className="button" disabled={busy}>
              Save link
            </button>
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
