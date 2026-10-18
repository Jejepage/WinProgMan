import type { AppData } from "../domain/types";
import type { ProjectStore } from "../storage/ProjectStore";
import { validateData } from "../storage/validation";
import { findConflicts } from "./conflicts";
import { mergeData, sameData } from "./merge";

export interface SyncTransport {
  list(): Promise<string[]>;
  read(name: string): Promise<string | null>;
  write(name: string, contents: string): Promise<void>;
}

/** One complete state per device; each device only ever writes its own file. */
export interface SyncFile {
  format: 1;
  deviceId: string;
  deviceName: string;
  savedAt: string;
  checksum: string;
  data: AppData;
}

export interface SyncResult {
  /** Other devices whose state was read. */
  devices: string[];
  /** Files that were unreadable or incomplete (retried on the next run). */
  skipped: string[];
  /** Local data changed because of the merge. */
  changed: boolean;
  /** Local versions replaced by newer ones from another computer (now in the trash). */
  conflicts: number;
  /** This device's file was (re)written. */
  published: boolean;
  syncedAt: string;
}

export const fileName = (deviceId: string) => `device-${deviceId}.json`;
export const validDeviceId = (value: string) =>
  /^[A-Za-z0-9-]{8,64}$/.test(value);

async function checksum(data: AppData): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function parse(text: string): Promise<SyncFile> {
  const value = JSON.parse(text) as Partial<SyncFile> | null;
  if (
    !value ||
    value.format !== 1 ||
    typeof value.deviceId !== "string" ||
    typeof value.checksum !== "string"
  )
    throw new Error("Unknown sync file format.");
  if ((await checksum(value.data as AppData)) !== value.checksum)
    throw new Error("Incomplete or damaged sync file.");
  return { ...(value as SyncFile), data: validateData(value.data) };
}

export interface SyncOptions {
  store: ProjectStore;
  transport: SyncTransport;
  deviceId: string;
  deviceName: string;
  /** Called with the local state before a merge changes it. */
  backup?: (data: AppData) => Promise<void>;
  now?: () => Date;
}

/** Reads the other devices, merges them into the local store, publishes ours. */
export async function runSync(options: SyncOptions): Promise<SyncResult> {
  const { store, transport, deviceId } = options;
  const now = options.now ?? (() => new Date());
  if (!validDeviceId(deviceId)) throw new Error("Invalid device id.");
  const own = fileName(deviceId);
  const remotes: SyncFile[] = [];
  const skipped: string[] = [];
  for (const name of await transport.list()) {
    if (name === own) continue;
    try {
      const text = await transport.read(name);
      if (text !== null) remotes.push(await parse(text));
    } catch {
      skipped.push(name);
    }
  }
  let changed = false;
  let conflicts = 0;
  if (remotes.length) {
    const local = await store.load();
    const preview = mergeData(
      local,
      remotes.map((file) => file.data),
      now(),
    );
    if (!sameData(local, preview)) {
      let base: AppData | undefined;
      try {
        const text = await transport.read(own);
        if (text) base = (await parse(text)).data;
      } catch {
        base = undefined; // No reliable published state: report no conflicts.
      }
      const found = findConflicts(
        local,
        base,
        remotes.map((file) => ({
          deviceName: file.deviceName,
          data: file.data,
        })),
        now(),
        deviceId,
      );
      await options.backup?.(local);
      await store.apply({
        type: "sync.merge",
        remotes: remotes.map((file) => file.data),
        conflicts: found,
      });
      conflicts = found.length;
      changed = true;
    }
  }
  const data = await store.load();
  const sum = await checksum(data);
  let published = false;
  let current: string | null = null;
  try {
    const text = await transport.read(own);
    if (text)
      current = (JSON.parse(text) as Partial<SyncFile>).checksum ?? null;
  } catch {
    current = null;
  }
  if (current !== sum) {
    const file: SyncFile = {
      format: 1,
      deviceId,
      deviceName: options.deviceName,
      savedAt: now().toISOString(),
      checksum: sum,
      data,
    };
    await transport.write(own, JSON.stringify(file));
    published = true;
  }
  return {
    devices: remotes.map((file) => file.deviceName),
    skipped,
    changed,
    conflicts,
    published,
    syncedAt: now().toISOString(),
  };
}

/** Replaces this device's data with the newest state found in the folder. */
export async function adoptFolder(
  options: Omit<SyncOptions, "now">,
): Promise<boolean> {
  const { store, transport, deviceId } = options;
  let newest: SyncFile | undefined;
  for (const name of await transport.list()) {
    if (name === fileName(deviceId)) continue;
    try {
      const text = await transport.read(name);
      if (!text) continue;
      const file = await parse(text);
      if (!newest || file.savedAt > newest.savedAt) newest = file;
    } catch {
      // Unreadable files are not candidates.
    }
  }
  if (!newest) return false;
  await options.backup?.(await store.load());
  await store.importData({
    ...newest.data,
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
  });
  return true;
}
