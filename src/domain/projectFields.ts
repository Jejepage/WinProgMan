import { formatDate, ownerNames } from "./queries";
import type { Project, ProjectStatus } from "./types";

/**
 * Owner as it is stored: the spelling of a name already used in another
 * project (case-insensitive), otherwise the trimmed input; "" = not assigned.
 */
export function canonicalOwner(projects: Project[], raw: string): string {
  const wanted = raw.trim();
  const key = wanted.toLocaleLowerCase("de");
  return (
    ownerNames(projects).find((name) => name.toLocaleLowerCase("de") === key) ||
    wanted
  );
}

/** Fields that can be changed directly in lists without opening the editor. */
export interface QuickProjectFields {
  status?: ProjectStatus;
  owner?: string;
  /** "" removes the date. */
  startDate?: string;
  endDate?: string;
}

/**
 * Returns the project with the given quick fields applied, or null when
 * nothing changes. An empty owner removes the optional field.
 */
export function withQuickFields(
  project: Project,
  fields: QuickProjectFields,
  projects: Project[],
  now = new Date().toISOString(),
): Project | null {
  const next: Project = { ...project };
  if (fields.status !== undefined) next.status = fields.status;
  if (fields.owner !== undefined) {
    const owner = canonicalOwner(projects, fields.owner);
    if (owner) next.owner = owner;
    else delete next.owner;
  }
  for (const key of ["startDate", "endDate"] as const) {
    const value = fields[key];
    if (value === undefined) continue;
    if (value) next[key] = value;
    else delete next[key];
  }
  if (
    next.status === project.status &&
    next.owner === project.owner &&
    next.startDate === project.startDate &&
    next.endDate === project.endDate
  )
    return null;
  next.updatedAt = now;
  return next;
}

/** "Start 01.12.26 – End 31.03.27", only the parts that are set; "" if none. */
export function projectPeriod(project: Project): string {
  const parts = [
    project.startDate && `Start ${formatDate(project.startDate)}`,
    project.endDate && `End ${formatDate(project.endDate)}`,
  ].filter(Boolean);
  return parts.join(" – ");
}
