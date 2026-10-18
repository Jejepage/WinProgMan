import {
  AUTO_PROJECT_NUMBER,
  emptyData,
  type AppData,
  type DomainChange,
  type ExportEnvelope,
} from "../domain/types";
import { restore, stamp } from "../domain/history";
import { mergeData } from "../sync/merge";
import type { ProjectStore } from "./ProjectStore";
import { validateData, validateImport } from "./validation";

function applyChange(data: AppData, change: DomainChange): AppData {
  if (change.type === "samples.load") {
    if (data.projects.length > 0)
      throw new Error(
        "Sample data can only be loaded when there are no projects.",
      );
    return { ...change.value, brainstorm: data.brainstorm };
  }
  if (change.type === "brainstorm.save") {
    if (change.expectedRevision !== data.brainstorm.revision)
      throw new Error(
        "Brainstorm was changed in another window. Your draft has been preserved.",
      );
    return {
      ...data,
      brainstorm: {
        text: change.text,
        revision: data.brainstorm.revision + 1,
        updatedAt: new Date().toISOString(),
      },
    };
  }
  if (change.type === "sync.merge") return data;
  if (change.type === "trash.restore")
    return restore(data, change.id, new Date());
  if (change.type === "trash.purge") {
    const found = data.tombstones.some((item) => item.id === change.id);
    if (!found) throw new Error("This item is no longer in the trash.");
    return {
      ...data,
      tombstones: data.tombstones.map((item) =>
        item.id === change.id || item.group === change.id
          ? { ...item, record: { id: item.id } }
          : item,
      ),
    };
  }
  if (change.type === "trash.empty")
    return {
      ...data,
      tombstones: data.tombstones.map((item) => ({
        ...item,
        record: { id: item.id },
      })),
    };
  if (
    change.type === "project.save" &&
    !data.projects.some((project) => project.id === change.value.id)
  ) {
    const number =
      change.value.number === AUTO_PROJECT_NUMBER
        ? Math.max(
            AUTO_PROJECT_NUMBER,
            ...data.projects.map((project) => project.number),
          ) + 1
        : change.value.number;
    return {
      ...data,
      projects: [...data.projects, { ...change.value, number }],
    };
  }
  if (change.type === "project.saveWithLinks") {
    if (!data.projects.some((project) => project.id === change.value.id))
      throw new Error("The project no longer exists.");
    if (change.links.some((link) => link.projectId !== change.value.id))
      throw new Error("Links must belong to the edited project.");
    return {
      ...data,
      projects: data.projects.map((project) =>
        project.id === change.value.id ? change.value : project,
      ),
      links: [
        ...data.links.filter((link) => link.projectId !== change.value.id),
        ...change.links,
      ],
    };
  }
  if (change.type === "todo.setDoNext") {
    const todo = data.todos.find((item) => item.id === change.id);
    if (!todo) throw new Error("The task no longer exists.");
    if (todo.completed && change.doNext)
      throw new Error("Reopen the task before marking it as Do next.");
    const value = { ...todo, updatedAt: new Date().toISOString() };
    if (change.doNext) value.doNext = true;
    else delete value.doNext;
    return {
      ...data,
      todos: data.todos.map((item) => (item.id === value.id ? value : item)),
    };
  }
  if (change.type === "project.delete") {
    return {
      ...data,
      projects: data.projects.filter((value) => value.id !== change.id),
      links: data.links.filter((value) => value.projectId !== change.id),
      todos: data.todos.filter((value) => value.projectId !== change.id),
      events: data.events.filter((value) => value.projectId !== change.id),
    };
  }
  if (change.type === "category.delete") {
    const now = new Date().toISOString();
    return {
      ...data,
      projectCategories: data.projectCategories.filter(
        (value) => value.id !== change.id,
      ),
      projects: data.projects.map((project) => {
        if (project.categoryId !== change.id) return project;
        const { categoryId: _category, ...rest } = project;
        return { ...rest, updatedAt: now };
      }),
    };
  }
  const collection = change.type.startsWith("category.")
    ? "projectCategories"
    : change.type.startsWith("project.")
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
              new Error("Lokaler Speicher konnte nicht geÃ¶ffnet werden."),
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
      transaction.oncomplete = () => resolve();
      transaction.onabort = () =>
        reject(
          failure ??
            transaction.error ??
            new Error("Ã„nderung wurde nicht gespeichert."),
        );
      transaction.onerror = () =>
        reject(failure ?? transaction.error ?? request.error);
    });
  }

  apply(change: DomainChange): Promise<void> {
    return this.write((data) => {
      const now = new Date();
      if (change.type === "sync.merge") {
        const merged = mergeData(data, change.remotes, now);
        const ids = new Set(merged.tombstones.map((item) => item.id));
        return {
          ...merged,
          tombstones: [
            ...merged.tombstones,
            ...(change.conflicts ?? []).filter((item) => !ids.has(item.id)),
          ],
        };
      }
      return stamp(data, applyChange(data, change), now);
    });
  }
  async exportData(): Promise<ExportEnvelope> {
    return {
      ...(await this.load()),
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
    };
  }
  async importData(data: ExportEnvelope): Promise<void> {
    const {
      schemaVersion: _version,
      exportedAt: _at,
      ...validated
    } = validateImport(data);
    return this.write((current) => stamp(current, validated, new Date()));
  }
}
