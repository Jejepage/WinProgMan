import { useEffect, useRef, useState } from "react";
import { emptyData, type AppData } from "../domain/types";
import type { ProjectStore } from "../storage/ProjectStore";
import { useDailyBackup, useSync } from "../sync/useSync";
import { errorLabel } from "../ui/labels";

/**
 * Loads the data, serializes changes (one at a time), tells other windows and
 * the sync about them, and keeps the data fresh when another window changes it.
 */
export function useAppStore(store: ProjectStore) {
  const [data, setData] = useState<AppData>(emptyData);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const updates = useRef<BroadcastChannel | null>(null);
  const sync = useSync(store, async () => {
    setData(await store.load());
    updates.current?.postMessage("changed");
  });
  useDailyBackup(store, !loading);
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
  }, [store]);
  useEffect(() => {
    store
      .load()
      .then(setData)
      .catch((e) => setError(errorLabel(e)))
      .finally(() => setLoading(false));
  }, [store]);

  async function saveBrainstorm(text: string, expectedRevision: number) {
    await store.apply({ type: "brainstorm.save", text, expectedRevision });
    const latest = await store.load();
    setData(latest);
    updates.current?.postMessage("changed");
    sync.notifyChanged();
    return latest.brainstorm;
  }
  async function transact(action: () => Promise<void>) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setData(await store.load());
      updates.current?.postMessage("changed");
      sync.notifyChanged();
      return true;
    } catch (e) {
      setError(errorLabel(e));
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    data,
    busy,
    loading,
    error,
    setError,
    sync,
    saveBrainstorm,
    transact,
  };
}
