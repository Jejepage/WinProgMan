export const categories = [
  "Meeting",
  "Telefonat",
  "Milestone",
  "Beschluss",
  "Notiz",
] as const;
export type Category = (typeof categories)[number];
export interface Base {
  revision?: number;
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
  projectNumber?: number;
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
  eventId?: string;
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
  nextProjectNumber: number;
  revision: number;
  trash: TrashEntry[];
  projectCategories: ProjectCategory[];
  projects: Project[];
  links: Link[];
  todos: Todo[];
  events: ProjectEvent[];
}
export interface ExportEnvelope extends AppData {
  schemaVersion: 5;
  exportedAt: string;
}
export interface TrashEntry {
  id: string;
  type: "project" | "todo" | "event" | "link";
  name: string;
  projectId: string;
  projectName: string;
  deletedAt: string;
  data: Pick<AppData, "projects" | "todos" | "events" | "links">;
  detachedTasks?: { id: string; revision: number }[];
}
export type DomainChange = (
  | { type: "project.save"; value: Project }
  | { type: "category.save"; value: ProjectCategory }
  | { type: "category.delete"; id: string }
  | { type: "link.save"; value: Link }
  | { type: "todo.save"; value: Todo }
  | { type: "event.save"; value: ProjectEvent }
  | {
      type: "project.delete" | "link.delete" | "todo.delete" | "event.delete";
      id: string;
    }
  | { type: "trash.restore" | "trash.delete"; id: string }
  | { type: "trash.empty" }
) & { expectedRevision?: number; overwrite?: boolean };
export const emptyData = (): AppData => ({
  nextProjectNumber: 1,
  revision: 0,
  trash: [],
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
