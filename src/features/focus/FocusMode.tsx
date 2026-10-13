import type { AppData, DomainChange } from "../../domain/types";
import { formatDate, localToday, sortEvents } from "../../domain/queries";
import { projectReference, type OpenRecord } from "../../domain/workflows";
import { Dialog } from "../../ui/dialogs";
import { MarkdownNote } from "../events/MarkdownNote";

export function FocusMode({
  data,
  todoId,
  busy,
  onChange,
  onClose,
  onOpen,
}: {
  data: AppData;
  todoId: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onClose: () => void;
  onOpen: OpenRecord;
}) {
  const todo = data.todos.find((item) => item.id === todoId);
  const project = data.projects.find((item) => item.id === todo?.projectId);
  if (!todo || !project)
    return (
      <Dialog title="Focus mode" onClose={onClose}>
        <p className="empty">This task is no longer available.</p>
      </Dialog>
    );
  const linkedEvent = data.events.find(
    (event) => event.id === todo.eventId && event.projectId === project.id,
  );
  const recentEvents = sortEvents(
    data.events.filter(
      (event) =>
        event.projectId === project.id &&
        event.id !== linkedEvent?.id &&
        event.date <= localToday(),
    ),
  )
    .reverse()
    .slice(0, 3);
  const links = data.links.filter((link) => link.projectId === project.id);
  function open(type: Parameters<OpenRecord>[0], id: string) {
    onClose();
    onOpen(type, id, project!.id);
  }
  return (
    <Dialog title="Focus mode" onClose={onClose}>
      <div className="focus-task">
        <h2>{todo.title}</h2>
        <p className="muted">
          {todo.completed
            ? "Completed"
            : todo.dueDate
              ? `Due ${formatDate(todo.dueDate)}`
              : "No due date"}
          {todo.doNext && !todo.completed ? " · Do next" : ""}
        </p>
      </div>
      <section className="focus-context">
        <h3>Project context</h3>
        <strong>{projectReference(project)}</strong>
        {project.description && <p className="prose">{project.description}</p>}
      </section>
      {linkedEvent && (
        <section className="focus-related">
          <h3>Source event</h3>
          <button
            className="text-button"
            onClick={() => open("event", linkedEvent.id)}
          >
            {linkedEvent.title} · {formatDate(linkedEvent.date)}
          </button>
          {linkedEvent.note && (
            <details>
              <summary>Event notes</summary>
              {linkedEvent.noteFormat === "markdown" ? (
                <MarkdownNote text={linkedEvent.note} />
              ) : (
                <p className="plain-note">{linkedEvent.note}</p>
              )}
            </details>
          )}
        </section>
      )}
      {!!recentEvents.length && (
        <section className="focus-related">
          <h3>Recent project events</h3>
          {recentEvents.map((event) => (
            <p key={event.id}>
              <button
                className="text-button"
                onClick={() => open("event", event.id)}
              >
                {event.title}
              </button>
              <span className="muted"> · {formatDate(event.date)}</span>
            </p>
          ))}
        </section>
      )}
      {!!links.length && (
        <section className="focus-related">
          <h3>Project links</h3>
          {links.map((link) => (
            <p key={link.id}>
              <button
                className="text-button"
                onClick={() => open("link", link.id)}
              >
                {link.label || link.target}
              </button>
            </p>
          ))}
        </section>
      )}
      <div className="actions">
        <button
          className="button"
          disabled={busy || todo.completed}
          onClick={async () => {
            const value = {
              ...todo,
              completed: true,
              updatedAt: new Date().toISOString(),
            };
            delete value.doNext;
            if (await onChange({ type: "todo.save", value })) onClose();
          }}
        >
          {todo.completed ? "Completed" : "Mark completed"}
        </button>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => open("todo", todo.id)}
        >
          Edit task
        </button>
        <button
          className="button secondary"
          onClick={() => open("project", project.id)}
        >
          Open project
        </button>
        <button className="button secondary" onClick={onClose}>
          Close focus mode
        </button>
      </div>
    </Dialog>
  );
}
