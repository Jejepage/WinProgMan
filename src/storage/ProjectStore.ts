import type { AppData, DomainChange, ExportEnvelope } from "../domain/types";
export interface ProjectStore {
  load(): Promise<AppData>;
  apply(change: DomainChange): Promise<void>;
  exportData(): Promise<ExportEnvelope>;
  importData(data: ExportEnvelope, expectedRevision?: number): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export class ConflictError extends Error {
  constructor(public readonly current?: AppData) {
    super("This item has changed in another window.");
    this.name = "ConflictError";
  }
}
