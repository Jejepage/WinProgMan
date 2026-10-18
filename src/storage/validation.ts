import {
  categories,
  emptyBrainstorm,
  projectStatuses,
  tombstoneKinds,
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
function timestamp(value: unknown, path: string) {
  string(value, path);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    fail(path, "UTC-Zeitstempel erwartet.");
  const normalized = new Date(value).toISOString();
  if (normalized.slice(0, 19) !== value.slice(0, 19))
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
export function validateImport(value: unknown): ExportEnvelope {
  const root = record(value, "Sicherung");
  const legacy = root.schemaVersion === 1;
  const current = root.schemaVersion === 5 || root.schemaVersion === 6;
  const synced = root.schemaVersion === 6;
  if (
    root.schemaVersion !== 1 &&
    root.schemaVersion !== 2 &&
    root.schemaVersion !== 3 &&
    root.schemaVersion !== 4 &&
    root.schemaVersion !== 5 &&
    root.schemaVersion !== 6
  )
    fail(
      "schemaVersion",
      "Nur Sicherungsformat 1, 2, 3, 4, 5 und 6 werden unterstützt.",
    );
  fields(
    root,
    [
      "schemaVersion",
      "exportedAt",
      "projects",
      "links",
      "todos",
      "events",
      ...(current ? ["brainstorm"] : []),
      ...(synced ? ["tombstones"] : []),
      ...(legacy ? [] : ["projectCategories"]),
    ],
    "Sicherung",
  );
  timestamp(root.exportedAt, "exportedAt");
  if (current) {
    const brainstorm = record(root.brainstorm, "brainstorm");
    fields(brainstorm, ["text", "revision", "updatedAt"], "brainstorm");
    string(brainstorm.text, "brainstorm.text");
    if (
      !Number.isSafeInteger(brainstorm.revision) ||
      Number(brainstorm.revision) < 0
    )
      fail("brainstorm.revision", "Nichtnegative ganze Revision erwartet.");
    timestamp(brainstorm.updatedAt, "brainstorm.updatedAt");
  }
  const ids = new Set<string>();
  const projects = new Set<string>();
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  const projectNumbers = new Set<number>();
  for (const collection of [
    ...(legacy ? [] : ["projectCategories" as const]),
    "projects",
    "links",
    "todos",
    "events",
  ] as const) {
    const list = root[collection];
    if (!Array.isArray(list)) return fail(collection, "Liste erwartet.");
    list.forEach((item: unknown, index: number) => {
      const path = `${collection}[${index}]`;
      const entry = record(item, path);
      const extras =
        collection === "projectCategories"
          ? ["name"]
          : collection === "projects"
            ? [
                "name",
                "description",
                ...(current ? ["number"] : []),
                ...(legacy ? [] : ["status", "categoryId"]),
              ]
            : collection === "links"
              ? ["projectId", "label", "target"]
              : collection === "todos"
                ? [
                    "projectId",
                    "title",
                    "completed",
                    "dueDate",
                    ...(Number(root.schemaVersion) >= 4 ? ["doNext"] : []),
                  ]
                : [
                    "projectId",
                    "category",
                    "title",
                    "date",
                    "time",
                    "note",
                    ...(Number(root.schemaVersion) >= 3 ? ["noteFormat"] : []),
                  ];
      fields(
        entry,
        ["id", "createdAt", "updatedAt", ...(synced ? ["rev"] : []), ...extras],
        path,
      );
      if (
        entry.rev !== undefined &&
        (!Number.isSafeInteger(entry.rev) || Number(entry.rev) < 1)
      )
        fail(`${path}.rev`, "Positive ganze Version erwartet.");
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
      if (collection === "projectCategories") {
        string(entry.name, `${path}.name`, true);
        const name = entry.name.trim().toLocaleLowerCase("de");
        if (categoryNames.has(name))
          fail(`${path}.name`, "Doppelter Kategoriename.");
        categoryNames.add(name);
        categoryIds.add(entry.id);
      } else if (collection === "projects") {
        if (current) {
          if (!Number.isSafeInteger(entry.number) || Number(entry.number) < 1)
            fail(`${path}.number`, "Positive ganze Projektnummer erwartet.");
          const number = entry.number as number;
          if (projectNumbers.has(number))
            fail(`${path}.number`, "Diese Projektnummer ist bereits vergeben.");
          projectNumbers.add(number);
        }
        if (!legacy) {
          if (
            !projectStatuses.includes(
              entry.status as (typeof projectStatuses)[number],
            )
          )
            fail(`${path}.status`, "Unbekannter Projektstatus.");
          if (entry.categoryId !== undefined) {
            string(entry.categoryId, `${path}.categoryId`, true);
            if (!categoryIds.has(entry.categoryId))
              fail(`${path}.categoryId`, "Kategorie existiert nicht.");
          }
        }
        projects.add(entry.id);
        string(entry.name, `${path}.name`, true);
        string(entry.description, `${path}.description`);
      } else {
        string(entry.projectId, `${path}.projectId`, true);
        if (!projects.has(entry.projectId))
          fail(`${path}.projectId`, "Projekt existiert nicht.");
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
              const url = new URL(entry.target);
              if (!url.hostname) fail(`${path}.target`, "Ungültige URL.");
            } catch {
              fail(`${path}.target`, "Ungültige URL.");
            }
          }
        } else {
          string(entry.title, `${path}.title`, true);
          if (collection === "todos") {
            if (typeof entry.completed !== "boolean")
              fail(`${path}.completed`, "Wahrheitswert erwartet.");
            if (entry.doNext !== undefined && typeof entry.doNext !== "boolean")
              fail(`${path}.doNext`, "Wahrheitswert erwartet.");
            if (entry.dueDate !== undefined)
              date(entry.dueDate, `${path}.dueDate`);
          } else {
            if (
              !categories.includes(
                entry.category as (typeof categories)[number],
              )
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
            if (
              entry.noteFormat !== undefined &&
              entry.noteFormat !== "markdown"
            )
              fail(`${path}.noteFormat`, "Unbekanntes Notizformat.");
          }
        }
      }
    });
  }
  const result = structuredClone(root);
  result.schemaVersion = 6;
  if (synced) {
    const list = root.tombstones;
    if (!Array.isArray(list)) fail("tombstones", "Liste erwartet.");
    const seen = new Set<string>();
    (list as unknown[]).forEach((item, index) => {
      const path = `tombstones[${index}]`;
      const entry = record(item, path);
      fields(
        entry,
        ["kind", "id", "rev", "deletedAt", "group", "record"],
        path,
      );
      if (!tombstoneKinds.includes(entry.kind as never))
        fail(`${path}.kind`, "Unbekannte Art.");
      string(entry.id, `${path}.id`, true);
      if (seen.has(entry.id) || ids.has(entry.id))
        fail(`${path}.id`, "Doppelte ID.");
      seen.add(entry.id);
      if (!Number.isSafeInteger(entry.rev) || Number(entry.rev) < 0)
        fail(`${path}.rev`, "Nichtnegative ganze Version erwartet.");
      timestamp(entry.deletedAt, `${path}.deletedAt`);
      if (entry.group !== undefined) string(entry.group, `${path}.group`, true);
      const stored = record(entry.record, `${path}.record`);
      if (stored.id !== entry.id)
        fail(`${path}.record.id`, "Stimmt nicht mit der ID überein.");
    });
  } else {
    result.tombstones = [];
  }
  if (!current) {
    result.brainstorm = emptyBrainstorm();
    result.projects = (result.projects as Record<string, unknown>[]).map(
      (project, index) => ({ ...project, number: index + 1 }),
    );
  }
  if (legacy) {
    result.projectCategories = [];
    result.projects = (result.projects as Record<string, unknown>[]).map(
      (project) => ({ ...project, status: "Aktiv" }),
    );
  }
  return result as unknown as ExportEnvelope;
}

export function validateData(data: unknown): AppData {
  const source = record(data, "Daten");
  const {
    schemaVersion: _version,
    exportedAt: _at,
    ...result
  } = validateImport({
    ...source,
    schemaVersion:
      source.brainstorm !== undefined ||
      (Array.isArray(source.projects) &&
        source.projects.some(
          (project: unknown) =>
            !!project && typeof project === "object" && "number" in project,
        ))
        ? source.tombstones !== undefined
          ? 6
          : 5
        : source.projectCategories === undefined
          ? 1
          : 4,
    exportedAt: new Date().toISOString(),
  });
  return result;
}
