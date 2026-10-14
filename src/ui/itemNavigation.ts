export function openItem(kind: "task" | "event", id: string) {
  const url = new URL(window.location.href);
  url.hash = new URLSearchParams({ detail: kind, id }).toString();
  window.location.hash = url.hash;
}
