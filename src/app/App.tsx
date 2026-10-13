import { Button, Field, StatusLabel, Card, Table } from "../ui/components";
import { useEffect, useRef, useState } from "react";
import {
  emptyData,
  metadata,
  projectStatuses,
  type ProjectStatus,
  type AppData,
  type DomainChange,
  type ExportEnvelope,
} from "../domain/types";
import {
  activeProjects,
  formatDate,
  localToday,
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
export function App() {
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [view, setView] = useState<View>("Dashboard");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState(localToday);
  const [newProject, setNewProject] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Aktiv");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pending, setPending] = useState<ExportEnvelope | null>(null);
  const [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    store
      .load()
      .then(setData)
      .catch((e) => setError(errorLabel(e)))
      .finally(() => setLoading(false));
    const timer = setInterval(() => setToday(localToday()), 30000);
    return () => clearInterval(timer);
  }, []);
  async function transact(action: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setData(await store.load());
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
  const effectiveCategoryFilter =
    categoryFilter === "none" ||
    data.projectCategories.some((c) => c.id === categoryFilter)
      ? categoryFilter
      : "";
  const filteredProjects = data.projects.filter(
    (p) =>
      (!statusFilter || p.status === statusFilter) &&
      (!effectiveCategoryFilter ||
        (effectiveCategoryFilter === "none"
          ? !p.categoryId
          : p.categoryId === effectiveCategoryFilter)),
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("Dashboard");
          }}
        >
          <span className="brand-mark">W</span>
          <span>
            WinProgMan<small>Personal workspace</small>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {(
            ["Dashboard", "Projects", "Tasks", "Events", "Settings"] as View[]
          ).map((v, i) => (
            <button
              key={v}
              aria-current={view === v ? "page" : undefined}
              className={`nav-button ${view === v ? "active" : ""}`}
              onClick={() => setView(v)}
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
        <header className="topbar">
          <span>PERSONAL WORKSPACE</span>
          <time dateTime={today}>{formatDate(today)}</time>
        </header>
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
                          setStatusFilter("");
                          setCategoryFilter("");
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
        {loading ? (
          <section className="panel">
            <p>Loading projects …</p>
          </section>
        ) : (
          <>
            {view !== "Project" && (
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {view === "Dashboard" ? "YOUR NEXT STEPS" : "WORKSPACE"}
                  </p>
                  <h1>{view === "Dashboard" ? "Dashboard" : view}</h1>
                  <p className="description">
                    {view === "Dashboard"
                      ? "Open tasks and upcoming events across your projects."
                      : view === "Projects"
                        ? "All your projects, including those currently dormant."
                        : view === "Tasks"
                          ? "Your next steps across all projects."
                          : view === "Settings"
                            ? "Manage your project topics."
                            : "Meetings, decisions and notes in chronological order."}
                  </p>
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
                        data.projectCategories.some((c) => c.id === categoryId)
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
                        schemaVersion: 3,
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
                    <span>Active projects</span>
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
                <div className="section-heading">
                  <h2>Next up</h2>
                  <span className="muted">By project</span>
                </div>
                {!active.length && !!data.projects.length && (
                  <section className="panel empty">
                    All clear. No tasks or upcoming events.
                  </section>
                )}
                {active.map((p) => {
                  const todos = sortTodos(
                    open.filter((t) => t.projectId === p.id),
                  );
                  const events = sortEvents(
                    coming.filter((e) => e.projectId === p.id),
                  );
                  return (
                    <section key={p.id} className="panel overview-card">
                      <div className="section-heading">
                        <div>
                          <button
                            className="project-title"
                            onClick={() => goProject(p.id)}
                          >
                            {p.name} <span>↗</span>
                          </button>
                          <p className="muted">{p.description}</p>
                        </div>
                        <StatusLabel>{statusLabel(p.status)}</StatusLabel>
                      </div>
                      <div className="overview-columns">
                        <div>
                          <h3>OPEN TASKS</h3>
                          {!todos.length && (
                            <p className="muted">No open tasks.</p>
                          )}
                          {todos.map((t) => (
                            <label key={t.id} className="overview-todo">
                              <input
                                type="checkbox"
                                checked={false}
                                disabled={busy}
                                onChange={() =>
                                  void change({
                                    type: "todo.save",
                                    value: {
                                      ...t,
                                      completed: true,
                                      updatedAt: new Date().toISOString(),
                                    },
                                  })
                                }
                              />
                              <span>
                                {t.title}
                                {t.dueDate && (
                                  <small
                                    className={
                                      overdue(t, today) ? "overdue" : ""
                                    }
                                  >
                                    {overdue(t, today) ? "Overdue · " : ""}
                                    {formatDate(t.dueDate)}
                                  </small>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                        <div>
                          <h3>UPCOMING EVENTS</h3>
                          {!events.length && (
                            <p className="muted">No upcoming events.</p>
                          )}
                          {events.slice(0, 5).map((e) => (
                            <div className="overview-event" key={e.id}>
                              <span className="category">
                                {categoryLabel(e.category)}
                              </span>
                              <strong>{e.title}</strong>
                              <small>
                                {formatDate(e.date)}
                                {e.time && ` · ${e.time}`}
                              </small>
                            </div>
                          ))}
                          {events.length > 5 && (
                            <button
                              className="text-button"
                              onClick={() => goProject(p.id)}
                            >
                              + {events.length - 5} more events
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
            {view === "Settings" && (
              <CategorySettings
                categories={data.projectCategories}
                projects={data.projects}
                busy={busy}
                onChange={change}
              />
            )}
            {view === "Projects" && (
              <>
                <div className="panel form-grid project-filters">
                  <label className="field">
                    Filter status
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="">All statuses</option>
                      {projectStatuses.map((s) => (
                        <option key={s} value={s}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    Filter topic
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
                </div>
                {!filteredProjects.length && !!data.projects.length && (
                  <p className="panel empty">
                    No projects match these filters.
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
                        <th>Actions</th>
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
                          <td>
                            <button
                              className="icon-button danger"
                              disabled={busy}
                              onClick={() => {
                                const count =
                                  data.todos.filter((t) => t.projectId === p.id)
                                    .length +
                                  data.events.filter(
                                    (e) => e.projectId === p.id,
                                  ).length +
                                  data.links.filter((l) => l.projectId === p.id)
                                    .length;
                                if (
                                  confirm(
                                    `Delete project "${p.name}" and ${count} related items permanently?`,
                                  )
                                )
                                  void change({
                                    type: "project.delete",
                                    id: p.id,
                                  });
                              }}
                            >
                              Delete
                            </button>
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
              />
            )}
            {view === "Events" && (
              <EventsPanel
                key={view}
                showHeading={false}
                headerTarget={headerTarget}
                {...common}
                events={data.events}
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
                    links={data.links.filter((l) => l.projectId === project.id)}
                    busy={busy}
                    onChange={change}
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
        <footer>
          WinProgMan <span>Personal projects · Local storage</span>
        </footer>
      </main>
    </div>
  );
}
