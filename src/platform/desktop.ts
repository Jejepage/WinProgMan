import { isTauri } from "@tauri-apps/api/core";

export const isDesktop = () => isTauri();

export async function confirmAction(message: string): Promise<boolean> {
  if (!isDesktop()) return window.confirm(message);
  const { confirm } = await import("@tauri-apps/plugin-dialog");
  return confirm(message, { title: "WinProgMan", kind: "warning" });
}

/** False means the user cancelled; errors are handled by the calling UI. */
export async function saveBackup(
  filename: string,
  contents: string,
): Promise<boolean> {
  if (isDesktop()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({
      title: "Save JSON backup",
      defaultPath: filename,
      filters: [{ name: "JSON backup", extensions: ["json"] }],
    });
    if (!path) return false;
    await writeTextFile(path, contents);
    return true;
  }
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Give the browser time to begin the download before releasing its source.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(url))
    throw new Error("Unsupported link destination.");
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}
