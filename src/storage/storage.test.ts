import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { demoData } from "../domain/demo";
import {
  emptyData,
  metadata,
  type AppData,
  type ExportEnvelope,
  type Project,
  type Todo,
} from "../domain/types";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore";
import { ConflictError } from "./ProjectStore";
import { validateData, validateImport } from "./validation";
const envelope = (): ExportEnvelope => ({
  ...demoData(),
  schemaVersion: 5,
  exportedAt: new Date().toISOString(),
});
const store = () => new IndexedDbProjectStore(`test-${crypto.randomUUID()}`);
const project = (): Project => ({
  ...metadata(),
  name: "Project",
  description: "",
  status: "Aktiv",
});
const oldEnvelope = (version: number) => {
  const {
    nextProjectNumber: _counter,
    revision: _revision,
    trash: _trash,
    ...data
  } = envelope();
  const result: Record<string, unknown> = {
    ...data,
    schemaVersion: version,
    projects: data.projects.map(
      ({ projectNumber: _number, revision: _rev, ...p }) => {
        if (version !== 1) return p;
        const { status: _status, categoryId: _category, ...old } = p;
        return old;
      },
    ),
    todos: data.todos.map(({ doNext: _next, ...todo }) =>
      version >= 4 ? { ...todo, doNext: _next } : todo,
    ),
  };
  if (version === 1) delete result.projectCategories;
  return result;
};
async function seedRaw(name: string, data: unknown) {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("app");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("app", "readwrite");
      tx.objectStore("app").put(data, "data");
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    };
  });
}
async function seeded() {
  const adapter = store();
  await adapter.importData(envelope());
  return { adapter, data: await adapter.load() };
}
async function deleteProject(adapter: IndexedDbProjectStore, p: Project) {
  await adapter.apply({
    type: "project.delete",
    id: p.id,
    expectedRevision: p.revision,
  });
}

describe("Backup validation and migration", () => {
  it.each([1, 2, 3, 4])(
    "migrates version %s without changing IDs, notes or displayed project order",
    (version) => {
      const original = oldEnvelope(version);
      const before = structuredClone(original);
      const migrated = validateImport(original);
      expect(migrated.schemaVersion).toBe(5);
      expect(migrated.projects.map((p) => p.projectNumber)).toEqual([1, 2]);
      expect(migrated.nextProjectNumber).toBe(3);
      expect(migrated.trash).toEqual([]);
      expect(migrated.events).toEqual(original.events);
      expect(original).toEqual(before);
      expect(migrated.projects.map((p) => p.id)).toEqual(
        (original.projects as Project[]).map((p) => p.id),
      );
    },
  );
  it("preserves Markdown and legacy plain text, do-next and event relationships", () => {
    const data = envelope();
    data.events[0].note = "# Heading\n**bold**";
    data.events[0].noteFormat = "markdown";
    data.events[1].note = "**plain text**";
    data.todos[0].eventId = data.events[0].id;
    expect(validateImport(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
  it("rejects fields newer than the declared schema", () => {
    const old = oldEnvelope(2);
    (old.events as { noteFormat?: string }[])[0].noteFormat = "markdown";
    expect(() => validateImport(old)).toThrow("Unbekanntes Feld");
    expect(() => validateImport({ ...envelope(), schemaVersion: 4 })).toThrow(
      "Unbekanntes Feld",
    );
  });
  it.each<[string, (data: ExportEnvelope) => unknown]>([
    [
      "unknown version",
      (d: ExportEnvelope) => Object.assign(d, { schemaVersion: 6 }),
    ],
    ["duplicate id", (d: ExportEnvelope) => (d.todos[0].id = d.projects[0].id)],
    [
      "duplicate project number",
      (d: ExportEnvelope) => (d.projects[1].projectNumber = 1),
    ],
    ["invalid counter", (d: ExportEnvelope) => (d.nextProjectNumber = 2)],
    ["fractional counter", (d: ExportEnvelope) => (d.nextProjectNumber = 3.5)],
    ["negative revision", (d: ExportEnvelope) => (d.revision = -1)],
    [
      "invalid record revision",
      (d: ExportEnvelope) => (d.todos[0].revision = -1),
    ],
    [
      "invalid project",
      (d: ExportEnvelope) => (d.todos[0].projectId = "missing"),
    ],
    [
      "invalid category",
      (d: ExportEnvelope) => (d.projects[0].categoryId = "missing"),
    ],
    [
      "invalid event relationship",
      (d: ExportEnvelope) => (d.todos[0].eventId = d.events[5].id),
    ],
    ["missing event", (d: ExportEnvelope) => (d.todos[0].eventId = "missing")],
    ["invalid date", (d: ExportEnvelope) => (d.events[0].date = "2026-02-30")],
    ["invalid time", (d: ExportEnvelope) => (d.events[0].time = "24:00")],
    [
      "invalid timestamp",
      (d: ExportEnvelope) => (d.projects[0].createdAt = "2026-02-30T00:00:00Z"),
    ],
    [
      "updated before created",
      (d: ExportEnvelope) => (d.projects[0].updatedAt = "2000-01-01T00:00:00Z"),
    ],
    [
      "unsafe link",
      (d: ExportEnvelope) => (d.links[0].target = "javascript:alert(1)"),
    ],
    ["bad url", (d: ExportEnvelope) => (d.links[0].target = "https://")],
    [
      "duplicate category names",
      (d: ExportEnvelope) =>
        (d.projectCategories = [
          { ...metadata(), name: "Work" },
          { ...metadata(), name: " work " },
        ]),
    ],
    [
      "invalid note format",
      (d: ExportEnvelope) => Object.assign(d.events[0], { noteFormat: "html" }),
    ],
    [
      "invalid boolean",
      (d: ExportEnvelope) => Object.assign(d.todos[0], { doNext: "yes" }),
    ],
  ] as const)("rejects %s", (_name, mutate) => {
    const data = envelope();
    mutate(data);
    expect(() => validateImport(data)).toThrow();
  });
  it("validates empty data", () =>
    expect(validateData(emptyData())).toEqual(emptyData()));
});

describe("Transactional IndexedDB and permanent numbers", () => {
  it("starts empty, persists edits and allocates a stable project number", async () => {
    const name = crypto.randomUUID();
    const adapter = new IndexedDbProjectStore(name);
    expect(await adapter.load()).toEqual(emptyData());
    await adapter.apply({ type: "project.save", value: project() });
    const saved = (await adapter.load()).projects[0];
    expect(saved.projectNumber).toBe(1);
    await adapter.apply({
      type: "project.save",
      value: { ...saved, name: "Renamed", projectNumber: 99 },
    });
    const loaded = await new IndexedDbProjectStore(name).load();
    expect(loaded.projects[0].name).toBe("Renamed");
    expect(loaded.projects[0].projectNumber).toBe(1);
    expect(loaded.projects[0].revision).toBeGreaterThan(saved.revision!);
  });
  it("never reuses deleted numbers, even after emptying trash or importing an old backup", async () => {
    const adapter = store();
    await adapter.apply({ type: "project.save", value: project() });
    await deleteProject(adapter, (await adapter.load()).projects[0]);
    await adapter.apply({ type: "trash.empty" });
    await adapter.importData({
      ...emptyData(),
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
    });
    await adapter.apply({ type: "project.save", value: project() });
    expect((await adapter.load()).projects[0].projectNumber).toBe(2);
  });
  it("serializes concurrent creates without losing data or allocating duplicate numbers", async () => {
    const adapter = store();
    await Promise.all(
      Array.from({ length: 8 }, () =>
        adapter.apply({ type: "project.save", value: project() }),
      ),
    );
    const loaded = await adapter.load();
    expect(new Set(loaded.projects.map((p) => p.projectNumber)).size).toBe(8);
    expect(loaded.nextProjectNumber).toBe(9);
  });
  it("persists legacy migration during load and leaves the original intact if the migration write fails", async () => {
    const name = crypto.randomUUID();
    const { schemaVersion: _s, exportedAt: _e, ...legacy } = oldEnvelope(1);
    await seedRaw(name, legacy);
    const adapter = new IndexedDbProjectStore(name);
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new Error("write failed");
      });
    await expect(adapter.load()).rejects.toThrow("write failed");
    failure.mockRestore();
    const result = await adapter.load();
    expect(result.projects.map((p) => p.projectNumber)).toEqual([1, 2]);
    const spy = vi.spyOn(IDBObjectStore.prototype, "put");
    await new IndexedDbProjectStore(name).load();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("keeps existing data unchanged on invalid imports, edits and write failures", async () => {
    const { adapter, data } = await seeded();
    const invalid = envelope();
    invalid.todos[0].projectId = "missing";
    await expect(adapter.importData(invalid)).rejects.toThrow();
    expect(await adapter.load()).toEqual(data);
    await expect(
      adapter.apply({
        type: "todo.save",
        value: { ...data.todos[0], eventId: "missing" },
      }),
    ).rejects.toThrow();
    expect(await adapter.load()).toEqual(data);
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    await expect(deleteProject(adapter, data.projects[0])).rejects.toThrow(
      "Full",
    );
    failure.mockRestore();
    expect(await adapter.load()).toEqual(data);
  });
  it("removes a category atomically and invalidates project editors", async () => {
    const adapter = store();
    const backup = envelope();
    const category = { ...metadata(), name: "Work" };
    backup.projectCategories = [category];
    backup.projects[0].categoryId = category.id;
    await adapter.importData(backup);
    const before = await adapter.load();
    await adapter.apply({
      type: "category.delete",
      id: category.id,
      expectedRevision: before.projectCategories[0].revision,
    });
    const after = await adapter.load();
    expect(after.projectCategories).toEqual([]);
    expect(after.projects[0].categoryId).toBeUndefined();
    expect(after.projects[0].revision).toBeGreaterThan(
      before.projects[0].revision!,
    );
    expect(after.todos).toEqual(before.todos);
  });
});

describe("Trash and relationships", () => {
  it("deletes and restores an entire project atomically with permanent numbers and contents", async () => {
    const { adapter, data } = await seeded();
    const task = { ...data.todos[0], eventId: data.events[0].id };
    await adapter.apply({ type: "todo.save", value: task });
    await deleteProject(adapter, data.projects[0]);
    const deleted = await adapter.load();
    expect(deleted.projects).toHaveLength(1);
    expect(deleted.trash).toHaveLength(1);
    expect(deleted.todos.every((t) => t.projectId !== task.projectId)).toBe(
      true,
    );
    await adapter.apply({ type: "trash.restore", id: deleted.trash[0].id });
    const restored = await adapter.load();
    expect(restored.trash).toEqual([]);
    expect(
      restored.projects.find((p) => p.id === task.projectId)?.projectNumber,
    ).toBe(1);
    expect(restored.todos.find((t) => t.id === task.id)?.eventId).toBe(
      task.eventId,
    );
    expect(restored.events).toHaveLength(data.events.length);
    expect(restored.links).toHaveLength(data.links.length);
  });
  it("restores each independently deleted type and preserves its ID", async () => {
    const { adapter } = await seeded();
    for (const type of ["todo", "event", "link"] as const) {
      const data = await adapter.load();
      const item =
        type === "todo"
          ? data.todos[0]
          : type === "event"
            ? data.events[0]
            : data.links[0];
      await adapter.apply({
        type: `${type}.delete`,
        id: item.id,
        expectedRevision: item.revision,
      });
      const entry = (await adapter.load()).trash[0];
      expect(entry.type).toBe(type);
      await adapter.apply({ type: "trash.restore", id: entry.id });
      const after = await adapter.load();
      expect(
        [...after.todos, ...after.events, ...after.links].some(
          (i) => i.id === item.id,
        ),
      ).toBe(true);
    }
  });
  it("unlinks tasks on event deletion, then only relinks untouched tasks", async () => {
    const { adapter, data } = await seeded();
    for (const task of data.todos.slice(0, 2))
      await adapter.apply({
        type: "todo.save",
        value: { ...task, eventId: data.events[0].id },
      });
    await adapter.apply({
      type: "event.delete",
      id: data.events[0].id,
      expectedRevision: data.events[0].revision,
    });
    const deleted = await adapter.load();
    expect(deleted.todos.slice(0, 2).every((t) => !t.eventId)).toBe(true);
    await adapter.apply({
      type: "todo.save",
      value: { ...deleted.todos[1], title: "Changed while event deleted" },
    });
    await adapter.apply({ type: "trash.restore", id: deleted.trash[0].id });
    const after = await adapter.load();
    expect(after.todos[0].eventId).toBe(data.events[0].id);
    expect(after.todos[1].eventId).toBeUndefined();
  });
  it("preserves trash, detached relationships and restore eligibility through export/import", async () => {
    const { adapter, data } = await seeded();
    await adapter.apply({
      type: "todo.save",
      value: { ...data.todos[0], eventId: data.events[0].id },
    });
    await adapter.apply({
      type: "event.delete",
      id: data.events[0].id,
      expectedRevision: data.events[0].revision,
    });
    const backup = await adapter.exportData();
    const other = store();
    await other.importData(validateImport(JSON.parse(JSON.stringify(backup))));
    await other.apply({ type: "trash.restore", id: backup.trash[0].id });
    expect((await other.load()).todos[0].eventId).toBe(data.events[0].id);
  });
  it("requires restoring a parent first and never silently resurrects it", async () => {
    const { adapter, data } = await seeded();
    await adapter.apply({
      type: "todo.delete",
      id: data.todos[0].id,
      expectedRevision: data.todos[0].revision,
    });
    await deleteProject(adapter, data.projects[0]);
    const before = await adapter.load();
    await expect(
      adapter.apply({ type: "trash.restore", id: before.trash[0].id }),
    ).rejects.toThrow("Restore the project first");
    expect(await adapter.load()).toEqual(before);
    await adapter.apply({ type: "trash.restore", id: before.trash[1].id });
    await adapter.apply({ type: "trash.restore", id: before.trash[0].id });
    expect((await adapter.load()).todos).toHaveLength(data.todos.length);
  });
  it("clears stale references in deleted tasks when an event is permanently removed", async () => {
    const { adapter, data } = await seeded();
    await adapter.apply({
      type: "todo.save",
      value: { ...data.todos[0], eventId: data.events[0].id },
    });
    const task = (await adapter.load()).todos[0];
    await adapter.apply({
      type: "todo.delete",
      id: task.id,
      expectedRevision: task.revision,
    });
    await adapter.apply({
      type: "event.delete",
      id: data.events[0].id,
      expectedRevision: data.events[0].revision,
    });
    const before = await adapter.load();
    await adapter.apply({ type: "trash.delete", id: before.trash[1].id });
    expect(
      (await adapter.load()).trash[0].data.todos[0].eventId,
    ).toBeUndefined();
    await adapter.apply({ type: "trash.restore", id: before.trash[0].id });
  });
  it("rejects corrupt trash ids, numbers, relationships, timestamps and payload shape", async () => {
    const { adapter, data } = await seeded();
    await deleteProject(adapter, data.projects[0]);
    const backup = await adapter.exportData();
    const mutations = [
      (d: ExportEnvelope) => (d.trash[0].data.todos[0].id = d.projects[0].id),
      (d: ExportEnvelope) =>
        (d.trash[0].data.projects[0].projectNumber =
          d.projects[0].projectNumber),
      (d: ExportEnvelope) => (d.trash[0].data.todos[0].projectId = "missing"),
      (d: ExportEnvelope) => (d.trash[0].data.todos[0].eventId = "missing"),
      (d: ExportEnvelope) => (d.trash[0].deletedAt = "yesterday"),
      (d: ExportEnvelope) => (d.trash[0].data.projects = []),
      (d: ExportEnvelope) => (d.nextProjectNumber = 1),
    ];
    for (const mutate of mutations) {
      const corrupt = structuredClone(backup);
      mutate(corrupt);
      await expect(adapter.importData(corrupt)).rejects.toThrow();
    }
    expect((await adapter.load()).trash).toEqual(backup.trash);
  });
});

describe("Concurrent windows", () => {
  it("rejects stale saves and deletes while allowing an explicit overwrite", async () => {
    const name = crypto.randomUUID();
    const a = new IndexedDbProjectStore(name);
    const b = new IndexedDbProjectStore(name);
    await a.apply({ type: "project.save", value: project() });
    const original = (await a.load()).projects[0];
    await a.apply({
      type: "project.save",
      value: { ...original, name: "Window A" },
    });
    await expect(
      b.apply({
        type: "project.save",
        value: { ...original, name: "Window B" },
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      b.apply({
        type: "project.delete",
        id: original.id,
        expectedRevision: original.revision,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await b.apply({
      type: "project.save",
      value: { ...original, name: "Explicit B" },
      overwrite: true,
    });
    expect((await a.load()).projects[0].name).toBe("Explicit B");
  });
  it("detects conflicts within a single transaction for simultaneous saves", async () => {
    const { adapter, data } = await seeded();
    const task = data.todos[0];
    const results = await Promise.allSettled(
      ["A", "B"].map((title) =>
        adapter.apply({ type: "todo.save", value: { ...task, title } }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
  it("rejects stale editors after delete/restore and after replacing with an old backup", async () => {
    const { adapter, data } = await seeded();
    const backup = await adapter.exportData();
    await deleteProject(adapter, data.projects[0]);
    await adapter.apply({
      type: "trash.restore",
      id: (await adapter.load()).trash[0].id,
    });
    await expect(
      adapter.apply({ type: "project.save", value: data.projects[0] }),
    ).rejects.toBeInstanceOf(ConflictError);
    const current = (await adapter.load()).projects.find(
      (p) => p.id === data.projects[0].id,
    )!;
    await adapter.importData(backup);
    await expect(
      adapter.apply({ type: "project.save", value: current }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it("rejects a replacement import when the preview revision has changed", async () => {
    const { adapter, data } = await seeded();
    await adapter.apply({ type: "project.save", value: project() });
    const before = await adapter.load();
    await expect(
      adapter.importData(envelope(), data.revision),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await adapter.load()).toEqual(before);
  });
  it("broadcasts only committed changes to another store and supports unsubscribe", async () => {
    const name = crypto.randomUUID();
    const a = new IndexedDbProjectStore(name);
    const b = new IndexedDbProjectStore(name);
    const listener = vi.fn();
    const unsubscribe = b.subscribe(listener);
    try {
      await a.apply({ type: "project.save", value: project() });
      await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
      await expect(
        a.apply({
          type: "todo.save",
          value: {
            ...metadata(),
            projectId: "missing",
            title: "Task",
            completed: false,
          } as Todo,
        }),
      ).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
      await a.apply({ type: "project.save", value: project() });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
});

describe("Trash restore ordering and destructive concurrency", () => {
  it.each([true, false])(
    "restores an unchanged task relationship regardless of restoration order (task first: %s)",
    async (taskFirst) => {
      const { adapter, data } = await seeded();
      await adapter.apply({
        type: "todo.save",
        value: { ...data.todos[0], eventId: data.events[0].id },
      });
      await adapter.apply({
        type: "event.delete",
        id: data.events[0].id,
        expectedRevision: data.events[0].revision,
      });
      const task = (await adapter.load()).todos[0];
      await adapter.apply({
        type: "todo.delete",
        id: task.id,
        expectedRevision: task.revision,
      });
      const trash = (await adapter.load()).trash;
      const first = trash.find(
        (t) => t.type === (taskFirst ? "todo" : "event"),
      )!;
      const second = trash.find((t) => t.id !== first.id)!;
      await adapter.apply({ type: "trash.restore", id: first.id });
      await adapter.apply({ type: "trash.restore", id: second.id });
      expect(
        (await adapter.load()).todos.find((t) => t.id === task.id)?.eventId,
      ).toBe(data.events[0].id);
    },
  );
  it("remembers the source when a task is deleted before its event and restored first", async () => {
    const { adapter, data } = await seeded();
    await adapter.apply({
      type: "todo.save",
      value: { ...data.todos[0], eventId: data.events[0].id },
    });
    const task = (await adapter.load()).todos[0];
    await adapter.apply({
      type: "todo.delete",
      id: task.id,
      expectedRevision: task.revision,
    });
    await adapter.apply({
      type: "event.delete",
      id: data.events[0].id,
      expectedRevision: data.events[0].revision,
    });
    const trash = (await adapter.load()).trash;
    await adapter.apply({ type: "trash.restore", id: trash[0].id });
    await adapter.apply({ type: "trash.restore", id: trash[1].id });
    expect(
      (await adapter.load()).todos.find((t) => t.id === task.id)?.eventId,
    ).toBe(data.events[0].id);
  });
  it("does not empty new trash entries from a stale window", async () => {
    const { adapter, data } = await seeded();
    await deleteProject(adapter, data.projects[0]);
    const preview = await adapter.load();
    await deleteProject(adapter, data.projects[1]);
    const before = await adapter.load();
    await expect(
      adapter.apply({
        type: "trash.empty",
        expectedRevision: preview.revision,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(await adapter.load()).toEqual(before);
  });
  it("does not recreate permanently deleted records via explicit stale overwrite", async () => {
    const { adapter, data } = await seeded();
    await deleteProject(adapter, data.projects[0]);
    await adapter.apply({ type: "trash.empty" });
    await expect(
      adapter.apply({
        type: "project.save",
        value: data.projects[0],
        overwrite: true,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});
