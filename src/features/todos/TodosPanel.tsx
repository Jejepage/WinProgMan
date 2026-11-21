import { createPortal } from "react-dom";
import { Fragment, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Flag, Plus } from "lucide-react";
import { useEditorShortcuts } from "../../ui/useEditorShortcuts";
import { QuickDateField } from "../../ui/QuickDateField";
import { openItem, openNewItem } from "../../ui/itemNavigation";
import { SearchField } from "../../ui/components";
import {
  metadata,
  type DomainChange,
  type Project,
  type Todo,
} from "../../domain/types";
import {
  dueGroup,
  formatTimestampDate,
  matchesSearch,
  overdue,
  relativeDate,
  sortTodos,
  type DueGroup,
} from "../../domain/queries";

type SortKey = "title" | "project" | "due" | "created";
const groupLabels: Record<DueGroup | "completed", string> = {
  overdue: "Overdue",
  today: "Today",
  week: "Next 7 days",
  later: "Later",
  none: "No due date",
  completed: "Completed",
};
const groupOrder: (DueGroup | "completed")[] = [
  "overdue",
  "today",
  "week",
  "later",
  "none",
  "completed",
];
const groupingKey = "winprogman-task-grouping";
function readGrouping() {
  try {
    return localStorage.getItem(groupingKey) === "due";
  } catch {
    return false;
  }
}
interface Props {
  initialTodo?: Todo;
  initialProjectId?: string;
  detailOnly?: boolean;
  onClose?: () => void;
  todos: Todo[];
  projects: Project[];
  projectId?: string;
  showHeading?: boolean;
  /** Replaces the "Tasks" heading text, e.g. with the project name. */
  heading?: React.ReactNode;
  compactSections?: boolean;
  headerTarget?: HTMLElement | null;
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Project filter of the global task list ("" = all projects). */
  projectFilter?: string;
  onProjectFilterChange?: (value: string) => void;
  showCreated?: boolean;
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onProject: (id: string) => void;
}
export function TodosPanel({
  initialTodo,
  initialProjectId,
  detailOnly = false,
  onClose,
  todos,
  projects,
  projectId,
  showHeading = true,
  heading,
  compactSections = false,
  headerTarget,
  search = "",
  onSearchChange,
  projectFilter = "",
  onProjectFilterChange,
  showCreated = true,
  today,
  busy,
  onChange,
  onProject,
}: Props) {
  // Completed tasks stay hidden until "Show completed" is switched on.
  const [showCompleted, setShowCompleted] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(
    null,
  );
  const [grouped, setGrouped] = useState(readGrouping);
  useEffect(() => {
    try {
      localStorage.setItem(groupingKey, grouped ? "due" : "none");
    } catch {
      /* Session only. */
    }
  }, [grouped]);
  const activeProjectFilter =
    !projectId && projects.some((p) => p.id === projectFilter)
      ? projectFilter
      : "";
  const projectName = (id: string) =>
    projects.find((project) => project.id === id)?.name || "";
  const visible = todos.filter(
    (todo) =>
      (showCompleted || !todo.completed) &&
      (!activeProjectFilter || todo.projectId === activeProjectFilter) &&
      matchesSearch(
        search,
        todo.title,
        projects.find((project) => project.id === todo.projectId)?.name || "",
      ),
  );
  const editing = initialTodo || null;
  const sortedVisible = sortTodos(visible);
  if (sort) {
    const value = (todo: Todo) =>
      sort.key === "title"
        ? todo.title
        : sort.key === "project"
          ? projectName(todo.projectId)
          : sort.key === "due"
            ? todo.dueDate || "9999"
            : todo.createdAt;
    // Stable sort: equal values keep the default order.
    sortedVisible.sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        value(a).localeCompare(value(b), "de", { sensitivity: "base" }) *
          (sort.desc ? -1 : 1),
    );
  }
  const groupOf = (todo: Todo): DueGroup | "completed" =>
    todo.completed ? "completed" : dueGroup(todo, today);
  if (grouped)
    sortedVisible.sort(
      (a, b) => groupOrder.indexOf(groupOf(a)) - groupOrder.indexOf(groupOf(b)),
    );
  const sectionOf = (todo: Todo) =>
    grouped
      ? groupLabels[groupOf(todo)]
      : compactSections
        ? todo.completed
          ? "Completed"
          : todo.doNext
            ? "Do next"
            : "Open tasks"
        : "";
  const sortHeader = (key: SortKey, label: string) => {
    const active = sort?.key === key;
    return (
      <th
        scope="col"
        aria-sort={
          active ? (sort.desc ? "descending" : "ascending") : undefined
        }
      >
        <button
          type="button"
          className="sort-button"
          title={`Sort by ${label.toLowerCase()}`}
          onClick={() =>
            setSort(
              !active
                ? { key, desc: false }
                : sort.desc
                  ? null
                  : { key, desc: true },
            )
          }
        >
          {label}
          {active &&
            (sort.desc ? (
              <ArrowDown size={12} aria-hidden="true" />
            ) : (
              <ArrowUp size={12} aria-hidden="true" />
            ))}
        </button>
      </th>
    );
  };
  // Quick capture: Enter stores a task right away; details can follow later.
  const [quickTitle, setQuickTitle] = useState("");
  const [quickProject, setQuickProject] = useState("");
  const quickTarget =
    projectId ||
    activeProjectFilter ||
    (projects.some((p) => p.id === quickProject) ? quickProject : "") ||
    projects[0]?.id ||
    "";
  async function quickAdd(event: React.FormEvent) {
    event.preventDefault();
    const text = quickTitle.trim();
    if (!text || !quickTarget || busy) return;
    const value: Todo = {
      ...metadata(),
      projectId: quickTarget,
      title: text,
      completed: false,
    };
    if (await onChange({ type: "todo.save", value })) setQuickTitle("");
  }
  const [adding, setAdding] = useState(detailOnly || Boolean(initialTodo));
  const [title, setTitle] = useState(initialTodo?.title || "");
  const [date, setDate] = useState(initialTodo?.dueDate || "");
  const [doNext, setDoNext] = useState(Boolean(initialTodo?.doNext));
  const [owner, setOwner] = useState(
    initialTodo?.projectId ||
      initialProjectId ||
      projectId ||
      projects[0]?.id ||
      "",
  );
  const currentTodo = editing
    ? todos.find((todo) => todo.id === editing.id) || editing
    : null;
  const form = useRef<HTMLFormElement>(null);
  const initialOwner = useRef(owner);
  useEditorShortcuts(form, {
    active: adding && detailOnly,
    isDirty: () =>
      title !== (initialTodo?.title || "") ||
      date !== (initialTodo?.dueDate || "") ||
      doNext !== Boolean(initialTodo?.doNext) ||
      owner !== initialOwner.current,
    onCancel: () => (detailOnly ? onClose?.() : setAdding(false)),
  });
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
      className="button add-button"
      disabled={busy || !projects.length}
      aria-label="Add task"
      title="Add task (N)"
      onClick={() => openNewItem("task", projectId)}
    >
      <Plus size={16} aria-hidden="true" />
      <span className="button-label">Task</span>
    </button>
  );
  function setDue(todo: Todo, dueDate: string) {
    const value: Todo = { ...todo, updatedAt: new Date().toISOString() };
    if (dueDate) value.dueDate = dueDate;
    else delete value.dueDate;
    void onChange({ type: "todo.save", value });
  }
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
    <section className="panel todos-panel">
      {!detailOnly && (
        <>
          <div
            className={`section-heading ${!showHeading && headerTarget ? "empty-heading" : ""}`}
          >
            {showHeading ? (
              <h2>
                {heading ?? "Tasks"}{" "}
                <span className="count">
                  {todos.filter((t) => !t.completed).length} open
                </span>
              </h2>
            ) : null}
            {headerTarget ? createPortal(addButton, headerTarget) : addButton}
          </div>
          <div className="task-filters actions" aria-label="Task filter">
            <label className="show-completed-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={showCompleted}
                onChange={(event) => setShowCompleted(event.target.checked)}
              />
              <span>Show completed</span>
            </label>
            <label className="show-completed-toggle">
              <input
                type="checkbox"
                role="switch"
                checked={grouped}
                onChange={(event) => setGrouped(event.target.checked)}
              />
              <span>Group by due date</span>
            </label>
            {!projectId && onProjectFilterChange && (
              <label className="field task-project-filter">
                <span className="sr-only">Project</span>
                <select
                  aria-label="Filter by project"
                  value={activeProjectFilter}
                  onChange={(event) =>
                    onProjectFilterChange(event.target.value)
                  }
                >
                  <option value="">All projects</option>
                  {[...projects]
                    .sort((a, b) => a.name.localeCompare(b.name, "de"))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
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
        <form ref={form} className="editor" onSubmit={save}>
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
                  if (await onChange({ type: "todo.delete", id: editing.id })) {
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
      {!detailOnly && projects.length > 0 && (
        <form className="quick-add" onSubmit={quickAdd}>
          <Plus size={15} aria-hidden="true" />
          <input
            aria-label="Quick add task"
            placeholder="Add task … (Enter)"
            title={
              projectId || activeProjectFilter
                ? undefined
                : "Enter saves the task to the project selected on the right"
            }
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && quickTitle) {
                event.preventDefault();
                setQuickTitle("");
              }
            }}
          />
          {!projectId && !activeProjectFilter && (
            <select
              aria-label="Project for the new task"
              value={quickTarget}
              disabled={busy}
              onChange={(event) => setQuickProject(event.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </form>
      )}
      {!detailOnly && (
        <>
          {!visible.length && (
            <p className="empty">
              {search.trim()
                ? "No tasks match this search and filter."
                : !showCompleted && todos.length
                  ? "No open tasks. Switch on Show completed to see finished ones."
                  : "No tasks yet. Add the next step."}
              {!search.trim() && !todos.length && projects.length > 0 && (
                <>
                  {" "}
                  <button
                    className="button secondary"
                    onClick={() => openNewItem("task", projectId)}
                  >
                    Add your first task
                  </button>
                </>
              )}
            </p>
          )}
          <div className="table-scroll">
            <table
              className={`data-table tasks-table ${projectId ? "project-tasks" : "global-tasks"}`}
            >
              <colgroup>
                <col className="task-check-col" />
                <col className="task-next-col" />
                <col className="task-title-col" />
                {!projectId && <col className="task-project-col" />}
                <col className="task-date-col" />
                {showCreated && <col className="task-created-col" />}
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Completed</span>
                  </th>
                  <th scope="col">
                    <span className="sr-only">Do next</span>
                  </th>
                  {sortHeader("title", "Task")}
                  {!projectId && sortHeader("project", "Project")}
                  {sortHeader("due", "Due date")}
                  {showCreated && sortHeader("created", "Created")}
                </tr>
              </thead>
              <tbody>
                {sortedVisible.map((todo, index) => (
                  <Fragment key={todo.id}>
                    {sectionOf(todo) &&
                      (index === 0 ||
                        sectionOf(todo) !==
                          sectionOf(sortedVisible[index - 1])) && (
                        <tr
                          className={`task-section ${grouped ? "due-section" : "split-only"} ${grouped ? `due-${groupOf(todo)}` : !todo.completed && todo.doNext ? "next-section" : ""}`}
                        >
                          <th
                            colSpan={
                              (projectId ? 4 : 5) + (showCreated ? 1 : 0)
                            }
                            scope="colgroup"
                          >
                            {sectionOf(todo)}
                          </th>
                        </tr>
                      )}
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
                      <td>
                        <button
                          type="button"
                          className={`icon-button task-next-toggle ${todo.doNext ? "marked" : ""}`}
                          aria-label={`${todo.title} Do next`}
                          aria-pressed={Boolean(todo.doNext)}
                          title={
                            todo.completed
                              ? "Reopen task to mark as Do next"
                              : todo.doNext
                                ? "Remove Do next mark"
                                : "Mark as Do next (shown on the dashboard)"
                          }
                          disabled={busy || todo.completed}
                          onClick={() =>
                            void onChange({
                              type: "todo.setDoNext",
                              id: todo.id,
                              doNext: !todo.doNext,
                            })
                          }
                        >
                          <Flag
                            size={15}
                            fill={todo.doNext ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        </button>
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
                            {
                              projects.find((p) => p.id === todo.projectId)
                                ?.name
                            }
                          </button>
                        </td>
                      )}
                      <td>
                        <QuickDateField
                          value={todo.dueDate}
                          label={`Due date of ${todo.title}`}
                          emptyTitle="Set due date"
                          className={overdue(todo, today) ? "overdue" : ""}
                          disabled={busy}
                          display={(date) =>
                            `${overdue(todo, today) ? "Overdue · " : ""}${relativeDate(date, today)}`
                          }
                          onSelect={(dueDate) => setDue(todo, dueDate)}
                        />
                      </td>
                      {showCreated && (
                        <td>{formatTimestampDate(todo.createdAt)}</td>
                      )}
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
