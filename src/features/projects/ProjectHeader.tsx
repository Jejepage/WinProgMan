import { useState } from "react";
import {
  metadata,
  type DomainChange,
  type Link,
  type Project,
} from "../../domain/types";
interface Props {
  project: Project;
  links: Link[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}
export function ProjectHeader({ project, links, busy, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [linkEditor, setLinkEditor] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (
      await onChange({
        type: "project.save",
        value: {
          ...project,
          name: name.trim() || "Neues Projekt",
          description,
          updatedAt: new Date().toISOString(),
        },
      })
    )
      setEditing(false);
  }
  function editLink(value?: Link) {
    setLink(value || null);
    setLabel(value?.label || "");
    setTarget(value?.target || "");
    setMessage("");
    setLinkEditor(true);
  }
  async function saveLink(e: React.FormEvent) {
    e.preventDefault();
    if (!target.trim()) {
      setMessage("Bitte ein Ziel eintragen.");
      return;
    }
    if (
      await onChange({
        type: "link.save",
        value: {
          ...(link || metadata()),
          projectId: project.id,
          label: label.trim() || target.trim(),
          target: target.trim(),
          updatedAt: new Date().toISOString(),
        },
      })
    )
      setLinkEditor(false);
  }
  return (
    <section className="project-header panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PROJEKT</p>
          <h1>{project.name}</h1>
          <p className="description">
            {project.description || "Platz für eine kurze Projektbeschreibung."}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setName(project.name);
            setDescription(project.description);
            setEditing(!editing);
          }}
        >
          Projekt bearbeiten
        </button>
      </div>
      {editing && (
        <form className="editor" onSubmit={save}>
          <label className="field">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            Kurzbeschreibung
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>
          <div className="actions">
            <button className="button" disabled={busy}>
              Speichern
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(false)}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
      <div className="links-heading">
        <h2>Links & Ablagen</h2>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => editLink()}
        >
          + Link hinzufügen
        </button>
      </div>
      <ul className="links-list">
        {links.map((l) => (
          <li key={l.id}>
            <div>
              {/^(https?:\/\/|mailto:|tel:)/i.test(l.target) ? (
                <a href={l.target} target="_blank" rel="noreferrer">
                  {l.label} ↗
                </a>
              ) : (
                <strong>{l.label}</strong>
              )}
              <small>{l.target}</small>
            </div>
            <div className="row-actions">
              <button
                className="icon-button"
                onClick={() =>
                  void navigator.clipboard.writeText(l.target).then(
                    () => setMessage("Ziel kopiert."),
                    () =>
                      setMessage(
                        "Kopieren nicht möglich. Bitte den angezeigten Pfad markieren.",
                      ),
                  )
                }
              >
                Kopieren
              </button>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => editLink(l)}
              >
                Bearbeiten
              </button>
              <button
                className="icon-button danger"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Link „${l.label}“ löschen?`))
                    void onChange({ type: "link.delete", id: l.id });
                }}
              >
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!links.length && (
        <p className="muted">
          Ordner, Dokumente oder Teams direkt am Projekt ablegen.
        </p>
      )}
      {linkEditor && (
        <form className="editor" onSubmit={saveLink}>
          <div className="form-grid">
            <label className="field">
              Anzeigename
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              URL oder Pfad
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="https://… oder Laufwerkspfad"
              />
            </label>
          </div>
          <div className="actions">
            <button className="button" disabled={busy}>
              Link speichern
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setLinkEditor(false)}
            >
              Abbrechen
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
