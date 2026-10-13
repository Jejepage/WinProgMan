import { useState } from "react";
import {
  metadata,
  type DomainChange,
  type Project,
  type ProjectEvent,
  type Todo,
} from "../../domain/types";
import { formatDate } from "../../domain/queries";
import { eventCategoryLabels } from "../../ui/labels";
import { MarkdownNote } from "./MarkdownNote";

/** Shared expanded event body in both list and timeline views. */
export function EventDetails({
  event,
  project,
  todos,
  busy,
  onChange,
  onFocus,
}: {
  event: ProjectEvent;
  project?: Project;
  todos: Todo[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onFocus?: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState("");
  const related = todos.filter(
    (todo) => todo.projectId === event.projectId && todo.eventId === event.id,
  );
  const available = todos.filter(
    (todo) => todo.projectId === event.projectId && todo.eventId !== event.id,
  );
  async function saveTask(todo: Todo) {
    return onChange({
      type: "todo.save",
      value: { ...todo, updatedAt: new Date().toISOString() },
    });
  }
  return (
    <>
      <p className="muted">
        {eventCategoryLabels[event.category]} · {formatDate(event.date)}
        {event.time ? ` · ${event.time}` : ""}
        {project
          ? ` · ${project.projectNumber ? `PRJ-${String(project.projectNumber).padStart(3, "0")} · ` : ""}${project.name}`
          : ""}
      </p>
      {event.note ? (
        event.noteFormat === "markdown" ? (
          <MarkdownNote text={event.note} />
        ) : (
          <p
            className="event-note"
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
          >
            {event.note}
          </p>
        )
      ) : (
        <p className="muted">No note text.</p>
      )}
      <h3>Related tasks</h3>
      {related.length === 0 && <p className="muted">No related tasks yet.</p>}
      <ul className="item-list related-tasks">
        {related.map((todo) => (
          <li key={todo.id} className="actions">
            <label>
              <input
                type="checkbox"
                checked={todo.completed}
                disabled={busy}
                aria-label={`${todo.title} completed`}
                onChange={() => {
                  const value = { ...todo, completed: !todo.completed };
                  if (value.completed) delete value.doNext;
                  void saveTask(value);
                }}
              />{" "}
              {todo.title}
            </label>
            {!todo.completed && onFocus && (
              <button className="text-button" onClick={() => onFocus(todo.id)}>
                Focus
              </button>
            )}
            <button
              className="text-button"
              disabled={busy}
              aria-label={`Unlink ${todo.title}`}
              onClick={() => {
                const value = { ...todo };
                delete value.eventId;
                void saveTask(value);
              }}
            >
              Unlink
            </button>
          </li>
        ))}
      </ul>
      <form
        className="actions"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !title.trim()) return;
          if (
            await saveTask({
              ...metadata(),
              title: title.trim(),
              completed: false,
              projectId: event.projectId,
              eventId: event.id,
            })
          )
            setTitle("");
        }}
      >
        <label className="field">
          New related task
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Next step from this event"
          />
        </label>
        <button className="button secondary" disabled={busy || !title.trim()}>
          Add related task
        </button>
      </form>
      {available.length > 0 && (
        <form
          className="actions"
          onSubmit={async (e) => {
            e.preventDefault();
            const todo = available.find((item) => item.id === selected);
            if (!todo || busy) return;
            if (await saveTask({ ...todo, eventId: event.id })) setSelected("");
          }}
        >
          <label className="field">
            Existing task
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Choose task</option>
              {available.map((todo) => (
                <option key={todo.id} value={todo.id}>
                  {todo.title}
                  {todo.eventId ? " (relink from another event)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="button secondary" disabled={busy || !selected}>
            Link task
          </button>
        </form>
      )}
    </>
  );
}
