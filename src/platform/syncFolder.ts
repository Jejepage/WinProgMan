import { invoke } from "@tauri-apps/api/core";
import type { SyncTransport } from "../sync/service";

export const getSyncFolder = () => invoke<string | null>("sync_folder_info");
export const chooseSyncFolder = () =>
  invoke<string | null>("choose_sync_folder");
export const clearSyncFolder = () => invoke<void>("clear_sync_folder");

/** Files live in the user-chosen folder; the shell validates every name. */
export const folderTransport: SyncTransport = {
  list: () => invoke<string[]>("sync_list"),
  read: (name) => invoke<string | null>("sync_read", { name }),
  write: (name, contents) => invoke<void>("sync_write", { name, contents }),
};

const pad = (n: number) => String(n).padStart(2, "0");
export const backupName = (at = new Date()) =>
  `backup-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}.json`;

export const writeLocalBackup = (name: string, contents: string) =>
  invoke<void>("backup_write", { name, contents });
export const listLocalBackups = () => invoke<string[]>("backup_list");
