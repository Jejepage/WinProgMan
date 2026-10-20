import type { ProjectEvent } from "./types";

/**
 * Recurrence of an Outlook series as stored in PidLidAppointmentRecur
 * ([MS-OXOCAL] 2.2.1.44). Dates are minutes since 01.01.1601 at local midnight
 * of the series time zone, which is treated as the local time zone here.
 */
export interface OutlookRecurrence {
  patternType: number;
  period: number;
  firstDOW: number;
  dayOfWeekBits?: number;
  dayOfMonth?: number;
  nth?: number;
  startDate: number;
  endDate: number;
  /** Minutes after local midnight. */
  startTimeOffset: number;
  endTimeOffset: number;
  /** Original dates of deleted and moved occurrences. */
  deletedInstanceDates: number[];
  /** Moved occurrences with their new local start and end (minutes since 1601). */
  exceptions: { startDateTime: number; endDateTime: number }[];
}

export interface OutlookPerson {
  name: string;
  email: string;
}

/** The parts of a dropped Outlook item that WinProgMan uses. */
export interface OutlookItem {
  kind: "mail" | "appointment";
  subject: string;
  sender?: OutlookPerson;
  to: OutlookPerson[];
  cc: OutlookPerson[];
  /** UTC timestamps (ISO 8601). */
  received?: string;
  start?: string;
  end?: string;
  location?: string;
  body?: string;
  recurrence?: OutlookRecurrence;
}

export interface OutlookSchedule {
  date: string;
  /** HH:mm, empty for all-day appointments and mails without a time. */
  time: string;
  allDay: boolean;
  /** Last day and end time of an appointment, if known. */
  endDate?: string;
  endTime?: string;
  /**
   * A dropped series occurrence carries only the series, not the dragged date:
   * "next" = proposed next occurrence from today, "start" = series start.
   */
  seriesDate?: "next" | "start";
}

const DAY_MINUTES = 1440;
const EPOCH_1601 = Date.UTC(1601, 0, 1);
const pad2 = (value: number) => String(value).padStart(2, "0");

function isoFromDay(day: number): string {
  return new Date(EPOCH_1601 + day * 86400000).toISOString().slice(0, 10);
}
function dayFromIso(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.round((Date.UTC(year, month - 1, day) - EPOCH_1601) / 86400000);
}
const weekday = (day: number) =>
  new Date(EPOCH_1601 + day * 86400000).getUTCDay();
const minutesToTime = (minutes: number) =>
  `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`;

function localParts(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    time: `${pad2(date.getHours())}:${pad2(date.getMinutes())}`,
  };
}

/** Whether a series has an occurrence on the given day, ignoring exceptions. */
function patternMatches(recurrence: OutlookRecurrence, day: number): boolean {
  const start = Math.floor(recurrence.startDate / DAY_MINUTES);
  if (day < start) return false;
  const period = Math.max(1, recurrence.period);
  const date = new Date(EPOCH_1601 + day * 86400000);
  const first = new Date(EPOCH_1601 + start * 86400000);
  const months =
    (date.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    date.getUTCMonth() -
    first.getUTCMonth();
  const daysInMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  switch (recurrence.patternType) {
    case 0: // Daily: the period is given in minutes.
      return (
        (day - start) % Math.max(1, Math.round(period / DAY_MINUTES)) === 0
      );
    case 1: {
      // Weekly: weeks are counted from the week containing the series start.
      const weekStart = (value: number) =>
        value - ((weekday(value) - recurrence.firstDOW + 7) % 7);
      const weeks = (weekStart(day) - weekStart(start)) / 7;
      return (
        weeks % period === 0 &&
        Boolean((recurrence.dayOfWeekBits ?? 0) & (1 << weekday(day)))
      );
    }
    case 2: // Monthly on a day; days beyond the month end fall on its last day.
      return (
        months % period === 0 &&
        date.getUTCDate() === Math.min(recurrence.dayOfMonth ?? 0, daysInMonth)
      );
    case 4: // Last day of the month.
      return months % period === 0 && date.getUTCDate() === daysInMonth;
    case 3: {
      // Nth matching weekday of the month (n = 5 means the last one).
      if (months % period !== 0) return false;
      const bits = recurrence.dayOfWeekBits ?? 0;
      const firstOfMonth = day - date.getUTCDate() + 1;
      const matching: number[] = [];
      for (let offset = 0; offset < daysInMonth; offset += 1)
        if (bits & (1 << weekday(firstOfMonth + offset)))
          matching.push(firstOfMonth + offset);
      const nth = recurrence.nth ?? 1;
      return day === (nth >= 5 ? matching.at(-1) : matching[nth - 1]);
    }
    default:
      // Hijri calendar patterns are not supported.
      return false;
  }
}

/** Supported patterns; others fall back to the series start. */
const supported = (recurrence: OutlookRecurrence) =>
  [0, 1, 2, 3, 4].includes(recurrence.patternType);

/**
 * First occurrence on or after today (an occurrence later today still counts),
 * including moved occurrences. Null if the series has ended or is unsupported.
 */
export function nextOccurrence(
  recurrence: OutlookRecurrence,
  today: string,
): { day: number; start: number; end: number } | null {
  if (!supported(recurrence)) return null;
  const todayDay = dayFromIso(today);
  const deleted = new Set(
    recurrence.deletedInstanceDates.map((value) =>
      Math.floor(value / DAY_MINUTES),
    ),
  );
  const duration = Math.max(
    0,
    recurrence.endTimeOffset - recurrence.startTimeOffset,
  );
  let regular: { day: number; start: number; end: number } | null = null;
  const from = Math.max(
    todayDay,
    Math.floor(recurrence.startDate / DAY_MINUTES),
  );
  const until = Math.min(
    Math.floor(recurrence.endDate / DAY_MINUTES),
    // Series without end: five years are enough to find the next occurrence.
    todayDay + 5 * 366,
  );
  for (let day = from; day <= until; day += 1) {
    if (!deleted.has(day) && patternMatches(recurrence, day)) {
      const start = day * DAY_MINUTES + recurrence.startTimeOffset;
      regular = { day, start, end: start + duration };
      break;
    }
  }
  const moved = recurrence.exceptions
    .filter(
      (exception) =>
        Math.floor(exception.startDateTime / DAY_MINUTES) >= todayDay,
    )
    .map((exception) => ({
      day: Math.floor(exception.startDateTime / DAY_MINUTES),
      start: exception.startDateTime,
      end: exception.endDateTime,
    }))
    .sort((a, b) => a.start - b.start)[0];
  if (regular && moved) return moved.start < regular.start ? moved : regular;
  return regular ?? moved ?? null;
}

/** Date and time WinProgMan proposes for a dropped Outlook item. */
export function outlookSchedule(
  item: OutlookItem,
  today: string,
): OutlookSchedule {
  if (item.kind === "mail") {
    const received = item.received ? localParts(item.received) : null;
    return received
      ? { date: received.date, time: received.time, allDay: false }
      : { date: today, time: "", allDay: false };
  }
  const recurrence = item.recurrence;
  if (recurrence) {
    const allDay =
      recurrence.startTimeOffset === 0 &&
      recurrence.endTimeOffset > 0 &&
      recurrence.endTimeOffset % DAY_MINUTES === 0;
    const next = nextOccurrence(recurrence, today);
    if (next) {
      const lastMinute = allDay ? next.end - DAY_MINUTES : next.end;
      return {
        date: isoFromDay(next.day),
        time: allDay ? "" : minutesToTime(next.start % DAY_MINUTES),
        allDay,
        endDate: isoFromDay(Math.floor(lastMinute / DAY_MINUTES)),
        ...(allDay ? {} : { endTime: minutesToTime(next.end % DAY_MINUTES) }),
        seriesDate: "next",
      };
    }
  }
  const start = item.start ? localParts(item.start) : null;
  const end = item.end ? localParts(item.end) : null;
  if (!start)
    return {
      date: today,
      time: "",
      allDay: false,
      ...(recurrence ? { seriesDate: "start" as const } : {}),
    };
  // All-day appointments run from local midnight to a later local midnight.
  const allDay =
    start.time === "00:00" && end?.time === "00:00" && end.date > start.date;
  const lastDay =
    allDay && end
      ? isoFromDay(dayFromIso(end.date) - 1)
      : (end?.date ?? start.date);
  return {
    date: start.date,
    time: allDay ? "" : start.time,
    allDay,
    endDate: lastDay,
    ...(!allDay && end ? { endTime: end.time } : {}),
    ...(recurrence ? { seriesDate: "start" as const } : {}),
  };
}

/** An existing event of the project that looks like the dropped item. */
export function findSimilarEvent(
  events: ProjectEvent[],
  projectId: string,
  title: string,
  date: string,
): ProjectEvent | undefined {
  const key = title.trim().toLocaleLowerCase();
  return events.find(
    (event) =>
      event.projectId === projectId &&
      event.category !== "Notiz" &&
      event.date === date &&
      event.title.trim().toLocaleLowerCase() === key,
  );
}
