import type {
  OutlookItem,
  OutlookPerson,
  OutlookRecurrence,
} from "../../domain/outlookImport";

/** OLE compound file signature: Outlook drags items as virtual .msg files. */
const MSG_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export const isMsgFile = (bytes: Uint8Array) =>
  MSG_SIGNATURE.every((value, index) => bytes[index] === value);

/** The msgreader fields used here (see FieldsData in @kenjiuno/msgreader). */
export interface MsgFields {
  messageClass?: string;
  subject?: string;
  senderName?: string;
  senderEmail?: string;
  senderSmtpAddress?: string;
  sentRepresentingSmtpAddress?: string;
  messageDeliveryTime?: string;
  clientSubmitTime?: string;
  apptStartWhole?: string;
  apptEndWhole?: string;
  apptLocation?: string;
  body?: string;
  recipients?: {
    name?: string;
    email?: string;
    smtpAddress?: string;
    recipType?: "to" | "cc" | "bcc";
  }[];
  apptRecur?: {
    recurrencePattern: {
      patternType: number;
      period: number;
      firstDOW: number;
      patternTypeWeek?: { dayOfWeekBits: number };
      patternTypeMonth?: { day: number };
      patternTypeMonthNth?: { dayOfWeekBits: number; n: number };
      deletedInstanceDates: number[];
      startDate: number;
      endDate: number;
    };
    startTimeOffset: number;
    endTimeOffset: number;
    exceptionInfo?: { startDateTime: number; endDateTime: number }[];
  };
}

const iso = (value?: string) => {
  const time = value ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};
// Exchange-internal addresses (/o=…/cn=…) are not useful to a reader.
const mailAddress = (...values: (string | undefined)[]) =>
  values.find((value) => value?.includes("@"))?.trim() ?? "";

function recurrence(
  value: MsgFields["apptRecur"],
): OutlookRecurrence | undefined {
  if (!value) return undefined;
  const pattern = value.recurrencePattern;
  return {
    patternType: pattern.patternType,
    period: pattern.period,
    firstDOW: pattern.firstDOW,
    dayOfWeekBits:
      pattern.patternTypeWeek?.dayOfWeekBits ??
      pattern.patternTypeMonthNth?.dayOfWeekBits,
    dayOfMonth: pattern.patternTypeMonth?.day,
    nth: pattern.patternTypeMonthNth?.n,
    startDate: pattern.startDate,
    endDate: pattern.endDate,
    startTimeOffset: value.startTimeOffset,
    endTimeOffset: value.endTimeOffset,
    deletedInstanceDates: pattern.deletedInstanceDates ?? [],
    exceptions: (value.exceptionInfo ?? []).map((exception) => ({
      startDateTime: exception.startDateTime,
      endDateTime: exception.endDateTime,
    })),
  };
}

/** Maps msgreader output to the item model of the domain. */
export function outlookItemFromFields(fields: MsgFields): OutlookItem {
  const messageClass = (fields.messageClass ?? "").toLowerCase();
  const appointment =
    Boolean(fields.apptStartWhole) &&
    (messageClass.startsWith("ipm.appointment") ||
      messageClass.startsWith("ipm.schedule.meeting.request") ||
      messageClass.startsWith("ipm.schedule.meeting.canceled"));
  const people = (type: "to" | "cc"): OutlookPerson[] =>
    (fields.recipients ?? [])
      .filter((recipient) => (recipient.recipType ?? "to") === type)
      .map((recipient) => ({
        name: recipient.name?.trim() ?? "",
        email: mailAddress(recipient.smtpAddress, recipient.email),
      }))
      .filter((person) => person.name || person.email);
  const senderEmail = mailAddress(
    fields.senderSmtpAddress,
    fields.sentRepresentingSmtpAddress,
    fields.senderEmail,
  );
  const senderName = fields.senderName?.trim() ?? "";
  return {
    kind: appointment ? "appointment" : "mail",
    subject: fields.subject?.trim() ?? "",
    ...(senderName || senderEmail
      ? { sender: { name: senderName, email: senderEmail } }
      : {}),
    to: people("to"),
    cc: people("cc"),
    received: iso(fields.messageDeliveryTime) ?? iso(fields.clientSubmitTime),
    ...(appointment
      ? {
          start: iso(fields.apptStartWhole),
          end: iso(fields.apptEndWhole),
          location: fields.apptLocation?.trim() || undefined,
          recurrence: recurrence(fields.apptRecur),
        }
      : {}),
    body: fields.body,
  };
}

/** Reads a dropped .msg file. Throws for other files. */
export async function readOutlookItem(file: Blob): Promise<OutlookItem> {
  const buffer = await file.arrayBuffer();
  if (!isMsgFile(new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength))))
    throw new Error("This is not an Outlook item.");
  // Loaded on demand: the reader is only needed when something is dropped.
  const module = await import("@kenjiuno/msgreader");
  // CommonJS interop differs between dev server and build: the class is either
  // the default export or nested once more under it.
  const nested = module.default as unknown as {
    default?: typeof module.default;
  };
  const MsgReader = nested.default ?? module.default;
  const fields = new MsgReader(buffer).getFileData() as MsgFields & {
    error?: string;
  };
  if (fields.error) throw new Error("The Outlook item could not be read.");
  return outlookItemFromFields(fields);
}
