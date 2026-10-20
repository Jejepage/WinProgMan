import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  AUTO_PROJECT_NUMBER,
  metadata,
  projectStatuses,
  type DomainChange,
  type ExportEnvelope,
  type ProjectStatus,
  type Todo,
} from "../domain/types";
import {
  activeProjects,
  localToday,
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
import { openItem, openNewItem } from "../ui/itemNavigation";
import { errorLabel } from "../ui/labels";
import { projectReport } from "../domain/report";
import { confirmAction, saveBackup, saveTextFile } from "../platform/desktop";
import { ImportPreview } from "./ImportPreview";
import { NewProjectForm, type NewProjectDraft } from "./NewProjectForm";
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
import { useAppStore } from "./useAppStore";
import { usePreferences } from "./usePreferences";

const store = new IndexedDbProjectStore();
const emptyDraft = (): NewProjectDraft => ({
  name: "",
  status: "Aktiv",
  categoryId: "",
});

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [headerTarget, setHeaderTarget] = useState<HTMLDivElement | null>(null);
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
          : "Dashboard";
  });
  const [projectId, setProjectId] = useState("");
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
  const [newProject, setNewProject] = useState(false);
  const [draft, setDraft] = useState<NewProjectDraft>(emptyDraft);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ProjectStatus>>(
    () => new Set(projectStatuses),
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [importantOnly, setImportantOnly] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [noteSearch, setNoteSearch] = useState("");
  const [pending, setPending] = useState<ExportEnvelope | null>(null);
  const [notice, setNotice] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [undo, setUndo] = useState<{ id: string; label: string } | null>(null);
  const prefs = usePreferences();
  const brainstormPanel = useRef<BrainstormPanelHandle>(null);
  const [brainstormOpened, setBrainstormOpened] = useState(false);
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
  const closeDetail = () => {
    if (openedOnLoad.current && detail && detail.kind !== "task") {
      const note = detail.creating
        ? detail.kind === "note" || detail.notesOnly
        : data.events.find((event) => event.id === detail.id)?.category ===
          "Notiz";
      setView(note ? "Notes" : "Events");
    }
    openedOnLoad.current = false;
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    setDetail(null);
  };
  useEffect(() => {
    const update = () => {
      setDetail(readDetail());
      setSettingsOpen(false);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  async function navigate(next: View) {
    try {
      await brainstormPanel.current?.flush();
      if (next === "Settings") {
        setSettingsOpen(true);
        return;
      }
      setSettingsOpen(false);
      closeDetail();
      if (next === "Brainstorm") setBrainstormOpened(true);
      setNewProject(false);
      setView(next);
    } catch (e) {
      setError(errorLabel(e));
    }
  }
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
      closeDetail();
      setNewProject(false);
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
      run: () => {
        void navigate("Projects").then(() => setNewProject(true));
      },
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
  const goProject = (id: string) => {
    setProjectId(id);
    setView("Project");
  };
  const project = data.projects.find((p) => p.id === projectId);
  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const value = {
      ...metadata(),
      number: AUTO_PROJECT_NUMBER,
      name: draft.name.trim() || "New project",
      description: "",
      status: draft.status,
      ...(draft.categoryId &&
      data.projectCategories.some((c) => c.id === draft.categoryId)
        ? { categoryId: draft.categoryId }
        : {}),
    };
    if (await change({ type: "project.save", value })) {
      setNewProject(false);
      setDraft(emptyDraft());
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
      (await confirmAction(
        `Delete project "${project.name}" and ${count} related items permanently?`,
      )) &&
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
    closeDetail();
    setNewProject(false);
    setSettingsOpen(false);
    setBrainstormOpened(false);
    setPending(null);
    setView("Projects");
    setSelectedStatuses(new Set(projectStatuses));
    setCategoryFilter("");
    setNoteSearch("");
    setProjectSearch("");
    setTaskSearch("");
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
  const filteredProjects = data.projects.filter(
    (p) =>
      selectedStatuses.has(p.status) &&
      (!importantOnly || !!p.important) &&
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
            onClose={closeDetail}
          />
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
                    {![
                      "Settings",
                      "Tasks",
                      "Events",
                      "Notes",
                      "Brainstorm",
                    ].includes(view) && (
                      <button
                        className="button"
                        disabled={busy}
                        aria-label="New project"
                        title="New project"
                        onClick={() => setNewProject(!newProject)}
                      >
                        <Plus size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}
              {newProject && (
                <NewProjectForm
                  draft={draft}
                  onDraft={setDraft}
                  categories={data.projectCategories}
                  busy={busy}
                  onSubmit={addProject}
                  onCancel={() => setNewProject(false)}
                />
              )}
              {!data.projects.length &&
                view !== "Settings" &&
                view !== "Brainstorm" && (
                  <section className="panel welcome">
                    <p className="eyebrow">GET STARTED</p>
                    <h2>Your next project starts here.</h2>
                    <p>Create a project or explore the app with sample data.</p>
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
                  importantOnly={importantOnly}
                  onImportantOnly={setImportantOnly}
                  onChange={change}
                  busy={busy}
                  onReport={() => void report()}
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
