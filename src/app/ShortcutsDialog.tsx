import { useEffect, useRef } from "react";

const shortcuts: [string, string][] = [
  ["Ctrl+K", "Search and commands"],
  ["N", "New item in the current view (task on a project page)"],
  ["1 – 6", "Dashboard, Projects, Tasks, Events, Notes, Brainstorm"],
  ["Ctrl+S", "Save the open editor"],
  ["Enter", "Save a task or event from a text field"],
  ["Esc", "Cancel the open editor (asks before discarding changes)"],
  ["Alt+← / Alt+→", "Back and forward between views"],
  ["?", "Show this overview"],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "?") {
        event.preventDefault();
        close.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="palette shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <dl>
          {shortcuts.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          Single-key shortcuts are ignored while typing in a field.
        </p>
        <button
          ref={closeButton}
          className="button secondary"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
