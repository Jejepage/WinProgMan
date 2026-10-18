import { isRestorable, TOMBSTONE_RETENTION_DAYS } from "../../domain/history";
import type { DomainChange, Tombstone } from "../../domain/types";
import { confirmAction } from "../../platform/desktop";

const kindLabel: Record<Tombstone["kind"], string> = {
  category: "Category",
  project: "Project",
  link: "Link",
  todo: "Task",
  event: "Event",
};
const title = (item: Tombstone) =>
  String(item.record.title ?? item.record.name ?? item.record.label ?? "");

export function TrashSettings({
  tombstones,
  busy,
  onChange,
}: {
  tombstones: Tombstone[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}) {
  const items = tombstones
    .filter(
      (item) => isRestorable(item) && !item.group, // dependants come back with their project
    )
    .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  return (
    <section className="panel trash-settings" aria-label="Trash">
      <h2>Trash</h2>
      <p className="description">
        Deleted items stay here for {TOMBSTONE_RETENTION_DAYS} days and can be
        restored. Restoring a project brings back its tasks, events, notes and
        links.
      </p>
      {items.length === 0 ? (
        <p className="empty">The trash is empty.</p>
      ) : (
        <>
          <ul className="trash-list">
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  <strong>{kindLabel[item.kind]}</strong>{" "}
                  {item.record.category === "Notiz" ? "(note) " : ""}
                  {title(item) || "Untitled"}
                  <small>
                    {" "}
                    · deleted {new Date(item.deletedAt).toLocaleDateString()}
                  </small>
                </span>
                <span className="actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void onChange({ type: "trash.restore", id: item.id })
                    }
                  >
                    Restore
                  </button>
                  <button
                    className="button secondary danger"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        await confirmAction(
                          `Delete "${title(item) || "this item"}" permanently?`,
                        )
                      )
                        await onChange({ type: "trash.purge", id: item.id });
                    }}
                  >
                    Delete permanently
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="actions">
            <button
              className="button secondary danger"
              disabled={busy}
              onClick={async () => {
                if (await confirmAction("Empty the trash permanently?"))
                  await onChange({ type: "trash.empty" });
              }}
            >
              Empty trash
            </button>
          </div>
        </>
      )}
    </section>
  );
}
