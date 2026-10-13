import { useId, useState, type FormEvent } from "react";
import {
  categories,
  metadata,
  type Category,
  type DomainChange,
  type Project,
  type ProjectEvent,
} from "../../domain/types";
import { formatDate, sortEvents } from "../../domain/queries";

interface Props {
  events: ProjectEvent[];
  projects: Project[];
  projectId?: string;
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
  projects,
  projectId,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
  const prefix = useId();
  const [category, setCategory] = useState<Category | "">("");
  const [timeline, setTimeline] = useState(false);
  const [editor, setEditor] = useState<{
    original?: ProjectEvent;
    draft: Draft;
  } | null>(null);
  const [deleting, setDeleting] = useState<ProjectEvent | null>(null);
  const visible = sortEvents(
    events.filter(
      (event) =>
        (!projectId || event.projectId === projectId) &&
        (!category || event.category === category),
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
        category: event?.category ?? "Meeting",
        title: event?.title ?? "",
        date: event?.date ?? today,
        time: event?.time ?? "",
        note: event?.note ?? "",
      },
    });
  }

  async function save(submit: FormEvent) {
    submit.preventDefault();
    if (!editor || busy || !editor.draft.projectId) return;
    const { draft, original } = editor;
    const value: ProjectEvent = {
      ...(original ?? metadata()),
      updatedAt: new Date().toISOString(),
      projectId: draft.projectId,
      category: draft.category,
      title: draft.title.trim() || "Unbenanntes Ereignis",
      date:
        !original && draft.category === "Notiz" ? today : draft.date || today,
      ...(draft.time ? { time: draft.time } : {}),
      ...(draft.note ? { note: draft.note } : {}),
    };
    // Explicitly remove optional fields when the user clears them while editing.
    if (!draft.time) delete value.time;
    if (!draft.note) delete value.note;
    if (await onChange({ type: "event.save", value })) setEditor(null);
  }

  function renderEvent(event: ProjectEvent) {
    const project = projects.find((item) => item.id === event.projectId);
    return (
      <li key={event.id} className="event-item">
        <div className="section-heading">
          <div>
            <span className="category">{event.category}</span>
            <h3>{event.title}</h3>
          </div>
          <div className="actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => begin(event)}
              aria-label={`Ereignis ${event.title} bearbeiten`}
            >
              Bearbeiten
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                setEditor(null);
                setDeleting(event);
              }}
              aria-label={`Ereignis ${event.title} löschen`}
            >
              Löschen
            </button>
          </div>
        </div>
        <p className="muted">
          <time
            dateTime={event.time ? `${event.date}T${event.time}` : event.date}
          >
            {formatDate(event.date)}
            {event.time ? ` · ${event.time} Uhr` : ""}
          </time>
        </p>
        {!projectId && project && (
          <button
            className="button secondary"
            onClick={() => onProject(project.id)}
          >
            {project.name}
          </button>
        )}
        {event.note && (
          <p
            className="event-note"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {event.note}
          </p>
        )}
      </li>
    );
  }

  const marker = (
    <li
      key="today-marker"
      className="today-marker"
      aria-label={`Heute, ${formatDate(today)}`}
    >
      Heute · {formatDate(today)}
    </li>
  );
  const past = visible.filter((event) => event.date < today);
  const future = visible.filter((event) => event.date >= today);

  return (
    <section className="panel" aria-label="Ereignisse">
      <div className="section-heading">
        <h2>
          Ereignisse <span className="muted">({visible.length})</span>
        </h2>
        <button
          className="button"
          disabled={busy || projects.length === 0}
          onClick={() => begin()}
        >
          Ereignis hinzufügen
        </button>
      </div>
      <div className="actions">
        <label className="field" htmlFor={`${prefix}-filter`}>
          Kategorie
          <select
            id={`${prefix}-filter`}
            aria-label="Kategorie"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as Category | "")
            }
          >
            <option value="">Alle Kategorien</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {projectId && (
          <div className="actions" aria-label="Ereignisdarstellung">
            <button
              className={`button ${timeline ? "secondary" : ""}`}
              aria-pressed={!timeline}
              onClick={() => setTimeline(false)}
            >
              Liste
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
      </div>
      {projects.length === 0 && (
        <p className="empty">
          Lege zuerst ein Projekt für deine Ereignisse an.
        </p>
      )}
      {editor && (
        <form className="event-editor" onSubmit={save}>
          <h3>{editor.original ? "Ereignis bearbeiten" : "Neues Ereignis"}</h3>
          <div className="form-grid">
            {!projectId && (
              <label className="field" htmlFor={`${prefix}-project`}>
                Projekt
                <select
                  id={`${prefix}-project`}
                  aria-label="Projekt"
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
            <label className="field" htmlFor={`${prefix}-category`}>
              Kategorie
              <select
                id={`${prefix}-category`}
                aria-label="Kategorie"
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
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="field" htmlFor={`${prefix}-title`}>
              Titel
              <input
                id={`${prefix}-title`}
                autoFocus
                value={editor.draft.title}
                placeholder="Unbenanntes Ereignis"
                disabled={busy}
                onChange={(event) => patch({ title: event.target.value })}
              />
            </label>
            <label className="field" htmlFor={`${prefix}-date`}>
              Datum
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
              Uhrzeit (optional)
              <input
                id={`${prefix}-time`}
                type="time"
                value={editor.draft.time}
                disabled={busy}
                onChange={(event) => patch({ time: event.target.value })}
              />
            </label>
          </div>
          <label className="field" htmlFor={`${prefix}-note`}>
            Notiztext (optional)
            <textarea
              id={`${prefix}-note`}
              rows={5}
              value={editor.draft.note}
              disabled={busy}
              onChange={(event) => patch({ note: event.target.value })}
            />
          </label>
          {!editor.original && editor.draft.category === "Notiz" && (
            <p className="muted">
              Neue Notizen erhalten automatisch das heutige Datum.
            </p>
          )}
          <div className="actions">
            <button className="button" disabled={busy}>
              Speichern
            </button>
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => setEditor(null)}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
      {deleting && (
        <div className="delete-confirm" role="alert">
          <p>Ereignis „{deleting.title}“ löschen?</p>
          <div className="actions">
            <button
              className="button danger"
              disabled={busy}
              onClick={async () => {
                if (await onChange({ type: "event.delete", id: deleting.id }))
                  setDeleting(null);
              }}
            >
              Endgültig löschen
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {visible.length === 0 && (
        <p className="empty">
          {category
            ? `Keine Ereignisse der Kategorie ${category}.`
            : "Noch keine Ereignisse."}
        </p>
      )}
      <ul
        className={projectId && timeline ? "item-list timeline" : "item-list"}
      >
        {projectId && timeline ? (
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
