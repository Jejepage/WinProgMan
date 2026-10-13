import { Card, SearchField, Table, StatusLabel } from "../../ui/components";
import { statusLabel } from "../../ui/labels";
import {
  projectStatuses,
  type ProjectStatus,
  type AppData,
  type Project,
} from "../../domain/types";
export function ProjectList({
  data,
  filteredProjects,
  selectedStatuses,
  toggleStatus,
  effectiveCategoryFilter,
  setCategoryFilter,
  projectSearch,
  setProjectSearch,
  goProject,
}: {
  data: AppData;
  filteredProjects: Project[];
  selectedStatuses: Set<ProjectStatus>;
  toggleStatus: (status: ProjectStatus) => void;
  effectiveCategoryFilter: string;
  setCategoryFilter: (value: string) => void;
  projectSearch: string;
  setProjectSearch: (value: string) => void;
  goProject: (id: string) => void;
}) {
  return (
    <>
      <div className="panel form-grid project-filters">
        <fieldset className="status-filter">
          <legend>Show statuses</legend>
          <div>
            {projectStatuses.map((value) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={selectedStatuses.has(value)}
                  onChange={() => toggleStatus(value)}
                />
                {statusLabel(value)}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          Filter topic
          <select
            value={effectiveCategoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
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
          value={projectSearch}
          onChange={setProjectSearch}
        />
      </div>
      {!filteredProjects.length && !!data.projects.length && (
        <p className="panel empty">
          No projects match the current search or filters.
        </p>
      )}
      <Card className="table-wrap">
        <Table>
          <thead>
            <tr>
              <th>Project #</th>
              <th>Title</th>
              <th>Topic</th>
              <th>Status</th>
              <th>Open tasks</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((p) => (
              <tr key={p.id}>
                <td>
                  PRJ-
                  {String(p.projectNumber).padStart(3, "0")}
                </td>
                <td>
                  <button
                    className="project-title"
                    onClick={() => goProject(p.id)}
                  >
                    {p.name}
                  </button>
                </td>
                <td>
                  {data.projectCategories.find((c) => c.id === p.categoryId)
                    ?.name || "No topic"}
                </td>
                <td>
                  <StatusLabel>{statusLabel(p.status)}</StatusLabel>
                </td>
                <td>
                  {
                    data.todos.filter(
                      (t) => t.projectId === p.id && !t.completed,
                    ).length
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
