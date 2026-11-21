import { EventsPanel } from "../../features/events/EventsPanel";
import { TodosPanel } from "../../features/todos/TodosPanel";
import { readPrefill } from "../../features/outlook/pendingPrefill";
import { NewProjectEditor } from "../../features/projects/NewProjectEditor";
import type { AppData } from "../../domain/types";
import type { Detail, PanelShared } from "../types";

/** Full-page editor for one task, event or note (opened through the URL hash). */
export function DetailPage({
  detail,
  data,
  hidden,
  error,
  loading,
  shared,
  backLabel,
  onClose,
  onProjectCreated,
}: {
  detail: Detail;
  data: AppData;
  hidden: boolean;
  error: string;
  loading: boolean;
  shared: PanelShared;
  /** Name of the list or project the editor returns to. */
  backLabel: string;
  onClose: () => void;
  onProjectCreated: (id: string) => void;
}) {
  const todo = data.todos.find((item) => item.id === detail.id);
  const event = data.events.find((item) => item.id === detail.id);
  const isNote = detail.creating
    ? detail.kind === "note" || Boolean(detail.notesOnly)
    : event?.category === "Notiz";
  const item = detail.kind === "task" ? todo : event;
  const initialProjectId = data.projects.some((p) => p.id === detail.projectId)
    ? detail.projectId
    : undefined;
  const prefill =
    detail.creating && detail.kind === "event" && detail.prefill
      ? readPrefill(detail.prefill)
      : undefined;
  const detailKey = detail.creating
    ? `new-${detail.kind}-${initialProjectId || "global"}-${detail.prefill || ""}`
    : detail.id;
  const unavailable =
    detail.kind === "project"
      ? false
      : detail.creating
        ? !data.projects.length
        : !item;
  const itemProject = data.projects.find(
    (p) => p.id === (item?.projectId || initialProjectId),
  );
  return (
    <section className="detail-page" hidden={hidden}>
      <button className="text-button breadcrumb" onClick={onClose}>
        ← {backLabel}
      </button>
      <div className="page-heading">
        <div>
          <h1>
            {`${detail.creating ? "New" : "Edit"} ${detail.kind === "project" ? "project" : detail.kind === "task" ? "task" : isNote ? "note" : "event"}`}
          </h1>
          {itemProject && detail.kind !== "project" && (
            <p className="detail-context">{itemProject.name}</p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="panel">
          {error}
        </p>
      )}
      {loading ? (
        <p>Loading …</p>
      ) : unavailable ? (
        <section className="panel">
          <p>
            {detail.creating
              ? "Create a project before adding tasks, events or notes."
              : "This item no longer exists."}
          </p>
          <button className="button secondary" onClick={onClose}>
            Back to list
          </button>
        </section>
      ) : detail.kind === "project" ? (
        <NewProjectEditor
          projects={data.projects}
          categories={data.projectCategories}
          busy={shared.busy}
          onChange={shared.onChange}
          onCreated={onProjectCreated}
          onCancel={onClose}
        />
      ) : detail.kind === "task" ? (
        <TodosPanel
          key={detailKey}
          {...shared}
          todos={!detail.creating && todo ? [todo] : []}
          initialTodo={detail.creating ? undefined : todo}
          initialProjectId={initialProjectId}
          detailOnly
          onClose={onClose}
        />
      ) : (
        <EventsPanel
          key={detailKey}
          {...shared}
          events={!detail.creating && event ? [event] : []}
          initialEvent={detail.creating ? undefined : event}
          initialProjectId={initialProjectId}
          initialDraft={prefill}
          notices={
            prefill
              ? prefill.notices
              : detail.prefill && detail.creating
                ? [
                    "The dropped Outlook item is no longer available after reloading. Drop it again to prefill this event.",
                  ]
                : undefined
          }
          notesOnly={isNote}
          detailOnly
          onClose={onClose}
        />
      )}
    </section>
  );
}
