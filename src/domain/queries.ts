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

const byNumber = (projects: Project[]) =>
  [...projects].sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));
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
      projects: byNumber(
        projects.filter((project) => project.categoryId === topic.id),
      ),
    }));
  groups.push({
    id: "",
    name: "No topic",
    projects: byNumber(projects.filter((project) => !project.categoryId)),
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
      b.date.localeCompare(a.date) ||
      (b.time || "").localeCompare(a.time || "") ||
      b.id.localeCompare(a.id),
  );
export const activeProjects = (data: AppData, today = localToday()) =>
  data.projects.filter(
    (p) =>
      data.todos.some((t) => t.projectId === p.id && !t.completed) ||
      data.events.some((e) => e.projectId === p.id && upcoming(e, today)),
  );
const pad2 = (value: number) => String(value).padStart(2, "0");
/** Date as dd/mm/yy. */
export const formatDate = (date: string) => {
  const [year = "", month = "", day = ""] = date.split("-");
  return `${day}/${month}/${year.slice(-2)}`;
};
export const formatTimestampDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${pad2(date.getFullYear() % 100)}`;
};
/** Time of day as 24-hour HH:mm. */
export const formatTimestampTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
