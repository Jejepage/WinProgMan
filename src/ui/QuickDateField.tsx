import { useState, type ReactNode } from "react";
import { formatDate } from "../domain/queries";

/**
 * A date shown as text; a click turns it into a date field. The new date is
 * stored with Enter or when leaving the field (so typing a year digit by
 * digit stores nothing in between); Esc keeps the old date. An emptied
 * field removes the date. Clicks stay inside (rows may react to clicks).
 */
export function QuickDateField({
  value,
  label,
  emptyTitle = "Set date",
  className = "",
  disabled,
  display = (date) => formatDate(date),
  onSelect,
}: {
  value?: string;
  /** Accessible name of the field, e.g. "Due date of Write report". */
  label: string;
  emptyTitle?: string;
  className?: string;
  disabled?: boolean;
  display?: (date: string) => ReactNode;
  onSelect: (date: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (editing) {
    const finish = (store: boolean) => {
      setEditing(false);
      if (!store || draft === (value || "")) return;
      if (draft === "" || /^\d{4}-\d{2}-\d{2}$/.test(draft)) onSelect(draft);
    };
    return (
      <input
        type="date"
        className="quick-date"
        aria-label={label}
        autoFocus
        value={draft}
        onClick={(event) => event.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
          }
        }}
      />
    );
  }
  return (
    <button
      type="button"
      className={`quick-date-button ${className}`}
      aria-label={`Change ${label.charAt(0).toLowerCase()}${label.slice(1)}`}
      title={value ? `${formatDate(value)} – click to change` : emptyTitle}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        setDraft(value || "");
        setEditing(true);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {value ? display(value) : <span className="muted">—</span>}
    </button>
  );
}
