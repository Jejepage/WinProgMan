import type { AppData, Base, RecordKind, Tombstone } from "./types";

/** Deletions are kept this long so they can be restored and reach other devices. */
export const TOMBSTONE_RETENTION_DAYS = 60;
const DAY = 24 * 60 * 60 * 1000;

type Collection =
  "projectCategories" | "projects" | "links" | "todos" | "events";
export const collectionByKind: Record<RecordKind, Collection> = {
  category: "projectCategories",
  project: "projects",
  link: "links",
  todo: "todos",
  event: "events",
};
export const kindOrder: RecordKind[] = [
  "category",
  "project",
  "link",
  "todo",
  "event",
];

/** Structural comparison that ignores the sync version counter. */
export function sameContent(a: unknown, b: unknown, ignoreRev = true): boolean {
  const strip = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(strip)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .filter(
                ([key, v]) => (!ignoreRev || key !== "rev") && v !== undefined,
              )
              .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
              .map(([key, v]) => [key, strip(v)]),
          )
        : value;
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b));
}

/** A purged tombstone no longer holds the record, only the fact of deletion. */
export const isRestorable = (tombstone: Tombstone) =>
  Object.keys(tombstone.record).length > 1;

export function dropExpired(tombstones: Tombstone[], now: Date): Tombstone[] {
  const limit = now.getTime() - TOMBSTONE_RETENTION_DAYS * DAY;
  return tombstones.filter((item) => Date.parse(item.deletedAt) >= limit);
}

/**
 * Turns the difference between two states into sync metadata: changed records
 * get a higher version, removed ones leave a tombstone. Restored records
 * continue above their tombstone so that they win over the deletion.
 */
export function stamp(before: AppData, after: AppData, now: Date): AppData {
  const stamp = now.toISOString();
  const tombstones = new Map(after.tombstones.map((item) => [item.id, item]));
  const previous = new Map(before.tombstones.map((item) => [item.id, item]));
  const removedProjects = new Set(
    before.projects
      .filter((p) => !after.projects.some((q) => q.id === p.id))
      .map((p) => p.id),
  );
  const result: AppData = { ...after };
  for (const kind of kindOrder) {
    const name = collectionByKind[kind];
    const old = new Map<string, Base>(
      (before[name] as Base[]).map((item) => [item.id, item]),
    );
    const next = new Map<string, Base>();
    for (const item of after[name] as Base[]) {
      const existing = old.get(item.id);
      if (existing && sameContent(existing, item)) {
        next.set(item.id, existing);
        continue;
      }
      const dead = previous.get(item.id);
      const rev = existing
        ? (existing.rev ?? 0) + 1
        : dead
          ? dead.rev + 1
          : (item.rev ?? 1);
      next.set(item.id, { ...item, rev });
      tombstones.delete(item.id);
    }
    for (const [id, item] of old) {
      if (next.has(id)) continue;
      const known = tombstones.get(id);
      if (known && known.rev >= (item.rev ?? 0)) continue;
      const projectId = (item as Base & { projectId?: string }).projectId;
      tombstones.set(id, {
        kind,
        id,
        rev: item.rev ?? 0,
        deletedAt: stamp,
        ...(projectId && removedProjects.has(projectId)
          ? { group: projectId }
          : {}),
        record: item as unknown as Record<string, unknown>,
      });
    }
    (result as unknown as Record<string, unknown>)[name] = [...next.values()];
  }
  result.tombstones = dropExpired([...tombstones.values()], now);
  return result;
}

/** Moves a deleted record (and, for a project, its dependants) back. */
export function restore(data: AppData, id: string, now: Date): AppData {
  const dead = data.tombstones.find((item) => item.id === id);
  if (!dead) throw new Error("This item is no longer in the trash.");
  if (!isRestorable(dead))
    throw new Error("This item was permanently deleted.");
  if (dead.conflict) return restoreConflict(data, dead, now);
  if (dead.kind === "brainstorm") throw new Error("Unknown trash entry.");
  const group =
    dead.kind === "project"
      ? data.tombstones.filter(
          (item) => item.group === id && isRestorable(item),
        )
      : [];
  if (
    (dead.kind === "link" || dead.kind === "todo" || dead.kind === "event") &&
    !data.projects.some((p) => p.id === dead.record.projectId)
  )
    throw new Error("Restore the project first.");
  if (
    dead.kind === "category" &&
    data.projectCategories.some(
      (c) =>
        c.name.trim().toLocaleLowerCase("de") ===
        String(dead.record.name).trim().toLocaleLowerCase("de"),
    )
  )
    throw new Error("A category with this name already exists.");
  const taken = new Set(data.projects.map((p) => p.number));
  const back = [dead, ...group];
  const result: AppData = {
    ...data,
    tombstones: data.tombstones.filter(
      (item) => !back.some((b) => b.id === item.id),
    ),
  };
  for (const item of back) {
    const name = collectionByKind[item.kind as RecordKind];
    const record: Record<string, unknown> = {
      ...item.record,
      updatedAt: now.toISOString(),
    };
    if (item.kind === "project" && taken.has(Number(record.number))) {
      record.number = Math.max(0, ...taken) + 1;
    }
    if (
      item.kind === "project" &&
      record.categoryId !== undefined &&
      !result.projectCategories.some((c) => c.id === record.categoryId)
    )
      delete record.categoryId;
    if (item.kind === "project") taken.add(Number(record.number));
    (result as unknown as Record<string, unknown[]>)[name] = [
      ...(result[name] as unknown[]),
      record,
    ];
  }
  return result;
}

/** Label of the field that names a record, used for copies and the trash list. */
const nameField = ["title", "name", "label"] as const;

/**
 * Brings a replaced local version back as a copy next to the version that won:
 * records get a new id, the brainstorm text is appended to the current one.
 */
function restoreConflict(data: AppData, dead: Tombstone, now: Date): AppData {
  const tombstones = data.tombstones.filter((item) => item.id !== dead.id);
  const stamp = now.toISOString();
  if (dead.kind === "brainstorm") {
    const lost = String(dead.record.text ?? "");
    const text = data.brainstorm.text.trim()
      ? `${data.brainstorm.text.replace(/\s+$/, "")}\n\n---\n\n${lost}`
      : lost;
    return {
      ...data,
      tombstones,
      brainstorm: {
        text,
        revision: data.brainstorm.revision + 1,
        updatedAt: stamp,
      },
    };
  }
  const projectId = dead.record.projectId;
  if (dead.kind !== "project" && dead.kind !== "category") {
    if (!data.projects.some((p) => p.id === projectId))
      throw new Error("The project of this item no longer exists.");
  }
  const record: Record<string, unknown> = {
    ...dead.record,
    id: crypto.randomUUID(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  delete record.rev;
  const field = nameField.find((key) => typeof record[key] === "string");
  if (field) record[field] = `${record[field]} (other version)`;
  if (dead.kind === "project")
    record.number = Math.max(0, ...data.projects.map((p) => p.number)) + 1;
  const name = collectionByKind[dead.kind];
  return {
    ...data,
    tombstones,
    [name]: [...(data[name] as unknown[]), record],
  };
}
