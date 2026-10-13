import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { demoData } from "../domain/demo";
import { emptyData, metadata, type ExportEnvelope } from "../domain/types";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore";
import { validateData, validateImport } from "./validation";

const legacyData = () => {
  const { projectCategories: _categories, ...data } = demoData();
  return {
    ...data,
    todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
    projects: data.projects.map(
      ({ status: _status, categoryId: _category, ...project }) => project,
    ),
  };
};

const envelope = (): ExportEnvelope => ({
  ...demoData(),
  schemaVersion: 4,
  exportedAt: new Date().toISOString(),
});
const store = () => new IndexedDbProjectStore(`test-${crypto.randomUUID()}`);

describe("Sicherungsvalidierung", () => {
  it("erhält alte Klartextnotizen beim Import von Format 2 unverändert", () => {
    const data = envelope();
    const old = {
      ...data,
      schemaVersion: 2,
      todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
    };
    old.events[0].note = "**kein Markdown**\n# Klartext";
    const imported = validateImport(old);
    expect(imported.schemaVersion).toBe(4);
    expect(imported.events).toEqual(old.events);
    expect(imported.events[0]).not.toHaveProperty("noteFormat");
    expect(validateData(old).events).toEqual(old.events);
  });
  it("erhält Markdown und Klartext getrennt im JSON-Roundtrip", () => {
    const data = envelope();
    data.events[0].note = "# Überschrift\n\n**Wichtig**";
    data.events[0].noteFormat = "markdown";
    expect(validateImport(JSON.parse(JSON.stringify(data)))).toEqual(data);
    expect(validateData(data).events).toEqual(data.events);
  });
  it("weist unbekannte Notizformate und Markdown-Felder in alten Versionen ab", () => {
    const data = envelope();
    (data.events[0] as unknown as { noteFormat: string }).noteFormat = "html";
    expect(() => validateImport(data)).toThrow("Unbekanntes Notizformat");
    data.events[0].noteFormat = "markdown";
    expect(() =>
      validateImport({
        ...data,
        schemaVersion: 2,
        todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
      }),
    ).toThrow("Unbekanntes Feld");
    const legacy = legacyData();
    expect(() =>
      validateImport({
        ...legacy,
        schemaVersion: 1,
        exportedAt: data.exportedAt,
        events: data.events,
      }),
    ).toThrow("Unbekanntes Feld");
  });
  it("migriert alte Sicherungen und lokale Daten ohne IDs oder Inhalte zu ändern", () => {
    const legacy = legacyData();
    const migrated = validateImport({
      ...legacy,
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
    });
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.projectCategories).toEqual([]);
    expect(migrated.projects).toEqual(
      legacy.projects.map((project) => ({ ...project, status: "Aktiv" })),
    );
    expect(validateData(legacy)).toEqual({
      ...legacy,
      projectCategories: [],
      projects: migrated.projects,
    });
    expect(legacy.projects[0]).not.toHaveProperty("status");
  });
  it("weist neue Felder in Format 1, fehlenden Status und ungültige Kategoriebeziehungen ab", () => {
    expect(() => validateImport({ ...envelope(), schemaVersion: 1 })).toThrow();
    const data = envelope();
    delete (data.projects[0] as Partial<(typeof data.projects)[0]>).status;
    expect(() => validateImport(data)).toThrow();
    const orphan = envelope();
    orphan.projects[0].categoryId = "fehlt";
    expect(() => validateImport(orphan)).toThrow();
  });
  it("weist doppelte Kategorienamen und übergreifend doppelte IDs ab", () => {
    const data = envelope();
    data.projectCategories = [
      { ...metadata(), name: "Arbeit" },
      { ...metadata(), name: " arbeit " },
    ];
    expect(() => validateImport(data)).toThrow("Doppelter Kategoriename");
    data.projectCategories = [
      { ...metadata(), id: data.projects[0].id, name: "Arbeit" },
    ];
    expect(() => validateImport(data)).toThrow("Doppelte ID");
  });
  it("erhält IDs, Beziehungen und mehrzeilige Notizen im JSON-Roundtrip", () => {
    const data = envelope();
    expect(validateImport(JSON.parse(JSON.stringify(data)))).toEqual(data);
  });
  it("erhält Do-next-Markierungen in Format 4 und migriert Format 3 ohne sie", () => {
    const data = envelope();
    expect(data.todos.some((todo) => todo.doNext)).toBe(true);
    expect(validateImport(JSON.parse(JSON.stringify(data))).todos).toEqual(
      data.todos,
    );
    const old = {
      ...data,
      schemaVersion: 3,
      todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
    };
    const migrated = validateImport(old);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.todos).toEqual(old.todos);
    expect(validateData(old).todos).toEqual(old.todos);
    expect(() => validateImport({ ...data, schemaVersion: 3 })).toThrow(
      "Unbekanntes Feld",
    );
    (data.todos[0] as unknown as { doNext: string }).doNext = "yes";
    expect(() => validateImport(data)).toThrow("Wahrheitswert erwartet");
  });
  it.each([
    [
      "unbekannte Version",
      (data: ExportEnvelope) => {
        (data as unknown as { schemaVersion: number }).schemaVersion = 5;
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
        schemaVersion: 4,
        exportedAt: new Date().toISOString(),
      }).projects,
    ).toEqual([]);
  });
});

describe("IndexedDB", () => {
  it("speichert Markdown mit Formatkennzeichnung und erhält Klartext beim Reload und Export", async () => {
    const name = `notes-${crypto.randomUUID()}`;
    const adapter = new IndexedDbProjectStore(name);
    const data = envelope();
    data.events[0].note = "**Formatierter Text**";
    data.events[0].noteFormat = "markdown";
    data.events[1].note = "**Alter Klartext**";
    await adapter.importData(data);
    expect((await new IndexedDbProjectStore(name).load()).events).toEqual(
      data.events,
    );
    expect((await adapter.exportData()).events).toEqual(data.events);
  });
  it("lädt persistierte Altdaten und migriert vor der ersten Kategorieänderung", async () => {
    const name = `legacy-${crypto.randomUUID()}`;
    const legacy = legacyData();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore("app");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("app", "readwrite");
        transaction.objectStore("app").put(legacy, "data");
        transaction.oncomplete = () => {
          database.close();
          resolve();
        };
        transaction.onabort = () => reject(transaction.error);
      };
    });
    const adapter = new IndexedDbProjectStore(name);
    const migrated = await adapter.load();
    expect(
      migrated.projects.every((project) => project.status === "Aktiv"),
    ).toBe(true);
    const category = { ...metadata(), name: "Arbeit" };
    await adapter.apply({ type: "category.save", value: category });
    const reloaded = await new IndexedDbProjectStore(name).load();
    expect(reloaded).toEqual({ ...migrated, projectCategories: [category] });
    expect((await adapter.exportData()).schemaVersion).toBe(4);
  });
  it("löscht Kategorien atomar, erhält Projekte und aktualisiert deren Zeitstempel", async () => {
    const adapter = store();
    const data = envelope();
    const category = { ...metadata(), name: "Arbeit" };
    data.projectCategories = [category];
    data.projects[0].categoryId = category.id;
    await adapter.importData(data);
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new Error("Schreibfehler");
      });
    try {
      await expect(
        adapter.apply({ type: "category.delete", id: category.id }),
      ).rejects.toThrow("Schreibfehler");
    } finally {
      failure.mockRestore();
    }
    expect(await adapter.load()).toEqual({
      projectCategories: data.projectCategories,
      projects: data.projects,
      links: data.links,
      todos: data.todos,
      events: data.events,
    });
    await adapter.apply({ type: "category.delete", id: category.id });
    const loaded = await adapter.load();
    expect(loaded.projectCategories).toEqual([]);
    expect(loaded.projects[0].categoryId).toBeUndefined();
    expect(Date.parse(loaded.projects[0].updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(data.projects[0].updatedAt),
    );
    expect(loaded.projects[1]).toEqual(data.projects[1]);
    expect(loaded.todos).toEqual(data.todos);
  });
  it("erhält Kategorien bei Projektlöschung und weist ungültige Kategorieänderungen atomar ab", async () => {
    const adapter = store();
    const data = envelope();
    data.projectCategories = [{ ...metadata(), name: "Privat" }];
    await adapter.importData(data);
    await expect(
      adapter.apply({
        type: "category.save",
        value: { ...metadata(), name: " privat " },
      }),
    ).rejects.toThrow();
    expect((await adapter.load()).projectCategories).toEqual(
      data.projectCategories,
    );
    await adapter.apply({ type: "project.delete", id: data.projects[0].id });
    expect((await adapter.load()).projectCategories).toEqual(
      data.projectCategories,
    );
  });
  it("startet leer, speichert CRUD und lädt aus einer neuen Adapterinstanz", async () => {
    const name = `test-${crypto.randomUUID()}`;
    const first = new IndexedDbProjectStore(name);
    expect(await first.load()).toEqual(emptyData());
    const project = {
      ...metadata(),
      name: "Projekt",
      description: "",
      status: "Aktiv" as const,
    };
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
      schemaVersion: 4,
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
    expect((await adapter.exportData()).schemaVersion).toBe(4);
  });
});
