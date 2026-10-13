import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { projectStatusLabels } from "../../ui/labels";
import {
  metadata,
  projectStatuses,
  type DomainChange,
  type Link,
  type Project,
  type ProjectCategory,
  type ProjectStatus,
} from "../../domain/types";
import { normalizeLinkTarget } from "../../domain/links";
interface Props {
  project: Project;
  links: Link[];
  projectCategories: ProjectCategory[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}
export function ProjectHeader({
  project,
  links,
  projectCategories,
  busy,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [categoryId, setCategoryId] = useState(project.categoryId || "");
  const [linkEditor, setLinkEditor] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value: Project = {
      ...project,
      name: name.trim() || "New project",
      description,
      status,
      updatedAt: new Date().toISOString(),
    };
    if (categoryId) value.categoryId = categoryId;
    else delete value.categoryId;
    if (
      await onChange({
        type: "project.save",
        value,
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
      setMessage("Enter a link destination.");
      return;
    }
    if (
      await onChange({
        type: "link.save",
        value: {
          ...(link || metadata()),
          projectId: project.id,
          label: label.trim() || target.trim(),
          target: normalizeLinkTarget(target),
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
          <p className="eyebrow">PROJECT</p>
          <h1>{project.name}</h1>
          <p className="muted">
            {projectStatusLabels[project.status]} ·{" "}
            {projectCategories.find(
              (category) => category.id === project.categoryId,
            )?.name || "No topic"}
          </p>
          <p className="description">
            {project.description || "Add a short project description."}
          </p>
        </div>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => {
            setName(project.name);
            setDescription(project.description);
            setStatus(project.status);
            setCategoryId(project.categoryId || "");
            setEditing(!editing);
          }}
        >
          <Pencil size={14} aria-hidden="true" /> Edit project
        </button>
      </div>
      {editing && (
        <form className="editor" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              >
                {projectStatuses.map((value) => (
                  <option key={value} value={value}>
                    {projectStatusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Topic
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">No topic</option>
                {projectCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="field">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </label>
          <div className="actions">
            <button className="button" disabled={busy}>
              Save
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="links-heading">
        <h2>Links & resources</h2>
        <button
          className="text-button"
          disabled={busy}
          onClick={() => editLink()}
        >
          <Plus size={14} aria-hidden="true" /> Add link
        </button>
      </div>
      <ul className="links-list">
        {links.map((l) => (
          <li key={l.id}>
            <div>
              {/^(https?:\/\/|mailto:|tel:)/i.test(
                normalizeLinkTarget(l.target),
              ) ? (
                <a
                  href={normalizeLinkTarget(l.target)}
                  target="_blank"
                  rel="noreferrer"
                >
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
                    () => setMessage("Destination copied."),
                    () =>
                      setMessage(
                        "Unable to copy. Select the displayed path to copy it manually.",
                      ),
                  )
                }
              >
                <Copy size={14} aria-hidden="true" /> Copy
              </button>
              <button
                className="icon-button"
                disabled={busy}
                onClick={() => editLink(l)}
              >
                <Pencil size={14} aria-hidden="true" /> Edit
              </button>
              <button
                className="icon-button danger"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Delete link "${l.label}"?`))
                    void onChange({ type: "link.delete", id: l.id });
                }}
              >
                <Trash2 size={14} aria-hidden="true" /> Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!links.length && (
        <p className="muted">
          <Plus size={14} aria-hidden="true" /> Add links to folders, documents
          or websites.
        </p>
      )}
      {linkEditor && (
        <form className="editor" onSubmit={saveLink}>
          <div className="form-grid">
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
          </div>
          <div className="actions">
            <button className="button" disabled={busy}>
              Save link
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setLinkEditor(false)}
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
