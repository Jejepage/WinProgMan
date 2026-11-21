import { useId, useRef, useState } from "react";
import { useEditorShortcuts } from "../../ui/useEditorShortcuts";
import { Copy, Pencil, Plus, Save, Star, Trash2 } from "lucide-react";
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
import { ownerNames } from "../../domain/queries";
import {
  canonicalOwner,
  projectPeriod,
  type QuickProjectFields,
} from "../../domain/projectFields";
import { QuickDateField } from "../../ui/QuickDateField";
import { OwnerQuickSelect, StatusQuickSelect } from "./QuickFields";
import { OwnerSelect } from "./OwnerSelect";
interface Props {
  project: Project;
  projects: Project[];
  links: Link[];
  projectCategories: ProjectCategory[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onDelete: () => Promise<void>;
  /** Status/owner chosen directly outside the editor. */
  onQuickFields: (fields: QuickProjectFields) => void;
}
export function ProjectHeader({
  project,
  projects,
  links,
  projectCategories,
  busy,
  onChange,
  onDelete,
  onQuickFields,
}: Props) {
  const editorId = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [number, setNumber] = useState(String(project.number));
  const [numberError, setNumberError] = useState("");
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState<ProjectStatus>(project.status);
  const [categoryId, setCategoryId] = useState(project.categoryId || "");
  const [owner, setOwner] = useState(project.owner || "");
  const [startDate, setStartDate] = useState(project.startDate || "");
  const [endDate, setEndDate] = useState(project.endDate || "");
  const [linkEditor, setLinkEditor] = useState(false);
  const [link, setLink] = useState<Link | null>(null);
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("");
  const [message, setMessage] = useState("");
  const [draftLinks, setDraftLinks] = useState<Link[]>([]);
  const editorForm = useRef<HTMLFormElement>(null);
  useEditorShortcuts(editorForm, {
    active: editing,
    isDirty: () =>
      linkEditor ||
      name !== project.name ||
      number !== String(project.number) ||
      description !== project.description ||
      status !== project.status ||
      categoryId !== (project.categoryId || "") ||
      owner !== (project.owner || "") ||
      startDate !== (project.startDate || "") ||
      endDate !== (project.endDate || "") ||
      JSON.stringify(draftLinks) !== JSON.stringify(links),
    onCancel: () => {
      setEditing(false);
      setLinkEditor(false);
      setMessage("");
    },
  });
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
    // Reuse the spelling of a known name so the list stays free of duplicates.
    const ownerName = canonicalOwner(projects, owner);
    if (ownerName) value.owner = ownerName;
    else delete value.owner;
    if (startDate) value.startDate = startDate;
    else delete value.startDate;
    if (endDate) value.endDate = endDate;
    else delete value.endDate;
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
    if (!editing) {
      // Outside project editing the link is stored right away.
      void onChange({ type: "link.save", value }).then((ok) => {
        if (ok) {
          setLinkEditor(false);
          setMessage("");
        }
      });
      return;
    }
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
          <div className="project-title-row">
            <h1>{project.name}</h1>
            <button
              type="button"
              className={`star-button ${project.important ? "is-on" : ""}`}
              aria-pressed={!!project.important}
              aria-label={
                project.important
                  ? "Remove important mark"
                  : "Mark as important"
              }
              title={
                project.important
                  ? "Remove important mark"
                  : "Mark as important"
              }
              disabled={busy}
              onClick={() =>
                void onChange({
                  type: "project.save",
                  value: {
                    ...project,
                    important: !project.important,
                    updatedAt: new Date().toISOString(),
                  },
                })
              }
            >
              <Star size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="muted project-quick-meta">
            {editing ? (
              <StatusLabel data-status={project.status}>
                {projectStatusLabels[project.status]}
              </StatusLabel>
            ) : (
              <StatusQuickSelect
                value={project.status}
                projectName={project.name}
                disabled={busy}
                onSelect={(status) => onQuickFields({ status })}
              />
            )}
            <span>
              {projectCategories.find(
                (category) => category.id === project.categoryId,
              )?.name || "No topic"}
            </span>
            <span className="project-owner">
              Owner:{" "}
              {editing ? (
                project.owner || "not assigned"
              ) : (
                <OwnerQuickSelect
                  value={project.owner || ""}
                  names={ownerNames(projects)}
                  projectName={project.name}
                  disabled={busy}
                  onSelect={(owner) => onQuickFields({ owner })}
                />
              )}
            </span>
            {editing ? (
              projectPeriod(project) && <span>{projectPeriod(project)}</span>
            ) : (
              <>
                <span className="project-date">
                  Start:{" "}
                  <QuickDateField
                    value={project.startDate}
                    label={`Start date of ${project.name}`}
                    emptyTitle="Set start date"
                    disabled={busy}
                    onSelect={(startDate) => onQuickFields({ startDate })}
                  />
                </span>
                <span className="project-date">
                  End:{" "}
                  <QuickDateField
                    value={project.endDate}
                    label={`End date of ${project.name}`}
                    emptyTitle="Set end date"
                    disabled={busy}
                    onSelect={(endDate) => onQuickFields({ endDate })}
                  />
                </span>
              </>
            )}
          </div>
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
            setOwner(project.owner || "");
            setStartDate(project.startDate || "");
            setEndDate(project.endDate || "");
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
        <form ref={editorForm} id={editorId} className="editor" onSubmit={save}>
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
            <div className="field">
              Owner
              <OwnerSelect
                value={owner}
                names={ownerNames(projects)}
                onChange={setOwner}
              />
            </div>
            <label className="field">
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="field">
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
        <button
          className="text-button"
          disabled={busy}
          aria-label="Add link"
          title="Add link"
          onClick={() => editLink()}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
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
