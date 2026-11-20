import { useState } from "react";

const newPerson = "__new_person__";

/**
 * Dropdown of owners already used in other projects, plus "New person…",
 * which switches to a text field. An empty value means not assigned.
 */
export function OwnerSelect({
  value,
  names,
  onChange,
}: {
  value: string;
  names: string[];
  onChange: (value: string) => void;
}) {
  const known = names.some(
    (name) =>
      name.toLocaleLowerCase("de") === value.trim().toLocaleLowerCase("de"),
  );
  const [typing, setTyping] = useState(!!value.trim() && !known);
  if (typing)
    return (
      <span className="owner-new">
        <input
          aria-label="Owner"
          value={value}
          placeholder="Name of the responsible person"
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setTyping(false);
            onChange(known ? value : "");
          }}
        >
          Choose from list
        </button>
      </span>
    );
  return (
    <select
      aria-label="Owner"
      value={
        known
          ? names.find(
              (n) =>
                n.toLocaleLowerCase("de") ===
                value.trim().toLocaleLowerCase("de"),
            )
          : ""
      }
      onChange={(e) => {
        if (e.target.value === newPerson) {
          setTyping(true);
          onChange("");
        } else onChange(e.target.value);
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
