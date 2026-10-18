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
