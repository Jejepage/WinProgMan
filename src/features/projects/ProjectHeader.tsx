import { Dialog, ConflictNotice } from "../../ui/dialogs";
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
  deleted?: boolean;
  project: Project;
  links: Link[];
  projectCategories: ProjectCategory[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onDelete: () => Promise<void>;
}
export function ProjectHeader({
  deleted = false,
  project,
  links,
  projectCategories,
  busy,
  onChange,
  onDelete,
}: Props) {
  const [original, setOriginal] = useState(project);
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
  async function save(e?: React.FormEvent, overwrite = false) {
    e?.preventDefault();
    if (busy) return;
    const value: Project = {
      ...original,
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
        overwrite,
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
  async function saveLink(e?: React.FormEvent, overwrite = false) {
    e?.preventDefault();
    if (busy) return;
    if (!target.trim()) {
      setMessage("Enter a link destination.");
      return;
    }
    if (
      await onChange({
        type: "link.save",
        overwrite,
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
          <p className="eyebrow">
            {project.projectNumber
              ? `PRJ-${String(project.projectNumber).padStart(3, "0")}`
              : "PROJECT"}
          </p>
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
            setOriginal(project);
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
        <Dialog title="Edit project" onClose={() => setEditing(false)}>
          <form className="editor" onSubmit={save}>
            <ConflictNotice
              original={original}
              current={deleted ? undefined : project}
              onReload={() => {
                if (deleted) {
                  setEditing(false);
                  return;
                }
                setOriginal(project);
                setName(project.name);
                setDescription(project.description);
                setStatus(project.status);
                setCategoryId(project.categoryId || "");
              }}
              onOverwrite={() => void save(undefined, true)}
            />
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
              <button
                type="button"
                className="button danger project-delete"
                disabled={busy}
                onClick={() => void onDelete()}
              >
                Delete project
              </button>
            </div>
          </form>
        </Dialog>
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
                    void onChange({
                      type: "link.delete",
                      id: l.id,
                      expectedRevision: l.revision,
                    });
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
        <Dialog
          title={link ? "Edit link" : "Add link"}
          onClose={() => setLinkEditor(false)}
        >
          <form className="editor" onSubmit={saveLink}>
            <ConflictNotice
              original={link || undefined}
              current={
                link ? links.find((item) => item.id === link.id) : undefined
              }
              onReload={() => {
                const current = links.find((item) => item.id === link?.id);
                if (current) editLink(current);
                else setLinkEditor(false);
              }}
              onOverwrite={() => void saveLink(undefined, true)}
            />
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
            {message && <p role="status">{message}</p>}
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
        </Dialog>
      )}
      {message && !linkEditor && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </section>
  );
}
