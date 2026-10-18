import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "../domain/types";
import { isDesktop } from "../platform/desktop";
import {
  backupName,
  chooseSyncFolder,
  clearSyncFolder,
  folderTransport,
  getSyncFolder,
  writeLocalBackup,
} from "../platform/syncFolder";
import type { ProjectStore } from "../storage/ProjectStore";
import { adoptFolder, runSync, type SyncResult } from "./service";

const INTERVAL_MS = 2 * 60 * 1000;
const CHANGE_DELAY_MS = 8000;

function stored(key: string, create: () => string): string {
  try {
    const value = localStorage.getItem(key);
    if (value) return value;
    const next = create();
    localStorage.setItem(key, next);
    return next;
  } catch {
    return create();
  }
}
export const deviceId = () =>
  stored("winprogman-device-id", () => crypto.randomUUID());
const defaultName = () => `PC ${deviceId().slice(0, 4)}`;
export const getDeviceName = () =>
  stored("winprogman-device-name", defaultName);
export function setDeviceName(name: string) {
  try {
    localStorage.setItem(
      "winprogman-device-name",
      name.trim() || defaultName(),
    );
  } catch {
    /* Session only. */
  }
}

const backupBefore = () => async (data: AppData) => {
  const envelope = {
    ...data,
    schemaVersion: 6 as const,
    exportedAt: new Date().toISOString(),
  };
  await writeLocalBackup(backupName(), JSON.stringify(envelope, null, 2));
};

export interface SyncState {
  available: boolean;
  folder: string | null;
  running: boolean;
  last: SyncResult | null;
  error: string;
  paused: boolean;
}

export function useSync(store: ProjectStore, onChanged: () => Promise<void>) {
  const available = isDesktop();
  const [state, setState] = useState<SyncState>({
    available,
    folder: null,
    running: false,
    last: null,
    error: "",
    paused: readPaused(),
  });
  const busy = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const folder = useRef<string | null>(null);
  const paused = useRef(state.paused);
  const refresh = useRef(onChanged);
  refresh.current = onChanged;

  const run = useCallback(
    async (action?: () => Promise<boolean | void>) => {
      if (!folder.current || (paused.current && !action)) return;
      if (busy.current) {
        again.current = true;
        return;
      }
      busy.current = true;
      setState((s) => ({ ...s, running: true, error: "" }));
      try {
        const outcome = action ? await action() : undefined;
        const result = await runSync({
          store,
          transport: folderTransport,
          deviceId: deviceId(),
          deviceName: getDeviceName(),
          backup: backupBefore(),
        });
        if (result.changed || outcome) await refresh.current();
        setState((s) => ({ ...s, running: false, last: result }));
      } catch (reason) {
        setState((s) => ({ ...s, running: false, error: String(reason) }));
      } finally {
        busy.current = false;
        if (again.current) {
          again.current = false;
          void run();
        }
      }
    },
    [store],
  );

  useEffect(() => {
    if (!available) return;
    let active = true;
    void getSyncFolder().then(
      (path) => {
        if (!active) return;
        folder.current = path;
        setState((s) => ({ ...s, folder: path }));
        void run();
      },
      (reason: unknown) =>
        active && setState((s) => ({ ...s, error: String(reason) })),
    );
    const interval = setInterval(() => void run(), INTERVAL_MS);
    const focus = () => void run();
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("focus", focus);
    };
  }, [available, run]);

  /** Call after a local change; syncs shortly afterwards. */
  const notifyChanged = useCallback(() => {
    if (!folder.current) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(), CHANGE_DELAY_MS);
  }, [run]);

  return {
    state,
    notifyChanged,
    syncNow: () => run(),
    async chooseFolder(mode: "merge" | "adopt") {
      const path = await chooseSyncFolder();
      if (!path) return false;
      folder.current = path;
      setState((s) => ({ ...s, folder: path, error: "", last: null }));
      await run(
        mode === "adopt"
          ? () =>
              adoptFolder({
                store,
                transport: folderTransport,
                deviceId: deviceId(),
                deviceName: getDeviceName(),
                backup: backupBefore(),
              })
          : undefined,
      );
      return true;
    },
    async stop() {
      await clearSyncFolder();
      folder.current = null;
      setState((s) => ({ ...s, folder: null, last: null, error: "" }));
    },
    setPaused(value: boolean) {
      paused.current = value;
      try {
        localStorage.setItem("winprogman-sync-paused", value ? "1" : "");
      } catch {
        /* Session only. */
      }
      setState((s) => ({ ...s, paused: value }));
      if (!value) void run();
    },
  };
}

function readPaused() {
  try {
    return localStorage.getItem("winprogman-sync-paused") === "1";
  } catch {
    return false;
  }
}

/** One rolling local backup per day (desktop only), kept by the shell. */
export function useDailyBackup(store: ProjectStore, ready: boolean) {
  useEffect(() => {
    if (!ready || !isDesktop()) return;
    void (async () => {
      const { listLocalBackups } = await import("../platform/syncFolder");
      const names = await listLocalBackups();
      const stamp = backupName().slice(7, 15);
      if (names.some((name) => name.slice(7, 15) === stamp)) return;
      const data = await store.exportData();
      await writeLocalBackup(backupName(), JSON.stringify(data, null, 2));
    })().catch(() => undefined);
  }, [ready, store]);
}
