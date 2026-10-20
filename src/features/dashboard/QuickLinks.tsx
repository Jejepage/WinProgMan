import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  /** "new", the id of the link being edited, or null when closed. */
  const [editing, setEditing] = useState<string | null>(null);
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

  function open(item?: QuickLink) {
    if (item && editing === item.id) return close();
    if (!item && editing === "new") return close();
    setEditing(item ? item.id : "new");
    setLabel(item?.label ?? "");
    setTarget(item?.target ?? "");
    setMessage("");
  }

  function close() {
    setEditing(null);
    setLabel("");
    setTarget("");
    setMessage("");
  }

  const current = links.find((item) => item.id === editing);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (classifyLinkTarget(target).kind === "unknown") {
      setMessage("Enter a website address or an absolute Windows folder path.");
      return;
    }
    const fields = {
      label: label.trim() || target.trim(),
      target: normalizeLinkTarget(target),
    };
    const ok = await onChange({
      type: "quicklink.save",
      value: current
        ? { ...current, ...fields, updatedAt: new Date().toISOString() }
        : { ...metadata(), ...fields },
    });
    if (ok) close();
  }

  async function remove() {
    if (!current) return;
    if (await onChange({ type: "quicklink.delete", id: current.id })) close();
  }

  return (
    <section className="panel dashboard-links">
      <div className="dashboard-links-row">
        <h2>Links</h2>
        {!links.length && editing === null && (
          <p className="muted">Keep frequently used links here.</p>
        )}
        <ul className="dashboard-links-list">
          {links.map((item) => (
            <li
              key={item.id}
              className={editing === item.id ? "is-editing" : undefined}
            >
              <ProjectLink link={{ ...item, projectId: "" }} compact />
              <button
                className="icon-button"
                aria-label={`Edit ${item.label}`}
                aria-expanded={editing === item.id}
                title="Edit link"
                disabled={busy}
                onClick={() => open(item)}
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          className="text-button"
          aria-label="Add dashboard link"
          aria-expanded={editing === "new"}
          title="Add link"
          onClick={() => open()}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
      {(editing === "new" || current) && (
        <form className="editor" onSubmit={save}>
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
            <button type="button" className="button secondary" onClick={close}>
              Cancel
            </button>
            {current && (
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                <Trash2 size={14} aria-hidden="true" /> Delete link
              </button>
            )}
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
