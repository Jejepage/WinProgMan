import { createPortal } from "react-dom";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  metadata,
  type DomainChange,
  type Project,
  type Todo,
} from "../../domain/types";
import { formatDate, overdue, sortTodos } from "../../domain/queries";
interface Props {
  todos: Todo[];
  projects: Project[];
  projectId?: string;
  showHeading?: boolean;
  headerTarget?: HTMLElement | null;
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onProject: (id: string) => void;
}
export function TodosPanel({
  todos,
  projects,
  projectId,
  showHeading = true,
  headerTarget,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
  const [openOnly, setOpenOnly] = useState(false);
  const visible = todos.filter((todo) => !openOnly || !todo.completed);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [owner, setOwner] = useState(projectId || projects[0]?.id || "");
  function open(todo?: Todo) {
    setEditing(todo || null);
    setTitle(todo?.title || "");
    setDate(todo?.dueDate || "");
    setOwner(todo?.projectId || projectId || projects[0]?.id || "");
    setAdding(true);
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!owner) return;
    const value: Todo = {
      ...(editing || metadata()),
      projectId: owner,
      title: title.trim() || "New task",
      completed: editing?.completed || false,
      updatedAt: new Date().toISOString(),
    };
    if (date) value.dueDate = date;
    else delete value.dueDate;
    if (await onChange({ type: "todo.save", value })) setAdding(false);
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
            {todos.filter((t) => !t.completed).length} open
          </span>
        )}
      </div>
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
          </div>
        </form>
      )}
      {!visible.length && (
        <p className="empty">No tasks yet. Add the next step.</p>
      )}
      <div className="table-scroll">
        <table className="data-table tasks-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Completed</span>
              </th>
              <th scope="col">Task title</th>
              {!projectId && <th scope="col">Project</th>}
              <th scope="col">Due date</th>
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortTodos(visible).map((todo) => (
              <tr
                key={todo.id}
                className={`todo-item ${todo.completed ? "completed" : ""}`}
              >
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${todo.title} completed`}
                    checked={todo.completed}
                    disabled={busy}
                    onChange={() =>
                      void onChange({
                        type: "todo.save",
                        value: {
                          ...todo,
                          completed: !todo.completed,
                          updatedAt: new Date().toISOString(),
                        },
                      })
                    }
                  />
                </td>
                <td className="task-title">
                  <strong>{todo.title}</strong>
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
                <td>
                  <span
                    className={`status-label ${todo.completed ? "status-done" : "status-open"}`}
                  >
                    {todo.completed ? "Done" : "Open"}
                  </span>
                </td>
                <td>
                  <div className="row-actions">
                    <button
                      className="icon-button"
                      aria-label={`${todo.title} edit`}
                      disabled={busy}
                      onClick={() => open(todo)}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label={`${todo.title} delete`}
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Delete "${todo.title}"?`))
                          void onChange({ type: "todo.delete", id: todo.id });
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
