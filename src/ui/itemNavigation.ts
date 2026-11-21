export type ItemKind = "task" | "event" | "note" | "project";

/**
 * Editors live in the URL hash. A history entry is pushed (and marked) so the
 * browser's Back button and Cancel/Save return to the list the user came from.
 */
function pushDetail(params: URLSearchParams) {
  window.history.pushState({ planB: "detail" }, "", `#${params}`);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function openItem(kind: "task" | "event" | "note", id: string) {
  pushDetail(new URLSearchParams({ detail: kind, id }));
}

export function openNewItem(
  kind: ItemKind,
  projectId?: string,
  notesOnly = false,
  prefill?: string,
) {
  const params = new URLSearchParams({ detail: kind, mode: "new" });
  if (projectId) params.set("project", projectId);
  if (notesOnly) params.set("note", "1");
  // Only a token: prefilled content stays in memory (see pendingPrefill).
  if (prefill) params.set("prefill", prefill);
  pushDetail(params);
}
