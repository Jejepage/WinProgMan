import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { demoData } from "../domain/demo";
import { IndexedDbProjectStore } from "../storage/IndexedDbProjectStore";
import { adoptFolder, fileName, runSync, type SyncTransport } from "./service";

const memory = (): SyncTransport & { files: Map<string, string> } => {
  const files = new Map<string, string>();
  return {
    files,
    list: async () => [...files.keys()].sort(),
    read: async (name) => files.get(name) ?? null,
    write: async (name, text) => void files.set(name, text),
  };
};
const device = (label: string) => ({
  store: new IndexedDbProjectStore(`svc-${label}-${crypto.randomUUID()}`),
  deviceId: `${label}-00000000`,
  deviceName: label,
});

describe("Synchronisierung über einen Ordner", () => {
  it("überträgt Daten von Gerät A zu Gerät B und zurück", async () => {
    const transport = memory();
    const a = device("aaaa");
    const b = device("bbbb");
    await a.store.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
    });
    expect((await runSync({ ...a, transport })).published).toBe(true);
    const backups: number[] = [];
    const first = await runSync({
      ...b,
      transport,
      backup: async (data) => void backups.push(data.projects.length),
    });
    expect(first.devices).toEqual(["aaaa"]);
    expect((await b.store.load()).projects.length).toBe(
      demoData().projects.length,
    );
    expect(first.changed).toBe(true);
    expect(backups).toEqual([0]);

    const todo = (await b.store.load()).todos[0];
    await b.store.apply({ type: "todo.delete", id: todo.id });
    await runSync({ ...b, transport });
    const back = await runSync({ ...a, transport });
    expect(back.changed).toBe(true);
    expect((await a.store.load()).todos.some((t) => t.id === todo.id)).toBe(
      false,
    );
  });

  it("schreibt unveränderte Daten nicht erneut und ändert nichts ohne Unterschied", async () => {
    const transport = memory();
    const a = device("aaaa");
    await a.store.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
    });
    await runSync({ ...a, transport });
    const again = await runSync({ ...a, transport });
    expect(again.published).toBe(false);
    expect(again.changed).toBe(false);
  });

  it("überspringt beschädigte oder unvollständige Dateien und erhält die Daten", async () => {
    const transport = memory();
    const a = device("aaaa");
    await a.store.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
    });
    transport.files.set(fileName("cccc-00000000"), '{"format":1,"device');
    const bad = JSON.parse(
      JSON.stringify({
        format: 1,
        deviceId: "dddd-00000000",
        deviceName: "d",
        savedAt: new Date().toISOString(),
        checksum: "0".repeat(64),
        data: demoData(),
      }),
    );
    transport.files.set(fileName("dddd-00000000"), JSON.stringify(bad));
    const before = await a.store.load();
    const result = await runSync({ ...a, transport });
    expect(result.skipped.sort()).toEqual([
      fileName("cccc-00000000"),
      fileName("dddd-00000000"),
    ]);
    expect(result.changed).toBe(false);
    expect((await a.store.load()).projects).toEqual(before.projects);
  });

  async function twoSynced() {
    const transport = memory();
    const a = device("aaaa");
    const b = device("bbbb");
    await a.store.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
    });
    await runSync({ ...a, transport });
    await runSync({ ...b, transport });
    await runSync({ ...a, transport });
    return { transport, a, b };
  }

  it("legt eine ersetzte lokale Notiz im Papierkorb ab und stellt sie als Kopie wieder her", async () => {
    const { transport, a, b } = await twoSynced();
    const event = (await a.store.load()).events[0];
    // B bearbeitet zuerst, A danach (später gewinnt); B synchronisiert zuletzt.
    await b.store.apply({
      type: "event.save",
      value: {
        ...event,
        title: "Von B",
        updatedAt: "2030-01-01T10:00:00.000Z",
      },
    });
    await a.store.apply({
      type: "event.save",
      value: {
        ...event,
        title: "Von A",
        updatedAt: "2030-01-01T11:00:00.000Z",
      },
    });
    await runSync({ ...a, transport });
    const result = await runSync({ ...b, transport });
    expect(result.conflicts).toBe(1);
    const data = await b.store.load();
    expect(data.events.find((e) => e.id === event.id)?.title).toBe("Von A");
    const lost = data.tombstones.find((t) => t.conflict);
    expect(lost?.conflict).toEqual({
      of: event.id,
      by: b.deviceId,
      device: "aaaa",
    });
    expect(lost?.record.title).toBe("Von B");

    await b.store.apply({ type: "trash.restore", id: lost!.id });
    const after = await b.store.load();
    expect(after.events.map((e) => e.title)).toContain("Von A");
    expect(after.events.map((e) => e.title)).toContain("Von B (other version)");
    expect(after.tombstones.some((t) => t.conflict)).toBe(false);
  });

  it("meldet keinen Konflikt, wenn die lokale Fassung nur älter ist", async () => {
    const { transport, a, b } = await twoSynced();
    const todo = (await a.store.load()).todos[0];
    await a.store.apply({
      type: "todo.save",
      value: { ...todo, title: "Neu von A" },
    });
    await runSync({ ...a, transport });
    const result = await runSync({ ...b, transport });
    expect(result.changed).toBe(true);
    expect(result.conflicts).toBe(0);
    expect((await b.store.load()).tombstones.some((t) => t.conflict)).toBe(
      false,
    );
  });

  it("sichert den unterlegenen Brainstorm-Text", async () => {
    const { transport, a, b } = await twoSynced();
    const first = await b.store.load();
    await b.store.apply({
      type: "brainstorm.save",
      text: "Text von B",
      expectedRevision: first.brainstorm.revision,
    });
    const second = await a.store.load();
    await a.store.apply({
      type: "brainstorm.save",
      text: "Text von A",
      expectedRevision: second.brainstorm.revision,
    });
    await a.store.apply({
      type: "brainstorm.save",
      text: "Text von A, ergänzt",
      expectedRevision: second.brainstorm.revision + 1,
    });
    await runSync({ ...a, transport });
    const result = await runSync({ ...b, transport });
    expect(result.conflicts).toBe(1);
    const data = await b.store.load();
    expect(data.brainstorm.text).toBe("Text von A, ergänzt");
    const lost = data.tombstones.find((t) => t.kind === "brainstorm");
    expect(lost?.record.text).toBe("Text von B");

    await b.store.apply({ type: "trash.restore", id: lost!.id });
    const text = (await b.store.load()).brainstorm.text;
    expect(text).toContain("Text von A, ergänzt");
    expect(text).toContain("Text von B");
  });

  it("übernimmt den Ordnerstand ohne eigene Veröffentlichung ohne Konfliktmeldung", async () => {
    const { transport, a } = await twoSynced();
    const fresh = device("cccc");
    await fresh.store.apply({
      type: "brainstorm.save",
      text: "Lokal",
      expectedRevision: 0,
    });
    const result = await runSync({ ...fresh, transport });
    expect(result.conflicts).toBe(0);
    expect((await a.store.load()).projects.length).toBeGreaterThan(0);
  });

  it("übernimmt auf Wunsch den Ordnerstand vollständig", async () => {
    const transport = memory();
    const a = device("aaaa");
    const b = device("bbbb");
    await a.store.importData({
      ...demoData(),
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
    });
    await runSync({ ...a, transport });
    const saved: number[] = [];
    expect(
      await adoptFolder({
        ...b,
        transport,
        backup: async (d) => void saved.push(d.projects.length),
      }),
    ).toBe(true);
    expect((await b.store.load()).projects.map((p) => p.id)).toEqual(
      (await a.store.load()).projects.map((p) => p.id),
    );
    expect(await adoptFolder({ ...device("eeee"), transport: memory() })).toBe(
      false,
    );
  });
});
