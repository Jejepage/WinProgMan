import type { AppData, DomainChange, Todo } from "../../domain/types";
import {
  activeProjects,
  formatDate,
  overdue,
  sortTodos,
  sortEvents,
  upcoming,
} from "../../domain/queries";
import { statusLabel, categoryLabel } from "../../ui/labels";
import { StatusLabel } from "../../ui/components";
import { WeekOverview } from "./WeekOverview";
import type { OpenRecord } from "../../domain/workflows";
export function Dashboard({
  data,
  today,
  busy,
  change,
  goProject,
  openItem,
  onFocus,
}: {
  data: AppData;
  today: string;
  busy: boolean;
  change: (value: DomainChange) => Promise<boolean>;
  goProject: (id: string) => void;
  openItem: OpenRecord;
  onFocus: (id: string) => void;
}) {
  const active = activeProjects(data, today);
  const open = data.todos.filter((t) => !t.completed);
  const coming = data.events.filter((e) => upcoming(e, today));
  const doNextTodos = sortTodos(open.filter((t) => t.doNext));
  const completeTodo = (todo: Todo) =>
    change({
      type: "todo.save",
      value: {
        ...todo,
        completed: true,
        doNext: false,
        updatedAt: new Date().toISOString(),
      },
    });
  return (
    <>
      <div className="stats">
        <div>
          <strong>{active.length}</strong>
          <span>Projects with work</span>
        </div>
        <div>
          <strong>{open.length}</strong>
          <span>Open tasks</span>
        </div>
        <div>
          <strong>{coming.length}</strong>
          <span>Upcoming events</span>
        </div>
      </div>
      <WeekOverview
        data={data}
        today={today}
        busy={busy}
        onChange={change}
        onOpen={openItem}
      />
      <div className="dashboard-columns">
        <section className="panel dashboard-projects">
          <div className="section-heading">
            <h2>Projects with open work</h2>
            <span className="muted">{active.length}</span>
          </div>
          {!active.length && (
            <p className="muted">No open tasks or upcoming events.</p>
          )}
          {active.map((p) => {
            const taskCount = open.filter(
              (task) => task.projectId === p.id,
            ).length;
            const eventCount = coming.filter(
              (event) => event.projectId === p.id,
            ).length;
            const projectTodos = sortTodos(
              open.filter((todo) => todo.projectId === p.id),
            );
            const projectEvents = sortEvents(
              coming.filter((event) => event.projectId === p.id),
            );
            return (
              <div className="dashboard-project-row" key={p.id}>
                <div className="dashboard-project-head">
                  <div>
                    <button
                      className="project-title"
                      onClick={() => goProject(p.id)}
                    >
                      {p.name} <span>↗</span>
                    </button>
                    <p className="muted">{p.description}</p>
                    <small>
                      {taskCount} open tasks · {eventCount} upcoming events
                    </small>
                  </div>
                  <StatusLabel>{statusLabel(p.status)}</StatusLabel>
                </div>
                <div className="overview-columns">
                  <div>
                    <h3>OPEN TASKS</h3>
                    {!projectTodos.length && (
                      <p className="muted">No open tasks.</p>
                    )}
                    {projectTodos.map((todo) => (
                      <div key={todo.id} className="overview-todo">
                        <input
                          aria-label={`${todo.title} completed`}
                          type="checkbox"
                          checked={false}
                          disabled={busy}
                          onChange={() => void completeTodo(todo)}
                        />
                        <span>
                          {todo.doNext && (
                            <span className="do-next-badge">Do next</span>
                          )}
                          {todo.title}
                          {todo.dueDate && (
                            <small
                              className={overdue(todo, today) ? "overdue" : ""}
                            >
                              {overdue(todo, today) ? "Overdue · " : ""}
                              {formatDate(todo.dueDate)}
                            </small>
                          )}
                        </span>
                        <button
                          className="text-button"
                          onClick={() => onFocus(todo.id)}
                        >
                          Focus
                        </button>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3>UPCOMING EVENTS</h3>
                    {!projectEvents.length && (
                      <p className="muted">No upcoming events.</p>
                    )}
                    {projectEvents.slice(0, 5).map((event) => (
                      <div className="overview-event" key={event.id}>
                        <span className="category">
                          {categoryLabel(event.category)}
                        </span>
                        <strong>{event.title}</strong>
                        <small>
                          {formatDate(event.date)}
                          {event.time && ` · ${event.time}`}
                        </small>
                      </div>
                    ))}
                    {projectEvents.length > 5 && (
                      <button
                        className="text-button"
                        onClick={() => goProject(p.id)}
                      >
                        + {projectEvents.length - 5} more events
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
        <section className="panel dashboard-next">
          <div className="section-heading">
            <h2>Do next</h2>
            <span className="muted">{doNextTodos.length}</span>
          </div>
          {!doNextTodos.length && (
            <p className="muted">
              Mark an open task as Do next to see it here.
            </p>
          )}
          {doNextTodos.map((todo) => (
            <div className="dashboard-next-row" key={todo.id}>
              <input
                type="checkbox"
                aria-label={`${todo.title} completed`}
                checked={false}
                disabled={busy}
                onChange={() => void completeTodo(todo)}
              />
              <div>
                <button
                  className="text-button"
                  onClick={() => onFocus(todo.id)}
                >
                  {todo.title} · Focus
                </button>
                <button
                  className="text-button"
                  onClick={() => goProject(todo.projectId)}
                >
                  {data.projects.find((p) => p.id === todo.projectId)?.name ||
                    "Project"}
                </button>
                {todo.dueDate && (
                  <small className={overdue(todo, today) ? "overdue" : ""}>
                    {overdue(todo, today) ? "Overdue · " : ""}
                    {formatDate(todo.dueDate)}
                  </small>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
