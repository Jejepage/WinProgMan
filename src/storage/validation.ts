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
  fields(
    root,
    [
      "schemaVersion",
      "exportedAt",
      "projects",
      "links",
      "todos",
      "events",
      ...(legacy ? [] : ["projectCategories"]),
    ],
    "Sicherung",
  );
  if (
    root.schemaVersion !== 1 &&
    root.schemaVersion !== 2 &&
    root.schemaVersion !== 3
  )
    fail(
      "schemaVersion",
      "Nur Sicherungsformat 1, 2 und 3 werden unterstützt.",
    );
  timestamp(root.exportedAt, "exportedAt");
  const ids = new Set<string>();
  const projects = new Set<string>();
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
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
                ...(legacy ? [] : ["status", "categoryId"]),
              ]
            : collection === "links"
              ? ["projectId", "label", "target"]
              : collection === "todos"
                ? ["projectId", "title", "completed", "dueDate"]
                : [
                    "projectId",
                    "category",
                    "title",
                    "date",
                    "time",
                    "note",
                    ...(root.schemaVersion === 3 ? ["noteFormat"] : []),
                  ];
      fields(entry, ["id", "createdAt", "updatedAt", ...extras], path);
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
  result.schemaVersion = 3;
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
    schemaVersion: source.projectCategories === undefined ? 1 : 3,
    exportedAt: new Date().toISOString(),
  });
  return result;
}
