import { describe, expect, it } from "vitest";
import { createRecoveryJournal } from "./recovery";
import { emptyBrainstorm } from "../../domain/types";
function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
describe("Brainstorm recovery journals", () => {
  it("ignores a journal whose draft was committed before journal cleanup", () => {
    const local = storage(),
      session = storage();
    const journal = createRecoveryJournal(local, session);
    journal.write("committed", emptyBrainstorm());
    expect(
      journal.recover({
        text: "committed",
        revision: 1,
        updatedAt: "2026-10-17T10:00:00.000Z",
      }),
    ).toBeUndefined();
    expect(local.length).toBe(0);
  });
  it("restores a draft after reload in the same tab and never clears another tab's draft", () => {
    const local = storage(),
      sessionA = storage(),
      sessionB = storage();
    const first = createRecoveryJournal(local, sessionA);
    const other = createRecoveryJournal(local, sessionB);
    first.write("first draft", emptyBrainstorm());
    other.write("other draft", emptyBrainstorm());
    expect(createRecoveryJournal(local, sessionA).recover()?.text).toBe(
      "first draft",
    );
    first.write("", emptyBrainstorm());
    expect(first.recover()).toBeUndefined();
    expect(other.recover()?.text).toBe("other draft");
    other.write("latest other draft", emptyBrainstorm());
    expect(local.length).toBe(1);
    expect(createRecoveryJournal(local, sessionB).recover()?.text).toBe(
      "latest other draft",
    );
  });
});
