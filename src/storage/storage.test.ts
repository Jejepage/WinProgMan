import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { demoData } from "../domain/demo";
import { emptyData, metadata, type ExportEnvelope } from "../domain/types";
import { IndexedDbProjectStore } from "./IndexedDbProjectStore";
import { validateData, validateImport } from "./validation";

const legacyData = () => {
  const {
    projectCategories: _categories,
    brainstorm: _brainstorm,
    ...data
  } = demoData();
  return {
    ...data,
    todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
    projects: data.projects.map(
      ({
        status: _status,
        categoryId: _category,
        number: _number,
        ...project
      }) => project,
    ),
  };
};

const oldFields = (data: ExportEnvelope) => {
  const { brainstorm: _brainstorm, ...rest } = data;
  return {
    ...rest,
    projects: rest.projects.map(({ number: _number, ...project }) => project),
  };
};

const envelope = (): ExportEnvelope => ({
  ...demoData(),
  schemaVersion: 5,
  exportedAt: new Date().toISOString(),
});
const store = () => new IndexedDbProjectStore(`test-${crypto.randomUUID()}`);

describe("Sicherungsvalidierung", () => {
  it("importiert Format 4 mit stabilen Nummern und leerem Brainstorm und validiert Format 5 vollständig", () => {
    const data = envelope();
    const old = { ...oldFields(data), schemaVersion: 4 };
    const imported = validateImport(old);
    expect(imported.projects.map((project) => project.number)).toEqual([1, 2]);
    expect(imported.brainstorm).toEqual(emptyData().brainstorm);
    const snapshot = JSON.stringify(data);
    data.projects[1].number = data.projects[0].number;
    expect(() => validateImport(data)).toThrow("bereits vergeben");
    for (const mutate of [
      (value: ExportEnvelope) => {
        value.brainstorm.revision = -1;
      },
      (value: ExportEnvelope) => {
        value.brainstorm.revision = 1.5;
      },
      (value: ExportEnvelope) => {
        value.brainstorm.updatedAt = "gestern";
      },
      (value: ExportEnvelope) => {
        delete (value as Partial<ExportEnvelope>).brainstorm;
      },
    ]) {
      const value = JSON.parse(snapshot) as ExportEnvelope;
      mutate(value);
      expect(() => validateImport(value)).toThrow();
    }
  });
  it("erhält alte Klartextnotizen beim Import von Format 2 unverändert", () => {
    const data = envelope();
    const old = {
      ...oldFields(data),
      schemaVersion: 2,
      todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
    };
    old.events[0].note = "**kein Markdown**\n# Klartext";
    const imported = validateImport(old);
    expect(imported.schemaVersion).toBe(5);
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
    expect(migrated.schemaVersion).toBe(5);
    expect(migrated.projectCategories).toEqual([]);
    expect(migrated.projects).toEqual(
      legacy.projects.map((project, index) => ({
        ...project,
        number: index + 1,
        status: "Aktiv",
      })),
    );
    expect(validateData(legacy)).toEqual({
      ...legacy,
      brainstorm: emptyData().brainstorm,
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
      ...oldFields(data),
      schemaVersion: 3,
      todos: data.todos.map(({ doNext: _doNext, ...todo }) => todo),
    };
    const migrated = validateImport(old);
    expect(migrated.schemaVersion).toBe(5);
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
        (data as unknown as { schemaVersion: number }).schemaVersion = 6;
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
        schemaVersion: 5,
        exportedAt: new Date().toISOString(),
      }).projects,
    ).toEqual([]);
  });
});

describe("IndexedDB", () => {
  it("lädt Beispiele atomar ohne Brainstorm zu ersetzen und schützt vorhandene Projekte", async () => {
    const name = `samples-${crypto.randomUUID()}`;
    const adapter = new IndexedDbProjectStore(name);
    await adapter.apply({
      type: "brainstorm.save",
      text: "Meine Tagesideen",
      expectedRevision: 0,
    });
    const brainstorm = (await adapter.load()).brainstorm;
    await adapter.apply({ type: "samples.load", value: demoData() });
    const loaded = await new IndexedDbProjectStore(name).load();
    expect(loaded.brainstorm).toEqual(brainstorm);
    expect(loaded.projects).toHaveLength(2);
    expect(loaded.todos.length).toBeGreaterThan(0);
    await expect(
      adapter.apply({ type: "samples.load", value: demoData() }),
    ).rejects.toThrow("no projects");
    expect(await adapter.load()).toEqual(loaded);
  });
  it("vergibt Nummern auch über parallele Adapter atomar und erhält sie bei Änderungen und Löschung", async () => {
    const name = `numbers-${crypto.randomUUID()}`;
    const first = new IndexedDbProjectStore(name);
    const second = new IndexedDbProjectStore(name);
    const projects = Array.from({ length: 8 }, (_, index) => ({
      ...metadata(),
      number: 0,
      name: `Projekt ${index}`,
      description: "",
      status: "Aktiv" as const,
    }));
    await Promise.all(
      projects.map((value, index) =>
        (index % 2 ? first : second).apply({ type: "project.save", value }),
      ),
    );
    const before = await first.load();
    expect(
      before.projects.map((project) => project.number).sort((a, b) => a - b),
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const edited = { ...before.projects[0], number: 20 };
    await first.apply({
      type: "project.saveWithLinks",
      value: edited,
      links: [],
    });
    await second.apply({ type: "project.delete", id: before.projects[1].id });
    await first.apply({
      type: "project.save",
      value: { ...projects[0], ...metadata() },
    });
    const reloaded = await new IndexedDbProjectStore(name).load();
    expect(
      reloaded.projects.find((project) => project.id === edited.id)?.number,
    ).toBe(20);
    expect(reloaded.projects.some((project) => project.number === 21)).toBe(
      true,
    );
    for (const number of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
      reloaded.projects[1].number,
    ]) {
      const snapshot = await first.load();
      await expect(
        first.apply({
          type: "project.saveWithLinks",
          value: { ...edited, number },
          links: [],
        }),
      ).rejects.toThrow();
      expect(await first.load()).toEqual(snapshot);
    }
  });
  it("sichert Brainstorm mit CAS, erhält andere Daten und verhindert verlorene parallele Änderungen", async () => {
    const name = `brainstorm-${crypto.randomUUID()}`;
    const first = new IndexedDbProjectStore(name);
    const second = new IndexedDbProjectStore(name);
    await first.importData(envelope());
    const before = await first.load();
    const results = await Promise.allSettled([
      first.apply({
        type: "brainstorm.save",
        text: "# Idee\r\n\r\nText",
        expectedRevision: 0,
      }),
      second.apply({
        type: "brainstorm.save",
        text: "Andere Idee",
        expectedRevision: 0,
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const loaded = await second.load();
    expect(loaded.brainstorm.revision).toBe(1);
    expect(loaded.projects).toEqual(before.projects);
    expect(loaded.events).toEqual(before.events);
    await expect(
      second.apply({
        type: "brainstorm.save",
        text: "Alt",
        expectedRevision: 0,
      }),
    ).rejects.toThrow("another window");
    expect(await first.load()).toEqual(loaded);
    await first.apply({
      type: "brainstorm.save",
      text: "",
      expectedRevision: 1,
    });
    expect((await second.load()).brainstorm).toMatchObject({
      text: "",
      revision: 2,
    });
    const exported = await first.exportData();
    expect(exported.schemaVersion).toBe(5);
    const restored = store();
    await restored.importData(JSON.parse(JSON.stringify(exported)));
    expect(await restored.load()).toEqual(await first.load());
  });
  it("speichert Projekt und Linkentwurf gemeinsam und erhält bei Fehlern den gesamten alten Bestand", async () => {
    const adapter = store();
    const data = envelope();
    await adapter.importData(data);
    const before = await adapter.load();
    const project = { ...before.projects[0], name: "Changed" };
    const link = {
      ...metadata(),
      projectId: project.id,
      label: "Docs",
      target: "https://example.com",
    };
    await expect(
      adapter.apply({
        type: "project.saveWithLinks",
        value: project,
        links: [{ ...link, projectId: before.projects[1].id }],
      }),
    ).rejects.toThrow();
    expect(await adapter.load()).toEqual(before);
    const failure = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new Error("Disk full");
      });
    try {
      await expect(
        adapter.apply({
          type: "project.saveWithLinks",
          value: project,
          links: [link],
        }),
      ).rejects.toThrow("Disk full");
    } finally {
      failure.mockRestore();
    }
    expect(await adapter.load()).toEqual(before);
    await adapter.apply({
      type: "project.saveWithLinks",
      value: project,
      links: [link],
    });
    const after = await adapter.load();
    expect(after.projects.map((item) => item.id)).toEqual(
      before.projects.map((item) => item.id),
    );
    expect(after.projects[0].name).toBe("Changed");
    expect(after.links.filter((item) => item.projectId === project.id)).toEqual(
      [link],
    );
    expect(after.links.filter((item) => item.projectId !== project.id)).toEqual(
      before.links.filter((item) => item.projectId !== project.id),
    );
    await adapter.apply({ type: "project.delete", id: project.id });
    await expect(
      adapter.apply({
        type: "project.saveWithLinks",
        value: project,
        links: [],
      }),
    ).rejects.toThrow("no longer exists");
  });
  it("ändert Do next am aktuellen Datensatz ohne andere Änderungen zu verlieren und schützt erledigte Aufgaben", async () => {
    const adapter = store();
    await adapter.importData(envelope());
    const task = (await adapter.load()).todos.find((item) => !item.completed)!;
    const modified = { ...task, title: "Newer title" };
    await adapter.apply({ type: "todo.save", value: modified });
    await adapter.apply({ type: "todo.setDoNext", id: task.id, doNext: true });
    expect(
      (await adapter.load()).todos.find((item) => item.id === task.id),
    ).toMatchObject({ title: "Newer title", doNext: true });
    await adapter.apply({ type: "todo.setDoNext", id: task.id, doNext: false });
    expect(
      (await adapter.load()).todos.find((item) => item.id === task.id),
    ).not.toHaveProperty("doNext");
    await adapter.apply({
      type: "todo.save",
      value: { ...modified, completed: true },
    });
    const before = await adapter.load();
    await expect(
      adapter.apply({ type: "todo.setDoNext", id: task.id, doNext: true }),
    ).rejects.toThrow("Reopen");
    expect(await adapter.load()).toEqual(before);
    await expect(
      adapter.apply({ type: "todo.setDoNext", id: "missing", doNext: false }),
    ).rejects.toThrow("no longer exists");
  });
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
    expect((await adapter.exportData()).schemaVersion).toBe(5);
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
      brainstorm: data.brainstorm,
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
      number: 0,
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
    expect(loaded.projects).toEqual([{ ...project, number: 1 }]);
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
      schemaVersion: 5,
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
    expect((await adapter.exportData()).schemaVersion).toBe(5);
  });
});
