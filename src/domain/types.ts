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
export interface Project extends Base {
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
  dueDate?: string;
}
export interface ProjectEvent extends Base {
  projectId: string;
  category: Category;
  title: string;
  date: string;
  time?: string;
  note?: string;
}
export interface AppData {
  projects: Project[];
  links: Link[];
  todos: Todo[];
  events: ProjectEvent[];
}
export interface ExportEnvelope extends AppData {
  schemaVersion: 1;
  exportedAt: string;
}
export type DomainChange =
  | { type: "project.save"; value: Project }
  | { type: "link.save"; value: Link }
  | { type: "todo.save"; value: Todo }
  | { type: "event.save"; value: ProjectEvent }
  | {
      type: "project.delete" | "link.delete" | "todo.delete" | "event.delete";
      id: string;
    };
export const emptyData = (): AppData => ({
  projects: [],
  links: [],
  todos: [],
  events: [],
});
export const metadata = (): Base => {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
};
