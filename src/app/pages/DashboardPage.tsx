import { useEffect, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
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

type BlockId = "important" | "open-work";
const collapsedKey = "winprogman-dashboard-collapsed";

function readCollapsed(): BlockId[] {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(collapsedKey) || "[]",
    );
    return Array.isArray(saved)
      ? saved.filter(
          (id): id is BlockId => id === "important" || id === "open-work",
        )
      : [];
  } catch {
    return [];
  }
}

/** Panel whose heading opens and closes its content; state stays local. */
function CollapsibleBlock({
  id,
  title,
  count,
  icon,
  collapsed,
  onToggle,
  className,
  children,
}: {
  id: BlockId;
  title: string;
  count: number;
  icon?: React.ReactNode;
  collapsed: boolean;
  onToggle: (id: BlockId) => void;
  className: string;
  children: React.ReactNode;
}) {
  const bodyId = `dashboard-block-${id}`;
  return (
    <section
      className={`panel dashboard-block ${className} ${collapsed ? "is-collapsed" : ""}`}
    >
      <div className="section-heading">
        <h2>
          <button
            type="button"
            className="block-toggle"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            onClick={() => onToggle(id)}
          >
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="block-chevron"
            />
            {icon}
            {title}
          </button>
        </h2>
        <span className="muted">{count}</span>
      </div>
      <div id={bodyId} hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}

export function DashboardPage({
  data,
  today,
  busy,
  onProject,
  onNavigate,
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
  onNavigate: (view: "Projects" | "Tasks" | "Events") => void;
  onComplete: (todo: Todo) => void;
  onChange: (change: DomainChange) => Promise<boolean>;
  active: AppData["projects"];
  open: Todo[];
  coming: AppData["events"];
  doNext: Todo[];
}) {
  const [collapsed, setCollapsed] = useState<BlockId[]>(readCollapsed);
  useEffect(() => {
    try {
      localStorage.setItem(collapsedKey, JSON.stringify(collapsed));
    } catch {
      /* Session only. */
    }
  }, [collapsed]);
  const toggle = (id: BlockId) =>
    setCollapsed((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const important = [...data.projects]
    .filter((project) => project.important)
    .sort((a, b) => a.number - b.number);
  const projectRow = (p: AppData["projects"][number]) => {
    const taskCount = open.filter((task) => task.projectId === p.id).length;
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
            <button className="project-title" onClick={() => onProject(p.id)}>
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
            {!projectTodos.length && <p className="muted">No open tasks.</p>}
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
                    <small className={overdue(todo, today) ? "overdue" : ""}>
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
                <span className="category" data-category={event.category}>
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
              <button className="text-button" onClick={() => onProject(p.id)}>
                + {projectEvents.length - 5} more events
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <QuickLinks links={data.quickLinks} busy={busy} onChange={onChange} />
      <div className="stats">
        <div>
          <button
            type="button"
            className="stat-link"
            onClick={() => onNavigate("Projects")}
          >
            <strong>{active.length}</strong>
            <span>Projects with work</span>
          </button>
        </div>
        <div>
          <button
            type="button"
            className="stat-link"
            onClick={() => onNavigate("Tasks")}
          >
            <strong>{open.length}</strong>
            <span>Open tasks</span>
          </button>
        </div>
        <div>
          <button
            type="button"
            className="stat-link"
            onClick={() => onNavigate("Events")}
          >
            <strong>{coming.length}</strong>
            <span>Upcoming events</span>
          </button>
        </div>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-stack">
          <CollapsibleBlock
            id="important"
            title="Important projects"
            count={important.length}
            icon={<Star size={15} aria-hidden="true" className="block-star" />}
            collapsed={collapsed.includes("important")}
            onToggle={toggle}
            className="dashboard-important"
          >
            {!important.length && (
              <p className="muted">
                Mark projects with the star in Projects to keep them here.
              </p>
            )}
            {important.map(projectRow)}
          </CollapsibleBlock>
          <CollapsibleBlock
            id="open-work"
            title="Projects with open work"
            count={active.length}
            collapsed={collapsed.includes("open-work")}
            onToggle={toggle}
            className="dashboard-projects"
          >
            {!active.length && (
              <p className="muted">No open tasks or upcoming events.</p>
            )}
            {active.map(projectRow)}
          </CollapsibleBlock>
        </div>
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
      </div>
    </>
  );
}
