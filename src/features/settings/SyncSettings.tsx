import { useState } from "react";
import { confirmAction } from "../../platform/desktop";
import { getDeviceName, setDeviceName, type useSync } from "../../sync/useSync";

type Sync = ReturnType<typeof useSync>;

export function syncSummary(state: Sync["state"]): string {
  if (!state.folder) return "";
  if (state.error) return "Sync problem";
  if (state.paused) return "Sync paused";
  if (state.running) return "Syncing …";
  if (state.last?.skipped.length) return "Waiting for other device";
  return state.last
    ? `Synced ${new Date(state.last.syncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
    : "Not synced yet";
}

export function SyncSettings({ sync, busy }: { sync: Sync; busy: boolean }) {
  const { state } = sync;
  const [name, setName] = useState(getDeviceName);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>) => {
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(String(reason));
    }
  };
  return (
    <section className="panel sync-settings" aria-label="Sync">
      <h2>Sync between computers</h2>
      {!state.available ? (
        <p className="description">
          Folder sync is available in the Windows app.
        </p>
      ) : (
        <>
          <p className="description">
            Choose a folder inside your OneDrive. Each computer writes only its
            own file there and merges the files of the others, so nothing is
            overwritten. If a task or event is edited on one computer and
            deleted on another, the edit wins. Your local database stays on this
            computer.
          </p>
          <label className="field">
            This computer&apos;s name
            <input
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setDeviceName(name)}
            />
          </label>
          {state.folder ? (
            <>
              <p>
                Sync folder:{" "}
                <code className="storage-path">{state.folder}</code>
              </p>
              <p role="status">
                {syncSummary(state)}
                {state.last && state.last.devices.length > 0
                  ? ` · merged with ${state.last.devices.join(", ")}`
                  : state.last
                    ? " · no other computer found yet"
                    : ""}
              </p>
              {state.last?.skipped.length ? (
                <p>
                  Some files are still being uploaded by OneDrive and are read
                  on the next run.
                </p>
              ) : null}
              {(error || state.error) && (
                <p role="alert">{error || state.error}</p>
              )}
              <div className="actions">
                <button
                  className="button"
                  disabled={busy || state.running}
                  onClick={() => void sync.syncNow()}
                >
                  Sync now
                </button>
                <button
                  className="button secondary"
                  onClick={() => sync.setPaused(!state.paused)}
                >
                  {state.paused ? "Resume sync" : "Pause sync"}
                </button>
                <button
                  className="button secondary"
                  disabled={busy || state.running}
                  onClick={() =>
                    void run(async () => {
                      if (
                        await confirmAction(
                          "Replace the data on this computer with the newest state in the sync folder? A backup of the current data is saved first.",
                        )
                      )
                        await sync.chooseFolder("adopt");
                    })
                  }
                >
                  Use folder data instead…
                </button>
                <button
                  className="button secondary danger"
                  disabled={state.running}
                  onClick={() => void run(sync.stop)}
                >
                  Stop syncing
                </button>
              </div>
            </>
          ) : (
            <>
              {(error || state.error) && (
                <p role="alert">{error || state.error}</p>
              )}
              <div className="actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void run(() => sync.chooseFolder("merge"))}
                >
                  Choose sync folder
                </button>
              </div>
              <p className="description">
                On the second computer choose the same OneDrive folder. Both
                data sets are combined; use “Use folder data instead” on a fresh
                installation to take over the other computer&apos;s data
                exactly.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
