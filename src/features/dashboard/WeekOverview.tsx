import { useState } from "react";
import type { AppData, DomainChange } from "../../domain/types";
import { formatDate } from "../../domain/queries";
import {
  addCalendarDays,
  agendaItems,
  projectReference,
  type OpenRecord,
  type WeekFilter,
} from "../../domain/workflows";
import { categoryLabel } from "../../ui/labels";
import { Dialog } from "../../ui/dialogs";

export function WeekOverview({
  data,
  today,
  busy,
  onChange,
  onOpen,
}: {
  data: AppData;
  today: string;
  busy: boolean;
  onChange: (change: DomainChange) => Promise<boolean>;
  onOpen: OpenRecord;
}) {
  const [filter, setFilter] = useState<WeekFilter>("week");
  const [expanded, setExpanded] = useState(false);
  const entries = agendaItems(data, today, filter);
  const dates = [...new Set(entries.map((entry) => entry.date))];
  const overdueCount = agendaItems(data, today, "overdue").length;
  const filters: { value: WeekFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "Next 7 Days" },
    { value: "later", label: "Later" },
    {
      value: "overdue",
      label: `Overdue${overdueCount ? ` (${overdueCount})` : ""}`,
    },
  ];
  const content = (
    <>
      <div className="actions" aria-label="Planning filter">
        {filters.map((option) => (
          <button
            key={option.value}
            className={`button ${filter === option.value ? "" : "secondary"}`}
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {!entries.length && (
        <p className="empty">
          {filter === "overdue"
            ? "No overdue tasks."
            : "Nothing scheduled for this period."}
        </p>
      )}
      <div className="agenda-days">
        {dates.map((date) => (
          <section key={date} className="agenda-day" aria-label={date}>
            <h3>
              {date === today
                ? "Today"
                : date === addCalendarDays(today, 1)
                  ? "Tomorrow"
                  : formatDate(date)}
              {date === today || date === addCalendarDays(today, 1) ? (
                <span className="muted"> · {formatDate(date)}</span>
              ) : null}
            </h3>
            {entries
              .filter((entry) => entry.date === date)
              .map((entry) => (
                <div
                  className={`agenda-item ${entry.type === "todo" && date < today ? "overdue" : ""}`}
                  key={`${entry.type}-${entry.id}`}
                >
                  {entry.todo ? (
                    <input
                      type="checkbox"
                      checked={false}
                      disabled={busy}
                      aria-label={`${entry.title} completed`}
                      onChange={() => {
                        if (!entry.todo) return;
                        const value = {
                          ...entry.todo,
                          completed: true,
                          updatedAt: new Date().toISOString(),
                        };
                        delete value.doNext;
                        void onChange({ type: "todo.save", value });
                      }}
                    />
                  ) : (
                    <span className="status-pill">
                      {entry.event
                        ? categoryLabel(entry.event.category)
                        : "Event"}
                    </span>
                  )}
                  <div className="agenda-content">
                    <button
                      className="text-button"
                      onClick={() => {
                        setExpanded(false);
                        onOpen(entry.type, entry.id, entry.project.id);
                      }}
                    >
                      {entry.time && <span>{entry.time} · </span>}
                      {entry.title}
                    </button>
                    <span className="muted">
                      {projectReference(entry.project)}
                      {entry.type === "todo" ? " · Task" : ""}
                      {date < today && entry.type === "todo"
                        ? " · Overdue"
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
          </section>
        ))}
      </div>
    </>
  );
  return (
    <section className="panel week-overview" aria-label="Next 7 Days">
      <div className="section-heading">
        <h2>Next 7 Days</h2>
        <button className="button secondary" onClick={() => setExpanded(true)}>
          Expand overview
        </button>
      </div>
      {expanded ? (
        <Dialog title="Next 7 Days" onClose={() => setExpanded(false)}>
          {content}
        </Dialog>
      ) : (
        content
      )}
    </section>
  );
}
