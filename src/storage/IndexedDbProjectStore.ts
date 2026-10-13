import {
  emptyData,
  type AppData,
  type DomainChange,
  type ExportEnvelope,
} from "../domain/types";
import type { ProjectStore } from "./ProjectStore";
import { validateData, validateImport } from "./validation";

function applyChange(data: AppData, change: DomainChange): AppData {
  if (change.type === "project.delete") {
    return {
      projects: data.projects.filter((value) => value.id !== change.id),
      links: data.links.filter((value) => value.projectId !== change.id),
      todos: data.todos.filter((value) => value.projectId !== change.id),
      events: data.events.filter((value) => value.projectId !== change.id),
    };
  }
  const collection = change.type.startsWith("project.")
    ? "projects"
    : change.type.startsWith("link.")
      ? "links"
      : change.type.startsWith("todo.")
        ? "todos"
        : "events";
  if ("id" in change) {
    return {
      ...data,
      [collection]: data[collection].filter((value) => value.id !== change.id),
    };
  }
  const values = data[collection].filter(
    (value) => value.id !== change.value.id,
  );
  return { ...data, [collection]: [...values, change.value] };
}

/** One snapshot per transaction keeps cascading deletes/imports and read-modify-write atomic. */
export class IndexedDbProjectStore implements ProjectStore {
  private database: Promise<IDBDatabase> | undefined;
  constructor(private readonly databaseName = "winprogman") {}

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
      const transaction = database.transaction("app", "readonly");
      const request = transaction.objectStore("app").get("data");
      let result = emptyData();
      request.onsuccess = () => {
        try {
          result =
            request.result === undefined
              ? emptyData()
              : validateData(request.result);
        } catch (error) {
          reject(error);
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error("Lesen des lokalen Speichers wurde abgebrochen."),
        );
      transaction.onerror = () => reject(transaction.error ?? request.error);
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
            validateData(transform(request.result ?? emptyData())),
            "data",
          );
        } catch (error) {
          failure = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve();
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
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
    };
  }
  async importData(data: ExportEnvelope): Promise<void> {
    const {
      schemaVersion: _version,
      exportedAt: _at,
      ...validated
    } = validateImport(data);
    return this.write(() => validated);
  }
}
