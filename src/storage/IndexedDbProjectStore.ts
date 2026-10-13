import {
  emptyData,
  type AppData,
  type DomainChange,
  type ExportEnvelope,
} from "../domain/types";
import { ConflictError, type ProjectStore } from "./ProjectStore";
import { applyChange } from "./changes";
import { validateData, validateImport } from "./validation";

/** One snapshot per transaction keeps migration, cascading deletes and OCC atomic. */
export class IndexedDbProjectStore implements ProjectStore {
  private database: Promise<IDBDatabase> | undefined;
  private channel: BroadcastChannel | undefined;
  private listeners = new Set<() => void>();
  constructor(private readonly databaseName = "winprogman") {}
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    if (!this.channel && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`winprogman:${this.databaseName}`);
      this.channel.onmessage = () => {
        for (const callback of this.listeners) callback();
      };
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.channel?.close();
        this.channel = undefined;
      }
    };
  }
  private notify() {
    if (this.channel) this.channel.postMessage({ changed: true });
    else if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(`winprogman:${this.databaseName}`);
      channel.postMessage({ changed: true });
      channel.close();
    }
  }
  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.databaseName, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("app");
        };
        request.onerror = () =>
          reject(
            request.error ??
              new Error("Lokaler Speicher konnte nicht geöffnet werden."),
          );
        request.onblocked = () =>
          reject(
            new Error(
              "Lokaler Speicher ist durch ein anderes Fenster blockiert.",
            ),
          );
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => {
            database.close();
            this.database = undefined;
          };
          resolve(database);
        };
      }).catch((error) => {
        this.database = undefined;
        throw error;
      });
    }
    return this.database;
  }
  async load(): Promise<AppData> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("app", "readwrite");
      const store = transaction.objectStore("app");
      const request = store.get("data");
      let result = emptyData();
      let failure: unknown;
      request.onsuccess = () => {
        try {
          result = validateData(request.result ?? emptyData());
          // Migration is persisted before any editor can receive the new identities.
          if (
            request.result !== undefined &&
            JSON.stringify(request.result) !== JSON.stringify(result)
          )
            store.put(result, "data");
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(
          failure ?? transaction.error ?? new Error("Lesen wurde abgebrochen."),
        );
      transaction.onerror = () =>
        reject(failure ?? transaction.error ?? request.error);
    });
  }
  private async write(transform: (data: AppData) => AppData): Promise<void> {
    const database = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("app", "readwrite");
      const store = transaction.objectStore("app");
      const request = store.get("data");
      let failure: unknown;
      request.onsuccess = () => {
        try {
          store.put(
            validateData(
              transform(validateData(request.result ?? emptyData())),
            ),
            "data",
          );
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => {
        this.notify();
        resolve();
      };
      transaction.onabort = () =>
        reject(
          failure ??
            transaction.error ??
            new Error("Änderung wurde nicht gespeichert."),
        );
      transaction.onerror = () =>
        reject(failure ?? transaction.error ?? request.error);
    });
  }
  apply(change: DomainChange): Promise<void> {
    return this.write((data) => applyChange(data, change));
  }
  async exportData(): Promise<ExportEnvelope> {
    return {
      ...(await this.load()),
      schemaVersion: 5,
      exportedAt: new Date().toISOString(),
    };
  }
  async importData(
    data: ExportEnvelope,
    expectedRevision?: number,
  ): Promise<void> {
    const {
      schemaVersion: _version,
      exportedAt: _at,
      ...validated
    } = validateImport(data);
    return this.write((current) => {
      if (
        expectedRevision !== undefined &&
        current.revision !== expectedRevision
      )
        throw new ConflictError(current);
      const revision =
        Math.max(
          current.revision,
          validated.revision,
          ...[
            ...validated.projects,
            ...validated.projectCategories,
            ...validated.todos,
            ...validated.links,
            ...validated.events,
          ].map((item) => item.revision ?? 0),
        ) + 1;
      return {
        ...validated,
        revision,
        trash: validated.trash.map((entry) => ({
          ...entry,
          ...(entry.detachedTasks
            ? {
                detachedTasks: entry.detachedTasks.map((ref) => {
                  const task = validated.todos.find((t) => t.id === ref.id);
                  return task &&
                    !task.eventId &&
                    (task.revision ?? 0) === ref.revision
                    ? { ...ref, revision }
                    : ref;
                }),
              }
            : {}),
        })),
        // A full replacement must invalidate editors even when an old backup reuses IDs.
        ...Object.fromEntries(
          ["projects", "projectCategories", "todos", "links", "events"].map(
            (key) => [
              key,
              validated[key as "projects"].map((item) => ({
                ...item,
                revision,
              })),
            ],
          ),
        ),
        nextProjectNumber: Math.max(
          current.nextProjectNumber,
          validated.nextProjectNumber,
        ),
      };
    });
  }
}
