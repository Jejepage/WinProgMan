import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { findSimilarEvent } from "../../domain/outlookImport";
import { formatDate } from "../../domain/queries";
import type { ProjectEvent } from "../../domain/types";
import { openNewItem } from "../../ui/itemNavigation";
import { outlookEventPrefill } from "./outlookDraft";
import { storePrefill } from "./pendingPrefill";
import { readOutlookItem } from "./readOutlookItem";
import "./outlook.css";

const carriesFiles = (event: DragEvent) =>
  Array.from(event.dataTransfer.types).includes("Files");

/**
 * Accepts an Outlook mail or calendar item dropped onto a project and opens
 * the new-event editor prefilled with it. Nothing is saved before Save.
 */
export function OutlookDropZone({
  projectId,
  events,
  today,
  busy,
  children,
}: {
  projectId: string;
  events: ProjectEvent[];
  today: string;
  busy: boolean;
  children: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  // dragenter/dragleave also fire for every child element.
  const depth = useRef(0);

  function enter(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current += 1;
    setOver(true);
  }
  function hover(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = busy || reading ? "none" : "copy";
  }
  function leave(event: DragEvent) {
    if (!carriesFiles(event)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (!depth.current) setOver(false);
  }
  async function drop(event: DragEvent) {
    if (!carriesFiles(event)) return;
    event.preventDefault();
    depth.current = 0;
    setOver(false);
    const files = Array.from(event.dataTransfer.files);
    if (busy || reading || !files.length) return;
    setError("");
    setReading(true);
    try {
      const item = await readOutlookItem(files[0]);
      const prefill = outlookEventPrefill(item, projectId, today);
      const similar = findSimilarEvent(
        events,
        projectId,
        prefill.title,
        prefill.date,
      );
      if (similar)
        prefill.notices.push(
          `This project already has an event “${similar.title}” on ${formatDate(similar.date)}.`,
        );
      if (files.length > 1)
        prefill.notices.push(
          `Only the first of ${files.length} dropped items was taken. Drop items one at a time.`,
        );
      openNewItem("event", projectId, false, storePrefill(prefill));
    } catch (e) {
      setError(
        e instanceof Error && e.message === "This is not an Outlook item."
          ? "Only Outlook mails and calendar items can be dropped here."
          : "The Outlook item could not be read.",
      );
    } finally {
      setReading(false);
    }
  }

  return (
    <div
      className={`outlook-drop-zone${over ? " is-over" : ""}`}
      onDragEnter={enter}
      onDragOver={hover}
      onDragLeave={leave}
      onDrop={drop}
    >
      {(reading || error) && (
        <div
          className={`message${error ? " error" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>{error || "Reading Outlook item …"}</span>
          {error && (
            <button
              className="icon-button"
              aria-label="Dismiss"
              onClick={() => setError("")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      {children}
      {over && (
        <div className="outlook-drop-overlay" aria-hidden="true">
          <span>Drop to create an event from Outlook</span>
        </div>
      )}
    </div>
  );
}
