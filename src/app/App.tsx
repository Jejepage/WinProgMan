import {
  Button,
  Field,
  StatusLabel,
  Card,
  Table,
  SearchField,
} from "../ui/components";
import { useEffect, useRef, useState } from "react";
import {
  emptyData,
  metadata,
  projectStatuses,
  type ProjectStatus,
  type AppData,
  type DomainChange,
  type ExportEnvelope,
  type Todo,
} from "../domain/types";
import {
  activeProjects,
  formatDate,
  localToday,
  matchesSearch,
  overdue,
  sortEvents,
  sortTodos,
  upcoming,
} from "../domain/queries";
import { demoData } from "../domain/demo";
import { IndexedDbProjectStore } from "../storage/IndexedDbProjectStore";
import { validateImport } from "../storage/validation";
import { TodosPanel } from "../features/todos/TodosPanel";
import { EventsPanel } from "../features/events/EventsPanel";
import { ProjectHeader } from "../features/projects/ProjectHeader";
import { CategorySettings } from "../features/projects/CategorySettings";
import { openItem } from "../ui/itemNavigation";
const store = new IndexedDbProjectStore();
import {
  LayoutDashboard,
  Folder,
  CheckSquare,
  CalendarDays,
  Settings,
} from "lucide-react";
import { statusLabel, categoryLabel, errorLabel } from "../ui/labels";
type View =
  "Dashboard" | "Projects" | "Tasks" | "Events" | "Project" | "Settings";
type ThemeChoice = "system" | "light" | "dark";
export function App() {
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [view, setView] = useState<View>(() => {
    const kind = new URLSearchParams(window.location.hash.slice(1)).get(
      "detail",
    );
    return kind === "task"
      ? "Tasks"
      : kind === "event"
        ? "Events"
        : "Dashboard";
  });
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState(localToday);
  const [newProject, setNewProject] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Aktiv");
  const [categoryId, setCategoryId] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ProjectStatus>>(
    () => new Set(projectStatuses),
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [pending, setPending] = useState<ExportEnvelope | null>(null);
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      const saved = localStorage.getItem("winprogman-theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // Storage may be unavailable in private browser contexts.
    }
    return "system";
  });
  const file = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const updates = useRef<BroadcastChannel | null>(null);
  const readDetail = () => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const kind = params.get("detail");
    return kind === "task" || kind === "event"
      ? { kind, id: params.get("id") || "" }
      : null;
  };
  const [detail, setDetail] = useState(readDetail);
  const closeDetail = () => {
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setDetail(null);
  };
  useEffect(() => {
    const update = () => setDetail(readDetail());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    const refresh = () => {
      if (!lock.current)
        void store
          .load()
          .then(setData)
          .catch((e) => setError(errorLabel(e)));
    };
    const channel = new BroadcastChannel("winprogman-data");
    updates.current = channel;
    channel.onmessage = refresh;
    window.addEventListener("focus", refresh);
    return () => {
      channel.close();
      updates.current = null;
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    store
      .load()
      .then(setData)
      .catch((e) => setError(errorLabel(e)))
      .finally(() => setLoading(false));
    const timer = setInterval(() => setToday(localToday()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
    };
    apply();
    system.addEventListener("change", apply);
    try {
      localStorage.setItem("winprogman-theme", theme);
    } catch {
      // The choice still works for this session.
    }
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  async function transact(action: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setData(await store.load());
      updates.current?.postMessage("changed");
      return true;
    } catch (e) {
      setError(errorLabel(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const change = (value: DomainChange) => transact(() => store.apply(value));
  const completeTodo = (todo: Todo) => {
    const { doNext: _marker, ...rest } = todo;
    return change({
      type: "todo.save",
      value: {
        ...rest,
        completed: true,
        updatedAt: new Date().toISOString(),
      },
    });
  };
  const goProject = (id: string) => {
    setProjectId(id);
    setView("Project");
  };
  const project = data.projects.find((p) => p.id === projectId);
  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const value = {
      ...metadata(),
      name: name.trim() || "New project",
      description: "",
      status,
      ...(categoryId && data.projectCategories.some((c) => c.id === categoryId)
        ? { categoryId }
        : {}),
    };
    if (await change({ type: "project.save", value })) {
      setNewProject(false);
      setName("");
      setStatus("Aktiv");
      setCategoryId("");
      goProject(value.id);
    }
  }
  async function deleteProject() {
    if (!project) return;
    const count =
      data.todos.filter((todo) => todo.projectId === project.id).length +
      data.events.filter((event) => event.projectId === project.id).length +
      data.links.filter((link) => link.projectId === project.id).length;
    if (
      confirm(
        `Delete project "${project.name}" and ${count} related items permanently?`,
      ) &&
      (await change({ type: "project.delete", id: project.id }))
    ) {
      setProjectId("");
      setView("Projects");
    }
  }
  function toggleStatus(value: ProjectStatus) {
    setSelectedStatuses((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }
  async function download() {
    try {
      const value = await store.exportData();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `winprogman-${today}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("JSON backup downloaded.");
    } catch (e) {
      setError(errorLabel(e));
    }
  }
  async function readFile(value: File | undefined) {
    if (!value) return;
    try {
      setPending(validateImport(JSON.parse(await value.text())));
      setError("");
    } catch (e) {
      setError(e instanceof SyntaxError ? "Invalid JSON file." : errorLabel(e));
    }
    if (file.current) file.current.value = "";
  }
  const common = {
    projects: data.projects,
    today,
    busy,
    onChange: change,
    onProject: goProject,
  };
  const active = activeProjects(data, today);
  const open = data.todos.filter((t) => !t.completed);
  const coming = data.events.filter((e) => upcoming(e, today));
  const doNextTodos = sortTodos(open.filter((todo) => todo.doNext));
  const effectiveCategoryFilter =
    categoryFilter === "none" ||
    data.projectCategories.some((c) => c.id === categoryFilter)
      ? categoryFilter
      : "";
  const filteredProjects = data.projects.filter(
    (p) =>
      selectedStatuses.has(p.status) &&
      (!effectiveCategoryFilter ||
        (effectiveCategoryFilter === "none"
          ? !p.categoryId
          : p.categoryId === effectiveCategoryFilter)) &&
      matchesSearch(projectSearch, p.name),
  );
  const detailContent = detail
    ? (() => {
        const todo = data.todos.find((item) => item.id === detail.id);
        const event = data.events.find((item) => item.id === detail.id);
        const item = detail.kind === "task" ? todo : event;
        return (
          <section className="detail-page">
            <div className="page-heading">
              <h1>{detail.kind === "task" ? "Edit task" : "Edit event"}</h1>
            </div>
            {error && (
              <p role="alert" className="panel">
                {error}
              </p>
            )}
            {loading ? (
              <p>Loading …</p>
            ) : !item ? (
              <section className="panel">
                <p>This item no longer exists.</p>
                <button className="button secondary" onClick={closeDetail}>
                  Back to list
                </button>
              </section>
            ) : detail.kind === "task" && todo ? (
              <TodosPanel
                key={todo.id}
                {...common}
                todos={[todo]}
                initialTodo={todo}
                detailOnly
                onClose={closeDetail}
              />
            ) : event ? (
              <EventsPanel
                key={event.id}
                {...common}
                events={[event]}
                initialEvent={event}
                detailOnly
                onClose={closeDetail}
              />
            ) : null}
          </section>
        );
      })()
    : null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("Dashboard");
            closeDetail();
          }}
        >
          <span className="brand-mark">W</span>
          <span>
            WinProgMan<small>Personal workspace</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {(
            ["Dashboard", "Projects", "Tasks", "Events", "Settings"] as View[]
          ).map((v, i) => (
            <button
              key={v}
              aria-current={view === v ? "page" : undefined}
              className={`nav-button ${view === v ? "active" : ""}`}
              onClick={() => {
                closeDetail();
                setView(v);
              }}
            >
              {(() => {
                const Icon = [
                  LayoutDashboard,
                  Folder,
                  CheckSquare,
                  CalendarDays,
                  Settings,
                ][i];
                return <Icon size={18} aria-hidden="true" />;
              })()}
              {v}
              {v === "Projects" && <small>{data.projects.length}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" /> Stored locally
          <small>Your data stays in this browser.</small>
          <button
            className="text-button"
            disabled={busy || loading}
            onClick={() => void download()}
          >
            Export JSON ↓
          </button>
          <button
            className="text-button"
            disabled={busy || loading}
            onClick={() => file.current?.click()}
          >
            Import JSON ↑
          </button>
          <input
            hidden
            ref={file}
            type="file"
            accept=".json,application/json"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </div>
      </aside>
      <main>
        {error && (
          <div className="message error" role="alert">
            {error}
            <button className="icon-button" onClick={() => setError("")}>
              Close
            </button>
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            {notice}
            <button className="icon-button" onClick={() => setNotice("")}>
              Close
            </button>
          </div>
        )}
        {pending && (
          <section className="panel import-preview" aria-label="Import preview">
            <h2>Import backup</h2>
            <p>
              {pending.projects.length} Projects · {pending.todos.length} Tasks
              · {pending.events.length} Events · {pending.links.length} Links ·{" "}
              {pending.projectCategories.length} project topics
            </p>
            <p>All current data will be replaced. Back it up first as JSON.</p>
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => void download()}
              >
                Back up current data
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => {
                  if (confirm("Replace all current data with this backup?"))
                    void transact(() => store.importData(pending)).then(
                      (ok) => {
                        if (ok) {
                          setPending(null);
                          setView("Projects");
                          setSelectedStatuses(new Set(projectStatuses));
                          setCategoryFilter("");
                          setProjectSearch("");
                          setTaskSearch("");
                          setEventSearch("");
                          setNotice("Backup imported.");
                        }
                      },
                    );
                }}
              >
                Replace data
              </button>
              <button
                className="button secondary"
                onClick={() => setPending(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
        {detailContent}
        <div hidden={Boolean(detail)}>
          {loading ? (
            <section className="panel">
              <p>Loading projects …</p>
            </section>
          ) : (
            <>
              {view !== "Project" && (
                <div className="page-heading">
                  <div>
                    <h1>{view === "Dashboard" ? "Dashboard" : view}</h1>
                  </div>
                  <div className="page-actions" ref={setHeaderTarget}>
                    {!["Settings", "Tasks", "Events"].includes(view) && (
                      <button
                        className="button"
                        disabled={busy}
                        onClick={() => setNewProject(!newProject)}
                      >
                        + New project
                      </button>
                    )}
                  </div>
                </div>
              )}
              {newProject && (
                <form className="panel project-create" onSubmit={addProject}>
                  <label className="field">
                    Project name
                    <Field
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name your project"
                    />
                  </label>
                  <div className="form-grid">
                    <label className="field">
                      Project status
                      <select
                        value={status}
                        onChange={(e) =>
                          setStatus(e.target.value as ProjectStatus)
                        }
                      >
                        {projectStatuses.map((s) => (
                          <option key={s} value={s}>
                            {statusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      Project topic
                      <select
                        value={
                          data.projectCategories.some(
                            (c) => c.id === categoryId,
                          )
                            ? categoryId
                            : ""
                        }
                        onChange={(e) => setCategoryId(e.target.value)}
                      >
                        <option value="">No topic</option>
                        {data.projectCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="actions">
                    <Button disabled={busy}>Create project</Button>
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setNewProject(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {!data.projects.length && view !== "Settings" && (
                <section className="panel welcome">
                  <p className="eyebrow">GET STARTED</p>
                  <h2>Your next project starts here.</h2>
                  <p>Create a project or explore the app with sample data.</p>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void transact(() =>
                        store.importData({
                          ...demoData(),
                          schemaVersion: 4,
                          exportedAt: new Date().toISOString(),
                        }),
                      )
                    }
                  >
                    Load sample data
                  </button>
                </section>
              )}
              {view === "Dashboard" && (
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
                        <p className="muted">
                          No open tasks or upcoming events.
                        </p>
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
                                  {taskCount} open tasks · {eventCount} upcoming
                                  events
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
                                      type="checkbox"
                                      aria-label={todo.title}
                                      checked={false}
                                      disabled={busy}
                                      onChange={() => void completeTodo(todo)}
                                    />
                                    <span>
                                      {todo.doNext && (
                                        <span className="do-next-badge">
                                          Do next
                                        </span>
                                      )}
                                      <button
                                        className="task-title-button"
                                        disabled={busy}
                                        onClick={() =>
                                          openItem("task", todo.id)
                                        }
                                      >
                                        {todo.title}
                                      </button>
                                      {todo.dueDate && (
                                        <small
                                          className={
                                            overdue(todo, today)
                                              ? "overdue"
                                              : ""
                                          }
                                        >
                                          {overdue(todo, today)
                                            ? "Overdue · "
                                            : ""}
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
                                {projectEvents.slice(0, 5).map((event) => (
                                  <div
                                    className="overview-event"
                                    key={event.id}
                                  >
                                    <span className="category">
                                      {categoryLabel(event.category)}
                                    </span>
                                    <button
                                      className="event-title"
                                      disabled={busy}
                                      onClick={() =>
                                        openItem("event", event.id)
                                      }
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
                              className="task-title-button"
                              disabled={busy}
                              onClick={() => openItem("task", todo.id)}
                            >
                              {todo.title}
                            </button>
                            <button
                              className="text-button"
                              onClick={() => goProject(todo.projectId)}
                            >
                              {data.projects.find(
                                (p) => p.id === todo.projectId,
                              )?.name || "Project"}
                            </button>
                            {todo.dueDate && (
                              <small
                                className={
                                  overdue(todo, today) ? "overdue" : ""
                                }
                              >
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
              )}
              {view === "Settings" && (
                <>
                  <section className="panel appearance-settings">
                    <h2>Appearance</h2>
                    <p className="description">
                      Choose a theme or follow your system setting.
                    </p>
                    <div
                      className="actions"
                      role="group"
                      aria-label="Color theme"
                    >
                      {(["system", "light", "dark"] as ThemeChoice[]).map(
                        (choice) => (
                          <button
                            key={choice}
                            type="button"
                            className={`button ${theme === choice ? "" : "secondary"}`}
                            aria-pressed={theme === choice}
                            onClick={() => setTheme(choice)}
                          >
                            {choice[0].toUpperCase() + choice.slice(1)}
                          </button>
                        ),
                      )}
                    </div>
                  </section>
                  <CategorySettings
                    categories={data.projectCategories}
                    projects={data.projects}
                    busy={busy}
                    onChange={change}
                  />
                </>
              )}
              {view === "Projects" && (
                <>
                  <div className="panel form-grid project-filters">
                    <fieldset className="status-filter">
                      <legend className="sr-only">Show statuses</legend>
                      <div>
                        {projectStatuses.map((value) => (
                          <label key={value}>
                            <input
                              type="checkbox"
                              checked={selectedStatuses.has(value)}
                              onChange={() => toggleStatus(value)}
                            />
                            {statusLabel(value)}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="field">
                      <span className="sr-only">Filter topic</span>
                      <select
                        value={effectiveCategoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">All topics</option>
                        <option value="none">No topic</option>
                        {data.projectCategories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <SearchField
                      label="Search projects"
                      value={projectSearch}
                      onChange={setProjectSearch}
                    />
                  </div>
                  {!filteredProjects.length && !!data.projects.length && (
                    <p className="panel empty">
                      No projects match the current search or filters.
                    </p>
                  )}
                  <Card className="table-wrap">
                    <Table>
                      <thead>
                        <tr>
                          <th>Project #</th>
                          <th>Title</th>
                          <th>Topic</th>
                          <th>Status</th>
                          <th>Open tasks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProjects.map((p) => (
                          <tr key={p.id}>
                            <td>
                              PRJ-
                              {String(data.projects.indexOf(p) + 1).padStart(
                                3,
                                "0",
                              )}
                            </td>
                            <td>
                              <button
                                className="project-title"
                                onClick={() => goProject(p.id)}
                              >
                                {p.name}
                              </button>
                            </td>
                            <td>
                              {data.projectCategories.find(
                                (c) => c.id === p.categoryId,
                              )?.name || "No topic"}
                            </td>
                            <td>
                              <StatusLabel>{statusLabel(p.status)}</StatusLabel>
                            </td>
                            <td>
                              {
                                data.todos.filter(
                                  (t) => t.projectId === p.id && !t.completed,
                                ).length
                              }
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Card>
                </>
              )}
              {view === "Tasks" && (
                <TodosPanel
                  {...common}
                  todos={data.todos}
                  showHeading={false}
                  headerTarget={headerTarget}
                  search={taskSearch}
                  onSearchChange={setTaskSearch}
                />
              )}
              {view === "Events" && (
                <EventsPanel
                  key={view}
                  showHeading={false}
                  headerTarget={headerTarget}
                  {...common}
                  events={data.events}
                  search={eventSearch}
                  onSearchChange={setEventSearch}
                />
              )}
              {view === "Project" &&
                (project ? (
                  <>
                    <button
                      className="text-button breadcrumb"
                      onClick={() => setView("Projects")}
                    >
                      ← All projects
                    </button>
                    <ProjectHeader
                      key={project.id}
                      project={project}
                      projectCategories={data.projectCategories}
                      links={data.links.filter(
                        (l) => l.projectId === project.id,
                      )}
                      busy={busy}
                      onChange={change}
                      onDelete={deleteProject}
                    />
                    <div className="project-metadata">
                      <span>
                        PRJ-
                        {String(data.projects.indexOf(project) + 1).padStart(
                          3,
                          "0",
                        )}
                      </span>
                      <span>
                        Created {formatDate(project.createdAt.slice(0, 10))}
                      </span>
                      <span>
                        Updated {formatDate(project.updatedAt.slice(0, 10))}
                      </span>
                      <span>
                        {
                          data.todos.filter(
                            (t) => t.projectId === project.id && t.completed,
                          ).length
                        }{" "}
                        /{" "}
                        {
                          data.todos.filter((t) => t.projectId === project.id)
                            .length
                        }{" "}
                        tasks completed
                      </span>
                    </div>
                    <div className="detail-columns">
                      <TodosPanel
                        key={`todo-${project.id}`}
                        {...common}
                        projectId={project.id}
                        todos={data.todos.filter(
                          (t) => t.projectId === project.id,
                        )}
                      />
                      <EventsPanel
                        key={`event-${project.id}`}
                        {...common}
                        projectId={project.id}
                        events={data.events.filter(
                          (e) => e.projectId === project.id,
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <section className="panel empty">
                    This project no longer exists.
                    <button
                      className="text-button"
                      onClick={() => setView("Projects")}
                    >
                      Back to projects
                    </button>
                  </section>
                ))}
            </>
          )}
        </div>
        <footer>
          WinProgMan <span>Personal projects · Local storage</span>
        </footer>
      </main>
    </div>
  );
}
