import { useEffect, useRef, useState } from "react";
import {
  emptyData,
  metadata,
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
const store = new IndexedDbProjectStore();
type View = "Überblick" | "Projekte" | "To-Dos" | "Ereignisse" | "Projekt";
export function App() {
  const [data, setData] = useState<AppData>(emptyData);
  const [view, setView] = useState<View>("Überblick");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [today, setToday] = useState(localToday);
  const [newProject, setNewProject] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<ExportEnvelope | null>(null);
  const [notice, setNotice] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    store
      .load()
      .then(setData)
      .catch((e) => setError(String(e.message || e)))
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
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const change = (value: DomainChange) => transact(() => store.apply(value));
  const goProject = (id: string) => {
    setProjectId(id);
    setView("Projekt");
  };
  const project = data.projects.find((p) => p.id === projectId);
  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    const value = {
      ...metadata(),
      name: name.trim() || "Neues Projekt",
      description: "",
    };
    if (await change({ type: "project.save", value })) {
      setNewProject(false);
      setName("");
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
      setNotice("JSON-Sicherung heruntergeladen.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function readFile(value: File | undefined) {
    if (!value) return;
    try {
      setPending(validateImport(JSON.parse(await value.text())));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ungültige JSON-Datei.");
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("Überblick");
          }}
        >
          <span className="brand-mark">W</span>
          <span>
            WinProgMan<small>Raum für deine Projekte</small>
          </span>
        </a>
        <p className="nav-label">ARBEITSPLATZ</p>
        <nav aria-label="Hauptnavigation">
          {(["Überblick", "Projekte", "To-Dos", "Ereignisse"] as View[]).map(
            (v, i) => (
              <button
                key={v}
                aria-current={view === v ? "page" : undefined}
                className={`nav-button ${view === v ? "active" : ""}`}
                onClick={() => setView(v)}
              >
                <span aria-hidden="true">{["◫", "▤", "✓", "◷"][i]}</span>
                {v}
                {v === "Projekte" && <small>{data.projects.length}</small>}
              </button>
            ),
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" /> Lokal gespeichert
          <small>Dein Bestand bleibt in diesem Browser.</small>
          <button
            className="text-button"
            disabled={busy || loading}
            onClick={() => void download()}
          >
            JSON exportieren ↓
          </button>
          <button
            className="text-button"
            disabled={busy || loading}
            onClick={() => file.current?.click()}
          >
            JSON importieren ↑
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
          <span>DEIN PROJEKTALLTAG</span>
          <time dateTime={today}>{formatDate(today)}</time>
        </header>
        {error && (
          <div className="message error" role="alert">
            {error}
            <button className="icon-button" onClick={() => setError("")}>
              Schließen
            </button>
          </div>
        )}
        {notice && (
          <div className="message" role="status">
            {notice}
            <button className="icon-button" onClick={() => setNotice("")}>
              Schließen
            </button>
          </div>
        )}
        {pending && (
          <section className="panel import-preview" aria-label="Importvorschau">
            <h2>Sicherung importieren</h2>
            <p>
              {pending.projects.length} Projekte · {pending.todos.length} To-Dos
              · {pending.events.length} Ereignisse · {pending.links.length}{" "}
              Links
            </p>
            <p>
              Der aktuelle Bestand wird vollständig ersetzt. Sichere ihn vorher
              als JSON.
            </p>
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => void download()}
              >
                Aktuellen Bestand sichern
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm("Aktuellen Bestand durch diese Sicherung ersetzen?")
                  )
                    void transact(() => store.importData(pending)).then(
                      (ok) => {
                        if (ok) {
                          setPending(null);
                          setView("Projekte");
                          setNotice("Sicherung importiert.");
                        }
                      },
                    );
                }}
              >
                Bestand ersetzen
              </button>
              <button
                className="button secondary"
                onClick={() => setPending(null)}
              >
                Abbrechen
              </button>
            </div>
          </section>
        )}
        {loading ? (
          <section className="panel">
            <p>Projekte werden geladen …</p>
          </section>
        ) : (
          <>
            {view !== "Projekt" && (
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {view === "Überblick"
                      ? "KLARHEIT FÜR DEN NÄCHSTEN SCHRITT"
                      : "DEIN ARBEITSPLATZ"}
                  </p>
                  <h1>{view === "Überblick" ? "Alles im Blick." : view}</h1>
                  <p className="description">
                    {view === "Überblick"
                      ? "Was ansteht, was weitergeht — und wo du als Nächstes ansetzt."
                      : view === "Projekte"
                        ? "Alle Projekte an einem Ort. Auch die, die gerade ruhen."
                        : view === "To-Dos"
                          ? "Die nächsten Schritte, über alle Projekte hinweg."
                          : "Gespräche, Entscheidungen und Gedanken im Verlauf."}
                  </p>
                </div>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => setNewProject(!newProject)}
                >
                  + Neues Projekt
                </button>
              </div>
            )}
            {newProject && (
              <form className="panel project-create" onSubmit={addProject}>
                <label className="field">
                  Projektname
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Wie heißt dein Projekt?"
                  />
                </label>
                <div className="actions">
                  <button className="button" disabled={busy}>
                    Projekt anlegen
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setNewProject(false)}
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}
            {!data.projects.length && (
              <section className="panel welcome">
                <p className="eyebrow">EIN GUTER ANFANG</p>
                <h2>Dein nächstes Projekt beginnt hier.</h2>
                <p>
                  Lege ein Projekt an oder probiere die App mit Beispielen aus.
                </p>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void transact(() =>
                      store.importData({
                        ...demoData(),
                        schemaVersion: 1,
                        exportedAt: new Date().toISOString(),
                      }),
                    )
                  }
                >
                  Beispieldaten laden
                </button>
              </section>
            )}
            {view === "Überblick" && (
              <>
                <div className="stats">
                  <div>
                    <strong>{active.length}</strong>
                    <span>Aktive Projekte</span>
                  </div>
                  <div>
                    <strong>{open.length}</strong>
                    <span>Offene To-Dos</span>
                  </div>
                  <div>
                    <strong>{coming.length}</strong>
                    <span>Kommende Ereignisse</span>
                  </div>
                </div>
                <div className="section-heading">
                  <h2>Was jetzt ansteht</h2>
                  <span className="muted">Nach Projekt</span>
                </div>
                {!active.length && !!data.projects.length && (
                  <section className="panel empty">
                    Alles aufgeräumt. Deine Projekte ruhen gerade.
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
                        <span className="status-pill">Aktiv</span>
                      </div>
                      <div className="overview-columns">
                        <div>
                          <h3>NÄCHSTE TO-DOS</h3>
                          {!todos.length && (
                            <p className="muted">Keine offenen To-Dos.</p>
                          )}
                          {todos.slice(0, 5).map((t) => (
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
                                    {overdue(t, today) ? "Überfällig · " : ""}
                                    {formatDate(t.dueDate)}
                                  </small>
                                )}
                              </span>
                            </label>
                          ))}
                          {todos.length > 5 && (
                            <button
                              className="text-button"
                              onClick={() => goProject(p.id)}
                            >
                              + {todos.length - 5} weitere To-Dos
                            </button>
                          )}
                        </div>
                        <div>
                          <h3>KOMMENDE EREIGNISSE</h3>
                          {!events.length && (
                            <p className="muted">Keine kommenden Ereignisse.</p>
                          )}
                          {events.slice(0, 5).map((e) => (
                            <div className="overview-event" key={e.id}>
                              <span className="category">{e.category}</span>
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
                              + {events.length - 5} weitere Ereignisse
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                  );
                })}
              </>
            )}
            {view === "Projekte" && (
              <div className="project-grid">
                {data.projects.map((p) => (
                  <article className="panel project-card" key={p.id}>
                    <span className="status-pill">
                      {active.some((a) => a.id === p.id) ? "Aktiv" : "Ruhend"}
                    </span>
                    <button
                      className="project-title"
                      onClick={() => goProject(p.id)}
                    >
                      {p.name} ↗
                    </button>
                    <p className="description">
                      {p.description || "Noch keine Kurzbeschreibung."}
                    </p>
                    <p className="muted">
                      {
                        data.todos.filter(
                          (t) => t.projectId === p.id && !t.completed,
                        ).length
                      }{" "}
                      offene To-Dos ·{" "}
                      {data.events.filter((e) => e.projectId === p.id).length}{" "}
                      Ereignisse
                    </p>
                    <div className="actions">
                      <button
                        className="button secondary"
                        onClick={() => goProject(p.id)}
                      >
                        Projekt öffnen
                      </button>
                      <button
                        className="icon-button danger"
                        disabled={busy}
                        onClick={() => {
                          const count =
                            data.todos.filter((t) => t.projectId === p.id)
                              .length +
                            data.events.filter((e) => e.projectId === p.id)
                              .length +
                            data.links.filter((l) => l.projectId === p.id)
                              .length;
                          if (
                            confirm(
                              `Projekt „${p.name}“ und ${count} zugehörige Inhalte endgültig löschen?`,
                            )
                          )
                            void change({ type: "project.delete", id: p.id });
                        }}
                      >
                        Löschen
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {view === "To-Dos" && <TodosPanel {...common} todos={data.todos} />}
            {view === "Ereignisse" && (
              <EventsPanel {...common} events={data.events} />
            )}
            {view === "Projekt" &&
              (project ? (
                <>
                  <button
                    className="text-button breadcrumb"
                    onClick={() => setView("Projekte")}
                  >
                    ← Alle Projekte
                  </button>
                  <ProjectHeader
                    key={project.id}
                    project={project}
                    links={data.links.filter((l) => l.projectId === project.id)}
                    busy={busy}
                    onChange={change}
                  />
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
                  Dieses Projekt ist nicht mehr vorhanden.
                  <button
                    className="text-button"
                    onClick={() => setView("Projekte")}
                  >
                    Zur Projektliste
                  </button>
                </section>
              ))}
          </>
        )}
        <footer>
          WinProgMan <span>Ein Projekt. Ein nächster Schritt.</span>
        </footer>
      </main>
    </div>
  );
}
