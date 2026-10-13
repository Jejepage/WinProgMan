import { useState } from "react";
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
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onProject: (id: string) => void;
}
export function TodosPanel({
  todos,
  projects,
  projectId,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
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
      title: title.trim() || "Neues To-Do",
      completed: editing?.completed || false,
      updatedAt: new Date().toISOString(),
    };
    if (date) value.dueDate = date;
    else delete value.dueDate;
    if (await onChange({ type: "todo.save", value })) setAdding(false);
  }
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>
          To-Dos{" "}
          <span className="count">
            {todos.filter((t) => !t.completed).length} offen
          </span>
        </h2>
        <button
          className="button secondary"
          disabled={busy || !projects.length}
          onClick={() => open()}
        >
          + To-Do
        </button>
      </div>
      {adding && (
        <form className="editor" onSubmit={save}>
          <div className="form-grid">
            <label className="field">
              Titel
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Was steht als Nächstes an?"
              />
            </label>
            <label className="field">
              Datum (optional)
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            {!projectId && (
              <label className="field">
                Projekt
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
              Speichern
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setAdding(false)}
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
      {!todos.length && (
        <p className="empty">
          Noch keine To-Dos. Halte den nächsten Schritt fest.
        </p>
      )}
      <ul className="item-list">
        {sortTodos(todos).map((todo) => (
          <li
            key={todo.id}
            className={`todo-item ${todo.completed ? "completed" : ""}`}
          >
            <input
              type="checkbox"
              aria-label={`${todo.title} erledigt`}
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
            <div className="item-content">
              <strong>{todo.title}</strong>
              <div className="item-meta">
                {!projectId && (
                  <button
                    className="text-button"
                    onClick={() => onProject(todo.projectId)}
                  >
                    {projects.find((p) => p.id === todo.projectId)?.name}
                  </button>
                )}
                {todo.dueDate && (
                  <span className={overdue(todo, today) ? "overdue" : ""}>
                    {overdue(todo, today) ? "Überfällig · " : ""}
                    {formatDate(todo.dueDate)}
                  </span>
                )}
              </div>
            </div>
            <div className="row-actions">
              <button
                className="icon-button"
                aria-label={`${todo.title} bearbeiten`}
                disabled={busy}
                onClick={() => open(todo)}
              >
                Bearbeiten
              </button>
              <button
                className="icon-button danger"
                aria-label={`${todo.title} löschen`}
                disabled={busy}
                onClick={() => {
                  if (confirm(`„${todo.title}“ löschen?`))
                    void onChange({ type: "todo.delete", id: todo.id });
                }}
              >
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
