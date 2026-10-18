import { Card, SearchField, StatusLabel, Table } from "../../ui/components";
import { groupProjects } from "../../domain/queries";
import {
  projectStatuses,
  type AppData,
  type ProjectStatus,
} from "../../domain/types";
import { statusLabel } from "../../ui/labels";

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
                <th className="col-fit">Project #</th>
                <th>Title</th>
                <th className="col-fit">Status</th>
                <th className="col-fit">Open tasks</th>
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.id} className="project-topic-group">
                <tr className="topic-group-row">
                  <th colSpan={4} scope="rowgroup">
                    <h2 className="topic-group-heading">
                      {group.name}{" "}
                      <span className="count">{group.projects.length}</span>
                    </h2>
                  </th>
                </tr>
                {group.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="col-fit">
                      PRJ-
                      {String(p.number).padStart(3, "0")}
                    </td>
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
