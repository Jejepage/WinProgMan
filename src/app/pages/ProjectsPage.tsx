import { useEffect, useState } from "react";
import { FileText, Star } from "lucide-react";
import { TodosPanel } from "../../features/todos/TodosPanel";
import type { PanelShared } from "../types";
import { Card, SearchField, Table } from "../../ui/components";
import {
  OwnerQuickSelect,
  StatusQuickSelect,
} from "../../features/projects/QuickFields";
import type { QuickProjectFields } from "../../domain/projectFields";
import { QuickDateField } from "../../ui/QuickDateField";
import { groupProjects, ownerNames } from "../../domain/queries";
import {
  projectStatuses,
  type AppData,
  type DomainChange,
  type Project,
  type ProjectStatus,
} from "../../domain/types";
import { projectNumberLabel, statusLabel } from "../../ui/labels";

const selectedKey = "winprogman-selected-project";
const datesKey = "winprogman-project-dates";

function readShowDates(): boolean {
  try {
    return localStorage.getItem(datesKey) === "show";
  } catch {
    return false;
  }
}

function readSelected(): string {
  try {
    return localStorage.getItem(selectedKey) || "";
  } catch {
    return "";
  }
}

export function ProjectsPage({
  data,
  selectedStatuses,
  onToggleStatus,
  categoryFilter,
  onCategoryFilter,
  ownerFilter,
  onOwnerFilter,
  search,
  onSearch,
  projects,
  onProject,
  onProjectFields,
  importantOnly,
  onImportantOnly,
  onChange,
  onReport,
  busy,
  panel,
}: {
  data: AppData;
  selectedStatuses: Set<ProjectStatus>;
  onToggleStatus: (status: ProjectStatus) => void;
  /** Already reduced to an existing topic id, "none" or "". */
  categoryFilter: string;
  onCategoryFilter: (value: string) => void;
  /** Already reduced to an existing owner name, "none" or "". */
  ownerFilter: string;
  onOwnerFilter: (value: string) => void;
  search: string;
  onSearch: (value: string) => void;
  /** Projects after status, topic and text filters. */
  projects: AppData["projects"];
  onProject: (id: string) => void;
  /** Status/owner chosen directly in the list. */
  onProjectFields: (project: Project, fields: QuickProjectFields) => void;
  importantOnly: boolean;
  onImportantOnly: (value: boolean) => void;
  onChange: (change: DomainChange) => Promise<boolean>;
  /** Creates a Markdown report of `projects`. */
  onReport: () => void;
  busy: boolean;
  /** Shared task panel props for the tasks of the selected project. */
  panel: PanelShared;
}) {
  const groups = groupProjects(projects, data.projectCategories);
  const owners = ownerNames(data.projects);
  const [showDates, setShowDates] = useState(readShowDates);
  useEffect(() => {
    try {
      localStorage.setItem(datesKey, showDates ? "show" : "hide");
    } catch {
      /* Session only. */
    }
  }, [showDates]);
  const columns = showDates ? 8 : 6;
  const [selectedId, setSelectedId] = useState(readSelected);
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem(selectedKey, selectedId);
    } catch {
      /* Session only. */
    }
  }, [selectedId]);
  // The last chosen project stays selected; otherwise the first one shown.
  const visible = groups.flatMap((group) => group.projects);
  const selected =
    visible.find((p) => p.id === selectedId) ?? visible[0] ?? undefined;
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
        <label className="field">
          <span className="sr-only">Filter owner</span>
          <select
            value={ownerFilter}
            onChange={(e) => onOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            <option value="none">Not assigned</option>
            {ownerNames(data.projects).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="dates-toggle" title="Show start and end dates">
          <input
            type="checkbox"
            checked={showDates}
            onChange={(e) => setShowDates(e.target.checked)}
          />
          Dates
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
        <div className="projects-split">
          <Card className="table-wrap projects-panel">
            <Table className="projects-table">
              <thead>
                <tr>
                  <th className="col-fit">
                    <span className="sr-only">Important</span>
                  </th>
                  <th className="col-fit">Project #</th>
                  <th>Title</th>
                  <th className="col-fit">Owner</th>
                  <th className="col-fit">Status</th>
                  {showDates && (
                    <>
                      <th className="col-fit">Start</th>
                      <th className="col-fit">End</th>
                    </>
                  )}
                  <th className="col-fit">Open tasks</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.id} className="project-topic-group">
                  <tr className="topic-group-row">
                    <th colSpan={columns} scope="rowgroup">
                      <h2 className="topic-group-heading">
                        {group.name}{" "}
                        <span className="count">{group.projects.length}</span>
                      </h2>
                    </th>
                  </tr>
                  {group.projects.map((p) => (
                    <tr
                      key={p.id}
                      className={
                        selected?.id === p.id ? "is-selected" : undefined
                      }
                      aria-selected={selected?.id === p.id}
                      tabIndex={0}
                      title="Show the tasks of this project"
                      onClick={() => setSelectedId(p.id)}
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === "Enter" || event.key === " ")
                        ) {
                          event.preventDefault();
                          setSelectedId(p.id);
                        }
                      }}
                    >
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
                      <td className="col-fit">
                        {projectNumberLabel(p.number)}
                      </td>
                      <td>
                        <button
                          className="project-title"
                          onClick={() => onProject(p.id)}
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="col-fit project-owner-cell">
                        <OwnerQuickSelect
                          value={p.owner || ""}
                          names={owners}
                          projectName={p.name}
                          disabled={busy}
                          onSelect={(owner) => onProjectFields(p, { owner })}
                        />
                      </td>
                      <td className="col-fit">
                        <StatusQuickSelect
                          value={p.status}
                          projectName={p.name}
                          disabled={busy}
                          onSelect={(status) => onProjectFields(p, { status })}
                        />
                      </td>
                      {showDates && (
                        <>
                          <td className="col-fit">
                            <QuickDateField
                              value={p.startDate}
                              label={`Start date of ${p.name}`}
                              emptyTitle="Set start date"
                              disabled={busy}
                              onSelect={(startDate) =>
                                onProjectFields(p, { startDate })
                              }
                            />
                          </td>
                          <td className="col-fit">
                            <QuickDateField
                              value={p.endDate}
                              label={`End date of ${p.name}`}
                              emptyTitle="Set end date"
                              disabled={busy}
                              onSelect={(endDate) =>
                                onProjectFields(p, { endDate })
                              }
                            />
                          </td>
                        </>
                      )}
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
          {selected && (
            <div className="projects-side-tasks">
              <TodosPanel
                key={`side-${selected.id}`}
                {...panel}
                projectId={selected.id}
                heading={
                  <button
                    type="button"
                    className="project-title"
                    title="Open project"
                    onClick={() => onProject(selected.id)}
                  >
                    {selected.name} <span>↗</span>
                  </button>
                }
                todos={data.todos.filter((t) => t.projectId === selected.id)}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
