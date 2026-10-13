import type { AppData, DomainChange, ExportEnvelope } from "../domain/types";
export interface ProjectStore {
  load(): Promise<AppData>;
  apply(change: DomainChange): Promise<void>;
  exportData(): Promise<ExportEnvelope>;
  importData(data: ExportEnvelope): Promise<void>;
}
