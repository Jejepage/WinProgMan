export const categories = [
  "Meeting",
  "Telefonat",
  "Milestone",
  "Beschluss",
  "Mail",
  "Notiz",
] as const;
export type Category = (typeof categories)[number];
export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Version counter for sync: raised on every change, absent in old data. */
  rev?: number;
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
/** Placeholder number: the store assigns the next free number on save. */
export const AUTO_PROJECT_NUMBER = -1;
export interface Project extends Base {
  number: number;
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
export const tombstoneKinds = [
  "category",
  "project",
  "link",
  "todo",
  "event",
  "brainstorm",
] as const;
export type TombstoneKind = (typeof tombstoneKinds)[number];
/** Kinds that live in their own collection (the brainstorm is a single text). */
export type RecordKind = Exclude<TombstoneKind, "brainstorm">;
/** Local version that lost against a newer one from another computer. */
export interface ConflictInfo {
  /** Id of the record that won; for the brainstorm the fixed id "brainstorm". */
  of: string;
  /** Id of the computer whose local version was replaced. */
  by: string;
  /** Name of the computer whose version replaced this one. */
  device: string;
}
/** Deleted record kept for the trash and for propagating deletions via sync. */
export interface Tombstone {
  kind: TombstoneKind;
  id: string;
  /** Version of the record at deletion; a later edit (higher rev) wins. */
  rev: number;
  deletedAt: string;
  /** Project whose deletion removed this record as a dependent. */
  group?: string;
  /** Set when this is a replaced local version, not a deletion. */
  conflict?: ConflictInfo;
  record: Record<string, unknown>;
}
export interface AppData {
  tombstones: Tombstone[];
  brainstorm: Brainstorm;
  projectCategories: ProjectCategory[];
  projects: Project[];
  links: Link[];
  todos: Todo[];
  events: ProjectEvent[];
}
export interface Brainstorm {
  text: string;
  revision: number;
  updatedAt: string;
}
export const emptyBrainstorm = (): Brainstorm => ({
  text: "",
  revision: 0,
  updatedAt: "1970-01-01T00:00:00.000Z",
});
export interface ExportEnvelope extends AppData {
  schemaVersion: 6;
  exportedAt: string;
}
export type DomainChange =
  | { type: "samples.load"; value: AppData }
  | { type: "brainstorm.save"; text: string; expectedRevision: number }
  | { type: "trash.restore"; id: string }
  | { type: "trash.purge"; id: string }
  | { type: "trash.empty" }
  | { type: "sync.merge"; remotes: AppData[]; conflicts?: Tombstone[] }
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
  tombstones: [],
  brainstorm: emptyBrainstorm(),
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
