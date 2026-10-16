import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ desktop: true, invoke: vi.fn() }));
vi.mock("../src/platform/desktop", () => ({ isDesktop: () => mocks.desktop }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
import { openLocalFolder } from "../src/platform/localPaths";

describe("folder opening boundary", () => {
  beforeEach(() => {
    mocks.desktop = true;
    mocks.invoke.mockReset();
  });
  it("rejects browser and unsafe destinations before invoking native code", async () => {
    for (const target of [
      "https://example.com",
      "C:relative",
      "\\\\?\\C:\\Docs",
      "C:\\Docs:stream",
    ]) {
      await expect(openLocalFolder(target)).rejects.toThrow(
        "absolute Windows folder",
      );
    }
    mocks.desktop = false;
    await expect(openLocalFolder("C:\\Docs")).rejects.toThrow("Windows app");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("passes normalized paths to the directory-only native command and propagates failures", async () => {
    mocks.invoke
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce("Folder is unavailable");
    await openLocalFolder("file:///C:/My%20Folder/");
    expect(mocks.invoke).toHaveBeenCalledWith("open_local_folder", {
      path: "C:\\My Folder\\",
    });
    await expect(openLocalFolder("C:\\Missing")).rejects.toBe(
      "Folder is unavailable",
    );
  });
});
