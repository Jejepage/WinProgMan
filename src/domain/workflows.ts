import type { AppData, Project, ProjectEvent, Todo } from "./types";
import { localToday } from "./queries";

export type RecordType = "project" | "todo" | "event" | "link";
export type OpenRecord = (
  type: RecordType,
  id: string,
  projectId: string,
) => void;

export const projectReference = (project: Project): string =>
  `PRJ-${String(project.projectNumber ?? 0).padStart(3, "0")} · ${project.name}`;

/** Calendar arithmetic uses local noon, never a fixed 24-hour duration. */
export function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return localToday(value);
}

export function parseCaptureDate(input: string, today: string): string | null {
  const value = input.trim().toLocaleLowerCase("en");
  if (value === "today") return today;
  if (value === "tomorrow") return addCalendarDays(today, 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && localToday(parsed) === value
    ? value
    : null;
}

/** Search readable Markdown while retaining link destinations as searchable text. */
export function searchableText(value: string): string {
  return value
    .replace(/!?(?:\[([^\]]*)\])\(([^)]+)\)/g, "$1 $2")
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, "$1")
    .replace(/(^|\n)\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const searchTerms = (query: string): string[] => [
  ...new Set(
    searchableText(query).toLocaleLowerCase("en").split(/\s+/).filter(Boolean),
  ),
];

export interface SearchResult {
  type: RecordType;
  group: "Projects" | "Tasks" | "Events" | "Notes" | "Links";
  id: string;
  project: Project;
  title: string;
  snippet: string;
}

export function searchAll(data: AppData, query: string): SearchResult[] {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const results: SearchResult[] = [];
  const projects = new Map(
    data.projects.map((project) => [project.id, project]),
  );
  function include(
    type: RecordType,
    group: SearchResult["group"],
    id: string,
    projectId: string,
    title: string,
    body: string,
  ) {
    const project = projects.get(projectId);
    if (!project) return;
    const text = searchableText(body);
    const haystack =
      `${projectReference(project)} ${searchableText(title)} ${text}`.toLocaleLowerCase(
        "en",
      );
    if (!terms.every((term) => haystack.includes(term))) return;
    const positions = terms
      .map((term) => text.toLocaleLowerCase("en").indexOf(term))
      .filter((position) => position >= 0);
    const start = Math.max(
      0,
      (positions.length ? Math.min(...positions) : 0) - 65,
    );
    const end = Math.min(text.length, start + 190);
    results.push({
      type,
      group,
      id,
      project,
      title,
      snippet: `${start ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`,
    });
  }
  data.projects.forEach((p) =>
    include("project", "Projects", p.id, p.id, p.name, p.description),
  );
  data.todos.forEach((t) =>
    include("todo", "Tasks", t.id, t.projectId, t.title, t.title),
  );
  data.events.forEach((e) =>
    include(
      "event",
      e.category === "Notiz" ? "Notes" : "Events",
      e.id,
      e.projectId,
      e.title,
      e.note || e.title,
    ),
  );
  data.links.forEach((l) =>
    include("link", "Links", l.id, l.projectId, l.label || l.target, l.target),
  );
  return results;
}

export function highlightParts(
  value: string,
  query: string,
): { text: string; match: boolean }[] {
  const terms = searchTerms(query).sort((a, b) => b.length - a.length);
  if (!terms.length) return [{ text: value, match: false }];
  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return value
    .split(pattern)
    .filter(Boolean)
    .map((text) => ({
      text,
      match: terms.includes(text.toLocaleLowerCase("en")),
    }));
}

export type WeekFilter = "today" | "week" | "later" | "overdue";
export interface AgendaItem {
  type: "todo" | "event";
  id: string;
  project: Project;
  title: string;
  date: string;
  time?: string;
  todo?: Todo;
  event?: ProjectEvent;
}

export function agendaItems(
  data: AppData,
  today: string,
  filter: WeekFilter = "week",
): AgendaItem[] {
  const lastDay = addCalendarDays(today, 6);
  const projects = new Map(
    data.projects.map((project) => [project.id, project]),
  );
  const items: AgendaItem[] = [];
  for (const todo of data.todos) {
    const project = projects.get(todo.projectId);
    if (project && todo.dueDate && !todo.completed)
      items.push({
        type: "todo",
        id: todo.id,
        project,
        title: todo.title,
        date: todo.dueDate,
        todo,
      });
  }
  for (const event of data.events) {
    const project = projects.get(event.projectId);
    if (project)
      items.push({
        type: "event",
        id: event.id,
        project,
        title: event.title,
        date: event.date,
        ...(event.time ? { time: event.time } : {}),
        event,
      });
  }
  return items
    .filter((item) => {
      if (filter === "overdue")
        return item.type === "todo" && item.date < today;
      if (filter === "today") return item.date === today;
      if (filter === "later") return item.date > lastDay;
      return item.date >= today && item.date <= lastDay;
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.time || "").localeCompare(b.time || "") ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
}
