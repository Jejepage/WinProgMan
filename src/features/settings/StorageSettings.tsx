import { useEffect, useState } from "react";
import { isDesktop } from "../../platform/desktop";
import {
  cancelStorageLocation,
  chooseStorageFolder,
  getStorageLocation,
  restartForStorageLocation,
  scheduleStorageLocation,
  type StorageLocationInfo,
} from "../../platform/storageLocation";

export function StorageSettings({
  busy,
  onBackup,
}: {
  busy: boolean;
  onBackup: () => Promise<boolean>;
}) {
  const [info, setInfo] = useState<StorageLocationInfo | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [backedUp, setBackedUp] = useState(false);
  const desktop = isDesktop();
  const disabled = busy || working;
  useEffect(() => {
    if (!desktop) return;
    let active = true;
    void getStorageLocation().then(
      (value) => {
        if (active) setInfo(value);
      },
      (reason: unknown) => {
        if (active) setError(String(reason));
      },
    );
    return () => {
      active = false;
    };
  }, [desktop]);

  async function run(action: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await action();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setWorking(false);
    }
  }
  return (
    <section className="panel storage-settings">
      <h2>Storage</h2>
      {!desktop ? (
        <p className="description">
          This browser manages its own data location. Choose a storage folder in
          the Windows app.
        </p>
      ) : (
        <>
          <p className="description">
            All internal projects, tasks, events, notes and links stay together
            in this data folder. Linked documents remain in their existing
            folders.
          </p>
          {info && (
            <p>
              Current data folder:{" "}
              <code className="storage-path">{info.currentPath}</code>
            </p>
          )}
          {info?.lastError && <p role="alert">{info.lastError}</p>}
          {error && <p role="alert">{error}</p>}
          {!info?.pendingPath && !selected && (
            <button
              className="button secondary"
              disabled={disabled || !info}
              onClick={() =>
                void run(async () => {
                  const folder = await chooseStorageFolder();
                  if (folder) {
                    setSelected(folder);
                    setBackedUp(false);
                  }
                })
              }
            >
              Choose folder
            </button>
          )}
          {selected && !info?.pendingPath && (
            <div>
              <p>
                New folder: <code className="storage-path">{selected}</code>
              </p>
              <p>
                Choose an empty local folder. On the next app start, WinProgMan
                copies the closed database and its browser profile here. The
                original data is kept. Please export a JSON backup first.
              </p>
              <div className="actions">
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      if (await onBackup()) setBackedUp(true);
                    })
                  }
                >
                  Back up current data
                </button>
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      setInfo(await scheduleStorageLocation(selected));
                      setSelected(null);
                    })
                  }
                >
                  {backedUp ? "Use this folder" : "Continue without backup"}
                </button>
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {info?.pendingPath && (
            <div>
              <p>
                Pending folder:{" "}
                <code className="storage-path">{info.pendingPath}</code>
              </p>
              <p>
                Restart to finish the change. Data saved before restarting is
                included. Keep the new folder empty until then. An unavailable
                target leaves the original folder active.
              </p>
              <div className="actions">
                <button
                  className="button"
                  disabled={disabled}
                  onClick={() => void run(restartForStorageLocation)}
                >
                  Restart and apply
                </button>
                <button
                  className="button secondary"
                  disabled={disabled}
                  onClick={() =>
                    void run(async () => {
                      setInfo(await cancelStorageLocation());
                    })
                  }
                >
                  Cancel storage change
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
