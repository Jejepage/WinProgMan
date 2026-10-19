import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { openItem, openNewItem } from "../../ui/itemNavigation";
import { useId, useRef, useState, type FormEvent } from "react";
import {
  categories,
  metadata,
  type Category,
  type DomainChange,
  type Project,
  type ProjectEvent,
} from "../../domain/types";
import { formatDate, parseTime24, sortEvents } from "../../domain/queries";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { MarkdownNote } from "./MarkdownNote";
import { legacyNoteToMarkdown } from "./markdown";
import { SearchField } from "../../ui/components";
import { matchesSearch } from "../../domain/queries";

import { eventCategoryLabels as categoryLabels } from "../../ui/labels";

const eventCategories = categories.filter((category) => category !== "Notiz");

interface Props {
  initialEvent?: ProjectEvent;
  initialProjectId?: string;
  detailOnly?: boolean;
  onClose?: () => void;
  events: ProjectEvent[];
  projects: Project[];
  projectId?: string;
  showHeading?: boolean;
  headerTarget?: HTMLElement | null;
  search?: string;
  onSearchChange?: (value: string) => void;
  initialMode?: "list" | "timeline";
  notesOnly?: boolean;
  compactPreview?: boolean;
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onProject: (id: string) => void;
}

interface Draft {
  projectId: string;
  category: Category;
  title: string;
  date: string;
  time: string;
  note: string;
}

export function EventsPanel({
  initialEvent,
  initialProjectId,
  detailOnly = false,
  onClose,
  events,
  projects,
  projectId,
  showHeading = true,
  headerTarget,
  search = "",
  onSearchChange,
  initialMode = "list",
  notesOnly = false,
  compactPreview = false,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
  const prefix = useId();
  const noteEditor = useRef<MarkdownEditorHandle>(null);
  const [noteError, setNoteError] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [timeline, setTimeline] = useState(
    !notesOnly && initialMode === "timeline",
  );
  const itemKind = notesOnly ? "note" : "event";
  const itemLabel = notesOnly ? "note" : "event";
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [editor, setEditor] = useState<{
    original?: ProjectEvent;
    draft: Draft;
  } | null>(
    initialEvent || detailOnly
      ? {
          original: initialEvent,
          draft: {
            projectId:
              initialEvent?.projectId ||
              initialProjectId ||
              projectId ||
              projects[0]?.id ||
              "",
            category: notesOnly ? "Notiz" : initialEvent?.category || "Meeting",
            title: initialEvent?.title || "",
            date: initialEvent?.date || today,
            time: initialEvent?.time || "",
            note: initialEvent?.note
              ? initialEvent.noteFormat === "markdown"
                ? initialEvent.note
                : legacyNoteToMarkdown(initialEvent.note)
              : "",
          },
        }
      : null,
  );
  const [deleting, setDeleting] = useState<ProjectEvent | null>(null);
  const filtered = sortEvents(
    events.filter(
      (event) =>
        (!projectId || event.projectId === projectId) &&
        (!category || event.category === category) &&
        (notesOnly ? event.category === "Notiz" : event.category !== "Notiz") &&
        matchesSearch(
          search,
          event.title,
          projects.find((project) => project.id === event.projectId)?.name ||
            "",
        ),
    ),
  );
  const preview = compactPreview && !showAll && !timeline;
  const visible = preview
    ? notesOnly
      ? filtered.slice(0, 3)
      : // The nearest three upcoming events, still shown newest first.
        filtered
          .filter((event) => event.date >= today)
          .reverse()
          .slice(0, 3)
          .reverse()
    : filtered;
  const patch = (change: Partial<Draft>) =>
    setEditor((current) =>
      current
        ? { ...current, draft: { ...current.draft, ...change } }
        : current,
    );

  async function save(submit: FormEvent) {
    submit.preventDefault();
    if (!editor || busy || !editor.draft.projectId) return;
    const { original } = editor;
    let note: string;
    try {
      note = noteEditor.current?.read() ?? editor.draft.note;
    } catch (error) {
      setNoteError(
        error instanceof Error ? error.message : "Unable to read the note.",
      );
      return;
    }
    const time = notesOnly ? editor.draft.time : parseTime24(editor.draft.time);
    if (time === null) {
      setNoteError("Enter the time in 24-hour format, e.g. 14:30.");
      return;
    }
    setNoteError("");
    const draft = { ...editor.draft, note, time };
    const value: ProjectEvent = {
      ...(original ?? metadata()),
      updatedAt: new Date().toISOString(),
      projectId: draft.projectId,
      category: notesOnly ? "Notiz" : draft.category,
      title:
        draft.title.trim() || (notesOnly ? "Untitled note" : "Untitled event"),
      date: draft.date || today,
      ...(!notesOnly && draft.time ? { time: draft.time } : {}),
      ...(draft.note ? { note: draft.note } : {}),
    };
    // Explicitly remove optional fields when the user clears them while editing.
    // Notes do not expose time, but retain imported legacy times without data loss.
    if (!notesOnly && !draft.time) delete value.time;
    if (!draft.note) delete value.note;
    // Other event edits do not change the bytes or interpretation of legacy notes.
    if (
      original &&
      draft.note ===
        (original.noteFormat === "markdown"
          ? original.note || ""
          : legacyNoteToMarkdown(original.note || ""))
    ) {
      if (original.note !== undefined) value.note = original.note;
      else delete value.note;
      if (original.noteFormat) value.noteFormat = original.noteFormat;
      else delete value.noteFormat;
    } else if (draft.note) {
      value.noteFormat = "markdown";
    } else {
      delete value.noteFormat;
    }
    if (await onChange({ type: "event.save", value })) {
      if (detailOnly) {
        onClose?.();
      } else setEditor(null);
    }
  }

  function renderEvent(event: ProjectEvent) {
    const project = projects.find((item) => item.id === event.projectId);
    const isExpanded = expanded.has(event.id);
    const noteId = `${prefix}-note-${event.id}`;
    return (
      <li
        key={event.id}
        className={`event-item ${notesOnly ? "note-item" : event.date < today ? "is-past" : "is-upcoming"} ${isExpanded ? "is-expanded" : ""}`}
      >
        <div className="event-row">
          <button
            type="button"
            className="event-date event-date-button"
            disabled={busy}
            aria-label={`Open ${itemLabel} ${event.title}`}
            onClick={() => openItem(itemKind, event.id)}
          >
            <time
              dateTime={
                !notesOnly && event.time
                  ? `${event.date}T${event.time}`
                  : event.date
              }
            >
              {formatDate(event.date)}
              {!notesOnly && event.time ? ` · ${event.time}` : ""}
            </time>
          </button>
          <div className="event-title-group">
            <button
              className="event-title"
              disabled={busy}
              onClick={() => openItem(itemKind, event.id)}
            >
              {event.title}
            </button>
            {event.note ? (
              <>
                <button
                  className="text-button event-note-toggle"
                  aria-label={`Show note ${event.title}`}
                  aria-expanded={isExpanded}
                  aria-controls={noteId}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(event.id)) next.delete(event.id);
                      else next.add(event.id);
                      return next;
                    })
                  }
                >
                  <span aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>{" "}
                </button>
              </>
            ) : null}
          </div>
          {!notesOnly && (
            <span className="category" data-category={event.category}>
              {categoryLabels[event.category]}
            </span>
          )}
          {!projectId && project && (
            <button
              className="project-link"
              onClick={() => onProject(project.id)}
            >
              {project.name}
            </button>
          )}
        </div>
        {event.note && (
          <div id={noteId} className="event-details" hidden={!isExpanded}>
            {event.noteFormat === "markdown" ? (
              <MarkdownNote text={event.note} />
            ) : (
              <p
                className="event-note"
                style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {event.note}
              </p>
            )}
          </div>
        )}
      </li>
    );
  }

  const marker = (
    <li
      key="today-marker"
      className="today-marker"
      aria-label={`Today, ${formatDate(today)}`}
    >
      Today · {formatDate(today)}
    </li>
  );
  const past = visible.filter((event) => event.date < today);
  const future = visible.filter((event) => event.date >= today);

  const addButton = (
    <button
      className="button"
      disabled={busy || projects.length === 0}
      aria-label={notesOnly ? "Add note" : "Add event"}
      title={notesOnly ? "Add note" : "Add event"}
      onClick={() => openNewItem(itemKind, projectId)}
    >
      <Plus size={16} aria-hidden="true" />
    </button>
  );
  return (
    <section
      className={`panel events-panel${notesOnly ? " notes-panel" : ""}`}
      aria-label={notesOnly ? "Notes" : "Events"}
    >
      {!detailOnly && (
        <>
          <div
            className={`section-heading ${!showHeading && headerTarget ? "empty-heading" : ""}`}
          >
            {showHeading ? (
              <h2>
                {notesOnly ? "Notes" : preview ? "Upcoming events" : "Events"}{" "}
                <span className="muted">({visible.length})</span>
              </h2>
            ) : null}
            {headerTarget ? createPortal(addButton, headerTarget) : addButton}
          </div>
          <div className="actions event-filters">
            {compactPreview && (
              <button
                className="button secondary"
                aria-pressed={showAll || timeline}
                onClick={() => {
                  setShowAll(!(showAll || timeline));
                  setTimeline(false);
                }}
              >
                {showAll || timeline
                  ? notesOnly
                    ? "Recent notes"
                    : "Upcoming only"
                  : `All ${notesOnly ? "notes" : "events"} (${filtered.length})`}
              </button>
            )}
            {!notesOnly && (
              <label className="field" htmlFor={`${prefix}-filter`}>
                <span className="sr-only">Category</span>
                <select
                  id={`${prefix}-filter`}
                  aria-label="Category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as Category | "")
                  }
                >
                  <option value="">All categories</option>
                  {eventCategories.map((item) => (
                    <option key={item} value={item}>
                      {categoryLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!notesOnly && (
              <div className="actions" aria-label="Event view">
                <button
                  className={`button ${timeline ? "secondary" : ""}`}
                  aria-pressed={!timeline}
                  onClick={() => setTimeline(false)}
                >
                  List
                </button>
                <button
                  className={`button ${timeline ? "" : "secondary"}`}
                  aria-pressed={timeline}
                  onClick={() => setTimeline(true)}
                >
                  Timeline
                </button>
              </div>
            )}
            {!showHeading && (
              <span className="muted filter-count">
                {visible.length} entries
              </span>
            )}
            {onSearchChange && (
              <SearchField
                label={notesOnly ? "Search notes" : "Search events"}
                value={search}
                onChange={onSearchChange}
              />
            )}
          </div>
          {projects.length === 0 && (
            <p className="empty">
              Create a project to add {notesOnly ? "notes" : "events"}.
            </p>
          )}
        </>
      )}
      {editor && !deleting && (
        <form className="event-editor" onSubmit={save}>
          {!detailOnly && (
            <h3>
              {editor.original ? `Edit ${itemLabel}` : `New ${itemLabel}`}
            </h3>
          )}
          <div className="form-grid">
            {!projectId && (
              <label className="field" htmlFor={`${prefix}-project`}>
                Project
                <select
                  id={`${prefix}-project`}
                  aria-label="Project"
                  value={editor.draft.projectId}
                  disabled={busy}
                  onChange={(event) => patch({ projectId: event.target.value })}
                >
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!notesOnly && (
              <label className="field" htmlFor={`${prefix}-category`}>
                Category
                <select
                  id={`${prefix}-category`}
                  aria-label="Category"
                  value={editor.draft.category}
                  disabled={busy}
                  onChange={(event) =>
                    patch({ category: event.target.value as Category })
                  }
                >
                  {eventCategories.map((item) => (
                    <option key={item} value={item}>
                      {categoryLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field" htmlFor={`${prefix}-title`}>
              Title
              <input
                id={`${prefix}-title`}
                autoFocus
                value={editor.draft.title}
                placeholder={notesOnly ? "Untitled note" : "Untitled event"}
                disabled={busy}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </label>
            <label className="field" htmlFor={`${prefix}-date`}>
              Date
              <input
                id={`${prefix}-date`}
                type="date"
                value={editor.draft.date}
                disabled={busy}
                onChange={(event) => patch({ date: event.target.value })}
              />
            </label>
            {!notesOnly && (
              <label className="field" htmlFor={`${prefix}-time`}>
                Time (optional)
                <input
                  id={`${prefix}-time`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="HH:mm"
                  maxLength={5}
                  value={editor.draft.time}
                  disabled={busy}
                  onChange={(event) => patch({ time: event.target.value })}
                />
              </label>
            )}
          </div>
          <MarkdownEditor
            ref={noteEditor}
            key={editor.original?.id || "new"}
            id={`${prefix}-note`}
            value={editor.draft.note}
            disabled={busy}
          />
          {noteError && <p role="alert">{noteError}</p>}
          <div className="actions">
            <button className="button" disabled={busy}>
              Save
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => (detailOnly ? onClose?.() : setEditor(null))}
            >
              Cancel
            </button>
            {editor.original && (
              <button
                type="button"
                className="button danger"
                disabled={busy}
                aria-label={`Delete ${itemLabel} ${editor.original.title}`}
                onClick={() => {
                  try {
                    const note =
                      noteEditor.current?.read() ?? editor.draft.note;
                    patch({ note });
                    setDeleting(editor.original || null);
                  } catch (error) {
                    setNoteError(
                      error instanceof Error
                        ? error.message
                        : "Unable to read the note.",
                    );
                  }
                }}
              >
                Delete {itemLabel}
              </button>
            )}
          </div>
        </form>
      )}
      {deleting && (
        <div className="delete-confirm" role="alert">
          <p>
            Delete {itemLabel} “{deleting.title}”?
          </p>
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (await onChange({ type: "event.delete", id: deleting.id })) {
                  setDeleting(null);
                  setEditor(null);
                  if (detailOnly) onClose?.();
                }
              }}
            >
              Move to trash
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {!detailOnly && (
        <>
          {visible.length === 0 && (
            <p className="empty">
              {search.trim()
                ? `No ${notesOnly ? "notes" : "events"} match this search and filter.`
                : preview && !notesOnly
                  ? "No upcoming events. Open All events to see past entries."
                  : notesOnly
                    ? "No notes yet."
                    : category
                      ? `No events in ${categoryLabels[category]}.`
                      : "No events yet."}
              {!search.trim() &&
                !events.some(
                  (e) => (e.category === "Notiz") === Boolean(notesOnly),
                ) &&
                projects.length > 0 && (
                  <>
                    {" "}
                    <button
                      className="button secondary"
                      onClick={() => openNewItem(itemKind, projectId)}
                    >
                      {notesOnly
                        ? "Add your first note"
                        : "Add your first event"}
                    </button>
                  </>
                )}
            </p>
          )}
          <ul className={timeline ? "item-list timeline" : "item-list"}>
            {timeline ? (
              <>
                {future.map(renderEvent)}
                {marker}
                {past.map(renderEvent)}
              </>
            ) : (
              visible.map(renderEvent)
            )}
          </ul>
        </>
      )}
    </section>
  );
}
