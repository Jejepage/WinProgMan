import type { Brainstorm } from "../../domain/types";

/** Serializes only after a pause; a single writer drains the latest editor state. */
export class BrainstormAutosave {
  private version = 0;
  private savedVersion = 0;
  private running?: Promise<void>;
  private timer?: ReturnType<typeof setTimeout>;
  private conflict = false;
  private incoming?: Brainstorm;
  private acknowledged: Brainstorm[] = [];
  constructor(
    public baseline: Brainstorm,
    private read: () => string,
    private save: (text: string, revision: number) => Promise<Brainstorm>,
    private status: (
      status: "saved" | "pending" | "saving" | "error",
      error?: string,
    ) => void,
    private journal: (text: string, baseline: Brainstorm) => void,
    private replace: (value: Brainstorm) => void = () => {},
  ) {}
  get dirty() {
    return this.version !== this.savedVersion;
  }
  changed() {
    this.version++;
    this.status("pending");
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => {});
    }, 600);
  }
  capture(read = this.read) {
    if (this.dirty) this.journal(read(), this.baseline);
  }
  receive(next: Brainstorm): boolean {
    if (this.running) {
      this.incoming = next;
      return false;
    }
    if (
      next.revision === this.baseline.revision &&
      next.updatedAt === this.baseline.updatedAt &&
      next.text === this.baseline.text
    )
      return false;
    if (this.dirty) {
      this.conflict = true;
      this.status(
        "error",
        "Brainstorm changed elsewhere. Your draft is preserved. Copy it before reloading to review the saved version.",
      );
      return false;
    }
    this.baseline = next;
    return true;
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.running) return this.running;
    this.acknowledged = [];
    this.running = this.drain().finally(() => {
      this.running = undefined;
      if (this.incoming) {
        const next = this.incoming;
        this.incoming = undefined;
        if (
          !this.acknowledged.some(
            (saved) =>
              saved.text === next.text &&
              saved.revision === next.revision &&
              saved.updatedAt === next.updatedAt,
          )
        ) {
          if (this.receive(next)) this.replace(next);
        }
      }
    });
    return this.running;
  }
  private async drain() {
    try {
      while (this.dirty) {
        const version = this.version;
        const text = this.read();
        this.journal(text, this.baseline);
        if (this.conflict)
          throw new Error(
            "Brainstorm changed elsewhere. Your draft is preserved; copy it before reloading.",
          );
        if (text !== this.baseline.text) {
          this.status("saving");
          const saved = await this.save(text, this.baseline.revision);
          if (
            saved.text !== text ||
            saved.revision !== this.baseline.revision + 1
          ) {
            this.conflict = true;
            throw new Error(
              "Brainstorm changed elsewhere while saving. Your draft is preserved; copy it before reloading.",
            );
          }
          this.baseline = saved;
          this.acknowledged.push(this.baseline);
          if (this.acknowledged.length > 20) this.acknowledged.shift();
        }
        this.savedVersion = version;
        // Keep a recovery record until newer edits have also been persisted.
        this.journal(this.read(), this.baseline);
      }
      this.status("saved");
    } catch (error) {
      this.status(
        "error",
        error instanceof Error
          ? error.message
          : "Unable to save Brainstorm. Your draft is preserved.",
      );
      throw error;
    }
  }
  dispose() {
    clearTimeout(this.timer);
  }
}
