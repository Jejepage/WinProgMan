import { Button, Field } from "../ui/components";
import { useEffect, useRef, useState } from "react";
import {
  emptyData,
  metadata,
  projectStatuses,
  type Project,
  type ProjectStatus,
  type AppData,
  type DomainChange,
  type ExportEnvelope,
} from "../domain/types";
import { formatDate, localToday, matchesSearch } from "../domain/queries";
import { demoData } from "../domain/demo";
import { IndexedDbProjectStore } from "../storage/IndexedDbProjectStore";
import { ConflictError } from "../storage/ProjectStore";
import { GlobalSearch } from "../features/search/GlobalSearch";
import { QuickCapture } from "../features/quick-capture/QuickCapture";
import { Dashboard } from "../features/dashboard/Dashboard";
import { FocusMode } from "../features/focus/FocusMode";
import { TrashPanel } from "../features/trash/TrashPanel";
import { Dialog, DialogErrorContext } from "../ui/dialogs";
import { validateImport } from "../storage/validation";
import { TodosPanel } from "../features/todos/TodosPanel";
import { EventsPanel } from "../features/events/EventsPanel";
import { ProjectList } from "../features/projects/ProjectList";
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
import { statusLabel, errorLabel } from "../ui/labels";
type View =
  "Dashboard" | "Projects" | "Tasks" | "Events" | "Project" | "Settings";
type ThemeChoice = "system" | "light" | "dark";
export function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{
    type: string;
    id: string;
  } | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const importRevision = useRef<number | undefined>(undefined);
  const readSequence = useRef(0);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [view, setView] = useState<View>("Dashboard");
  const cachedProject = useRef<Project | undefined>(undefined);
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
  useEffect(() => {
    store
      .load()
      .then(setData)
      .catch((e) => setError(errorLabel(e)))
      .finally(() => setLoading(false));
    const timer = setInterval(() => setToday(localToday()), 30000);
    const unsubscribe = store.subscribe(() => {
      void store
        .load()
        .then(setData)
        .catch((e) => setError(errorLabel(e)));
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
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
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        event.isComposing
      )
        return;
      if (event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!document.querySelector("dialog[open]")) setCaptureOpen(true);
      } else if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!document.querySelector("dialog[open]")) setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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
      if (e instanceof ConflictError) setData(await store.load());
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const change = async (value: DomainChange) => {
    const ok = await transact(() => store.apply(value));
    if (
      ok &&
      ["project.delete", "todo.delete", "event.delete", "link.delete"].includes(
        value.type,
      ) &&
      "id" in value
    ) {
      const latest = await store.load();
      const entry = latest.trash.find((item) =>
        [
          ...item.data.projects,
          ...item.data.todos,
          ...item.data.events,
          ...item.data.links,
        ].some((record) => record.id === value.id),
      );
      if (entry) {
        setUndoId(entry.id);
        setNotice(
          `${entry.type === "todo" ? "Task" : entry.type[0].toUpperCase() + entry.type.slice(1)} deleted`,
        );
      }
    }
    return ok;
  };
  const goProject = (id: string) => {
    setSelectedItem(null);
    setProjectId(id);
    setView("Project");
  };
  const openItem = (
    type: "project" | "todo" | "event" | "link",
    id: string,
    parentId: string,
  ) => {
    goProject(parentId);
    setSelectedItem({ type, id });
    setSearchOpen(false);
    setFocusId(null);
    if (type === "link")
      requestAnimationFrame(() =>
        document
          .querySelector(".links-heading")
          ?.scrollIntoView({ block: "center" }),
      );
  };
  const liveProject = data.projects.find((p) => p.id === projectId);
  if (liveProject) cachedProject.current = liveProject;
  // Keep mounted editors and their drafts when another window removes the parent.
  const project =
    liveProject ??
    (cachedProject.current?.id === projectId
      ? cachedProject.current
      : undefined);
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
        `Delete project "${project.name}" and ${count} related items to Trash?`,
      ) &&
      (await change({
        type: "project.delete",
        id: project.id,
        expectedRevision: project.revision,
      }))
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
    setPending(null);
    const sequence = ++readSequence.current;
    if (!value) return;
    importRevision.current = data.revision;
    try {
      const parsed = validateImport(JSON.parse(await value.text()));
      if (sequence !== readSequence.current) return;
      setPending(parsed);
      setError("");
    } catch (e) {
      if (sequence !== readSequence.current) return;
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
      matchesSearch(
        projectSearch,
        p.name,
        `PRJ-${String(p.projectNumber).padStart(3, "0")}`,
      ),
  );
  return (
    <DialogErrorContext.Provider value={error}>
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
          <div className="workspace-tools">
            <button
              className="button secondary"
              disabled={loading || busy}
              onClick={() => setSearchOpen(true)}
            >
              Search all <kbd>Ctrl Shift F</kbd>
            </button>
            <button
              className="button"
              disabled={loading || busy}
              onClick={() => setCaptureOpen(true)}
            >
              Quick Capture <kbd>Ctrl K</kbd>
            </button>
          </div>
          {searchOpen && (
            <GlobalSearch
              data={data}
              onClose={() => setSearchOpen(false)}
              onOpen={openItem}
            />
          )}
          {captureOpen && (
            <QuickCapture
              data={data}
              projectId={view === "Project" ? projectId : undefined}
              today={today}
              busy={busy}
              onChange={change}
              onClose={() => setCaptureOpen(false)}
            />
          )}
          {focusId && (
            <FocusMode
              data={data}
              todoId={focusId}
              busy={busy}
              onChange={change}
              onClose={() => setFocusId(null)}
              onOpen={openItem}
            />
          )}
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
              {undoId && data.trash.some((entry) => entry.id === undoId) && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void change({ type: "trash.restore", id: undoId }).then(
                      (ok) => {
                        if (ok) {
                          setUndoId(null);
                          setNotice("Item restored.");
                        }
                      },
                    )
                  }
                >
                  Undo
                </button>
              )}
              <button className="icon-button" onClick={() => setNotice("")}>
                Close
              </button>
            </div>
          )}
          {pending && (
            <section
              className="panel import-preview"
              aria-label="Import preview"
            >
              <h2>Import backup</h2>
              <p>
                {pending.projects.length} Projects · {pending.todos.length}{" "}
                Tasks · {pending.events.length} Events · {pending.links.length}{" "}
                Links · {pending.projectCategories.length} project topics ·{" "}
                {pending.trash.length} trashed items
              </p>
              <p>
                All current data will be replaced. Back it up first as JSON.
              </p>
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
                      void transact(() =>
                        store.importData(pending, importRevision.current),
                      ).then((ok) => {
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
                      });
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
                <Dialog
                  title="New project"
                  onClose={() => setNewProject(false)}
                >
                  <form className="project-create" onSubmit={addProject}>
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
                </Dialog>
              )}
              {!data.projects.length && view !== "Settings" && (
                <section className="panel welcome">
                  <p className="eyebrow">GET STARTED</p>
                  <h2>Your next project starts here.</h2>
                  <p>Create a project or explore the app with sample data.</p>
                  <button
                    className="button secondary"
                    disabled={busy || data.trash.length > 0}
                    onClick={() => {
                      const sample = demoData();
                      sample.projects = sample.projects.map((value, index) => ({
                        ...value,
                        projectNumber: data.nextProjectNumber + index,
                      }));
                      sample.nextProjectNumber =
                        data.nextProjectNumber + sample.projects.length;
                      void transact(() =>
                        store.importData(
                          {
                            ...sample,
                            schemaVersion: 5,
                            exportedAt: new Date().toISOString(),
                          },
                          data.revision,
                        ),
                      );
                    }}
                  >
                    Load sample data
                  </button>
                  {!!data.trash.length && (
                    <p className="muted">
                      Restore deleted projects in Settings → Trash. Sample data
                      is available for an empty workspace.
                    </p>
                  )}
                </section>
              )}
              {view === "Dashboard" && (
                <Dashboard
                  data={data}
                  today={today}
                  busy={busy}
                  change={change}
                  goProject={goProject}
                  openItem={openItem}
                  onFocus={setFocusId}
                />
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
                  <TrashPanel data={data} busy={busy} onChange={change} />
                  <CategorySettings
                    categories={data.projectCategories}
                    projects={data.projects}
                    busy={busy}
                    onChange={change}
                  />
                </>
              )}
              {view === "Projects" && (
                <ProjectList
                  data={data}
                  filteredProjects={filteredProjects}
                  selectedStatuses={selectedStatuses}
                  toggleStatus={toggleStatus}
                  effectiveCategoryFilter={effectiveCategoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  projectSearch={projectSearch}
                  setProjectSearch={setProjectSearch}
                  goProject={goProject}
                />
              )}
              {view === "Tasks" && (
                <TodosPanel
                  {...common}
                  todos={data.todos}
                  events={data.events}
                  onFocus={setFocusId}
                  onEvent={(id) => {
                    const event = data.events.find((e) => e.id === id);
                    if (event) openItem("event", id, event.projectId);
                  }}
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
                  todos={data.todos}
                  onFocus={setFocusId}
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
                    {!liveProject && (
                      <p role="alert" className="message error">
                        This project was deleted in another window. Your editor
                        drafts are preserved. Restore the project in Settings →
                        Trash before saving.
                      </p>
                    )}
                    <ProjectHeader
                      key={project.id}
                      deleted={!liveProject}
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
                        {String(project.projectNumber).padStart(3, "0")}
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
                        events={data.events}
                        onFocus={setFocusId}
                        onEvent={(id) => openItem("event", id, project.id)}
                        onSelectedHandled={() => setSelectedItem(null)}
                        selectedId={
                          selectedItem?.type === "todo"
                            ? selectedItem.id
                            : undefined
                        }
                        todos={data.todos.filter(
                          (t) => t.projectId === project.id,
                        )}
                      />
                      <EventsPanel
                        key={`event-${project.id}`}
                        {...common}
                        projectId={project.id}
                        todos={data.todos}
                        onFocus={setFocusId}
                        onSelectedHandled={() => setSelectedItem(null)}
                        selectedId={
                          selectedItem?.type === "event"
                            ? selectedItem.id
                            : undefined
                        }
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
    </DialogErrorContext.Provider>
  );
}
