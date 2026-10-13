import { useState } from "react";
import {
  metadata,
  type DomainChange,
  type ProjectCategory,
  type Project,
} from "../../domain/types";

interface Props {
  categories: ProjectCategory[];
  projects: Project[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}

export function CategorySettings({
  categories,
  projects,
  busy,
  onChange,
}: Props) {
  const [editing, setEditing] = useState<ProjectCategory | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setMessage("Enter a topic name.");
      return;
    }
    if (
      categories.some(
        (c) =>
          c.id !== editing?.id &&
          c.name.trim().toLocaleLowerCase("de") ===
            trimmed.toLocaleLowerCase("de"),
      )
    ) {
      setMessage("This topic already exists.");
      return;
    }
    if (
      await onChange({
        type: "category.save",
        value: {
          ...(editing || metadata()),
          name: trimmed,
          updatedAt: new Date().toISOString(),
        },
      })
    ) {
      setEditing(null);
      setName("");
      setMessage("");
    }
  }
  return (
    <section className="panel" aria-label="Project topics">
      <h2>Project topics</h2>
      <p className="description">
        Assign one topic to each project. Event types are managed separately.
      </p>
      <form className="editor" onSubmit={save}>
        <label className="field">
          Topic name
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setMessage("");
            }}
          />
        </label>
        <div className="actions">
          <button className="button" disabled={busy}>
            {editing ? "Save topic" : "Add topic"}
          </button>
          {editing && (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setEditing(null);
                setName("");
                setMessage("");
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {message && <p role="status">{message}</p>}
      </form>
      {!categories.length && (
        <p className="muted">
          No project topics yet. Projects can also be managed without a topic.
        </p>
      )}
      <ul className="links-list">
        {categories.map((c) => {
          const count = projects.filter((p) => p.categoryId === c.id).length;
          return (
            <li key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <small>{count} projects</small>
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(c);
                    setName(c.name);
                    setMessage("");
                  }}
                >
                  Rename
                </button>
                <button
                  className="icon-button danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      confirm(
                        `Delete topic "${c.name}"? ${count} projects will have no topic. Projects and their contents are retained.`,
                      )
                    ) {
                      if (
                        (await onChange({
                          type: "category.delete",
                          id: c.id,
                        })) &&
                        editing?.id === c.id
                      ) {
                        setEditing(null);
                        setName("");
                        setMessage("");
                      }
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
