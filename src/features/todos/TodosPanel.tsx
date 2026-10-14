import { createPortal } from "react-dom";
import { useState } from "react";
import { Plus } from "lucide-react";
import { openItem } from "../../ui/itemNavigation";
import { SearchField } from "../../ui/components";
import {
  metadata,
  type DomainChange,
  type Project,
  type Todo,
} from "../../domain/types";
import {
  formatDate,
  formatTimestampDate,
  matchesSearch,
  overdue,
  sortTodos,
} from "../../domain/queries";
interface Props {
  initialTodo?: Todo;
  detailOnly?: boolean;
  onClose?: () => void;
  todos: Todo[];
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
  initialTodo,
  detailOnly = false,
  onClose,
  todos,
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
      (!openOnly || !todo.completed) &&
      matchesSearch(
        search,
        todo.title,
        projects.find((project) => project.id === todo.projectId)?.name || "",
      ),
  );
  const [editing, setEditing] = useState<Todo | null>(initialTodo || null);
  const [adding, setAdding] = useState(Boolean(initialTodo));
  const [title, setTitle] = useState(initialTodo?.title || "");
  const [date, setDate] = useState(initialTodo?.dueDate || "");
  const [doNext, setDoNext] = useState(Boolean(initialTodo?.doNext));
  const [owner, setOwner] = useState(
    initialTodo?.projectId || projectId || projects[0]?.id || "",
  );
  const currentTodo = editing
    ? todos.find((todo) => todo.id === editing.id) || editing
    : null;
  function open(todo?: Todo) {
    setEditing(todo || null);
    setTitle(todo?.title || "");
    setDate(todo?.dueDate || "");
    setDoNext(Boolean(todo?.doNext));
    setOwner(todo?.projectId || projectId || projects[0]?.id || "");
    setAdding(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!owner) return;
    const value: Todo = {
      ...(currentTodo || metadata()),
      projectId: owner,
      title: title.trim() || "New task",
      completed: currentTodo?.completed || false,
      updatedAt: new Date().toISOString(),
    };
    if (doNext && !value.completed) value.doNext = true;
    else delete value.doNext;
    if (date) value.dueDate = date;
    else delete value.dueDate;
    if (await onChange({ type: "todo.save", value })) {
      if (detailOnly) {
        onClose?.();
      } else setAdding(false);
    }
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
      {!detailOnly && (
        <>
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
        </>
      )}
      {adding && (
        <form className="editor" onSubmit={save}>
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
                  onChange={(e) => setOwner(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="do-next-control">
              <input
                type="checkbox"
                checked={doNext}
                disabled={Boolean(currentTodo?.completed)}
                onChange={(event) => setDoNext(event.target.checked)}
              />
              {currentTodo?.completed
                ? "Do next (reopen task first)"
                : "Do next"}
            </label>
          </div>
          <div className="actions">
            <button className="button" disabled={busy}>
              Save
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => (detailOnly ? onClose?.() : setAdding(false))}
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
                    (await onChange({ type: "todo.delete", id: editing.id }))
                  ) {
                    setAdding(false);
                    if (detailOnly) onClose?.();
                  }
                }}
              >
                Delete task
              </button>
            )}
          </div>
        </form>
      )}
      {!detailOnly && (
        <>
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
                        onClick={() => openItem("task", todo.id)}
                      >
                        {todo.title}
                      </button>
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
        </>
      )}
    </section>
  );
}
