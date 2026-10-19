import { AUTO_PROJECT_NUMBER } from "../domain/types";
import {
  collectionByKind,
  dropExpired,
  isRestorable,
  kindOrder,
  sameContent,
} from "../domain/history";
import type {
  AppData,
  Base,
  Brainstorm,
  Project,
  RecordKind,
  Tombstone,
} from "../domain/types";

type Row = Base & Record<string, unknown>;

/** Higher version wins; ties fall back to the later edit, then to content order. */
function newer(a: Row, b: Row): Row {
  const rev = (a.rev ?? 0) - (b.rev ?? 0);
  if (rev) return rev > 0 ? a : b;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function mergeBrainstorm(a: Brainstorm, b: Brainstorm): Brainstorm {
  if (a.revision !== b.revision) return a.revision > b.revision ? a : b;
  if (a.text === b.text) return a.updatedAt >= b.updatedAt ? a : b;
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b;
  return a.text >= b.text ? a : b;
}

/** A purged tombstone (no record) outranks a restorable one of equal version. */
function newerTombstone(a: Tombstone, b: Tombstone): Tombstone {
  if (a.rev !== b.rev) return a.rev > b.rev ? a : b;
  if (isRestorable(a) !== isRestorable(b)) return isRestorable(a) ? b : a;
  return a.deletedAt >= b.deletedAt ? a : b;
}

/**
 * Deterministic three-way-free merge of complete states. The result depends
 * only on the set of inputs, so every device converges to the same data.
 * A record survives a deletion when it was edited after the deleted version.
 */
export function mergeData(
  local: AppData,
  remotes: AppData[],
  now: Date,
): AppData {
  const states = [local, ...remotes];
  const records = new Map<string, { kind: number; row: Row }>();
  const dead = new Map<string, Tombstone>();
  for (const state of states) {
    for (const [index, kind] of kindOrder.entries()) {
      for (const row of state[collectionByKind[kind]] as unknown as Row[]) {
        const known = records.get(row.id);
        records.set(row.id, {
          kind: index,
          row: known ? newer(known.row, row) : row,
        });
      }
    }
    for (const item of state.tombstones) {
      const known = dead.get(item.id);
      dead.set(item.id, known ? newerTombstone(known, item) : item);
    }
  }

  const tombstones = new Map<string, Tombstone>();
  const live = new Map<string, { kind: number; row: Row }>();
  for (const [id, entry] of records) {
    const stone = dead.get(id);
    if (stone && (entry.row.rev ?? 0) <= stone.rev) tombstones.set(id, stone);
    else live.set(id, entry);
  }
  for (const [id, stone] of dead)
    if (!records.has(id)) tombstones.set(id, stone);

  // A surviving dependant revives its deleted project: the edit wins.
  const projectOf = (row: Row) => row.projectId as string | undefined;
  for (const entry of [...live.values()]) {
    const id = projectOf(entry.row);
    if (!id || live.has(id)) continue;
    const stone = tombstones.get(id);
    if (stone && stone.kind === "project" && isRestorable(stone)) {
      live.set(id, {
        kind: kindOrder.indexOf("project"),
        row: {
          ...(stone.record as Row),
          rev: stone.rev + 1,
        },
      });
      tombstones.delete(id);
    }
  }

  const rows = (kind: number) =>
    [...live.values()]
      .filter((entry) => entry.kind === kind)
      .map((entry) => entry.row)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  const stone = (row: Row, kind: RecordKind, rev: number) =>
    tombstones.set(row.id, {
      kind,
      id: row.id,
      rev,
      deletedAt: now.toISOString(),
      record: row as unknown as Record<string, unknown>,
    });

  // Unique category names: the oldest keeps the name, others fold into it.
  const categoryIndex = kindOrder.indexOf("category");
  const remap = new Map<string, string>();
  const names = new Map<string, Row>();
  const categories: Row[] = [];
  for (const row of rows(categoryIndex).sort((a, b) =>
    a.createdAt === b.createdAt
      ? a.id < b.id
        ? -1
        : 1
      : a.createdAt < b.createdAt
        ? -1
        : 1,
  )) {
    const key = String(row.name).trim().toLocaleLowerCase("de");
    const first = names.get(key);
    if (first) {
      remap.set(row.id, first.id);
      stone(row, "category", row.rev ?? 0);
    } else {
      names.set(key, row);
      categories.push(row);
    }
  }
  const categoryIds = new Set(categories.map((c) => c.id));

  const projectIndex = kindOrder.indexOf("project");
  let projects = rows(projectIndex).map((row) => {
    const categoryId = row.categoryId as string | undefined;
    if (categoryId === undefined) return row;
    const target = remap.get(categoryId) ?? categoryId;
    if (categoryIds.has(target))
      return target === categoryId ? row : { ...row, categoryId: target };
    const { categoryId: _gone, ...rest } = row;
    return rest as Row;
  });

  // Unique project numbers: the oldest keeps its number, later ones move up.
  const taken = new Set<number>();
  const ordered = [...projects].sort((a, b) =>
    a.createdAt === b.createdAt
      ? a.id < b.id
        ? -1
        : 1
      : a.createdAt < b.createdAt
        ? -1
        : 1,
  );
  const numbers = new Map<string, number>();
  for (const project of ordered) {
    const number = (project as unknown as Project).number;
    if (!taken.has(number)) {
      taken.add(number);
      numbers.set(project.id, number);
    }
  }
  let next = Math.max(AUTO_PROJECT_NUMBER, ...taken);
  for (const project of ordered)
    if (!numbers.has(project.id)) numbers.set(project.id, ++next);
  projects = projects.map((project) =>
    numbers.get(project.id) === (project as unknown as Project).number
      ? project
      : { ...project, number: numbers.get(project.id)! },
  );

  const projectIds = new Set(projects.map((p) => p.id));
  const dependants = (kind: RecordKind) =>
    rows(kindOrder.indexOf(kind)).filter((row) => {
      if (projectIds.has(row.projectId as string)) return true;
      stone(row, kind, row.rev ?? 0);
      return false;
    });

  const result: AppData = {
    brainstorm: states
      .map((s) => s.brainstorm)
      .reduce((a, b) => mergeBrainstorm(a, b)),
    projectCategories: categories as never,
    projects: projects as never,
    links: dependants("link") as never,
    quickLinks: rows(kindOrder.indexOf("quicklink")) as never,
    todos: dependants("todo") as never,
    events: dependants("event") as never,
    tombstones: dropExpired([...tombstones.values()], now).sort((a, b) =>
      a.id < b.id ? -1 : 1,
    ),
  };
  return result;
}

/** Content equality that ignores order and the version counter. */
export function sameData(a: AppData, b: AppData): boolean {
  const norm = (d: AppData) => ({
    ...d,
    projectCategories: [...d.projectCategories].sort((x, y) =>
      x.id < y.id ? -1 : 1,
    ),
    projects: [...d.projects].sort((x, y) => (x.id < y.id ? -1 : 1)),
    links: [...d.links].sort((x, y) => (x.id < y.id ? -1 : 1)),
    quickLinks: [...d.quickLinks].sort((x, y) => (x.id < y.id ? -1 : 1)),
    todos: [...d.todos].sort((x, y) => (x.id < y.id ? -1 : 1)),
    events: [...d.events].sort((x, y) => (x.id < y.id ? -1 : 1)),
    tombstones: [...d.tombstones].sort((x, y) => (x.id < y.id ? -1 : 1)),
  });
  return sameContent(norm(a), norm(b), false);
}
