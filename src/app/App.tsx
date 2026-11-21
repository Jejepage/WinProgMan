import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  projectStatuses,
  type DomainChange,
  type ExportEnvelope,
  type ProjectStatus,
  type Todo,
} from "../domain/types";
import {
  activeProjects,
  localToday,
  matchesOwner,
  matchesSearch,
  sortTodos,
  upcoming,
} from "../domain/queries";
import { demoData } from "../domain/demo";
import { IndexedDbProjectStore } from "../storage/IndexedDbProjectStore";
import { validateImport } from "../storage/validation";
import { TodosPanel } from "../features/todos/TodosPanel";
import { EventsPanel } from "../features/events/EventsPanel";
import {
  BrainstormPanel,
  type BrainstormPanelHandle,
} from "../features/brainstorm/BrainstormPanel";
import {
  CommandPalette,
  type PaletteAction,
} from "../features/search/CommandPalette";
import type { SearchResult } from "../domain/search";
import { ownConflicts } from "../sync/conflicts";
import { deviceId } from "../sync/useSync";
import { openItem, openNewItem, type ItemKind } from "../ui/itemNavigation";
import { errorLabel } from "../ui/labels";
import { projectReport } from "../domain/report";
import { confirmAction, saveBackup, saveTextFile } from "../platform/desktop";
import { ImportPreview } from "./ImportPreview";
import { NewMenu } from "./NewMenu";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { Sidebar } from "./Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { DetailPage } from "./pages/DetailPage";
import { ProjectPage } from "./pages/ProjectPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SettingsPage } from "./pages/SettingsPage";
import {
  navigationViews,
  readDetail,
  type PanelShared,
  type View,
} from "./types";
import {
  isDetailHistoryEntry,
  readLastRoute,
  readRoute,
  rememberRoute,
  routeHash,
  type Route,
} from "./route";
import { useAppStore } from "./useAppStore";
import { usePreferences } from "./usePreferences";

const store = new IndexedDbProjectStore();
/** Views reachable with the number keys 1–6, in navigation order. */
const shortcutViews = navigationViews.filter((v) => v !== "Settings");

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
  // A hash wins; without one the app reopens the last main view.
  const [initialRoute] = useState<Route | null>(() =>
    readDetail() ? null : (readRoute() ?? readLastRoute()),
  );
  const [view, setView] = useState<View>(() => {
    const kind = new URLSearchParams(window.location.hash.slice(1)).get(
      "detail",
    );
    return kind === "task"
      ? "Tasks"
      : kind === "note"
        ? "Notes"
        : kind === "event"
          ? "Events"
          : kind === "project"
            ? "Projects"
            : (initialRoute?.view ?? "Dashboard");
  });
  const [projectId, setProjectId] = useState(initialRoute?.projectId ?? "");
  const {
    data,
    busy,
    loading,
    error,
    setError,
    sync,
    saveBrainstorm,
    transact,
  } = useAppStore(store);
  const [today, setToday] = useState(localToday);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ProjectStatus>>(
    () => new Set(projectStatuses),
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [taskProjectFilter, setTaskProjectFilter] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [pending, setPending] = useState<ExportEnvelope | null>(null);
  const [notice, setNotice] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const prefs = usePreferences();
  const brainstormPanel = useRef<BrainstormPanelHandle>(null);
  const [brainstormOpened, setBrainstormOpened] = useState(
    view === "Brainstorm",
  );
  const file = useRef<HTMLInputElement>(null);
  const replaced = ownConflicts(data.tombstones, deviceId()).length;
  useEffect(() => {
    const timer = setInterval(() => setToday(localToday()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 15000);
    return () => clearTimeout(timer);
  }, [undo]);
  const [detail, setDetail] = useState(readDetail);
  const openedOnLoad = useRef(Boolean(detail));
  const currentRoute = (): Route =>
    view === "Project" && projectId
      ? { view: "Project", projectId }
      : { view: view === "Project" || view === "Settings" ? "Projects" : view };
  /** Shows a main view and records it in the URL (pushed unless `replace`). */
  const goTo = (route: Route, replace = false) => {
    const hash = routeHash(route);
    if (window.location.hash !== hash) {
      if (replace) window.history.replaceState(null, "", hash);
      else window.history.pushState(null, "", hash);
    }
    openedOnLoad.current = false;
    setDetail(null);
    if (route.projectId) setProjectId(route.projectId);
    if (route.view === "Brainstorm") setBrainstormOpened(true);
    setView(route.view);
  };
  const closeDetail = () => {
    // Opened inside the app: going back restores the list and its URL.
    if (detail && isDetailHistoryEntry()) {
      window.history.back();
      return;
    }
    let next = currentRoute();
    if (openedOnLoad.current && detail && detail.kind !== "task") {
      const note = detail.creating
        ? detail.kind === "note" || detail.notesOnly
        : data.events.find((event) => event.id === detail.id)?.category ===
          "Notiz";
      next = {
        view:
          detail.kind === "project" ? "Projects" : note ? "Notes" : "Events",
      };
    }
    goTo(next, true);
  };
  useEffect(() => {
    // The first entry gets the hash of the start view, so Back can return to it.
    if (!window.location.hash) {
      window.history.replaceState(null, "", routeHash(currentRoute()));
    }
    const update = () => {
      const next = readDetail();
      setDetail(next);
      setSettingsOpen(false);
      if (next) return;
      openedOnLoad.current = false;
      const route = readRoute();
      if (!route) return;
      if (route.projectId) setProjectId(route.projectId);
      if (route.view === "Brainstorm") setBrainstormOpened(true);
      setView(route.view);
    };
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    return () => {
      window.removeEventListener("hashchange", update);
      window.removeEventListener("popstate", update);
    };
    // Registered once; it reads the URL, not React state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (view !== "Settings" && (view !== "Project" || projectId))
      rememberRoute(currentRoute());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, projectId]);
  async function navigate(next: View) {
    try {
      await brainstormPanel.current?.flush();
      if (next === "Settings") {
        setSettingsOpen(true);
        return;
      }
      setSettingsOpen(false);
      goTo(
        next === "Project" && projectId
          ? { view: "Project", projectId }
          : { view: next === "Project" ? "Projects" : next },
        Boolean(detail),
      );
    } catch (e) {
      setError(errorLabel(e));
    }
  }
  /** "New" in the current context: a task on a project page, a note in Notes … */
  function newForView() {
    const kind: ItemKind =
      view === "Tasks" || view === "Project"
        ? "task"
        : view === "Events"
          ? "event"
          : view === "Notes"
            ? "note"
            : "project";
    if (kind !== "project" && !data.projects.length) return;
    openNewItem(
      kind,
      view === "Project" ? projectId : undefined,
      kind === "note",
    );
  }
  const shortcutState = useRef({ navigate, newForView, blocked: false });
  shortcutState.current = {
    navigate,
    newForView,
    blocked: paletteOpen || shortcutsOpen || loading,
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.defaultPrevented || shortcutState.current.blocked) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], .rich-note-editor',
        )
      )
        return;
      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      // While an editor or Settings is open, only ? applies.
      if (readDetail() || document.querySelector(".settings-page")) return;
      const position = Number(event.key);
      if (Number.isInteger(position) && position >= 1 && position <= 6) {
        event.preventDefault();
        void shortcutState.current.navigate(shortcutViews[position - 1]);
      } else if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        shortcutState.current.newForView();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        // Ctrl+K inside the note editor inserts a link.
        const target = event.target instanceof Element ? event.target : null;
        if (
          event.defaultPrevented ||
          target?.closest('.rich-note-editor, [contenteditable="true"]')
        )
          return;
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  async function openResult(result: SearchResult) {
    try {
      await brainstormPanel.current?.flush();
    } catch (e) {
      setError(errorLabel(e));
      return;
    }
    if (
      result.kind === "task" ||
      result.kind === "event" ||
      result.kind === "note"
    ) {
      openItem(result.kind, result.id);
    } else if (result.kind === "project") {
      setSettingsOpen(false);
      goProject(result.id);
    } else {
      void navigate("Brainstorm");
    }
  }
  const paletteActions: PaletteAction[] = [
    ...navigationViews.map((v) => ({
      id: `go-${v}`,
      label: `Go to ${v}`,
      run: () => void navigate(v),
    })),
    { id: "new-task", label: "New task", run: () => openNewItem("task") },
    { id: "new-event", label: "New event", run: () => openNewItem("event") },
    {
      id: "new-note",
      label: "New note",
      run: () => openNewItem("note", undefined, true),
    },
    {
      id: "new-project",
      label: "New project",
      run: () => openNewItem("project"),
    },
    {
      id: "shortcuts",
      label: "Show keyboard shortcuts",
      run: () => setShortcutsOpen(true),
    },
  ];
  const change = async (value: DomainChange) => {
    const done = await transact(() => store.apply(value));
    if (!done) return false;
    if (
      value.type === "todo.delete" ||
      value.type === "event.delete" ||
      value.type === "project.delete" ||
      value.type === "link.delete" ||
      value.type === "quicklink.delete" ||
      value.type === "category.delete"
    ) {
      setUndo({ id: value.id, label: "Moved to trash." });
      setNotice("");
    } else if (value.type === "trash.restore") {
      setUndo(null);
      setNotice("Restored.");
    }
    return true;
  };
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
  const goProject = (id: string) =>
    goTo({ view: "Project", projectId: id }, Boolean(detail));
  const project = data.projects.find((p) => p.id === projectId);
  async function deleteProject() {
    if (!project) return;
    const count =
      data.todos.filter((todo) => todo.projectId === project.id).length +
      data.events.filter((event) => event.projectId === project.id).length +
      data.links.filter((link) => link.projectId === project.id).length;
    if (
      (await confirmAction(
        `Delete project "${project.name}" and ${count} related items permanently?`,
      )) &&
      (await change({ type: "project.delete", id: project.id }))
    ) {
      setProjectId("");
      goTo({ view: "Projects" }, true);
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
  async function report() {
    try {
      const ok = await saveTextFile(
        `winprogman-report-${today}.md`,
        projectReport(data, filteredProjects, today),
        "text/markdown",
        "md",
        "Markdown report",
      );
      if (ok) setNotice("Project report saved.");
    } catch (e) {
      setError(errorLabel(e));
    }
  }
  async function download() {
    try {
      await brainstormPanel.current?.flush();
      const value = await store.exportData();
      if (
        await saveBackup(
          `winprogman-${today}.json`,
          JSON.stringify(value, null, 2),
        )
      ) {
        setNotice("JSON backup downloaded.");
        return true;
      }
    } catch (e) {
      setError(errorLabel(e));
    }
    return false;
  }
  async function readFile(value: File | undefined) {
    if (!value) return;
    try {
      await brainstormPanel.current?.flush();
      setPending(validateImport(JSON.parse(await value.text())));
      setError("");
    } catch (e) {
      setError(e instanceof SyntaxError ? "Invalid JSON file." : errorLabel(e));
    }
    if (file.current) file.current.value = "";
  }
  async function replaceData() {
    if (!pending) return;
    if (!(await confirmAction("Replace all current data with this backup?")))
      return;
    const ok = await transact(async () => {
      await brainstormPanel.current?.flush();
      await store.importData(pending);
    });
    if (!ok) return;
    setSettingsOpen(false);
    setBrainstormOpened(false);
    setPending(null);
    goTo({ view: "Projects" }, true);
    setSelectedStatuses(new Set(projectStatuses));
    setCategoryFilter("");
    setNoteSearch("");
    setProjectSearch("");
    setTaskSearch("");
    setTaskProjectFilter("");
    setEventSearch("");
    setUndo(null);
    setNotice("Backup imported.");
  }
  function showTrash() {
    void navigate("Settings").then(() =>
      setTimeout(
        () =>
          document
            .getElementById("trash-settings")
            ?.scrollIntoView({ block: "start" }),
        0,
      ),
    );
  }
  const shared: PanelShared = {
    compactSections: prefs.design === "split-compact",
    showCreated: prefs.taskCreated === "show",
    projects: data.projects,
    today,
    busy,
    onChange: change,
    onProject: goProject,
  };
  const open = data.todos.filter((t) => !t.completed);
  const effectiveCategoryFilter =
    categoryFilter === "none" ||
    data.projectCategories.some((c) => c.id === categoryFilter)
      ? categoryFilter
      : "";
  const effectiveOwnerFilter =
    ownerFilter === "none" ||
    data.projects.some((p) => matchesOwner(ownerFilter, p))
      ? ownerFilter
      : "";
  const filteredProjects = data.projects.filter(
    (p) =>
      selectedStatuses.has(p.status) &&
      (!importantOnly || !!p.important) &&
      matchesOwner(effectiveOwnerFilter, p) &&
      (!effectiveCategoryFilter ||
        (effectiveCategoryFilter === "none"
          ? !p.categoryId
          : p.categoryId === effectiveCategoryFilter)) &&
      matchesSearch(projectSearch, p.name),
  );
  return (
    <div
      className={`app-shell ${prefs.sidebar === "icons" ? "sidebar-icons" : ""} ${view === "Brainstorm" ? "brainstorm-view" : ""}`}
      data-view={settingsOpen ? "Settings" : view}
      data-navigation={prefs.navigation}
    >
      <Sidebar
        current={settingsOpen ? "Settings" : view}
        projectCount={data.projects.length}
        syncState={sync.state}
        replaced={replaced}
        onNavigate={(next) => void navigate(next)}
        onSearch={() => setPaletteOpen(true)}
        onShowTrash={showTrash}
      />
      <main>
        {paletteOpen && (
          <CommandPalette
            data={data}
            actions={paletteActions}
            onResult={(result) => void openResult(result)}
            onClose={() => setPaletteOpen(false)}
          />
        )}
        <input
          hidden
          ref={file}
          type="file"
          accept=".json,application/json"
          onChange={(e) => void readFile(e.target.files?.[0])}
        />
        {error && (
          <div className="message error" role="alert">
            {error}
            <button className="icon-button" onClick={() => setError("")}>
              Close
            </button>
          </div>
        )}
        {undo && (
          <div className="message" role="status">
            {undo.label}
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void change({ type: "trash.restore", id: undo.id })
              }
            >
              Undo
            </button>
            <button className="icon-button" onClick={() => setUndo(null)}>
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
          <ImportPreview
            pending={pending}
            busy={busy}
            onBackup={() => void download()}
            onReplace={() => void replaceData()}
            onCancel={() => setPending(null)}
          />
        )}
        {settingsOpen && (
          <SettingsPage
            prefs={prefs}
            sync={sync}
            data={data}
            busy={busy}
            loading={loading}
            onChange={change}
            onExport={download}
            onImport={() => file.current?.click()}
            onClose={() => setSettingsOpen(false)}
          />
        )}
        {detail && (
          <DetailPage
            detail={detail}
            data={data}
            hidden={settingsOpen}
            error={error}
            loading={loading}
            shared={shared}
            backLabel={
              view === "Project"
                ? project?.name || "Project"
                : view === "Settings"
                  ? "Projects"
                  : view
            }
            onClose={closeDetail}
            onProjectCreated={(id) =>
              goTo({ view: "Project", projectId: id }, true)
            }
          />
        )}
        {shortcutsOpen && (
          <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />
        )}
        <div hidden={Boolean(detail) || settingsOpen}>
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
                    {view === "Dashboard" && (
                      <NewMenu
                        disabled={busy}
                        hasProjects={data.projects.length > 0}
                      />
                    )}
                    {view === "Projects" && (
                      <button
                        className="button add-button"
                        disabled={busy}
                        aria-label="New project"
                        title="New project (N)"
                        onClick={() => openNewItem("project")}
                      >
                        <Plus size={16} aria-hidden="true" />
                        <span className="button-label">Project</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
              {!data.projects.length &&
                view !== "Settings" &&
                view !== "Brainstorm" && (
                  <section className="panel welcome">
                    <p className="eyebrow">GET STARTED</p>
                    <h2>Your next project starts here.</h2>
                    <p>Create a project or explore the app with sample data.</p>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => openNewItem("project")}
                    >
                      Create project
                    </button>{" "}
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() =>
                        void change({
                          type: "samples.load",
                          value: demoData(),
                        })
                      }
                    >
                      Load sample data
                    </button>
                  </section>
                )}
              {view === "Dashboard" && (
                <DashboardPage
                  data={data}
                  today={today}
                  busy={busy}
                  onProject={goProject}
                  onNavigate={(target) => void navigate(target)}
                  onComplete={(todo) => void completeTodo(todo)}
                  onChange={change}
                  active={activeProjects(data, today)}
                  open={open}
                  coming={data.events.filter((e) => upcoming(e, today))}
                  doNext={sortTodos(open.filter((todo) => todo.doNext))}
                />
              )}
              {view === "Projects" && (
                <ProjectsPage
                  data={data}
                  selectedStatuses={selectedStatuses}
                  onToggleStatus={toggleStatus}
                  categoryFilter={effectiveCategoryFilter}
                  onCategoryFilter={setCategoryFilter}
                  search={projectSearch}
                  onSearch={setProjectSearch}
                  projects={filteredProjects}
                  onProject={goProject}
                  ownerFilter={effectiveOwnerFilter}
                  onOwnerFilter={setOwnerFilter}
                  importantOnly={importantOnly}
                  onImportantOnly={setImportantOnly}
                  onChange={change}
                  busy={busy}
                  onReport={() => void report()}
                  panel={shared}
                />
              )}
              {view === "Tasks" && (
                <TodosPanel
                  {...shared}
                  todos={data.todos}
                  showHeading={false}
                  headerTarget={headerTarget}
                  search={taskSearch}
                  onSearchChange={setTaskSearch}
                  projectFilter={taskProjectFilter}
                  onProjectFilterChange={setTaskProjectFilter}
                />
              )}
              {view === "Events" && (
                <EventsPanel
                  key={view}
                  showHeading={false}
                  headerTarget={headerTarget}
                  {...shared}
                  events={data.events}
                  search={eventSearch}
                  onSearchChange={setEventSearch}
                />
              )}
              {view === "Notes" && (
                <EventsPanel
                  key={view}
                  {...shared}
                  notesOnly
                  showHeading={false}
                  headerTarget={headerTarget}
                  events={data.events}
                  search={noteSearch}
                  onSearchChange={setNoteSearch}
                />
              )}
              {brainstormOpened && (
                <div hidden={view !== "Brainstorm"}>
                  <BrainstormPanel
                    ref={brainstormPanel}
                    brainstorm={data.brainstorm}
                    onSave={saveBrainstorm}
                    disabled={busy}
                  />
                </div>
              )}
              {view === "Project" && (
                <ProjectPage
                  data={data}
                  projectId={projectId}
                  busy={busy}
                  compact={prefs.design === "split-compact"}
                  shared={shared}
                  onChange={change}
                  onDelete={deleteProject}
                  onBack={() => setView("Projects")}
                />
              )}
            </>
          )}
        </div>
        <footer>
          Plan B <span>Personal projects · Local storage</span>
        </footer>
      </main>
    </div>
  );
}
