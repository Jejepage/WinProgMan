import { QuickLinks } from "../../features/dashboard/QuickLinks";
import { StatusLabel } from "../../ui/components";
import {
  formatDate,
  overdue,
  sortEvents,
  sortTodos,
} from "../../domain/queries";
import type { AppData, DomainChange, Todo } from "../../domain/types";
import { openItem } from "../../ui/itemNavigation";
import { categoryLabel, statusLabel } from "../../ui/labels";

/** The five nearest upcoming events, still shown newest first. */
const nearest = (events: AppData["events"]) =>
  [...events].reverse().slice(0, 5).reverse();

export function DashboardPage({
  data,
  today,
  busy,
  onProject,
  onComplete,
  onChange,
  active,
  open,
  coming,
  doNext,
}: {
  data: AppData;
  today: string;
  busy: boolean;
  onProject: (id: string) => void;
  onComplete: (todo: Todo) => void;
  onChange: (change: DomainChange) => Promise<boolean>;
  active: AppData["projects"];
  open: Todo[];
  coming: AppData["events"];
  doNext: Todo[];
}) {
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
                      onClick={() => onProject(p.id)}
                    >
                      {p.name} <span>↗</span>
                    </button>
                    <p className="muted">{p.description}</p>
                    <small>
                      {taskCount} open tasks · {eventCount} upcoming events
                    </small>
                  </div>
                  <StatusLabel data-status={p.status}>
                    {statusLabel(p.status)}
                  </StatusLabel>
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
                          type="checkbox"
                          aria-label={todo.title}
                          checked={false}
                          disabled={busy}
                          onChange={() => void onComplete(todo)}
                        />
                        <span>
                          {todo.doNext && (
                            <span className="do-next-badge">Do next</span>
                          )}
                          <button
                            className="task-title-button"
                            disabled={busy}
                            onClick={() => openItem("task", todo.id)}
                          >
                            {todo.title}
                          </button>
                          {todo.dueDate && (
                            <small
                              className={overdue(todo, today) ? "overdue" : ""}
                            >
                              {overdue(todo, today) ? "Overdue · " : ""}
                              {formatDate(todo.dueDate)}
                            </small>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3>UPCOMING EVENTS</h3>
                    {!projectEvents.length && (
                      <p className="muted">No upcoming events.</p>
                    )}
                    {nearest(projectEvents).map((event) => (
                      <div className="overview-event" key={event.id}>
                        <span
                          className="category"
                          data-category={event.category}
                        >
                          {categoryLabel(event.category)}
                        </span>
                        <button
                          className="event-title"
                          disabled={busy}
                          onClick={() => openItem("event", event.id)}
                        >
                          {event.title}
                        </button>
                        <small>
                          {formatDate(event.date)}
                          {event.time && ` · ${event.time}`}
                        </small>
                      </div>
                    ))}
                    {projectEvents.length > 5 && (
                      <button
                        className="text-button"
                        onClick={() => onProject(p.id)}
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
            <span className="muted">{doNext.length}</span>
          </div>
          {!doNext.length && (
            <p className="muted">
              Mark an open task as Do next to see it here.
            </p>
          )}
          {doNext.map((todo) => (
            <div className="dashboard-next-row" key={todo.id}>
              <input
                type="checkbox"
                aria-label={`${todo.title} completed`}
                checked={false}
                disabled={busy}
                onChange={() => void onComplete(todo)}
              />
              <div>
                <button
                  className="task-title-button"
                  disabled={busy}
                  onClick={() => openItem("task", todo.id)}
                >
                  {todo.title}
                </button>
                <button
                  className="text-button"
                  onClick={() => onProject(todo.projectId)}
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
        <QuickLinks links={data.quickLinks} busy={busy} onChange={onChange} />
      </div>
    </>
  );
}
