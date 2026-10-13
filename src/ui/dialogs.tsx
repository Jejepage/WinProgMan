import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Base } from "../domain/types";

export const DialogErrorContext = createContext("");

function ReviewFields({ value }: { value?: Base }) {
  if (!value) return <p>Deleted</p>;
  const labels: Record<string, string> = {
    name: "Name",
    title: "Title",
    description: "Description",
    label: "Label",
    target: "Destination",
    status: "Status",
    category: "Category",
    completed: "Completed",
    doNext: "Do next",
    dueDate: "Due date",
    date: "Date",
    time: "Time",
    note: "Notes",
    projectNumber: "Project number",
  };
  return (
    <dl>
      {Object.entries(value)
        .filter(([key]) => key in labels)
        .map(([key, field]) => (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd>
              {typeof field === "boolean"
                ? field
                  ? "Yes"
                  : "No"
                : String(field || "—")}
            </dd>
          </div>
        ))}
    </dl>
  );
}

/** Native modal semantics provide focus containment and make the background inert. */
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const error = useContext(DialogErrorContext);
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    const field = dialog.querySelector<HTMLElement>(
      "input, select, textarea, [autofocus]",
    );
    field?.focus();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="workspace-dialog"
      aria-labelledby={titleId}
      onKeyDownCapture={(event) => {
        // Search inputs consume Escape to clear themselves; the dialog owns this shortcut.
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.stopPropagation();
          close.current();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      onKeyDown={(event) => {
        if (
          !event.defaultPrevented &&
          (event.ctrlKey || event.metaKey) &&
          event.key === "Enter"
        ) {
          const form = ref.current?.querySelector("form");
          if (form) {
            event.preventDefault();
            form.requestSubmit();
          }
        }
      }}
    >
      <div className="section-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="button secondary"
          onClick={onClose}
          aria-label={`Close ${title}`}
        >
          Close
        </button>
      </div>
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}

export function ConflictNotice({
  original,
  current,
  onReload,
  onOverwrite,
}: {
  original?: Base;
  current?: Base;
  onReload: () => void;
  onOverwrite: () => void;
}) {
  const [review, setReview] = useState(false);
  if (!original || (current && original.revision === current.revision))
    return null;
  return (
    <section className="message conflict-notice" role="alert">
      <p>This item has changed in another window.</p>
      {!current && (
        <p>The item was deleted. Restore it from Trash before editing.</p>
      )}
      <div className="actions">
        <button type="button" className="button secondary" onClick={onReload}>
          Reload latest version
        </button>
        <button
          type="button"
          className="button secondary"
          onClick={() => setReview(!review)}
        >
          Review changes
        </button>
        {current && (
          <button type="button" className="button" onClick={onOverwrite}>
            Overwrite with my version
          </button>
        )}
      </div>
      {review && (
        <div className="conflict-comparison">
          <div>
            <h3>Version when editing began</h3>
            <ReviewFields value={original} />
          </div>
          <div>
            <h3>Latest saved version</h3>
            <ReviewFields value={current} />
          </div>
        </div>
      )}
    </section>
  );
}
