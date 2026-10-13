import {
  type AppData,
  type Base,
  type DomainChange,
  type Project,
  type Todo,
  type TrashEntry,
} from "../domain/types";
import { ConflictError } from "./ProjectStore";

const contentCollections = ["projects", "links", "todos", "events"] as const;
const collectionFor = (type: string) =>
  type.startsWith("category.")
    ? "projectCategories"
    : type.startsWith("project.")
      ? "projects"
      : type.startsWith("link.")
        ? "links"
        : type.startsWith("todo.")
          ? "todos"
          : "events";
const advance = <T extends Base>(value: T, revision: number): T => ({
  ...value,
  revision,
  updatedAt: new Date(
    Math.max(Date.now(), Date.parse(value.updatedAt)),
  ).toISOString(),
});
function clearPurgedEventReferences(data: AppData) {
  const available = new Set(
    [...data.events, ...data.trash.flatMap((t) => t.data.events)].map(
      (e) => e.id,
    ),
  );
  for (const entry of data.trash)
    entry.data.todos = entry.data.todos.map((task) => {
      if (!task.eventId || available.has(task.eventId)) return task;
      const { eventId: _event, ...rest } = task;
      return rest;
    });
}

/** Pure mutation plan; validation and commit run inside the same IndexedDB transaction. */
export function applyChange(source: AppData, change: DomainChange): AppData {
  const data = structuredClone(source);
  const revision = data.revision + 1;
  if (!Number.isSafeInteger(revision))
    throw new Error("Revision limit reached.");
  data.revision = revision;
  if (change.type.startsWith("trash.")) {
    if (change.type === "trash.empty") {
      if (
        change.expectedRevision !== undefined &&
        change.expectedRevision !== source.revision
      )
        throw new ConflictError(source);
      data.trash = [];
    } else if ("id" in change) {
      const entry = data.trash.find((item) => item.id === change.id);
      if (!entry) throw new ConflictError(source);
      if (change.type === "trash.restore") {
        if (
          entry.type !== "project" &&
          !data.projects.some((p) => p.id === entry.projectId)
        )
          throw new Error(
            "Restore the project first. The original project is missing.",
          );
        const liveIds = new Set(
          [
            ...data.projectCategories,
            ...data.projects,
            ...data.todos,
            ...data.events,
            ...data.links,
          ].map((item) => item.id),
        );
        for (const key of contentCollections)
          for (const item of entry.data[key])
            if (liveIds.has(item.id))
              throw new Error("Restore would overwrite an existing item.");
        for (const project of entry.data.projects)
          if (
            data.projects.some((p) => p.projectNumber === project.projectNumber)
          )
            throw new Error("Project number is already in use.");
        const restoredProjects = entry.data.projects.map((project) => {
          const result = advance(project, revision);
          if (
            result.categoryId &&
            !data.projectCategories.some((c) => c.id === result.categoryId)
          )
            delete result.categoryId;
          return result;
        });
        const events = [...data.events, ...entry.data.events];
        const restoredTodos = entry.data.todos.map((task) => {
          const result = advance(task, revision);
          // Restore the relation later only if this task has not been edited in between.
          for (const deletedEvent of data.trash.filter(
            (item) => item.type === "event",
          )) {
            const event = deletedEvent.data.events[0];
            const ref = deletedEvent.detachedTasks?.find(
              (item) => item.id === task.id,
            );
            if (
              event.projectId === task.projectId &&
              (task.eventId === event.id ||
                (ref && ref.revision === (task.revision ?? 0) && !task.eventId))
            ) {
              deletedEvent.detachedTasks ??= [];
              if (ref) ref.revision = revision;
              else deletedEvent.detachedTasks.push({ id: task.id, revision });
            }
          }
          if (
            result.eventId &&
            !events.some(
              (e) =>
                e.id === result.eventId && e.projectId === result.projectId,
            )
          )
            delete result.eventId;
          return result;
        });
        data.projects.push(...restoredProjects);
        data.todos.push(...restoredTodos);
        data.events.push(
          ...entry.data.events.map((item) => advance(item, revision)),
        );
        data.links.push(
          ...entry.data.links.map((item) => advance(item, revision)),
        );
        if (entry.type === "event") {
          const event = entry.data.events[0];
          for (const deleted of data.trash) {
            deleted.data.todos = deleted.data.todos.map((task) => {
              const ref = entry.detachedTasks?.find(
                (item) => item.id === task.id,
              );
              return ref &&
                ref.revision === (task.revision ?? 0) &&
                !task.eventId &&
                task.projectId === event.projectId
                ? { ...task, eventId: event.id }
                : task;
            });
          }
          data.todos = data.todos.map((task) => {
            const previous = entry.detachedTasks?.find(
              (ref) => ref.id === task.id,
            );
            return previous &&
              previous.revision === (task.revision ?? 0) &&
              !task.eventId &&
              task.projectId === event.projectId
              ? advance({ ...task, eventId: event.id }, revision)
              : task;
          });
        }
      }
      data.trash = data.trash.filter((item) => item.id !== change.id);
    }
    clearPurgedEventReferences(data);
    return data;
  }
  const collection = collectionFor(change.type);
  const id =
    "value" in change ? change.value.id : "id" in change ? change.id : "";
  const previous = data[collection].find((item) => item.id === id);
  const expected =
    change.expectedRevision ??
    ("value" in change ? change.value.revision : undefined) ??
    0;
  if (change.overwrite && !previous) throw new ConflictError(source);
  if (
    !change.overwrite &&
    ((previous && (previous.revision ?? 0) !== expected) ||
      (!previous && expected !== 0))
  )
    throw new ConflictError(source);
  if ("value" in change) {
    // A deleted identity must be restored deliberately, never recreated by a stale editor.
    if (
      !previous &&
      data.trash.some((entry) =>
        contentCollections.some((key) =>
          entry.data[key].some((item) => item.id === id),
        ),
      )
    )
      throw new ConflictError(source);
    let value = advance(change.value, revision);
    if (change.type === "project.save") {
      value = {
        ...value,
        projectNumber: previous
          ? (previous as Project).projectNumber
          : data.nextProjectNumber++,
      } as Project;
    }
    const list = data[collection] as Base[];
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) list.push(value);
    else list[index] = value;
    return data;
  }
  if (!previous) throw new ConflictError(source);
  if (change.type === "category.delete") {
    data.projectCategories = data.projectCategories.filter(
      (item) => item.id !== id,
    );
    data.projects = data.projects.map((project) => {
      if (project.categoryId !== id) return project;
      const { categoryId: _category, ...rest } = project;
      return advance(rest, revision);
    });
    // Historical snapshots may keep deleted category IDs; restore drops those safely.
    return data;
  }
  const type = change.type.split(".")[0] as TrashEntry["type"];
  const projectId = type === "project" ? id : (previous as Todo).projectId;
  const project = data.projects.find((p) => p.id === projectId)!;
  const entry: TrashEntry = {
    id: crypto.randomUUID(),
    type,
    name:
      "name" in previous
        ? String(previous.name)
        : "title" in previous
          ? String(previous.title)
          : String((previous as { label: string }).label),
    projectId,
    projectName: project.name,
    deletedAt: new Date().toISOString(),
    data: { projects: [], todos: [], events: [], links: [] },
  };
  if (type === "project") {
    entry.data.projects = data.projects.filter((p) => p.id === id);
    entry.data.todos = data.todos.filter((item) => item.projectId === id);
    entry.data.events = data.events.filter((item) => item.projectId === id);
    entry.data.links = data.links.filter((item) => item.projectId === id);
    data.projects = data.projects.filter((p) => p.id !== id);
    data.todos = data.todos.filter((item) => item.projectId !== id);
    data.events = data.events.filter((item) => item.projectId !== id);
    data.links = data.links.filter((item) => item.projectId !== id);
  } else if (type === "todo") {
    entry.data.todos = data.todos.filter((item) => item.id === id);
    data.todos = data.todos.filter((item) => item.id !== id);
  } else if (type === "link") {
    entry.data.links = data.links.filter((item) => item.id === id);
    data.links = data.links.filter((item) => item.id !== id);
  } else {
    entry.data.events = data.events.filter((item) => item.id === id);
    data.events = data.events.filter((item) => item.id !== id);
    entry.detachedTasks = [];
    data.todos = data.todos.map((task) => {
      if (task.eventId !== id) return task;
      const { eventId: _event, ...rest } = task;
      entry.detachedTasks!.push({ id: task.id, revision });
      return advance(rest, revision);
    });
  }
  data.trash.push(entry);
  return data;
}
