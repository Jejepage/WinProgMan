import {
  collectionByKind,
  isRestorable,
  kindOrder,
  sameContent,
} from "../domain/history";
import type { AppData, Base, RecordKind, Tombstone } from "../domain/types";

/** Categories are folded by name in the merge, so they never conflict. */
const watched: RecordKind[] = kindOrder.filter((kind) => kind !== "category");

export interface RemoteState {
  deviceName: string;
  data: AppData;
}

const rows = (data: AppData, kind: RecordKind) =>
  data[collectionByKind[kind]] as unknown as Base[];
const rev = (row: Base) => row.rev ?? 0;

/**
 * Finds local versions that an incoming newer version from another computer is
 * about to replace although they were edited here after the last publish.
 * `base` is this computer's own published state; without it nothing is
 * reported, because an older local version alone is not a conflict. Returns
 * trash entries holding the local versions (the merge itself is not changed).
 */
export function findConflicts(
  local: AppData,
  base: AppData | undefined,
  remotes: RemoteState[],
  now: Date,
  deviceId: string,
): Tombstone[] {
  if (!base) return [];
  const found: Tombstone[] = [];
  const known = new Set(local.tombstones.map((item) => item.id));
  const add = (item: Tombstone) => {
    if (known.has(item.id)) return;
    known.add(item.id);
    found.push(item);
  };
  const stamp = now.toISOString();

  for (const kind of watched) {
    const published = new Map(rows(base, kind).map((row) => [row.id, row]));
    for (const mine of rows(local, kind)) {
      const before = published.get(mine.id);
      if (!before || sameContent(before, mine)) continue; // not edited since publish
      // The winner is the remote version with the highest version counter.
      let winner: { row: Base; device: string } | undefined;
      for (const remote of remotes) {
        const row = rows(remote.data, kind).find((r) => r.id === mine.id);
        if (
          row &&
          (!winner || rev(row) > rev(winner.row)) &&
          rev(row) >= rev(mine) &&
          !sameContent(row, mine)
        )
          winner = { row, device: remote.deviceName };
      }
      if (!winner) continue;
      // Equal versions are decided by the later edit, as in the merge.
      if (
        rev(winner.row) === rev(mine) &&
        winner.row.updatedAt < mine.updatedAt
      )
        continue;
      const id = `conflict-${mine.id}-${rev(mine)}`;
      add({
        kind,
        id,
        rev: rev(mine),
        deletedAt: stamp,
        conflict: { of: mine.id, by: deviceId, device: winner.device },
        record: { ...(mine as unknown as Record<string, unknown>), id },
      });
    }
  }

  const mine = local.brainstorm;
  const before = base.brainstorm;
  if (mine.text.trim() && mine.text !== before.text) {
    let winner: RemoteState | undefined;
    for (const remote of remotes) {
      const theirs = remote.data.brainstorm;
      const wins =
        theirs.revision !== mine.revision
          ? theirs.revision > mine.revision
          : theirs.updatedAt > mine.updatedAt;
      if (
        wins &&
        theirs.text !== mine.text &&
        (!winner || theirs.revision > winner.data.brainstorm.revision)
      )
        winner = remote;
    }
    if (winner) {
      const id = `conflict-brainstorm-${mine.revision}`;
      add({
        kind: "brainstorm",
        id,
        rev: mine.revision,
        deletedAt: stamp,
        conflict: { of: "brainstorm", by: deviceId, device: winner.deviceName },
        record: { ...mine, id },
      });
    }
  }
  return found;
}

/** Replaced local versions of this computer that are still in the trash. */
export const ownConflicts = (tombstones: Tombstone[], deviceId: string) =>
  tombstones.filter(
    (item) => item.conflict?.by === deviceId && isRestorable(item),
  );
