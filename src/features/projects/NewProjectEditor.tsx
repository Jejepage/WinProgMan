import { useRef, useState } from "react";
import {
  AUTO_PROJECT_NUMBER,
  metadata,
  projectStatuses,
  type DomainChange,
  type Project,
  type ProjectCategory,
  type ProjectStatus,
} from "../../domain/types";
import { ownerNames } from "../../domain/queries";
import { canonicalOwner } from "../../domain/projectFields";
import { statusLabel } from "../../ui/labels";
import { useEditorShortcuts } from "../../ui/useEditorShortcuts";
import { OwnerSelect } from "./OwnerSelect";

/**
 * Full-page editor for a new project, like New task/New event. Nothing is
 * stored before Save; links are added on the project page afterwards.
 */
export function NewProjectEditor({
  projects,
  categories,
  busy,
  onChange,
  onCreated,
  onCancel,
}: {
  projects: Project[];
  categories: ProjectCategory[];
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("Aktiv");
  const [categoryId, setCategoryId] = useState("");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  useEditorShortcuts(form, {
    isDirty: () =>
      !!(
        name.trim() ||
        description.trim() ||
        owner.trim() ||
        categoryId ||
        startDate ||
        endDate
      ) || status !== "Aktiv",
    onCancel,
  });
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value: Project = {
      ...metadata(),
      number: AUTO_PROJECT_NUMBER,
      name: name.trim() || "New project",
      description,
      status,
    };
    if (categories.some((category) => category.id === categoryId))
      value.categoryId = categoryId;
    // Reuse the spelling of a known name so the owner list stays free of duplicates.
    const ownerName = canonicalOwner(projects, owner);
    if (ownerName) value.owner = ownerName;
    if (startDate) value.startDate = startDate;
    if (endDate) value.endDate = endDate;
    if (await onChange({ type: "project.save", value })) onCreated(value.id);
  }
  return (
    <form ref={form} className="panel editor project-create" onSubmit={save}>
      <label className="field">
        Project name
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name your project"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Project status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          >
            {projectStatuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Project topic
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">No topic</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          Owner
          <OwnerSelect
            value={owner}
            names={ownerNames(projects)}
            onChange={setOwner}
          />
        </div>
        <label className="field">
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="field">
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
      </div>
      <label className="field">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </label>
      <p className="muted">
        The project number is assigned automatically. Add links on the project
        page after saving.
      </p>
      <div className="actions">
        <button className="button" disabled={busy}>
          Create project
        </button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
