import type { DomainChange, Project } from "../domain/types";

export type View =
  | "Dashboard"
  | "Projects"
  | "Tasks"
  | "Events"
  | "Notes"
  | "Brainstorm"
  | "Project"
  | "Settings";

/** Entries of the main navigation, in display order. */
export const navigationViews = [
  "Dashboard",
  "Projects",
  "Tasks",
  "Events",
  "Notes",
  "Brainstorm",
  "Settings",
] as View[];

/** Props shared by the task and event panels. */
export interface PanelShared {
  compactSections: boolean;
  projects: Project[];
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onProject: (id: string) => void;
}

export interface Detail {
  kind: "task" | "event" | "note";
  id: string;
  creating: boolean;
  projectId?: string;
  notesOnly: boolean;
}

/** Reads the open task/event/note editor from the URL hash. */
export function readDetail(): Detail | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const kind = params.get("detail");
  return kind === "task" || kind === "event" || kind === "note"
    ? {
        kind,
        id: params.get("id") || "",
        creating: params.get("mode") === "new",
        projectId: params.get("project") || undefined,
        notesOnly: params.get("note") === "1",
      }
    : null;
}
