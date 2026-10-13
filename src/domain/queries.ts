import type { Todo, ProjectEvent, AppData } from "./types";
export function localToday(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export const overdue = (todo: Todo, today = localToday()) =>
  !todo.completed && !!todo.dueDate && todo.dueDate < today;
export const upcoming = (event: ProjectEvent, today = localToday()) =>
  event.date >= today;
export const sortTodos = (todos: Todo[]) =>
  [...todos].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
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
