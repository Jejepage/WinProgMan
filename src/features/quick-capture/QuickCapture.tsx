import { useRef, useState, type FormEvent } from "react";
import {
  categories,
  metadata,
  type AppData,
  type Category,
  type DomainChange,
} from "../../domain/types";
import { parseCaptureDate, projectReference } from "../../domain/workflows";
import { categoryLabel } from "../../ui/labels";
import { Dialog } from "../../ui/dialogs";

const lastProjectKey = "winprogman.quick-capture.project";
function initialProject(data: AppData, projectId?: string): string {
  let previous: string | null = null;
  try {
    previous = localStorage.getItem(lastProjectKey);
  } catch {
    /* Preferences are optional. */
  }
  return (
    [projectId, previous, data.projects[0]?.id].find((id) =>
      data.projects.some((project) => project.id === id),
    ) || ""
  );
}

export function QuickCapture({
  data,
  projectId,
  today,
  busy,
  onChange,
  onClose,
}: {
  data: AppData;
  projectId?: string;
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<"Task" | "Event" | "Note">("Task");
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(() => initialProject(data, projectId));
  const [taskDate, setTaskDate] = useState("");
  const [eventDate, setEventDate] = useState("today");
  const [time, setTime] = useState("");
  const [category, setCategory] = useState<Category>("Meeting");
  const [note, setNote] = useState("");
  const [doNext, setDoNext] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || saving.current) return;
    if (!data.projects.some((project) => project.id === owner)) {
      setError("Choose an existing project before saving.");
      return;
    }
    const rawDate = kind === "Task" ? taskDate : eventDate;
    const date =
      kind === "Note"
        ? today
        : rawDate.trim()
          ? parseCaptureDate(rawDate, today)
          : kind === "Event"
            ? today
            : undefined;
    if (date === null) {
      setError("Enter today, tomorrow or a valid date in YYYY-MM-DD format.");
      return;
    }
    setError("");
    const base = {
      ...metadata(),
      projectId: owner,
      title: title.trim() || `New ${kind.toLowerCase()}`,
    };
    const change: DomainChange =
      kind === "Task"
        ? {
            type: "todo.save",
            value: {
              ...base,
              completed: false,
              ...(date ? { dueDate: date } : {}),
              ...(doNext ? { doNext: true } : {}),
            },
          }
        : {
            type: "event.save",
            value: {
              ...base,
              category: kind === "Note" ? "Notiz" : category,
              date: date || today,
              ...(kind === "Event" && time ? { time } : {}),
              ...(note ? { note, noteFormat: "markdown" as const } : {}),
            },
          };
    saving.current = true;
    try {
      if (await onChange(change)) {
        try {
          localStorage.setItem(lastProjectKey, owner);
        } catch {
          /* Saving the record does not require preferences. */
        }
        onClose();
      }
    } finally {
      saving.current = false;
    }
  }
  return (
    <Dialog title="Quick capture" onClose={onClose}>
      <form className="capture-form" onSubmit={save}>
        <label className="field">
          Title
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Capture your next thought…"
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Type
            <select
              value={kind}
              onChange={(event) => {
                setKind(event.target.value as typeof kind);
                setError("");
              }}
            >
              <option>Task</option>
              <option>Event</option>
              <option>Note</option>
            </select>
          </label>
          <label className="field">
            Project
            <select
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            >
              {!data.projects.length && (
                <option value="">Create a project first</option>
              )}
              {data.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {projectReference(project)}
                </option>
              ))}
            </select>
          </label>
          {kind !== "Note" && (
            <label className="field">
              {kind === "Task" ? "Due date (optional)" : "Date"}
              <input
                value={kind === "Task" ? taskDate : eventDate}
                placeholder="today, tomorrow, YYYY-MM-DD"
                onChange={(event) =>
                  kind === "Task"
                    ? setTaskDate(event.target.value)
                    : setEventDate(event.target.value)
                }
              />
            </label>
          )}
          {kind === "Task" && (
            <label className="do-next-control">
              <input
                type="checkbox"
                checked={doNext}
                onChange={(event) => setDoNext(event.target.checked)}
              />{" "}
              Do next
            </label>
          )}
          {kind === "Event" && (
            <>
              <label className="field">
                Category
                <select
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as Category)
                  }
                >
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Time (optional)
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
            </>
          )}
        </div>
        {kind !== "Task" && (
          <label className="field">
            {kind === "Note" ? "Note text" : "Notes (optional)"}
            <textarea
              rows={5}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Markdown supported"
            />
          </label>
        )}
        {kind === "Note" && <p className="muted">Created on {today}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="button" disabled={busy || !data.projects.length}>
            Save {kind.toLowerCase()}
          </button>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <span className="muted">Ctrl + Enter to save · Esc to close</span>
        </div>
      </form>
    </Dialog>
  );
}
