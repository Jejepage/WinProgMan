import { formatDate, groupProjects, sortTodos } from "./queries";
import type { AppData, Project } from "./types";
import { projectNumberLabel, statusLabel } from "../ui/labels";

const escapeInline = (text: string) =>
  text.replace(/\r?\n/g, " ").replace(/([\\`*_[\]|<>])/g, "\\$1");

/** Markdown report: the given projects (grouped by topic) with their open tasks. */
export function projectReport(
  data: AppData,
  projects: Project[],
  today: string,
): string {
  const lines = [
    `# Project report`,
    "",
    `Created ${formatDate(today)} · ${projects.length} projects`,
    "",
  ];
  for (const group of groupProjects(projects, data.projectCategories)) {
    lines.push(`## ${escapeInline(group.name)}`, "");
    for (const project of group.projects) {
      lines.push(
        `### ${projectNumberLabel(project.number)} ${escapeInline(project.name)}${project.important ? " ★" : ""}`,
        "",
        `Status: ${statusLabel(project.status)}`,
        "",
      );
      if (project.description.trim())
        lines.push(escapeInline(project.description.trim()), "");
      const open = sortTodos(
        data.todos.filter((t) => t.projectId === project.id && !t.completed),
      );
      if (!open.length) lines.push("_No open tasks._", "");
      else {
        for (const todo of open)
          lines.push(
            `- [ ] ${todo.doNext ? "**Do next** " : ""}${escapeInline(todo.title)}${
              todo.dueDate
                ? ` (due ${formatDate(todo.dueDate)}${todo.dueDate < today ? ", overdue" : ""})`
                : ""
            }`,
          );
        lines.push("");
      }
    }
  }
  return lines.join("\n");
}
