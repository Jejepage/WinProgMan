import { useState } from "react";
import { projectStatuses, type ProjectStatus } from "../../domain/types";
import { statusLabel } from "../../ui/labels";

const newPerson = "__new_person__";

/** Clicks and keys inside a quick field must not select the surrounding row. */
const keepInside = {
  onClick: (event: React.MouseEvent) => event.stopPropagation(),
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
};

/** Status badge that is a dropdown; the choice is stored right away. */
export function StatusQuickSelect({
  value,
  projectName,
  disabled,
  onSelect,
}: {
  value: ProjectStatus;
  projectName: string;
  disabled?: boolean;
  onSelect: (status: ProjectStatus) => void;
}) {
  return (
    <select
      className="status-pill quick-select"
      data-status={value}
      aria-label={`Status of ${projectName}`}
      title="Change status"
      value={value}
      disabled={disabled}
      {...keepInside}
      onChange={(e) => {
        const next = e.target.value as ProjectStatus;
        if (next !== value) onSelect(next);
      }}
    >
      {projectStatuses.map((status) => (
        <option key={status} value={status}>
          {statusLabel(status)}
        </option>
      ))}
    </select>
  );
}

/**
 * Owner dropdown stored right away. "New person…" switches to a text field
 * that is stored with Enter or when leaving it; Esc keeps the old owner.
 */
export function OwnerQuickSelect({
  value,
  names,
  projectName,
  disabled,
  onSelect,
}: {
  value: string;
  names: string[];
  projectName: string;
  disabled?: boolean;
  onSelect: (owner: string) => void;
}) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  if (typing) {
    const finish = (store: boolean) => {
      setTyping(false);
      if (store && draft.trim() && draft.trim() !== value) onSelect(draft);
    };
    return (
      <input
        className="quick-owner-input"
        aria-label={`New owner of ${projectName}`}
        placeholder="Name, then Enter"
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
  const current = names.find(
    (name) =>
      name.toLocaleLowerCase("de") === value.trim().toLocaleLowerCase("de"),
  );
  return (
    <select
      className="quick-select quick-owner"
      aria-label={`Owner of ${projectName}`}
      title="Change owner"
      value={current ?? ""}
      disabled={disabled}
      {...keepInside}
      onChange={(e) => {
        if (e.target.value === newPerson) {
          setDraft("");
          setTyping(true);
        } else if (e.target.value !== (current ?? "")) onSelect(e.target.value);
      }}
    >
      <option value="">Not assigned</option>
      {names.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value={newPerson}>New person…</option>
    </select>
  );
}
