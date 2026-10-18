import { useEffect, useMemo, useRef, useState } from "react";
import { searchAll, type SearchResult } from "../../domain/search";
import type { AppData } from "../../domain/types";
import "./palette.css";

export interface PaletteAction {
  id: string;
  label: string;
  run: () => void;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("de");
const kindLabel: Record<SearchResult["kind"] | "action", string> = {
  project: "Project",
  task: "Task",
  event: "Event",
  note: "Note",
  brainstorm: "Brainstorm",
  action: "Action",
};

type Entry =
  | { type: "action"; key: string; action: PaletteAction }
  | { type: "result"; key: string; result: SearchResult };

export function CommandPalette({
  data,
  actions,
  onResult,
  onClose,
}: {
  data: AppData;
  actions: PaletteAction[];
  onResult: (result: SearchResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const previous = useRef<Element | null>(null);
  useEffect(() => {
    previous.current = document.activeElement;
    input.current?.focus();
    return () => {
      if (previous.current instanceof HTMLElement) previous.current.focus();
    };
  }, []);
  const entries = useMemo<Entry[]>(() => {
    const needle = fold(query).trim();
    const matchingActions = actions
      .filter((action) => !needle || fold(action.label).includes(needle))
      .map<Entry>((action) => ({
        type: "action",
        key: `a-${action.id}`,
        action,
      }));
    const results = searchAll(data, query).map<Entry>((result) => ({
      type: "result",
      key: `r-${result.kind}-${result.id}`,
      result,
    }));
    return needle
      ? [
          ...matchingActions.slice(0, 4),
          ...results,
          ...matchingActions.slice(4),
        ]
      : matchingActions;
  }, [actions, data, query]);
  const selected = Math.min(index, Math.max(0, entries.length - 1));
  useEffect(() => {
    document
      .getElementById(`palette-option-${selected}`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);
  const choose = (entry: Entry | undefined) => {
    if (!entry) return;
    onClose();
    if (entry.type === "action") entry.action.run();
    else onResult(entry.result);
  };
  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
      >
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={
            entries.length ? `palette-option-${selected}` : undefined
          }
          aria-label="Search projects, tasks, events, notes and Brainstorm"
          placeholder="Search or type a command …"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex(Math.min(entries.length - 1, selected + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex(Math.max(0, selected - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(entries[selected]);
            } else if (event.key === "Tab") {
              event.preventDefault();
            }
          }}
        />
        {entries.length ? (
          <ul id="palette-list" role="listbox" aria-label="Results">
            {entries.map((entry, position) => {
              const result = entry.type === "result" ? entry.result : null;
              const kind = result ? result.kind : "action";
              return (
                <li
                  key={entry.key}
                  id={`palette-option-${position}`}
                  role="option"
                  aria-selected={position === selected}
                  onMouseMove={() => setIndex(position)}
                  onClick={() => choose(entry)}
                >
                  <span className="kind" data-kind={kind}>
                    {kindLabel[kind]}
                  </span>
                  <span className="title">
                    {result
                      ? result.title
                      : (entry as Extract<Entry, { type: "action" }>).action
                          .label}
                  </span>
                  {result && (result.context || result.snippet) && (
                    <small>
                      {[result.context, result.snippet]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hint" role="status">
            Nothing found for “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
