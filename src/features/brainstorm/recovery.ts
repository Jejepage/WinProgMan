import type { Brainstorm } from "../../domain/types";
export interface Recovery {
  text: string;
  baseline: Brainstorm;
}
const sessionKey = "winprogman.brainstorm.session.v1";
const draftPrefix = "winprogman.brainstorm.draft.v2.";

/** A tab may only replace/remove its own journal; reload preserves its session ID. */
export function createRecoveryJournal(local: Storage, session: Storage) {
  let owner: string;
  try {
    owner = session.getItem(sessionKey) || crypto.randomUUID();
    session.setItem(sessionKey, owner);
  } catch {
    owner = crypto.randomUUID();
  }
  const key = draftPrefix + owner;
  return {
    recover(current?: Brainstorm): Recovery | undefined {
      try {
        const value = JSON.parse(
          local.getItem(key) || "null",
        ) as Recovery | null;
        if (
          value &&
          typeof value.text === "string" &&
          typeof value.baseline?.text === "string" &&
          Number.isInteger(value.baseline.revision) &&
          typeof value.baseline.updatedAt === "string"
        ) {
          if (value.text === current?.text) {
            local.removeItem(key);
            return;
          }
          return value;
        }
      } catch {
        /* The main store remains authoritative. */
      }
    },
    write(text: string, baseline: Brainstorm) {
      try {
        if (text === baseline.text) local.removeItem(key);
        else local.setItem(key, JSON.stringify({ text, baseline }));
      } catch {
        /* beforeunload still warns while a durable save is pending. */
      }
    },
  };
}
