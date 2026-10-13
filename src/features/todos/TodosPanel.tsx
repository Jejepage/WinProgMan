import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Dialog, ConflictNotice } from "../../ui/dialogs";
import { Plus } from "lucide-react";
import { SearchField } from "../../ui/components";
import {
  metadata,
  type DomainChange,
  type Project,
  type Todo,
  type ProjectEvent,
} from "../../domain/types";
import {
  formatDate,
  formatTimestampDate,
  matchesSearch,
  overdue,
  sortTodos,
} from "../../domain/queries";
interface Props {
  todos: Todo[];
  events?: ProjectEvent[];
  onFocus?: (id: string) => void;
  onEvent?: (id: string) => void;
  selectedId?: string;
  onSelectedHandled?: () => void;
  projects: Project[];
  projectId?: string;
  showHeading?: boolean;
  headerTarget?: HTMLElement | null;
  search?: string;
  onSearchChange?: (value: string) => void;
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onProject: (id: string) => void;
}
export function TodosPanel({
  todos,
  events = [],
  onFocus,
  onEvent,
  selectedId,
  onSelectedHandled,
  projects,
  projectId,
  showHeading = true,
  headerTarget,
  search = "",
  onSearchChange,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
  const [openOnly, setOpenOnly] = useState(false);
  const visible = todos.filter(
    (todo) =>
      (!projectId || todo.projectId === projectId) &&
      (!openOnly || !todo.completed) &&
      matchesSearch(
        search,
        todo.title,
        projects.find((project) => project.id === todo.projectId)?.name || "",
      ),
  );
  const [editing, setEditing] = useState<Todo | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [doNext, setDoNext] = useState(false);
  const [owner, setOwner] = useState(projectId || projects[0]?.id || "");
  const [eventId, setEventId] = useState("");
  const handledSelection = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!selectedId) {
      handledSelection.current = undefined;
      return;
    }
    const todo = todos.find((item) => item.id === selectedId);
    if (todo && handledSelection.current !== selectedId) {
      handledSelection.current = selectedId;
      open(todo);
      onSelectedHandled?.();
    }
  }, [selectedId, todos]);
  const current = editing
    ? todos.find((todo) => todo.id === editing.id)
    : undefined;
  function open(todo?: Todo) {
    setEditing(todo || null);
    setEventId(todo?.eventId || "");
    setTitle(todo?.title || "");
    setDate(todo?.dueDate || "");
    setDoNext(Boolean(todo?.doNext));
    setOwner(todo?.projectId || projectId || projects[0]?.id || "");
    setAdding(true);
  }
  async function save(e?: React.FormEvent, overwrite = false) {
    e?.preventDefault();
    if (!owner || busy) return;
    const value: Todo = {
      ...(editing || metadata()),
      projectId: owner,
      title: title.trim() || "New task",
      completed: editing?.completed || false,
      updatedAt: new Date().toISOString(),
    };
    if (doNext && !value.completed) value.doNext = true;
    else delete value.doNext;
    if (eventId) value.eventId = eventId;
    else delete value.eventId;
    if (date) value.dueDate = date;
    else delete value.dueDate;
    if (await onChange({ type: "todo.save", value, overwrite }))
      setAdding(false);
  }
  const addButton = (
    <button
      className="button secondary"
      disabled={busy || !projects.length}
      onClick={() => open()}
    >
      <Plus size={14} aria-hidden="true" /> Add task
    </button>
  );
  function toggle(todo: Todo) {
    const value = {
      ...todo,
      completed: !todo.completed,
      updatedAt: new Date().toISOString(),
    };
    if (value.completed) delete value.doNext;
    void onChange({ type: "todo.save", value });
  }
  return (
    <section className="panel">
      <div
        className={`section-heading ${!showHeading && headerTarget ? "empty-heading" : ""}`}
      >
        {showHeading ? (
          <h2>
            Tasks{" "}
            <span className="count">
              {todos.filter((t) => !t.completed).length} open
            </span>
          </h2>
        ) : null}
        {headerTarget ? createPortal(addButton, headerTarget) : addButton}
      </div>
      <div className="task-filters actions" aria-label="Task filter">
        <button
          className={`button ${openOnly ? "secondary" : ""}`}
          aria-pressed={!openOnly}
          onClick={() => setOpenOnly(false)}
        >
          All tasks
        </button>
        <button
          className={`button ${openOnly ? "" : "secondary"}`}
          aria-pressed={openOnly}
          onClick={() => setOpenOnly(true)}
        >
          Open tasks
        </button>
        {!showHeading && (
          <span className="muted filter-count">
            {search.trim()
              ? `${visible.length} results`
              : `${todos.filter((t) => !t.completed).length} open`}
          </span>
        )}
        {onSearchChange && (
          <SearchField
            label="Search tasks"
            value={search}
            onChange={onSearchChange}
          />
        )}
      </div>
      {adding && (
        <Dialog
          title={editing ? "Edit task" : "New task"}
          onClose={() => setAdding(false)}
        >
          <form className="editor" onSubmit={save}>
            <ConflictNotice
              original={editing || undefined}
              current={current}
              onReload={() => (current ? open(current) : setAdding(false))}
              onOverwrite={() => void save(undefined, true)}
            />
            <div className="form-grid">
              <label className="field">
                Title
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What is the next step?"
                />
              </label>
              <label className="field">
                Due date (optional)
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              {!projectId && (
                <label className="field">
                  Project
                  <select
                    value={owner}
                    onChange={(e) => {
                      setOwner(e.target.value);
                      setEventId("");
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="field">
                Origin event
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  <option value="">No linked event</option>
                  {events
                    .filter((event) => event.projectId === owner)
                    .map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                </select>
              </label>
              {events.some((event) => event.projectId === owner) && (
                <div className="actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setEventId("")}
                  >
                    Unlink event
                  </button>
                  {onEvent && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={!eventId}
                      onClick={() => {
                        setAdding(false);
                        onEvent(eventId);
                      }}
                    >
                      Open event
                    </button>
                  )}
                </div>
              )}
              <label className="do-next-control">
                <input
                  type="checkbox"
                  checked={doNext}
                  disabled={Boolean(editing?.completed)}
                  onChange={(event) => setDoNext(event.target.checked)}
                />
                {editing?.completed ? "Do next (reopen task first)" : "Do next"}
              </label>
            </div>
            <div className="actions">
              <button className="button" disabled={busy}>
                Save
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
              {editing && (
                <button
                  type="button"
                  className="button secondary danger"
                  disabled={busy}
                  aria-label={`${editing.title} delete`}
                  onClick={async () => {
                    if (
                      confirm(`Delete "${editing.title}"?`) &&
                      (await onChange({
                        type: "todo.delete",
                        id: editing.id,
                        expectedRevision: editing.revision,
                      }))
                    )
                      setAdding(false);
                  }}
                >
                  Delete task
                </button>
              )}
            </div>
          </form>
        </Dialog>
      )}
      {!visible.length && (
        <p className="empty">
          {search.trim()
            ? "No tasks match this search and filter."
            : openOnly && todos.length
              ? "No open tasks."
              : "No tasks yet. Add the next step."}
        </p>
      )}
      <div className="table-scroll">
        <table
          className={`data-table tasks-table ${projectId ? "project-tasks" : "global-tasks"}`}
        >
          <colgroup>
            <col className="task-check-col" />
            <col className="task-title-col" />
            {!projectId && <col className="task-project-col" />}
            <col className="task-date-col" />
            <col className="task-created-col" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Completed</span>
              </th>
              <th scope="col">Task</th>
              {!projectId && <th scope="col">Project</th>}
              <th scope="col">Due date</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {sortTodos(visible).map((todo) => (
              <tr
                key={todo.id}
                className={`todo-item ${todo.completed ? "completed" : ""} ${todo.doNext && !todo.completed ? "is-do-next" : ""}`}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${todo.title} completed`}
                    checked={todo.completed}
                    disabled={busy}
                    onChange={() => toggle(todo)}
                  />
                </td>
                <td className="task-title">
                  <button
                    className="task-title-button"
                    aria-label={`${todo.title} edit`}
                    disabled={busy}
                    onClick={() => open(todo)}
                  >
                    {todo.title}
                  </button>
                  {!todo.completed && onFocus && (
                    <button
                      className="text-button"
                      onClick={() => onFocus(todo.id)}
                    >
                      Focus
                    </button>
                  )}
                  {todo.eventId && (
                    <button
                      className="text-button"
                      disabled={!onEvent}
                      onClick={() => onEvent?.(todo.eventId!)}
                    >
                      {events.find((event) => event.id === todo.eventId)
                        ?.title || "Origin event"}
                    </button>
                  )}
                  {todo.doNext && !todo.completed && (
                    <span className="do-next-badge">Do next</span>
                  )}
                </td>
                {!projectId && (
                  <td>
                    <button
                      className="text-button"
                      onClick={() => onProject(todo.projectId)}
                    >
                      {projects.find((p) => p.id === todo.projectId)?.name}
                    </button>
                  </td>
                )}
                <td>
                  {todo.dueDate ? (
                    <span className={overdue(todo, today) ? "overdue" : ""}>
                      {overdue(todo, today) ? "Overdue · " : ""}
                      {formatDate(todo.dueDate)}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>{formatTimestampDate(todo.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
