import { afterEach, describe, expect, it, vi } from "vitest";
import { BrainstormAutosave } from "./autosave";
import { emptyBrainstorm, type Brainstorm } from "../../domain/types";

afterEach(() => vi.useRealTimers());
const saved = (text: string, revision: number): Brainstorm => ({
  text,
  revision,
  updatedAt: `2026-10-17T10:00:0${revision}.000Z`,
});
describe("Brainstorm autosave", () => {
  it("debounces edits without reading or serializing on every change", async () => {
    vi.useFakeTimers();
    let text = "one";
    const read = vi.fn(() => text);
    const save = vi.fn(async (text: string, revision: number) =>
      saved(text, revision + 1),
    );
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      read,
      save,
      vi.fn(),
      vi.fn(),
    );
    queue.changed();
    await vi.advanceTimersByTimeAsync(400);
    text = "latest";
    queue.changed();
    expect(read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(599);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledExactlyOnceWith("latest", 0);
    expect(queue.dirty).toBe(false);
  });
  it("serializes writes and flushes changes made during an outstanding save", async () => {
    let text = "one";
    let finish!: (value: Brainstorm) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Brainstorm>((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementation(async (text: string, revision: number) =>
        saved(text, revision + 1),
      );
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      () => text,
      save,
      vi.fn(),
      vi.fn(),
    );
    queue.changed();
    const flushing = queue.flush();
    text = "two";
    queue.changed();
    expect(queue.flush()).toBe(flushing);
    queue.receive(saved("one", 1));
    finish(saved("one", 1));
    await flushing;
    expect(save.mock.calls).toEqual([
      ["one", 0],
      ["two", 1],
    ]);
    expect(queue.baseline.text).toBe("two");
    expect(queue.dirty).toBe(false);
    queue.dispose();
  });
  it("preserves the draft and journal after disk errors and permits retry", async () => {
    const journal = vi.fn();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("Disk full"))
      .mockResolvedValue(saved("draft", 1));
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      () => "draft",
      save,
      vi.fn(),
      journal,
    );
    queue.changed();
    await expect(queue.flush()).rejects.toThrow("Disk full");
    expect(queue.dirty).toBe(true);
    expect(journal).toHaveBeenCalledWith("draft", emptyBrainstorm());
    await queue.flush();
    expect(queue.dirty).toBe(false);
  });
  it("blocks stale drafts after external replacement and permits clean replacements", async () => {
    const save = vi.fn();
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      () => "draft",
      save,
      vi.fn(),
      vi.fn(),
    );
    queue.changed();
    expect(queue.receive(saved("elsewhere", 1))).toBe(false);
    await expect(queue.flush()).rejects.toThrow("changed elsewhere");
    expect(save).not.toHaveBeenCalled();
    expect(queue.dirty).toBe(true);
    queue.dispose();
    const clean = new BrainstormAutosave(
      emptyBrainstorm(),
      () => "",
      save,
      vi.fn(),
      vi.fn(),
    );
    expect(clean.receive(saved("replacement", 7))).toBe(true);
    expect(clean.baseline.text).toBe("replacement");
  });
  it("captures the latest draft synchronously before reload", () => {
    const journal = vi.fn();
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      () => "last keystroke",
      vi.fn(),
      vi.fn(),
      journal,
    );
    queue.changed();
    queue.capture();
    expect(journal).toHaveBeenCalledWith("last keystroke", emptyBrainstorm());
    queue.dispose();
  });
  it("replaces the visible clean editor when a remote change arrives during own save", async () => {
    let text = "own draft";
    let finish!: (value: Brainstorm) => void;
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Brainstorm>((resolve) => {
            finish = resolve;
          }),
      )
      .mockImplementation(async (text: string, revision: number) =>
        saved(text, revision + 1),
      );
    const replace = vi.fn((next: Brainstorm) => {
      text = next.text;
    });
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      () => text,
      save,
      vi.fn(),
      vi.fn(),
      replace,
    );
    queue.changed();
    const flushing = queue.flush();
    const remote = saved("remote draft", 2);
    queue.receive(remote);
    finish(saved("own draft", 1));
    await flushing;
    expect(replace).toHaveBeenCalledExactlyOnceWith(remote);
    expect(text).toBe("remote draft");
    text += " plus";
    queue.changed();
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith("remote draft plus", 2);
  });
  it("keeps a draft dirty when a save reply has been superseded by another writer", async () => {
    const journal = vi.fn();
    const queue = new BrainstormAutosave(
      emptyBrainstorm(),
      () => "own draft",
      vi.fn().mockResolvedValue(saved("remote draft", 2)),
      vi.fn(),
      journal,
    );
    queue.changed();
    await expect(queue.flush()).rejects.toThrow(
      "changed elsewhere while saving",
    );
    expect(queue.dirty).toBe(true);
    expect(queue.baseline).toEqual(emptyBrainstorm());
    expect(journal).toHaveBeenCalledWith("own draft", emptyBrainstorm());
  });
});
