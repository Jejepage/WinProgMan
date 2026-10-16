export function openItem(kind: "task" | "event", id: string) {
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({ detail: kind, id }).toString();
  window.location.hash = url.hash;
}

export function openNewItem(
  kind: "task" | "event",
  projectId?: string,
  notesOnly = false,
) {
  const params = new URLSearchParams({ detail: kind, mode: "new" });
  if (projectId) params.set("project", projectId);
  if (notesOnly) params.set("note", "1");
  window.location.hash = params.toString();
}
