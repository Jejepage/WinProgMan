import type {
  Todo,
  ProjectEvent,
  AppData,
  Project,
  ProjectCategory,
} from "./types";
export const matchesSearch = (query: string, ...values: string[]) => {
  const needle = query.trim().toLocaleLowerCase("en");
  return (
    !needle ||
    values.some((value) => value.toLocaleLowerCase("en").includes(needle))
  );
};
export function localToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const overdue = (todo: Todo, today = localToday()) =>
  !todo.completed && !!todo.dueDate && todo.dueDate < today;
export const upcoming = (event: ProjectEvent, today = localToday()) =>
  event.category !== "Notiz" && event.date >= today;

/** Filter first, then group. Categories are identities, even when named No topic. */
export function groupProjects(projects: Project[], topics: ProjectCategory[]) {
  const groups = [...topics]
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
        a.id.localeCompare(b.id),
    )
    .map((topic) => ({
      id: topic.id,
      name: topic.name,
      projects: projects.filter((project) => project.categoryId === topic.id),
    }));
  groups.push({
    id: "",
    name: "No topic",
    projects: projects.filter((project) => !project.categoryId),
  });
  return groups.filter((group) => group.projects.length);
}
export const sortTodos = (todos: Todo[]) =>
  [...todos].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      Number(!a.doNext) - Number(!b.doNext) ||
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
export const sortEvents = (events: ProjectEvent[]) =>
  [...events].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.time || "").localeCompare(b.time || "") ||
      a.id.localeCompare(b.id),
  );
export const activeProjects = (data: AppData, today = localToday()) =>
  data.projects.filter(
    (p) =>
      data.todos.some((t) => t.projectId === p.id && !t.completed) ||
      data.events.some((e) => e.projectId === p.id && upcoming(e, today)),
  );
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
export const formatTimestampDate = (timestamp: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
