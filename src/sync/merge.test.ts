import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { demoData } from "../domain/demo";
import { metadata, type AppData } from "../domain/types";
import { IndexedDbProjectStore } from "../storage/IndexedDbProjectStore";
import { validateData } from "../storage/validation";
import { mergeData, sameData } from "./merge";

const store = () => new IndexedDbProjectStore(`sync-${crypto.randomUUID()}`);
const now = () => new Date();

/** Two devices that start from the same synchronised state. */
async function pair() {
  const a = store();
  await a.importData({
    ...demoData(),
    schemaVersion: 6,
    exportedAt: new Date().toISOString(),
  });
  const b = store();
  await b.importData({
    ...(await a.exportData()),
    exportedAt: new Date().toISOString(),
  });
  return { a, b };
}
const sync = async (x: IndexedDbProjectStore, y: IndexedDbProjectStore) => {
  const [dx, dy] = [await x.load(), await y.load()];
  await x.apply({ type: "sync.merge", remotes: [dy] });
  await y.apply({ type: "sync.merge", remotes: [dx] });
  // second round delivers merge results (e.g. renumbering) in both directions
  const [ex, ey] = [await x.load(), await y.load()];
  await x.apply({ type: "sync.merge", remotes: [ey] });
  await y.apply({ type: "sync.merge", remotes: [ex] });
};

describe("Versionen und Papierkorb", () => {
  it("erhöht die Version nur bei echter Änderung und merkt sich Löschungen", async () => {
    const s = store();
    await s.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: now().toISOString(),
    });
    const data = await s.load();
    const todo = data.todos[0];
    await s.apply({ type: "todo.save", value: { ...todo } });
    expect((await s.load()).todos.find((t) => t.id === todo.id)?.rev).toBe(1);
    await s.apply({ type: "todo.save", value: { ...todo, title: "Neu" } });
    expect((await s.load()).todos.find((t) => t.id === todo.id)?.rev).toBe(2);
    await s.apply({ type: "todo.delete", id: todo.id });
    const after = await s.load();
    expect(after.todos.some((t) => t.id === todo.id)).toBe(false);
    expect(after.tombstones).toMatchObject([
      { kind: "todo", id: todo.id, rev: 2 },
    ]);
  });

  it("stellt Gelöschtes wieder her; Projekt samt abhängiger Inhalte", async () => {
    const s = store();
    await s.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: now().toISOString(),
    });
    const before = await s.load();
    const project = before.projects[0];
    await s.apply({ type: "project.delete", id: project.id });
    const deleted = await s.load();
    expect(deleted.tombstones.length).toBeGreaterThan(1);
    expect(
      deleted.tombstones.filter((t) => t.group === project.id).length,
    ).toBeGreaterThan(0);
    const child = deleted.tombstones.find((t) => t.kind === "todo")!;
    await expect(
      s.apply({ type: "trash.restore", id: child.id }),
    ).rejects.toThrow("Restore the project first");
    await s.apply({ type: "trash.restore", id: project.id });
    const back = await s.load();
    expect(back.tombstones).toEqual([]);
    expect(back.projects.map((p) => p.id)).toContain(project.id);
    expect(back.todos.length).toBe(before.todos.length);
    expect(back.projects.find((p) => p.id === project.id)!.rev).toBe(2);
  });

  it("löscht endgültig, behält aber die Löschung und lehnt Wiederherstellen ab", async () => {
    const s = store();
    await s.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: now().toISOString(),
    });
    const todo = (await s.load()).todos[0];
    await s.apply({ type: "todo.delete", id: todo.id });
    await s.apply({ type: "trash.purge", id: todo.id });
    const kept = (await s.load()).tombstones[0];
    expect(Object.keys(kept.record)).toEqual(["id"]);
    await expect(
      s.apply({ type: "trash.restore", id: todo.id }),
    ).rejects.toThrow("permanently deleted");
  });

  it("verwirft Löschvermerke nach der Aufbewahrungsfrist", async () => {
    const s = store();
    await s.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: now().toISOString(),
    });
    const todo = (await s.load()).todos[0];
    await s.apply({ type: "todo.delete", id: todo.id });
    const old = await s.load();
    old.tombstones[0].deletedAt = new Date(
      Date.now() - 61 * 24 * 3600 * 1000,
    ).toISOString();
    await s.importData({
      ...old,
      schemaVersion: 6,
      exportedAt: now().toISOString(),
    });
    await s.apply({ type: "todo.save", value: (await s.load()).todos[0] });
    expect((await s.load()).tombstones).toEqual([]);
  });
});

describe("Zusammenführen zweier Geräte", () => {
  it("übernimmt unabhängige Änderungen in beide Richtungen", async () => {
    const { a, b } = await pair();
    const project = (await a.load()).projects[0];
    const todoA = {
      ...metadata(),
      projectId: project.id,
      title: "A",
      completed: false,
    };
    const todoB = {
      ...metadata(),
      projectId: project.id,
      title: "B",
      completed: false,
    };
    await a.apply({ type: "todo.save", value: todoA });
    await b.apply({ type: "todo.save", value: todoB });
    await sync(a, b);
    const [x, y] = [await a.load(), await b.load()];
    expect(x.todos.map((t) => t.title)).toEqual(
      expect.arrayContaining(["A", "B"]),
    );
    expect(sameData(x, y)).toBe(true);
    expect(() => validateData(x)).not.toThrow();
  });

  it("lässt eine Bearbeitung gegen eine gleichzeitige Löschung gewinnen", async () => {
    const { a, b } = await pair();
    const todo = (await a.load()).todos[0];
    await a.apply({ type: "todo.delete", id: todo.id });
    await b.apply({
      type: "todo.save",
      value: { ...todo, title: "Bearbeitet" },
    });
    await sync(a, b);
    for (const device of [a, b]) {
      const data = await device.load();
      expect(data.todos.find((t) => t.id === todo.id)?.title).toBe(
        "Bearbeitet",
      );
      expect(data.tombstones.some((t) => t.id === todo.id)).toBe(false);
    }
  });

  it("überträgt Löschungen und lässt spätere Änderungen daneben unberührt", async () => {
    const { a, b } = await pair();
    const [t1, t2] = (await a.load()).todos;
    await a.apply({ type: "todo.delete", id: t1.id });
    await b.apply({ type: "todo.save", value: { ...t2, title: "Anders" } });
    await sync(a, b);
    for (const device of [a, b]) {
      const data = await device.load();
      expect(data.todos.some((t) => t.id === t1.id)).toBe(false);
      expect(data.todos.find((t) => t.id === t2.id)?.title).toBe("Anders");
    }
  });

  it("belebt ein gelöschtes Projekt, wenn dort parallel etwas bearbeitet wurde", async () => {
    const { a, b } = await pair();
    const data = await a.load();
    const project = data.projects[0];
    const todo = data.todos.find((t) => t.projectId === project.id)!;
    await a.apply({ type: "project.delete", id: project.id });
    await b.apply({ type: "todo.save", value: { ...todo, title: "Wichtig" } });
    await sync(a, b);
    for (const device of [a, b]) {
      const result = await device.load();
      expect(result.projects.some((p) => p.id === project.id)).toBe(true);
      expect(result.todos.find((t) => t.id === todo.id)?.title).toBe("Wichtig");
      expect(() => validateData(result)).not.toThrow();
    }
    expect(sameData(await a.load(), await b.load())).toBe(true);
  });

  it("vergibt doppelte Projektnummern deterministisch neu", async () => {
    const { a, b } = await pair();
    const base = await a.load();
    const make = (name: string) => ({
      ...metadata(),
      number: 0,
      status: "Aktiv" as const,
      name,
      description: "",
    });
    await a.apply({ type: "project.save", value: make("Auf A") });
    await b.apply({ type: "project.save", value: make("Auf B") });
    expect((await a.load()).projects.at(-1)!.number).toBe(
      (await b.load()).projects.at(-1)!.number,
    );
    await sync(a, b);
    const merged = await a.load();
    const numbers = merged.projects.map((p) => p.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(merged.projects.length).toBe(base.projects.length + 2);
    expect(sameData(merged, await b.load())).toBe(true);
  });

  it("führt gleichnamige Kategorien zusammen", async () => {
    const { a, b } = await pair();
    await a.apply({
      type: "category.save",
      value: { ...metadata(), name: "Privat" },
    });
    await b.apply({
      type: "category.save",
      value: { ...metadata(), name: "privat" },
    });
    await sync(a, b);
    const [x, y] = [await a.load(), await b.load()];
    expect(
      x.projectCategories.filter((c) => c.name.toLowerCase() === "privat"),
    ).toHaveLength(1);
    expect(sameData(x, y)).toBe(true);
  });

  it("konvergiert unabhängig von Reihenfolge und Wiederholung", () => {
    const base = demoData();
    const [project] = base.projects;
    const one: AppData = {
      ...base,
      todos: base.todos.map((t, i) =>
        i === 0 ? { ...t, title: "Eins", rev: 2 } : t,
      ),
    };
    const two: AppData = {
      ...base,
      todos: base.todos.map((t, i) =>
        i === 0
          ? {
              ...t,
              title: "Zwei",
              rev: 2,
              updatedAt: "2099-01-01T00:00:00.000Z",
            }
          : t,
      ),
      projects: base.projects.map((p) =>
        p.id === project.id ? { ...p, name: "Neu", rev: 3 } : p,
      ),
    };
    const at = now();
    const ab = mergeData(one, [two], at);
    const ba = mergeData(two, [one], at);
    expect(sameData(ab, ba)).toBe(true);
    expect(sameData(mergeData(ab, [two, one], at), ab)).toBe(true);
  });

  it("erkennt gleiche Stände ohne Änderung", () => {
    const base = demoData();
    expect(sameData(mergeData(base, [base], now()), base)).toBe(true);
  });
});
