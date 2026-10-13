import {
  categories,
  projectStatuses,
  type AppData,
  type ExportEnvelope,
} from "../domain/types";

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};
function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(path, "Objekt erwartet.");
  return value as Record<string, unknown>;
}
function fields(
  value: Record<string, unknown>,
  allowed: string[],
  path: string,
) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`${path}.${key}`, "Unbekanntes Feld.");
}
function string(
  value: unknown,
  path: string,
  nonempty = false,
): asserts value is string {
  if (typeof value !== "string" || (nonempty && !value.trim()))
    fail(path, "Gültiger Text erwartet.");
}
function integer(
  value: unknown,
  path: string,
  min = 0,
): asserts value is number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min)
    fail(path, "Gültige ganze Zahl erwartet.");
}
function timestamp(value: unknown, path: string) {
  string(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(path, "UTC-Zeitstempel erwartet.");
  if (new Date(value).toISOString().slice(0, 19) !== value.slice(0, 19))
    fail(path, "Ungültiger Zeitstempel.");
}
function date(value: unknown, path: string) {
  string(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value
  )
    fail(path, "Gültiges Datum YYYY-MM-DD erwartet.");
}
const collections = [
  "projectCategories",
  "projects",
  "links",
  "todos",
  "events",
] as const;
type Collection = (typeof collections)[number];
export function validateImport(value: unknown): ExportEnvelope {
  const root = record(value, "Sicherung");
  const version = root.schemaVersion;
  if (![1, 2, 3, 4, 5].includes(version as number))
    fail("schemaVersion", "Nur Sicherungsformat 1 bis 5 werden unterstützt.");
  const modern = version === 5;
  fields(
    root,
    [
      "schemaVersion",
      "exportedAt",
      "projects",
      "links",
      "todos",
      "events",
      ...(version === 1 ? [] : ["projectCategories"]),
      ...(modern ? ["nextProjectNumber", "revision", "trash"] : []),
    ],
    "Sicherung",
  );
  timestamp(root.exportedAt, "exportedAt");
  const result = structuredClone(root);
  if (version === 1) result.projectCategories = [];
  const ids = new Set<string>();
  const numbers = new Set<number>();
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  const validateEntity = (
    item: unknown,
    collection: Collection,
    path: string,
  ) => {
    const entry = record(item, path);
    const extra =
      collection === "projectCategories"
        ? ["name"]
        : collection === "projects"
          ? [
              "name",
              "description",
              ...(version === 1 ? [] : ["status", "categoryId"]),
              ...(modern ? ["projectNumber"] : []),
            ]
          : collection === "links"
            ? ["projectId", "label", "target"]
            : collection === "todos"
              ? [
                  "projectId",
                  "title",
                  "completed",
                  "dueDate",
                  ...(Number(version) >= 4 ? ["doNext"] : []),
                  ...(modern ? ["eventId"] : []),
                ]
              : [
                  "projectId",
                  "category",
                  "title",
                  "date",
                  "time",
                  "note",
                  ...(Number(version) >= 3 ? ["noteFormat"] : []),
                ];
    fields(
      entry,
      [
        "id",
        "createdAt",
        "updatedAt",
        ...(modern ? ["revision"] : []),
        ...extra,
      ],
      path,
    );
    string(entry.id, `${path}.id`, true);
    if (ids.has(entry.id)) fail(`${path}.id`, "Doppelte ID.");
    ids.add(entry.id);
    timestamp(entry.createdAt, `${path}.createdAt`);
    timestamp(entry.updatedAt, `${path}.updatedAt`);
    if (
      Date.parse(entry.updatedAt as string) <
      Date.parse(entry.createdAt as string)
    )
      fail(`${path}.updatedAt`, "Liegt vor dem Erstellungszeitpunkt.");
    if (entry.revision !== undefined)
      integer(entry.revision, `${path}.revision`);
    if (collection === "projectCategories") {
      string(entry.name, `${path}.name`, true);
      const name = entry.name.trim().toLocaleLowerCase("de");
      if (categoryNames.has(name))
        fail(`${path}.name`, "Doppelter Kategoriename.");
      categoryNames.add(name);
      categoryIds.add(entry.id);
    } else if (collection === "projects") {
      string(entry.name, `${path}.name`, true);
      string(entry.description, `${path}.description`);
      if (version === 1) entry.status = "Aktiv";
      else if (
        !projectStatuses.includes(
          entry.status as (typeof projectStatuses)[number],
        )
      )
        fail(`${path}.status`, "Unbekannter Projektstatus.");
      if (entry.categoryId !== undefined)
        string(entry.categoryId, `${path}.categoryId`, true);
      if (modern) {
        integer(entry.projectNumber, `${path}.projectNumber`, 1);
        if (numbers.has(entry.projectNumber))
          fail(`${path}.projectNumber`, "Doppelte Projektnummer.");
        numbers.add(entry.projectNumber);
      }
    } else {
      string(entry.projectId, `${path}.projectId`, true);
      if (collection === "links") {
        string(entry.label, `${path}.label`, true);
        string(entry.target, `${path}.target`, true);
        if (
          /^[a-z][a-z\d+.-]*:/i.test(entry.target) &&
          !/^(https?:|mailto:|tel:|file:|[a-z]:[\\/])/i.test(entry.target)
        )
          fail(`${path}.target`, "Nicht unterstütztes Linkprotokoll.");
        if (/^https?:/i.test(entry.target)) {
          try {
            if (!new URL(entry.target).hostname) throw new Error();
          } catch {
            fail(`${path}.target`, "Ungültige URL.");
          }
        }
      } else {
        string(entry.title, `${path}.title`, true);
        if (collection === "todos") {
          if (
            typeof entry.completed !== "boolean" ||
            (entry.doNext !== undefined && typeof entry.doNext !== "boolean")
          )
            fail(path, "Wahrheitswert erwartet.");
          if (entry.dueDate !== undefined)
            date(entry.dueDate, `${path}.dueDate`);
          if (entry.eventId !== undefined)
            string(entry.eventId, `${path}.eventId`, true);
        } else {
          if (
            !categories.includes(entry.category as (typeof categories)[number])
          )
            fail(`${path}.category`, "Unbekannte Ereigniskategorie.");
          date(entry.date, `${path}.date`);
          if (
            entry.time !== undefined &&
            (typeof entry.time !== "string" ||
              !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.time))
          )
            fail(`${path}.time`, "Uhrzeit HH:mm erwartet.");
          if (entry.note !== undefined) string(entry.note, `${path}.note`);
          if (entry.noteFormat !== undefined && entry.noteFormat !== "markdown")
            fail(`${path}.noteFormat`, "Unbekanntes Notizformat.");
        }
      }
    }
  };
  for (const collection of collections) {
    if (!Array.isArray(result[collection])) fail(collection, "Liste erwartet.");
    (result[collection] as unknown[]).forEach((item, i) =>
      validateEntity(item, collection, `${collection}[${i}]`),
    );
  }
  if (!modern) {
    (result.projects as Record<string, unknown>[]).forEach(
      (p, i) => (p.projectNumber = i + 1),
    );
    result.nextProjectNumber = (result.projects as unknown[]).length + 1;
    result.revision = 0;
    result.trash = [];
  }
  integer(result.nextProjectNumber, "nextProjectNumber", 1);
  integer(result.revision, "revision");
  if (!Array.isArray(result.trash)) fail("trash", "Liste erwartet.");
  const data = result as unknown as ExportEnvelope;
  const projectIds = new Set(data.projects.map((p) => p.id));
  const eventProjects = new Map(data.events.map((e) => [e.id, e.projectId]));
  for (const p of data.projects)
    if (p.categoryId && !categoryIds.has(p.categoryId))
      fail("projects.categoryId", "Kategorie existiert nicht.");
  for (const item of [...data.links, ...data.todos, ...data.events])
    if (!projectIds.has(item.projectId))
      fail("projectId", "Projekt existiert nicht.");
  for (const task of data.todos)
    if (task.eventId && eventProjects.get(task.eventId) !== task.projectId)
      fail("todos.eventId", "Ereignis existiert nicht im selben Projekt.");
  for (const [index, item] of data.trash.entries()) {
    const path = `trash[${index}]`;
    const entry = record(item, path);
    fields(
      entry,
      [
        "id",
        "type",
        "name",
        "projectId",
        "projectName",
        "deletedAt",
        "data",
        "detachedTasks",
      ],
      path,
    );
    string(entry.id, `${path}.id`, true);
    if (ids.has(entry.id)) fail(`${path}.id`, "Doppelte ID.");
    ids.add(entry.id);
    string(entry.name, `${path}.name`, true);
    string(entry.projectId, `${path}.projectId`, true);
    string(entry.projectName, `${path}.projectName`, true);
    timestamp(entry.deletedAt, `${path}.deletedAt`);
    if (!["project", "todo", "event", "link"].includes(entry.type as string))
      fail(`${path}.type`, "Unbekannter Papierkorbtyp.");
    const payload = record(entry.data, `${path}.data`);
    fields(payload, ["projects", "links", "todos", "events"], `${path}.data`);
    for (const collection of [
      "projects",
      "links",
      "todos",
      "events",
    ] as const) {
      if (!Array.isArray(payload[collection])) fail(path, "Liste erwartet.");
      (payload[collection] as unknown[]).forEach((record, i) =>
        validateEntity(record, collection, `${path}.data.${collection}[${i}]`),
      );
    }
    const expected =
      item.type === "project"
        ? "projects"
        : item.type === "todo"
          ? "todos"
          : item.type === "event"
            ? "events"
            : "links";
    if (
      item.data[expected].length !== 1 ||
      (item.type !== "project" &&
        Object.entries(item.data).some(
          ([key, list]) => key !== expected && list.length !== 0,
        ))
    )
      fail(path, "Ungültiger Papierkorbinhalt.");
    if (item.type === "project" && item.data.projects[0].id !== item.projectId)
      fail(path, "Ungültiger Projektverweis.");
    for (const child of [
      ...item.data.todos,
      ...item.data.links,
      ...item.data.events,
    ])
      if (child.projectId !== item.projectId)
        fail(path, "Ungültiger Projektverweis.");
    if (item.detachedTasks !== undefined) {
      if (item.type !== "event" || !Array.isArray(item.detachedTasks))
        fail(path, "Ungültige Aufgabenverknüpfungen.");
      const detached = new Set<string>();
      for (const reference of item.detachedTasks) {
        const ref = record(reference, path);
        fields(ref, ["id", "revision"], path);
        string(ref.id, path, true);
        integer(ref.revision, path);
        if (detached.has(ref.id)) fail(path, "Doppelte Aufgabenverknüpfung.");
        detached.add(ref.id);
      }
    }
    for (const event of item.data.events)
      eventProjects.set(event.id, event.projectId);
  }
  for (const item of data.trash)
    for (const task of item.data.todos)
      if (task.eventId && eventProjects.get(task.eventId) !== task.projectId)
        fail(
          "trash.todos.eventId",
          "Ereignis existiert nicht im selben Projekt.",
        );
  if ([...numbers].some((n) => n >= data.nextProjectNumber))
    fail(
      "nextProjectNumber",
      "Zähler muss über allen vergebenen Projektnummern liegen.",
    );
  data.schemaVersion = 5;
  return data;
}

/** Local snapshots before V2 have no envelope or counter. Validation never mutates its input. */
export function validateData(value: unknown): AppData {
  const source = record(value, "Daten");
  const {
    schemaVersion: _version,
    exportedAt: _at,
    ...result
  } = validateImport({
    ...source,
    schemaVersion:
      source.nextProjectNumber !== undefined ||
      source.trash !== undefined ||
      source.revision !== undefined
        ? 5
        : source.projectCategories === undefined
          ? 1
          : 4,
    exportedAt: new Date().toISOString(),
  });
  return result;
}
