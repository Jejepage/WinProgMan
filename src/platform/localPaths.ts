import { folderPath } from "../domain/links";
import { isDesktop } from "./desktop";
import { invoke } from "@tauri-apps/api/core";

/** Verify the destination is a directory before asking Windows to open it. */
export async function openLocalFolder(target: string): Promise<void> {
  const path = folderPath(target);
  if (!path) throw new Error("Enter an absolute Windows folder path.");
  if (!isDesktop()) throw new Error("Open folder links in the Windows app.");
  await invoke("open_local_folder", { path });
}
