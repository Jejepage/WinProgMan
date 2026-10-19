import type { ExportEnvelope } from "../domain/types";

export function ImportPreview({
  pending,
  busy,
  onBackup,
  onReplace,
  onCancel,
}: {
  pending: ExportEnvelope;
  busy: boolean;
  onBackup: () => void;
  onReplace: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="panel import-preview" aria-label="Import preview">
      <h2>Import backup</h2>
      <p>
        {pending.projects.length} Projects · {pending.todos.length} Tasks ·{" "}
        {pending.events.filter((event) => event.category !== "Notiz").length}{" "}
        Events ·{" "}
        {pending.events.filter((event) => event.category === "Notiz").length}{" "}
        Notes · {pending.links.length} Links · {pending.quickLinks.length}{" "}
        dashboard links · {pending.projectCategories.length} project topics
      </p>
      <p>Brainstorm: {pending.brainstorm.text.length} characters.</p>
      <p>
        All current data, including Brainstorm, will be replaced. Back it up
        first as JSON.
      </p>
      <div className="actions">
        <button className="button secondary" onClick={onBackup}>
          Back up current data
        </button>
        <button className="button danger" disabled={busy} onClick={onReplace}>
          Replace data
        </button>
        <button className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
