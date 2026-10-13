import type { AppData, DomainChange } from "../../domain/types";
export function TrashPanel({
  data,
  busy,
  onChange,
}: {
  data: AppData;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}) {
  return (
    <section className="panel" aria-label="Trash">
      <div className="section-heading">
        <h2>Trash</h2>
        <button
          className="button danger"
          disabled={busy || !data.trash.length}
          onClick={() => {
            if (
              confirm(
                "Permanently delete everything in Trash? This cannot be undone.",
              )
            )
              void onChange({
                type: "trash.empty",
                expectedRevision: data.revision,
              });
          }}
        >
          Empty trash
        </button>
      </div>
      <p className="muted">
        Deleted items stay here until you restore or permanently delete them.
      </p>
      {!data.trash.length && <p>Trash is empty.</p>}
      <ul className="trash-list">
        {[...data.trash].reverse().map((entry) => (
          <li key={entry.id}>
            <div>
              <strong>{entry.name}</strong>
              <small>
                {entry.type} · {entry.projectName} ·{" "}
                {new Date(entry.deletedAt).toLocaleString("en-GB")}
              </small>
            </div>
            <div className="actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void onChange({ type: "trash.restore", id: entry.id })
                }
              >
                Restore
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      `Permanently delete "${entry.name}"? This cannot be undone.`,
                    )
                  )
                    void onChange({ type: "trash.delete", id: entry.id });
                }}
              >
                Delete permanently
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
