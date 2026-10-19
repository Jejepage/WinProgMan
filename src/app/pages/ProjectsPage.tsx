import { FileText, Star } from "lucide-react";
import { Card, SearchField, StatusLabel, Table } from "../../ui/components";
import { groupProjects } from "../../domain/queries";
import {
  projectStatuses,
  type AppData,
  type DomainChange,
  type ProjectStatus,
} from "../../domain/types";
import { projectNumberLabel, statusLabel } from "../../ui/labels";

export function ProjectsPage({
  data,
  selectedStatuses,
  onToggleStatus,
  categoryFilter,
  onCategoryFilter,
  search,
  onSearch,
  projects,
  onProject,
  importantOnly,
  onImportantOnly,
  onChange,
  onReport,
  busy,
}: {
  data: AppData;
  selectedStatuses: Set<ProjectStatus>;
  onToggleStatus: (status: ProjectStatus) => void;
  /** Already reduced to an existing topic id, "none" or "". */
  categoryFilter: string;
  onCategoryFilter: (value: string) => void;
  search: string;
  onSearch: (value: string) => void;
  /** Projects after status, topic and text filters. */
  projects: AppData["projects"];
  onProject: (id: string) => void;
  importantOnly: boolean;
  onImportantOnly: (value: boolean) => void;
  onChange: (change: DomainChange) => Promise<boolean>;
  /** Creates a Markdown report of `projects`. */
  onReport: () => void;
  busy: boolean;
}) {
  const groups = groupProjects(projects, data.projectCategories);
  return (
    <>
      <div className="panel form-grid project-filters">
        <fieldset className="status-filter">
          <legend className="sr-only">Show statuses</legend>
          <div>
            {projectStatuses.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={selectedStatuses.has(value)}
                  onChange={() => onToggleStatus(value)}
                />
                {statusLabel(value)}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="button"
          className={`star-button star-filter ${importantOnly ? "is-on" : ""}`}
          aria-pressed={importantOnly}
          aria-label="Important only"
          title={
            importantOnly
              ? "Showing important projects only"
              : "Show important projects only"
          }
          onClick={() => onImportantOnly(!importantOnly)}
        >
          <Star size={18} aria-hidden="true" />
        </button>
        <label className="field">
          <span className="sr-only">Filter topic</span>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilter(e.target.value)}
          >
            <option value="">All topics</option>
            <option value="none">No topic</option>
            {data.projectCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <SearchField
          label="Search projects"
          value={search}
          onChange={onSearch}
        />
        <button
          type="button"
          className="button secondary report-button"
          disabled={!projects.length}
          onClick={onReport}
          aria-label="Report"
          title="Save a Markdown report of the projects shown below"
        >
          <FileText size={16} aria-hidden="true" />
        </button>
      </div>
      {!projects.length && !!data.projects.length && (
        <p className="panel empty">
          No projects match the current search or filters.
        </p>
      )}
      {!!groups.length && (
        <Card className="table-wrap projects-panel">
          <Table className="projects-table">
            <thead>
              <tr>
                <th className="col-fit">
                  <span className="sr-only">Important</span>
                </th>
                <th className="col-fit">Project #</th>
                <th>Title</th>
                <th className="col-fit">Status</th>
                <th className="col-fit">Open tasks</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.id} className="project-topic-group">
                <tr className="topic-group-row">
                  <th colSpan={5} scope="rowgroup">
                    <h2 className="topic-group-heading">
                      {group.name}{" "}
                      <span className="count">{group.projects.length}</span>
                    </h2>
                  </th>
                </tr>
                {group.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="col-fit">
                      <button
                        type="button"
                        className={`star-button ${p.important ? "is-on" : ""}`}
                        aria-pressed={!!p.important}
                        aria-label={`${p.important ? "Remove important mark from" : "Mark as important:"} ${p.name}`}
                        title={
                          p.important
                            ? "Remove important mark"
                            : "Mark as important"
                        }
                        disabled={busy}
                        onClick={() =>
                          void onChange({
                            type: "project.save",
                            value: {
                              ...p,
                              important: !p.important,
                              updatedAt: new Date().toISOString(),
                            },
                          })
                        }
                      >
                        <Star size={16} aria-hidden="true" />
                      </button>
                    </td>
                    <td className="col-fit">{projectNumberLabel(p.number)}</td>
                    <td>
                      <button
                        className="project-title"
                        onClick={() => onProject(p.id)}
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="col-fit">
                      <StatusLabel data-status={p.status}>
                        {statusLabel(p.status)}
                      </StatusLabel>
                    </td>
                    <td className="col-fit">
                      {
                        data.todos.filter(
                          (t) => t.projectId === p.id && !t.completed,
                        ).length
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </Table>
        </Card>
      )}
    </>
  );
}
