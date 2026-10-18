import { Download, Upload } from "lucide-react";
import type { AppData, DomainChange } from "../../domain/types";
import { CategorySettings } from "../../features/projects/CategorySettings";
import { StorageSettings } from "../../features/settings/StorageSettings";
import { SyncSettings } from "../../features/settings/SyncSettings";
import { TrashSettings } from "../../features/settings/TrashSettings";
import type { useSync } from "../../sync/useSync";
import type { Preferences, ThemeChoice } from "../usePreferences";

export function SettingsPage({
  prefs,
  sync,
  data,
  busy,
  loading,
  onChange,
  onExport,
  onImport,
  onClose,
}: {
  prefs: Preferences;
  sync: ReturnType<typeof useSync>;
  data: AppData;
  busy: boolean;
  loading: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onExport: () => Promise<boolean>;
  onImport: () => void;
  onClose: () => void;
}) {
  const {
    design,
    setDesign,
    navigation,
    setNavigation,
    density,
    setDensity,
    sidebar,
    setSidebar,
    theme,
    setTheme,
  } = prefs;
  return (
    <section className="settings-page" aria-label="Settings">
      <div className="page-heading">
        <h1>Settings</h1>
        <button className="button secondary" onClick={onClose}>
          Close settings
        </button>
      </div>
      <>
        <section className="panel appearance-settings">
          <h2>Appearance</h2>
          <h3>Design variant</h3>
          <div className="actions" role="group" aria-label="Design variant">
            {(["classic", "color", "split-compact", "slate"] as const).map(
              (choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`button ${design === choice ? "" : "secondary"}`}
                  aria-pressed={design === choice}
                  onClick={() => setDesign(choice)}
                >
                  {choice === "classic"
                    ? "Classic"
                    : choice === "color"
                      ? "Color"
                      : choice === "slate"
                        ? "Slate"
                        : "Split Compact"}
                </button>
              ),
            )}
          </div>
          <p className="description">
            Classic uses monospace text. Color uses proportional text and a
            distinct accent for projects, tasks, events and notes. Split Compact
            offers sidebar or top navigation and a blue project file beside the
            workspace. Slate has a dark slate sidebar, a light content area,
            white cards and solid status badges.
          </p>
          <div className="design-palette" aria-label="Item colors">
            <span data-kind="projects">Projects</span>
            <span data-kind="tasks">Tasks</span>
            <span data-kind="events">Events</span>
            <span data-kind="notes">Notes</span>
          </div>
          {design === "split-compact" && (
            <>
              <h3>Navigation placement</h3>
              <div
                className="actions"
                role="group"
                aria-label="Navigation placement"
              >
                {(["sidebar", "top"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    className={`button ${navigation === choice ? "" : "secondary"}`}
                    aria-pressed={navigation === choice}
                    onClick={() => setNavigation(choice)}
                  >
                    {choice === "sidebar" ? "Sidebar" : "Top navigation"}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>Density</h3>
          <div className="actions" role="group" aria-label="Density">
            {(["comfortable", "compact"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={`button ${density === choice ? "" : "secondary"}`}
                aria-pressed={density === choice}
                onClick={() => setDensity(choice)}
              >
                {choice === "comfortable" ? "Comfortable" : "Compact"}
              </button>
            ))}
          </div>
          <h3>Sidebar</h3>
          <div className="actions" role="group" aria-label="Sidebar">
            {(["labels", "icons"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                className={`button ${sidebar === choice ? "" : "secondary"}`}
                aria-pressed={sidebar === choice}
                onClick={() => setSidebar(choice)}
              >
                {choice === "labels" ? "Icons and labels" : "Icons only"}
              </button>
            ))}
          </div>
          <h3>Color theme</h3>
          <p className="description">
            Choose a theme or follow your system setting.
          </p>
          <div className="actions" role="group" aria-label="Color theme">
            {(["system", "light", "dark"] as ThemeChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                className={`button ${theme === choice ? "" : "secondary"}`}
                aria-pressed={theme === choice}
                onClick={() => setTheme(choice)}
              >
                {choice[0].toUpperCase() + choice.slice(1)}
              </button>
            ))}
          </div>
        </section>
        <SyncSettings sync={sync} busy={busy} />
        <TrashSettings
          tombstones={data.tombstones}
          data={data}
          busy={busy}
          onChange={onChange}
        />
        <StorageSettings busy={busy} onBackup={onExport} />
        <section className="panel backup-settings" aria-label="Backup">
          <h2>Import &amp; export</h2>
          <p className="description">
            Export a JSON backup of all projects, tasks, events, notes and
            Brainstorm. Import checks the file before asking you to replace the
            current data.
          </p>
          <div className="actions">
            <button
              className="button"
              aria-label="Export JSON ↓"
              disabled={busy || loading}
              onClick={() => void onExport()}
            >
              <Download size={16} aria-hidden="true" /> Export JSON ↓
            </button>
            <button
              className="button secondary"
              aria-label="Import JSON ↑"
              disabled={busy || loading}
              onClick={onImport}
            >
              <Upload size={16} aria-hidden="true" /> Import JSON ↑
            </button>
          </div>
        </section>
        <CategorySettings
          categories={data.projectCategories}
          projects={data.projects}
          busy={busy}
          onChange={onChange}
        />
      </>
    </section>
  );
}
