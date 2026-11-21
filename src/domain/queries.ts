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

/** Distinct owner names of all projects, alphabetically (case-insensitive). */
export function ownerNames(projects: Project[]): string[] {
  const names = new Map<string, string>();
  for (const project of projects) {
    const name = project.owner?.trim();
    if (name && !names.has(name.toLocaleLowerCase("de")))
      names.set(name.toLocaleLowerCase("de"), name);
  }
  return [...names.values()].sort((a, b) =>
    a.localeCompare(b, "de", { sensitivity: "base" }),
  );
}

/** Owner filter: "" shows all, "none" unassigned projects, otherwise a name. */
export const matchesOwner = (filter: string, project: Project) =>
  !filter ||
  (filter === "none"
    ? !project.owner
    : project.owner?.toLocaleLowerCase("de") ===
      filter.toLocaleLowerCase("de"));

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
/** Date as dd.mm.yy (German order). */
export const formatDate = (date: string) => {
  const [year = "", month = "", day = ""] = date.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
};
export const formatTimestampDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${pad2(date.getFullYear() % 100)}`;
};
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Whole days from `today` to `date` (both YYYY-MM-DD, local calendar days). */
export function dayDistance(date: string, today: string): number {
  const toUtc = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  return Math.round((toUtc(date) - toUtc(today)) / 86400000);
}
/**
 * Short date for lists: "Today", "Tomorrow", "Yesterday", a weekday with
 * date within the coming week ("Wed 25.11."), otherwise dd.mm.yy.
 */
export function relativeDate(date: string, today: string): string {
  const distance = dayDistance(date, today);
  if (distance === 0) return "Today";
  if (distance === 1) return "Tomorrow";
  if (distance === -1) return "Yesterday";
  if (distance > 1 && distance < 7) {
    const [y, m, d] = date.split("-").map(Number);
    const weekday = weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${weekday} ${pad2(d)}.${pad2(m)}.`;
  }
  return formatDate(date);
}
/** Due-date bucket for grouping open tasks. */
export type DueGroup = "overdue" | "today" | "week" | "later" | "none";
export function dueGroup(todo: Todo, today: string): DueGroup {
  if (!todo.dueDate) return "none";
  const distance = dayDistance(todo.dueDate, today);
  if (distance < 0) return todo.completed ? "later" : "overdue";
  if (distance === 0) return "today";
  return distance < 7 ? "week" : "later";
}
/**
 * List order for events: upcoming ones (from today) ascending so the next
 * entry comes first, then past ones with the most recent first.
 */
export function orderEventsForList(events: ProjectEvent[], today: string) {
  const sorted = sortEvents(events);
  return {
    upcoming: sorted.filter((event) => event.date >= today).reverse(),
    past: sorted.filter((event) => event.date < today),
  };
}
/** Time of day as 24-hour HH:mm. */
export const formatTimestampTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};
/** Reads a typed 24-hour time ("9:30", "0930", "14:05") as HH:mm; "" stays empty, invalid gives null. */
export function parseTime24(text: string): string | null {
  const value = text.trim();
  if (!value) return "";
  const match = /^(\d{1,2}):?(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${pad2(hours)}:${pad2(minutes)}`;
}
