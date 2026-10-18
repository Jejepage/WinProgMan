import { EventsPanel } from "../../features/events/EventsPanel";
import { ProjectHeader } from "../../features/projects/ProjectHeader";
import { TodosPanel } from "../../features/todos/TodosPanel";
import { projectNumberLabel } from "../../ui/labels";
import { formatDate } from "../../domain/queries";
import type { AppData, DomainChange } from "../../domain/types";
import type { PanelShared } from "../types";

export function ProjectPage({
  data,
  projectId,
  busy,
  compact,
  shared,
  onChange,
  onDelete,
  onBack,
}: {
  data: AppData;
  projectId: string;
  busy: boolean;
  compact: boolean;
  shared: PanelShared;
  onChange: (change: DomainChange) => Promise<boolean>;
  onDelete: () => Promise<void>;
  onBack: () => void;
}) {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project)
    return (
      <section className="panel empty">
        This project no longer exists.
        <button className="text-button" onClick={onBack}>
          Back to projects
        </button>
      </section>
    );
  return (
    <>
      <button className="text-button breadcrumb" onClick={onBack}>
        ← All projects
      </button>
      <div className="project-workspace">
        <ProjectHeader
          key={project.id}
          project={project}
          projects={data.projects}
          projectCategories={data.projectCategories}
          links={data.links.filter((l) => l.projectId === project.id)}
          busy={busy}
          onChange={onChange}
          onDelete={onDelete}
        />
        <div className="project-metadata">
          <span>{projectNumberLabel(project.number)}</span>
          <span>Created {formatDate(project.createdAt.slice(0, 10))}</span>
          <span>Updated {formatDate(project.updatedAt.slice(0, 10))}</span>
          <span>
            {
              data.todos.filter(
                (t) => t.projectId === project.id && t.completed,
              ).length
            }{" "}
            / {data.todos.filter((t) => t.projectId === project.id).length}{" "}
            tasks completed
          </span>
        </div>
        <div className="detail-columns">
          <TodosPanel
            key={`todo-${project.id}`}
            {...shared}
            projectId={project.id}
            todos={data.todos.filter((t) => t.projectId === project.id)}
          />
          <EventsPanel
            key={`event-${project.id}`}
            {...shared}
            compactPreview={compact}
            projectId={project.id}
            events={data.events.filter((e) => e.projectId === project.id)}
          />
          <EventsPanel
            key={`notes-${project.id}`}
            {...shared}
            compactPreview={compact}
            notesOnly
            projectId={project.id}
            events={data.events.filter(
              (event) => event.projectId === project.id,
            )}
          />
        </div>
      </div>
    </>
  );
}
