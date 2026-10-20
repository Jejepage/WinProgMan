import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmAction,
  openExternalUrl,
  saveBackup,
} from "../src/platform/desktop";

const native = vi.hoisted(() => ({
  isTauri: vi.fn(),
  confirm: vi.fn(),
  save: vi.fn(),
  writeTextFile: vi.fn(),
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: native.isTauri }));
vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: native.confirm,
  save: native.save,
}));
vi.mock("@tauri-apps/plugin-fs", () => ({
  writeTextFile: native.writeTextFile,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: native.openUrl }));

beforeEach(() => {
  vi.resetAllMocks();
  native.isTauri.mockReturnValue(true);
});

afterEach(() => vi.unstubAllGlobals());

describe("desktop backup", () => {
  it("does not write a file when the save dialog is cancelled", async () => {
    native.save.mockResolvedValue(null);

    await expect(saveBackup("backup.json", "{}")).resolves.toBe(false);
    expect(native.writeTextFile).not.toHaveBeenCalled();
  });

  it("propagates write errors instead of reporting a successful backup", async () => {
    const failure = new Error("Disk is full");
    native.save.mockResolvedValue("C:\\Backups\\backup.json");
    native.writeTextFile.mockRejectedValue(failure);

    await expect(saveBackup("backup.json", "{}")).rejects.toBe(failure);
  });

  it("writes the full backup to the destination selected by the user", async () => {
    const contents = JSON.stringify({ projects: [{ name: "Überprüfung" }] });
    native.save.mockResolvedValue("D:\\My backups\\selected.json");
    native.writeTextFile.mockResolvedValue(undefined);

    await expect(saveBackup("suggested.json", contents)).resolves.toBe(true);
    expect(native.save).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "suggested.json" }),
    );
    expect(native.writeTextFile).toHaveBeenCalledExactlyOnceWith(
      "D:\\My backups\\selected.json",
      contents,
    );
  });
});

describe("external links", () => {
  it.each([
    "https://example.com/path?q=value#section",
    "http://localhost:5173/",
    "HTTPS://example.com",
    "mailto:person@example.com",
    "tel:+352123456",
  ])("opens supported destination %s", async (url) => {
    await openExternalUrl(url);
    expect(native.openUrl).toHaveBeenCalledExactlyOnceWith(url);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///C:/Windows/System32/cmd.exe",
    "C:\\Windows\\System32\\cmd.exe",
    "\\\\server\\share",
    "//example.com",
    "example.com",
    "https:example.com",
  ])(
    "rejects unsupported destination %s before invoking Windows",
    async (url) => {
      await expect(openExternalUrl(url)).rejects.toThrow("Unsupported link");
      expect(native.openUrl).not.toHaveBeenCalled();
    },
  );
});

describe("destructive-action confirmation", () => {
  it.each([false, true])(
    "preserves browser confirmation result %s",
    async (answer) => {
      native.isTauri.mockReturnValue(false);
      const confirm = vi.fn().mockReturnValue(answer);
      vi.stubGlobal("window", { confirm });

      await expect(confirmAction("Delete project?")).resolves.toBe(answer);
      expect(confirm).toHaveBeenCalledWith("Delete project?");
      expect(native.confirm).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    "preserves native confirmation result %s",
    async (answer) => {
      native.confirm.mockResolvedValue(answer);

      await expect(confirmAction("Delete project?")).resolves.toBe(answer);
      expect(native.confirm).toHaveBeenCalledWith("Delete project?", {
        title: "Plan B",
        kind: "warning",
      });
    },
  );
});
