import { invoke } from "@tauri-apps/api/core";

export interface StorageLocationInfo {
  currentPath: string;
  pendingPath: string | null;
  lastError: string | null;
}

export const getStorageLocation = () =>
  invoke<StorageLocationInfo>("storage_location_info");
export const chooseStorageFolder = () =>
  invoke<string | null>("choose_storage_folder");
export const scheduleStorageLocation = (path: string) =>
  invoke<StorageLocationInfo>("schedule_storage_location", { path });
export const cancelStorageLocation = () =>
  invoke<StorageLocationInfo>("cancel_storage_location");
export const restartForStorageLocation = () =>
  invoke<void>("restart_for_storage_location");
