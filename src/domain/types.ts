export const categories = [
  "Meeting",
  "Telefonat",
  "Milestone",
  "Beschluss",
  "Notiz",
] as const;
export type Category = (typeof categories)[number];
export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
}
export const projectStatuses = [
  "Geplant",
  "Aktiv",
  "Pausiert",
  "Abgeschlossen",
] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
export interface ProjectCategory extends Base {
  name: string;
}
export interface Project extends Base {
  status: ProjectStatus;
  categoryId?: string;
  name: string;
  description: string;
}
export interface Link extends Base {
  projectId: string;
  label: string;
  target: string;
}
export interface Todo extends Base {
  projectId: string;
  title: string;
  completed: boolean;
  doNext?: boolean;
  dueDate?: string;
}
export interface ProjectEvent extends Base {
  projectId: string;
  category: Category;
  title: string;
  date: string;
  time?: string;
  note?: string;
  noteFormat?: "markdown";
}
export interface AppData {
  projectCategories: ProjectCategory[];
  projects: Project[];
  links: Link[];
  todos: Todo[];
  events: ProjectEvent[];
}
export interface ExportEnvelope extends AppData {
  schemaVersion: 4;
  exportedAt: string;
}
export type DomainChange =
  | { type: "project.save"; value: Project }
  | { type: "project.saveWithLinks"; value: Project; links: Link[] }
  | { type: "category.save"; value: ProjectCategory }
  | { type: "category.delete"; id: string }
  | { type: "link.save"; value: Link }
  | { type: "todo.save"; value: Todo }
  | { type: "todo.setDoNext"; id: string; doNext: boolean }
  | { type: "event.save"; value: ProjectEvent }
  | {
      type: "project.delete" | "link.delete" | "todo.delete" | "event.delete";
      id: string;
    };
export const emptyData = (): AppData => ({
  projectCategories: [],
  projects: [],
  links: [],
  todos: [],
  events: [],
});
export const metadata = (): Base => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};
