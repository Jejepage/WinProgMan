import { useMemo, useState } from "react";
import type { AppData } from "../../domain/types";
import {
  highlightParts,
  projectReference,
  searchAll,
  type OpenRecord,
  type SearchResult,
} from "../../domain/workflows";
import { Dialog } from "../../ui/dialogs";

function Highlight({ value, query }: { value: string; query: string }) {
  return (
    <>
      {highlightParts(value, query).map((part, index) =>
        part.match ? (
          <mark key={index}>{part.text}</mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

export function GlobalSearch({
  data,
  onClose,
  onOpen,
}: {
  data: AppData;
  onClose: () => void;
  onOpen: OpenRecord;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchAll(data, query), [data, query]);
  const groups: SearchResult["group"][] = [
    "Projects",
    "Tasks",
    "Events",
    "Notes",
    "Links",
  ];
  return (
    <Dialog title="Search everything" onClose={onClose}>
      <label className="field">
        Search all projects, tasks, events, notes and links
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type words or a project number…"
        />
      </label>
      <p className="muted" role="status">
        {query.trim()
          ? `${results.length} results`
          : "Enter one or more words to search your workspace."}
      </p>
      <div className="search-results">
        {groups.map((group) => {
          const entries = results.filter((result) => result.group === group);
          if (!entries.length) return null;
          return (
            <section key={group} aria-label={group}>
              <h3>
                {group} <span className="count">{entries.length}</span>
              </h3>
              {entries.map((result) => (
                <button
                  className="search-result"
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    onClose();
                    onOpen(result.type, result.id, result.project.id);
                  }}
                >
                  <strong>
                    <Highlight value={result.title} query={query} />
                  </strong>
                  <span className="muted">
                    <Highlight
                      value={projectReference(result.project)}
                      query={query}
                    />{" "}
                    · {group}
                  </span>
                  {result.snippet && (
                    <span className="search-snippet">
                      <Highlight value={result.snippet} query={query} />
                    </span>
                  )}
                </button>
              ))}
            </section>
          );
        })}
        {!!query.trim() && !results.length && (
          <p className="empty">No matching records. Try fewer words.</p>
        )}
      </div>
    </Dialog>
  );
}
