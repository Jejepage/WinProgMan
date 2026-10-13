import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  categories,
  metadata,
  type Category,
  type DomainChange,
  type Project,
  type ProjectEvent,
  type Todo,
} from "../../domain/types";
import { formatDate, sortEvents } from "../../domain/queries";
import { MarkdownEditor } from "./MarkdownEditor";
import { EventDetails } from "./EventDetails";
import { Dialog, ConflictNotice } from "../../ui/dialogs";
import { legacyNoteToMarkdown } from "./markdown";
import { SearchField } from "../../ui/components";
import { matchesSearch } from "../../domain/queries";

import { eventCategoryLabels as categoryLabels } from "../../ui/labels";

interface Props {
  events: ProjectEvent[];
  todos?: Todo[];
  onFocus?: (id: string) => void;
  selectedId?: string;
  onSelectedHandled?: () => void;
  projects: Project[];
  projectId?: string;
  showHeading?: boolean;
  headerTarget?: HTMLElement | null;
  search?: string;
  onSearchChange?: (value: string) => void;
  initialMode?: "list" | "timeline";
  notesOnly?: boolean;
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
  events,
  todos = [],
  onFocus,
  selectedId,
  onSelectedHandled,
  projects,
  projectId,
  showHeading = true,
  headerTarget,
  search = "",
  onSearchChange,
  initialMode = "list",
  notesOnly = false,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
  const prefix = useId();
  const [category, setCategory] = useState<Category | "">(
    notesOnly ? "Notiz" : "",
  );
  const [timeline, setTimeline] = useState(initialMode === "timeline");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<{
    original?: ProjectEvent;
    draft: Draft;
  } | null>(null);
  const handledSelection = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedId) {
      handledSelection.current = undefined;
      return;
    }
    if (
      handledSelection.current === selectedId ||
      !events.some((e) => e.id === selectedId)
    )
      return;
    handledSelection.current = selectedId;
    onSelectedHandled?.();
    setCategory("");
    setExpanded((current) => new Set([...current, selectedId]));
    requestAnimationFrame(() =>
      document
        .getElementById(`${prefix}-event-${selectedId}`)
        ?.scrollIntoView({ block: "center" }),
    );
  }, [selectedId, events, prefix]);
  const current = editor?.original
    ? events.find((e) => e.id === editor.original?.id)
    : undefined;
  const [deleting, setDeleting] = useState<ProjectEvent | null>(null);
  const visible = sortEvents(
    events.filter(
      (event) =>
        (!projectId || event.projectId === projectId) &&
        (!category || event.category === category) &&
        (!notesOnly || event.category === "Notiz") &&
        matchesSearch(
          search,
          event.title,
          event.note || "",
          projects.find((project) => project.id === event.projectId)?.name ||
            "",
        ),
    ),
  );
  const patch = (change: Partial<Draft>) =>
    setEditor((current) =>
      current
        ? { ...current, draft: { ...current.draft, ...change } }
        : current,
    );

  function begin(event?: ProjectEvent) {
    setDeleting(null);
    setEditor({
      original: event,
      draft: {
        projectId: event?.projectId ?? projectId ?? projects[0]?.id ?? "",
        category: event?.category ?? (notesOnly ? "Notiz" : "Meeting"),
        title: event?.title ?? "",
        date: event?.date ?? today,
        time: event?.time ?? "",
        note: event?.note
          ? event.noteFormat === "markdown"
            ? event.note
            : legacyNoteToMarkdown(event.note)
          : "",
      },
    });
  }

  async function save(submit?: FormEvent, overwrite = false) {
    submit?.preventDefault();
    if (!editor || busy || !editor.draft.projectId) return;
    const { draft, original } = editor;
    const value: ProjectEvent = {
      ...(original ?? metadata()),
      updatedAt: new Date().toISOString(),
      projectId: draft.projectId,
      category: draft.category,
      title: draft.title.trim() || "Untitled event",
      date:
        !original && draft.category === "Notiz" ? today : draft.date || today,
      ...(draft.time ? { time: draft.time } : {}),
      ...(draft.note ? { note: draft.note } : {}),
    };
    // Explicitly remove optional fields when the user clears them while editing.
    if (!draft.time) delete value.time;
    if (!draft.note) delete value.note;
    // Other event edits do not change the bytes or interpretation of legacy notes.
    if (
      original?.note &&
      !original.noteFormat &&
      draft.note === legacyNoteToMarkdown(original.note)
    ) {
      value.note = original.note;
      delete value.noteFormat;
    } else if (draft.note) {
      value.noteFormat = "markdown";
    } else {
      delete value.noteFormat;
    }
    if (await onChange({ type: "event.save", value, overwrite }))
      setEditor(null);
  }

  function renderEvent(event: ProjectEvent) {
    const project = projects.find((item) => item.id === event.projectId);
    const isExpanded = expanded.has(event.id);
    const noteId = `${prefix}-note-${event.id}`;
    const phase =
      event.date < today ? "Past" : event.date === today ? "Today" : "Upcoming";
    return (
      <li
        key={event.id}
        id={`${prefix}-event-${event.id}`}
        className={`event-item ${isExpanded ? "is-expanded" : ""} ${event.date < today ? "is-past" : "is-upcoming"}`}
      >
        <div className="event-row">
          <button
            type="button"
            className="event-date event-date-button"
            disabled={busy}
            aria-label={`Open event ${event.title}`}
            onClick={() => begin(event)}
          >
            <time
              dateTime={event.time ? `${event.date}T${event.time}` : event.date}
            >
              {formatDate(event.date)}
              {event.time ? ` · ${event.time}` : ""}
            </time>
          </button>
          <span className="event-phase">{phase}</span>
          <span className="category">{categoryLabels[event.category]}</span>
          {
            <button
              className="event-title"
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
              {event.title}
            </button>
          }
          {!projectId && project && (
            <button
              className="project-link"
              onClick={() => onProject(project.id)}
            >
              {project.name}
            </button>
          )}
          <div className="actions event-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => begin(event)}
              aria-label={`Edit event ${event.title}`}
            >
              Edit
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setDeleting(event);
              }}
              aria-label={`Delete event ${event.title}`}
            >
              Delete
            </button>
          </div>
        </div>
        {isExpanded && (
          <div id={noteId} className="event-details">
            <EventDetails
              event={event}
              project={project}
              todos={todos}
              busy={busy}
              onChange={onChange}
              onFocus={onFocus}
            />
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
      onClick={() => begin()}
    >
      {notesOnly ? "Add note" : "Add event"}
    </button>
  );
  return (
    <section
      className="panel events-panel"
      aria-label={notesOnly ? "Notes" : "Events"}
    >
      <div
        className={`section-heading ${!showHeading && headerTarget ? "empty-heading" : ""}`}
      >
        {showHeading ? (
          <h2>
            {notesOnly ? "Notes" : "Events"}{" "}
            <span className="muted">({visible.length})</span>
          </h2>
        ) : null}
        {headerTarget ? createPortal(addButton, headerTarget) : addButton}
      </div>
      <div className="actions event-filters">
        {!notesOnly && (
          <label className="field" htmlFor={`${prefix}-filter`}>
            Category
            <select
              id={`${prefix}-filter`}
              aria-label="Category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as Category | "")
              }
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {categoryLabels[item]}
                </option>
              ))}
            </select>
          </label>
        )}
        {
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
        }
        {!showHeading && (
          <span className="muted filter-count">{visible.length} entries</span>
        )}
        {onSearchChange && (
          <SearchField
            label="Search events"
            value={search}
            onChange={onSearchChange}
          />
        )}
      </div>
      {projects.length === 0 && (
        <p className="empty">Create a project to add events.</p>
      )}
      {editor && (
        <Dialog
          title={editor.original ? "Edit event" : "New event"}
          onClose={() => setEditor(null)}
        >
          <form className="event-editor" onSubmit={save}>
            <ConflictNotice
              original={editor.original}
              current={current}
              onReload={() => (current ? begin(current) : setEditor(null))}
              onOverwrite={() => void save(undefined, true)}
            />
            <div className="form-grid">
              {!projectId && (
                <label className="field" htmlFor={`${prefix}-project`}>
                  Project
                  <select
                    id={`${prefix}-project`}
                    aria-label="Project"
                    value={editor.draft.projectId}
                    disabled={busy}
                    onChange={(event) =>
                      patch({ projectId: event.target.value })
                    }
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field" htmlFor={`${prefix}-category`}>
                Category
                <select
                  id={`${prefix}-category`}
                  aria-label="Category"
                  value={editor.draft.category}
                  disabled={busy}
                  onChange={(event) =>
                    patch({
                      category: event.target.value as Category,
                      ...(!editor.original && event.target.value === "Notiz"
                        ? { date: today }
                        : {}),
                    })
                  }
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {categoryLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor={`${prefix}-title`}>
                Title
                <input
                  id={`${prefix}-title`}
                  autoFocus
                  value={editor.draft.title}
                  placeholder="Untitled event"
                  disabled={busy}
                  onChange={(event) => patch({ title: event.target.value })}
                />
              </label>
              <label className="field" htmlFor={`${prefix}-date`}>
                Date
                <input
                  id={`${prefix}-date`}
                  type="date"
                  value={
                    !editor.original && editor.draft.category === "Notiz"
                      ? today
                      : editor.draft.date
                  }
                  disabled={
                    busy ||
                    (!editor.original && editor.draft.category === "Notiz")
                  }
                  onChange={(event) => patch({ date: event.target.value })}
                />
              </label>
              <label className="field" htmlFor={`${prefix}-time`}>
                Time (optional)
                <input
                  id={`${prefix}-time`}
                  type="time"
                  value={editor.draft.time}
                  disabled={busy}
                  onChange={(event) => patch({ time: event.target.value })}
                />
              </label>
            </div>
            <MarkdownEditor
              key={editor.original?.id || "new"}
              id={`${prefix}-note`}
              value={editor.draft.note}
              disabled={busy}
              onChange={(note) => patch({ note })}
            />
            {!editor.original && editor.draft.category === "Notiz" && (
              <p className="muted">New notes automatically use today’s date.</p>
            )}
            <div className="actions">
              <button className="button" disabled={busy}>
                Save
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {deleting && (
        <Dialog title="Delete event" onClose={() => setDeleting(null)}>
          <div className="delete-confirm">
            <p>Delete event “{deleting.title}”?</p>
            <div className="actions">
              <button
                className="button danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    await onChange({
                      type: "event.delete",
                      id: deleting.id,
                      expectedRevision: deleting.revision,
                    })
                  )
                    setDeleting(null);
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
        </Dialog>
      )}
      {visible.length === 0 && (
        <p className="empty">
          {search.trim()
            ? "No events match this search and filter."
            : category
              ? `No events in ${categoryLabels[category]}.`
              : "No events yet."}
        </p>
      )}
      <ul className={timeline ? "item-list timeline" : "item-list"}>
        {timeline ? (
          <>
            {past.map(renderEvent)}
            {marker}
            {future.map(renderEvent)}
          </>
        ) : (
          visible.map(renderEvent)
        )}
      </ul>
    </section>
  );
}
