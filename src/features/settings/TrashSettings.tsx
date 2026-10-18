import {
  collectionByKind,
  isRestorable,
  TOMBSTONE_RETENTION_DAYS,
} from "../../domain/history";
import type {
  AppData,
  DomainChange,
  RecordKind,
  Tombstone,
} from "../../domain/types";
import { confirmAction } from "../../platform/desktop";
import { deviceId } from "../../sync/useSync";

const kindLabel: Record<Tombstone["kind"], string> = {
  category: "Category",
  project: "Project",
  link: "Link",
  todo: "Task",
  event: "Event",
  brainstorm: "Brainstorm",
};
const title = (item: Tombstone) =>
  String(item.record.title ?? item.record.name ?? item.record.label ?? "");
const ignored = new Set(["id", "rev", "createdAt", "updatedAt"]);
const show = (value: unknown) =>
  value === undefined
    ? "—"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

/** The version that replaced a lost one, as it stands now. */
function currentOf(
  item: Tombstone,
  data: AppData,
): Record<string, unknown> | null {
  if (item.kind === "brainstorm") return { text: data.brainstorm.text };
  const rows = data[collectionByKind[item.kind as RecordKind]] as unknown as {
    id: string;
  }[];
  return (
    (rows.find((row) => row.id === item.conflict?.of) as
      Record<string, unknown> | undefined) ?? null
  );
}

function Compare({ item, data }: { item: Tombstone; data: AppData }) {
  const now = currentOf(item, data);
  if (!now) return <p className="empty">The newer version no longer exists.</p>;
  const keys = [...new Set([...Object.keys(item.record), ...Object.keys(now)])]
    .filter(
      (key) =>
        !ignored.has(key) && (item.kind !== "brainstorm" || key === "text"),
    )
    .filter((key) => show(item.record[key]) !== show(now[key]));
  if (keys.length === 0)
    return <p className="empty">Both versions have the same content.</p>;
  return (
    <table className="conflict-compare">
      <thead>
        <tr>
          <th />
          <th>Your version (here in the trash)</th>
          <th>Newer version from {item.conflict?.device}</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key}>
            <th scope="row">{key}</th>
            <td>
              <pre>{show(item.record[key])}</pre>
            </td>
            <td>
              <pre>{show(now[key])}</pre>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TrashSettings({
  tombstones,
  data,
  busy,
  onChange,
}: {
  tombstones: Tombstone[];
  data: AppData;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
}) {
  const own = deviceId();
  const items = tombstones
    .filter(
      (item) =>
        isRestorable(item) &&
        !item.group && // dependants come back with their project
        (!item.conflict || item.conflict.by === own), // other computers' conflict copies are theirs
    )
    .sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  return (
    <section
      id="trash-settings"
      className="panel trash-settings"
      aria-label="Trash"
    >
      <h2>Trash</h2>
      <p className="description">
        Deleted items stay here for {TOMBSTONE_RETENTION_DAYS} days and can be
        restored. Restoring a project brings back its tasks, events, notes and
        links. Versions replaced by a newer edit from another computer are kept
        here too; restoring one adds it as a copy.
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
                  {item.kind === "brainstorm"
                    ? "text"
                    : title(item) || "Untitled"}
                  <small>
                    {item.conflict
                      ? ` · changed on ${item.conflict.device}, your version is kept here (${new Date(item.deletedAt).toLocaleDateString()})`
                      : ` · deleted ${new Date(item.deletedAt).toLocaleDateString()}`}
                  </small>
                  {item.conflict && (
                    <details>
                      <summary>Compare versions</summary>
                      <Compare item={item} data={data} />
                    </details>
                  )}
                </span>
                <span className="actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() =>
                      void onChange({ type: "trash.restore", id: item.id })
                    }
                  >
                    {item.conflict ? "Restore as copy" : "Restore"}
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
