import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { openNewItem, type ItemKind } from "../ui/itemNavigation";

const entries: { kind: ItemKind; label: string }[] = [
  { kind: "project", label: "Project" },
  { kind: "task", label: "Task" },
  { kind: "event", label: "Event" },
  { kind: "note", label: "Note" },
];

/** "New ▾" on the dashboard: creates any kind of item from one place. */
export function NewMenu({
  disabled,
  hasProjects,
}: {
  disabled: boolean;
  hasProjects: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>("button")?.focus();
      } else if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="new-menu" ref={root}>
      <button
        className="button add-button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Create a project, task, event or note"
        onClick={() => setOpen(!open)}
      >
        <Plus size={16} aria-hidden="true" />
        <span className="button-label">New</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open && (
        <div className="new-menu-list" role="menu" aria-label="New">
          {entries.map(({ kind, label }) => (
            <button
              key={kind}
              role="menuitem"
              disabled={kind !== "project" && !hasProjects}
              title={
                kind !== "project" && !hasProjects
                  ? "Create a project first"
                  : undefined
              }
              onClick={() => {
                setOpen(false);
                openNewItem(kind, undefined, kind === "note");
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
