import {
  outlookSchedule,
  type OutlookItem,
  type OutlookPerson,
} from "../../domain/outlookImport";
import { formatDate } from "../../domain/queries";
import type { Category } from "../../domain/types";
import { legacyNoteToMarkdown } from "../events/markdown";

/** Prefilled values for the new-event editor, created from a dropped item. */
export interface EventPrefill {
  projectId: string;
  category: Category;
  title: string;
  date: string;
  time: string;
  note: string;
  /** Hints shown above the editor; not saved. */
  notices: string[];
}

/** Longer bodies are cut so the editor stays responsive. */
export const MAX_BODY_LENGTH = 50000;

const person = ({ name, email }: OutlookPerson) =>
  name && email && name !== email ? `${name} (${email})` : name || email;
const people = (list: OutlookPerson[]) => list.map(person).join("; ");

/** Plain-text Outlook body as Markdown, using the legacy plain-text escaping. */
function bodyMarkdown(body: string): string {
  let text = body
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const cut = text.length > MAX_BODY_LENGTH;
  if (cut) text = text.slice(0, MAX_BODY_LENGTH);
  return legacyNoteToMarkdown(text) + (cut ? "\n\n*… (text shortened)*" : "");
}

export function outlookEventPrefill(
  item: OutlookItem,
  projectId: string,
  today: string,
): EventPrefill {
  const schedule = outlookSchedule(item, today);
  const facts: [string, string][] = [];
  if (item.kind === "mail") {
    if (item.sender) facts.push(["From", person(item.sender)]);
    if (item.to.length) facts.push(["To", people(item.to)]);
    if (item.cc.length) facts.push(["Cc", people(item.cc)]);
    if (schedule.time)
      facts.push(["Received", `${formatDate(schedule.date)} ${schedule.time}`]);
  } else {
    const sameDay = !schedule.endDate || schedule.endDate === schedule.date;
    const when = schedule.allDay
      ? sameDay
        ? `${formatDate(schedule.date)} (all day)`
        : `${formatDate(schedule.date)} – ${formatDate(schedule.endDate!)} (all day)`
      : sameDay
        ? `${formatDate(schedule.date)} ${schedule.time}${schedule.endTime ? `–${schedule.endTime}` : ""}`
        : `${formatDate(schedule.date)} ${schedule.time} – ${formatDate(schedule.endDate!)} ${schedule.endTime ?? ""}`.trim();
    facts.push(["When", when]);
    if (item.location) facts.push(["Location", item.location]);
    if (item.sender) facts.push(["Organizer", person(item.sender)]);
    const attendees = [...item.to, ...item.cc];
    if (attendees.length) facts.push(["Attendees", people(attendees)]);
    if (item.recurrence) facts.push(["Series", "recurring appointment"]);
  }
  const list = facts
    .map(([label, value]) => `- **${label}:** ${legacyNoteToMarkdown(value)}`)
    .join("\n");
  const body = item.body?.trim() ? bodyMarkdown(item.body) : "";
  const notices: string[] = [];
  if (schedule.seriesDate === "next")
    notices.push(
      "Recurring appointment: Outlook does not say which occurrence was dragged. The date is set to the next occurrence from today – please check it.",
    );
  else if (schedule.seriesDate === "start")
    notices.push(
      "Recurring appointment: no upcoming occurrence was found. The date is the start of the series – please check it.",
    );
  return {
    projectId,
    category: item.kind === "mail" ? "Mail" : "Meeting",
    title: item.subject,
    date: schedule.date,
    time: schedule.time,
    note: [list, body].filter(Boolean).join("\n\n---\n\n"),
    notices,
  };
}
