import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { demoData } from "../domain/demo";
import { emptyData, metadata, type ExportEnvelope } from "../domain/types";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore";
import { validateImport } from "./validation";

const envelope = (): ExportEnvelope => ({
  ...demoData(),
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
});
const store = () => new IndexedDbProjectStore(`test-${crypto.randomUUID()}`);

describe("Sicherungsvalidierung", () => {
  it("erhält IDs, Beziehungen und mehrzeilige Notizen im JSON-Roundtrip", () => {
    const data = envelope();
    expect(validateImport(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
  it.each([
    [
      "unbekannte Version",
      (data: ExportEnvelope) => {
        (data as unknown as { schemaVersion: number }).schemaVersion = 2;
      },
    ],
    [
      "fehlendes Feld",
      (data: ExportEnvelope) => {
        delete (data.projects[0] as Partial<(typeof data.projects)[0]>)
          .description;
      },
    ],
    [
      "doppelte ID",
      (data: ExportEnvelope) => {
        data.links[0].id = data.projects[0].id;
      },
    ],
    [
      "verwaiste Referenz",
      (data: ExportEnvelope) => {
        data.todos[0].projectId = "fehlt";
      },
    ],
    [
      "ungültiges Kalenderdatum",
      (data: ExportEnvelope) => {
        data.events[0].date = "2026-02-30";
      },
    ],
    [
      "ungültige Uhrzeit",
      (data: ExportEnvelope) => {
        data.events[0].time = "24:00";
      },
    ],
    [
      "ungültige Kategorie",
      (data: ExportEnvelope) => {
        (data.events[0] as unknown as { category: string }).category =
          "Sonstiges";
      },
    ],
    [
      "ungültiger Zeitstempel",
      (data: ExportEnvelope) => {
        data.projects[0].createdAt = "2026-02-30T00:00:00Z";
      },
    ],
    [
      "gefährliches Linkziel",
      (data: ExportEnvelope) => {
        data.links[0].target = "javascript:alert(1)";
      },
    ],
  ])("weist %s ab", (_description, mutate) => {
    const data = envelope();
    mutate(data);
    expect(() => validateImport(data)).toThrow();
  });
  it("akzeptiert optionale Daten und leere Listen", () => {
    expect(
      validateImport({
        ...emptyData(),
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
      }).projects,
    ).toEqual([]);
  });
});

describe("IndexedDB", () => {
  it("startet leer, speichert CRUD und lädt aus einer neuen Adapterinstanz", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const first = new IndexedDbProjectStore(name);
    expect(await first.load()).toEqual(emptyData());
    const project = { ...metadata(), name: "Projekt", description: "" };
    await first.apply({ type: "project.save", value: project });
    const todo = {
      ...metadata(),
      projectId: project.id,
      title: "Aufgabe",
      completed: false,
    };
    await first.apply({ type: "todo.save", value: todo });
    await first.apply({
      type: "todo.save",
      value: { ...todo, completed: true },
    });
    const loaded = await new IndexedDbProjectStore(name).load();
    expect(loaded.projects).toEqual([project]);
    expect(loaded.todos).toEqual([{ ...todo, completed: true }]);
    await first.apply({ type: "todo.delete", id: todo.id });
    expect((await first.load()).todos).toEqual([]);
  });
  it("löscht alle abhängigen Inhalte eines Projekts gemeinsam", async () => {
    const adapter = store();
    const data = envelope();
    await adapter.importData(data);
    await adapter.apply({ type: "project.delete", id: data.projects[0].id });
    const loaded = await adapter.load();
    expect(loaded.projects).toEqual([data.projects[1]]);
    for (const collection of [loaded.links, loaded.todos, loaded.events])
      expect(
        collection.every((item) => item.projectId === data.projects[1].id),
      ).toBe(true);
  });
  it("ersetzt beim Import und erhält den alten Bestand bei fehlerhaften Daten", async () => {
    const adapter = store();
    const data = envelope();
    await adapter.importData(data);
    const before = await adapter.load();
    const invalid = envelope();
    invalid.todos[0].projectId = "fehlt";
    await expect(adapter.importData(invalid)).rejects.toThrow();
    expect(await adapter.load()).toEqual(before);
    await adapter.importData({
      ...emptyData(),
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
    });
    expect(await adapter.load()).toEqual(emptyData());
  });
  it("weist ungültige Änderungen zurück, ohne bestehende Daten anzutasten", async () => {
    const adapter = store();
    const data = envelope();
    await adapter.importData(data);
    const before = await adapter.load();
    await expect(
      adapter.apply({
        type: "todo.save",
        value: {
          ...metadata(),
          projectId: "fehlt",
          title: "Aufgabe",
          completed: false,
        },
      }),
    ).rejects.toThrow();
    expect(await adapter.load()).toEqual(before);
  });
  it("erhält die Sicherung bei einem Schreibfehler während des Imports", async () => {
    const adapter = store();
    const data = envelope();
    await adapter.importData(data);
    const before = await adapter.load();
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new DOMException("Kein Speicherplatz", "QuotaExceededError");
      });
    try {
      await expect(adapter.importData(envelope())).rejects.toThrow(
        "Kein Speicherplatz",
      );
    } finally {
      failure.mockRestore();
    }
    expect(await adapter.load()).toEqual(before);
  });
  it("serialisiert parallele Änderungen ohne verlorene Datensätze", async () => {
    const adapter = store();
    const data = envelope();
    await adapter.importData(data);
    const todos = Array.from({ length: 8 }, (_, index) => ({
      ...metadata(),
      projectId: data.projects[0].id,
      title: `Aufgabe ${index}`,
      completed: false,
    }));
    await Promise.all(
      todos.map((value) => adapter.apply({ type: "todo.save", value })),
    );
    const loaded = await adapter.load();
    expect(loaded.todos).toHaveLength(data.todos.length + todos.length);
    expect((await adapter.exportData()).schemaVersion).toBe(1);
  });
});
