import type { View } from "./types";

/** A main view in the URL hash, e.g. #view=tasks or #project=<id>. */
export interface Route {
  view: Exclude<View, "Settings">;
  projectId?: string;
}

const slugs: Record<Route["view"], string> = {
  Dashboard: "dashboard",
  Projects: "projects",
  Tasks: "tasks",
  Events: "events",
  Notes: "notes",
  Brainstorm: "brainstorm",
  Project: "project",
};
const lastRouteKey = "winprogman-last-view";

/** Reads a main view from a hash; null for editors (#detail=…) or unknown hashes. */
export function readRoute(hash = window.location.hash): Route | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.get("detail")) return null;
  const projectId = params.get("project");
  if (projectId) return { view: "Project", projectId };
  const slug = params.get("view");
  const view = (Object.keys(slugs) as Route["view"][]).find(
    (key) => slugs[key] === slug && key !== "Project",
  );
  return view ? { view } : null;
}

export function routeHash(route: Route): string {
  return route.view === "Project" && route.projectId
    ? `#${new URLSearchParams({ project: route.projectId })}`
    : `#view=${slugs[route.view === "Project" ? "Projects" : route.view]}`;
}

export const sameRoute = (a: Route | null, b: Route) =>
  !!a && a.view === b.view && (a.projectId || "") === (b.projectId || "");

/** Last main view of this browser profile, used when the app starts without a hash. */
export function readLastRoute(): Route | null {
  try {
    const saved = localStorage.getItem(lastRouteKey);
    return saved ? readRoute(saved) : null;
  } catch {
    return null;
  }
}

export function rememberRoute(route: Route) {
  try {
    localStorage.setItem(lastRouteKey, routeHash(route));
  } catch {
    /* Session only. */
  }
}

/** History entries pushed for an editor carry this marker, so closing can go back. */
export const detailHistoryState = { planB: "detail" } as const;
export const isDetailHistoryEntry = () =>
  (window.history.state as { planB?: string } | null)?.planB === "detail";
