import { useId, useState } from "react";
import { Copy, Pencil, Plus, Save, Trash2 } from "lucide-react";
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
import { classifyLinkTarget, normalizeLinkTarget } from "../../domain/links";
import { confirmAction } from "../../platform/desktop";
import { ProjectLink } from "../../ui/ProjectLink";
import { StatusLabel } from "../../ui/components";
interface Props {
  project: Project;
  projects: Project[];
  links: Link[];
  projectCategories: ProjectCategory[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onDelete: () => Promise<void>;
}
export function ProjectHeader({
  project,
  projects,
  links,
  projectCategories,
  busy,
  onChange,
  onDelete,
}: Props) {
  const editorId = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [number, setNumber] = useState(String(project.number));
  const [numberError, setNumberError] = useState("");
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [categoryId, setCategoryId] = useState(project.categoryId || "");
  const [linkEditor, setLinkEditor] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [draftLinks, setDraftLinks] = useState<Link[]>([]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsedNumber = Number(number);
    if (
      !/^\d+$/.test(number) ||
      !Number.isSafeInteger(parsedNumber) ||
      parsedNumber < 0
    ) {
      setNumberError("Enter a whole project number (0 or higher).");
      return;
    }
    if (
      projects.some(
        (item) => item.id !== project.id && item.number === parsedNumber,
      )
    ) {
      setNumberError(`Project number ${parsedNumber} is already in use.`);
      return;
    }
    setNumberError("");
    if (linkEditor) {
      setMessage("Save or cancel the link draft before saving the project.");
      return;
    }
    const value: Project = {
      ...project,
      number: parsedNumber,
      name: name.trim() || "New project",
      description,
      status,
      updatedAt: new Date().toISOString(),
    };
    if (categoryId) value.categoryId = categoryId;
    else delete value.categoryId;
    if (
      await onChange({
        type: "project.saveWithLinks",
        value,
        links: draftLinks,
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
  function saveLink(e: React.FormEvent) {
    e.preventDefault();
    if (classifyLinkTarget(target).kind === "unknown") {
      setMessage("Enter a website address or an absolute Windows folder path.");
      return;
    }
    const value: Link = {
      ...(link || metadata()),
      projectId: project.id,
      label: label.trim() || target.trim(),
      target: normalizeLinkTarget(target),
      updatedAt: new Date().toISOString(),
    };
    setDraftLinks((current) =>
      link
        ? current.map((item) => (item.id === link.id ? value : item))
        : [...current, value],
    );
    setLinkEditor(false);
    setMessage("");
  }
  return (
    <section className="project-header panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            <span className="classic-only">PROJECT</span>
            <span className="split-only">PROJECT FILE</span>
          </p>
          <div className="split-only project-file-number">
            {String(project.number).padStart(3, "0")}
          </div>
          <h1>{project.name}</h1>
          <p className="muted">
            <StatusLabel data-status={project.status}>
              {projectStatusLabels[project.status]}
            </StatusLabel>{" "}
            ·{" "}
            {projectCategories.find(
              (category) => category.id === project.categoryId,
            )?.name || "No topic"}
          </p>
          <p className="description">
            {project.description || "Add a short project description."}
          </p>
        </div>
        <button
          className={editing ? "button" : "button secondary"}
          type={editing ? "submit" : "button"}
          form={editing ? editorId : undefined}
          disabled={busy}
          onClick={(event) => {
            if (editing) return;
            event.preventDefault();
            setName(project.name);
            setNumber(String(project.number));
            setNumberError("");
            setDescription(project.description);
            setStatus(project.status);
            setCategoryId(project.categoryId || "");
            setDraftLinks(links.map((item) => ({ ...item })));
            setLinkEditor(false);
            setMessage("");
            setEditing(true);
          }}
        >
          {editing ? (
            <>
              <Save size={14} aria-hidden="true" /> Save
            </>
          ) : (
            <>
              <Pencil size={14} aria-hidden="true" /> Edit project
            </>
          )}
        </button>
      </div>
      {editing && (
        <form id={editorId} className="editor" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              Project number
              <input
                inputMode="numeric"
                aria-label="Project number"
                value={number}
                aria-invalid={!!numberError}
                aria-describedby={
                  numberError ? `${editorId}-number-error` : undefined
                }
                onChange={(event) => {
                  setNumber(event.target.value);
                  setNumberError("");
                }}
              />
              {numberError && (
                <span id={`${editorId}-number-error`} role="alert">
                  {numberError}
                </span>
              )}
            </label>
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
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setLinkEditor(false);
                setMessage("");
              }}
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
      )}
      <div className="links-heading">
        <h2>Links & resources</h2>
        {editing && (
          <button
            className="text-button"
            disabled={busy}
            aria-label="Add link"
            title="Add link"
            onClick={() => editLink()}
          >
            <Plus size={14} aria-hidden="true" />
          </button>
        )}
      </div>
      <ul className={`links-list ${editing ? "" : "project-links-display"}`}>
        {(editing ? draftLinks : links).map((l) => (
          <li key={l.id}>
            <div>
              <ProjectLink link={l} />
            </div>
            {editing && (
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
                  onClick={async () => {
                    if (await confirmAction(`Delete link "${l.label}"?`)) {
                      setDraftLinks((current) =>
                        current.filter((item) => item.id !== l.id),
                      );
                      if (link?.id === l.id) setLinkEditor(false);
                    }
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" /> Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!(editing ? draftLinks : links).length && (
        <p className="muted">
          {editing ? "Add links to folders or websites." : "No links yet."}
        </p>
      )}
      {editing && linkEditor && (
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
