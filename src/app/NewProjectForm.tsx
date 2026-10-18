import { Button, Field } from "../ui/components";
import {
  projectStatuses,
  type ProjectCategory,
  type ProjectStatus,
} from "../domain/types";
import { statusLabel } from "../ui/labels";

export interface NewProjectDraft {
  name: string;
  status: ProjectStatus;
  categoryId: string;
}

export function NewProjectForm({
  draft,
  onDraft,
  categories,
  busy,
  onSubmit,
  onCancel,
}: {
  draft: NewProjectDraft;
  onDraft: (draft: NewProjectDraft) => void;
  categories: ProjectCategory[];
  busy: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form className="panel project-create" onSubmit={onSubmit}>
      <label className="field">
        Project name
        <Field
          autoFocus
          value={draft.name}
          onChange={(e) => onDraft({ ...draft, name: e.target.value })}
          placeholder="Name your project"
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Project status
          <select
            value={draft.status}
            onChange={(e) =>
              onDraft({ ...draft, status: e.target.value as ProjectStatus })
            }
          >
            {projectStatuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Project topic
          <select
            value={
              categories.some((c) => c.id === draft.categoryId)
                ? draft.categoryId
                : ""
            }
            onChange={(e) => onDraft({ ...draft, categoryId: e.target.value })}
          >
            <option value="">No topic</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <Button disabled={busy}>Create project</Button>
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
