import type { AppData } from "./types";

export type SearchKind = "project" | "task" | "event" | "note" | "brainstorm";
export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  /** Project name or short context. */
  context: string;
  snippet: string;
  score: number;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("de");
const plain = (markdown: string) =>
  markdown
    .replace(/[#*_`>[\]()|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function snippet(text: string, tokens: string[]): string {
  const source = plain(text);
  const folded = fold(source);
  const at = Math.min(
    ...tokens.map((token) => {
      const index = folded.indexOf(token);
      return index < 0 ? Infinity : index;
    }),
  );
  if (!Number.isFinite(at)) return source.slice(0, 80);
  const start = Math.max(0, at - 30);
  return (
    (start > 0 ? "…" : "") +
    source.slice(start, start + 100) +
    (start + 100 < source.length ? "…" : "")
  );
}

/**
 * Case- and accent-insensitive search; every word must occur somewhere in the
 * item. Title hits rank above hits in descriptions, notes and Brainstorm.
 */
export function searchAll(
  data: AppData,
  query: string,
  limit = 30,
): SearchResult[] {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const names = new Map(data.projects.map((p) => [p.id, p.name]));
  const results: SearchResult[] = [];
  const consider = (
    kind: SearchKind,
    id: string,
    title: string,
    context: string,
    body: string,
    extra = "",
  ) => {
    const head = fold(`${title} ${extra}`);
    const all = fold(`${title} ${extra} ${context} ${body}`);
    if (!tokens.every((token) => all.includes(token))) return;
    const inTitle = tokens.filter((token) => head.includes(token)).length;
    results.push({
      kind,
      id,
      title,
      context,
      snippet: inTitle === tokens.length || !body ? "" : snippet(body, tokens),
      score:
        inTitle * 10 +
        (fold(title).startsWith(tokens[0]) ? 5 : 0) +
        (kind === "project" ? 2 : 0),
    });
  };
  for (const project of data.projects)
    consider(
      "project",
      project.id,
      project.name,
      `Project ${project.number}`,
      project.description,
      `#${project.number} ${project.number}`,
    );
  for (const todo of data.todos)
    consider("task", todo.id, todo.title, names.get(todo.projectId) ?? "", "");
  for (const event of data.events)
    consider(
      event.category === "Notiz" ? "note" : "event",
      event.id,
      event.title,
      names.get(event.projectId) ?? "",
      event.note ?? "",
    );
  if (data.brainstorm.text.trim())
    consider(
      "brainstorm",
      "brainstorm",
      "Brainstorm",
      "",
      data.brainstorm.text,
    );
  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "de"))
    .slice(0, limit);
}
