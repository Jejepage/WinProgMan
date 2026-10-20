import { describe, expect, it } from "vitest";
import {
  findSimilarEvent,
  nextOccurrence,
  outlookSchedule,
  type OutlookItem,
  type OutlookRecurrence,
} from "../src/domain/outlookImport";
import type { ProjectEvent } from "../src/domain/types";
import {
  MAX_BODY_LENGTH,
  outlookEventPrefill,
} from "../src/features/outlook/outlookDraft";
import {
  outlookItemFromFields,
  readOutlookItem,
} from "../src/features/outlook/readOutlookItem";
import { buildMsg } from "./msgFixture";

/** Minutes since 01.01.1601 at midnight of the given day (MS-OXOCAL). */
const day = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return (Date.UTC(y, m - 1, d) - Date.UTC(1601, 0, 1)) / 60000;
};
const NEVER = 1525252321; // [MS-OXOCAL] end date of series without end
const MONDAY = 1 << 1;
const FRIDAY = 1 << 5;

const weekly = (
  overrides: Partial<OutlookRecurrence> = {},
): OutlookRecurrence => ({
  patternType: 1,
  period: 1,
  firstDOW: 1,
  dayOfWeekBits: MONDAY,
  startDate: day("2026-07-06"),
  endDate: day("2026-12-14"),
  startTimeOffset: 570,
  endTimeOffset: 600,
  deletedInstanceDates: [],
  exceptions: [],
  ...overrides,
});
const appointment = (overrides: Partial<OutlookItem> = {}): OutlookItem => ({
  kind: "appointment",
  subject: "Steering",
  to: [],
  cc: [],
  ...overrides,
});
/** Local wall-clock time as UTC ISO, independent of the test time zone. */
const local = (...parts: [number, number, number, number?, number?]) =>
  new Date(
    parts[0],
    parts[1] - 1,
    parts[2],
    parts[3] ?? 0,
    parts[4] ?? 0,
  ).toISOString();

describe("Outlook dates", () => {
  it("uses the local receive time of a mail", () => {
    expect(
      outlookSchedule(
        {
          kind: "mail",
          subject: "",
          to: [],
          cc: [],
          received: local(2026, 10, 15, 10, 44),
        },
        "2026-10-20",
      ),
    ).toEqual({ date: "2026-10-15", time: "10:44", allDay: false });
    expect(
      outlookSchedule(
        { kind: "mail", subject: "", to: [], cc: [] },
        "2026-10-20",
      ),
    ).toEqual({ date: "2026-10-20", time: "", allDay: false });
  });

  it("takes local start and end of a single appointment", () => {
    expect(
      outlookSchedule(
        appointment({
          start: local(2026, 10, 21, 11),
          end: local(2026, 10, 21, 11, 45),
        }),
        "2026-10-20",
      ),
    ).toEqual({
      date: "2026-10-21",
      time: "11:00",
      allDay: false,
      endDate: "2026-10-21",
      endTime: "11:45",
    });
  });

  it("recognises all-day appointments, also over several days", () => {
    expect(
      outlookSchedule(
        appointment({ start: local(2026, 11, 23), end: local(2026, 11, 24) }),
        "2026-10-20",
      ),
    ).toMatchObject({
      date: "2026-11-23",
      time: "",
      allDay: true,
      endDate: "2026-11-23",
    });
    expect(
      outlookSchedule(
        appointment({ start: local(2026, 11, 23), end: local(2026, 11, 30) }),
        "2026-10-20",
      ),
    ).toMatchObject({ allDay: true, endDate: "2026-11-29" });
    // A timed appointment that happens to start at midnight is not all-day.
    expect(
      outlookSchedule(
        appointment({
          start: local(2026, 11, 23),
          end: local(2026, 11, 23, 1),
        }),
        "2026-10-20",
      ),
    ).toMatchObject({ allDay: false, time: "00:00", endTime: "01:00" });
  });
});

describe("Outlook series", () => {
  it("proposes the next weekly occurrence from today, today included", () => {
    expect(
      outlookSchedule(appointment({ recurrence: weekly() }), "2026-10-20"),
    ).toEqual({
      date: "2026-10-26",
      time: "09:30",
      allDay: false,
      endDate: "2026-10-26",
      endTime: "10:00",
      seriesDate: "next",
    });
    expect(nextOccurrence(weekly(), "2026-10-26")?.day).toBe(
      day("2026-10-26") / 1440,
    );
  });

  it("skips deleted occurrences and prefers an earlier moved one", () => {
    const skipped = weekly({ deletedInstanceDates: [day("2026-10-26")] });
    expect(
      outlookSchedule(appointment({ recurrence: skipped }), "2026-10-20").date,
    ).toBe("2026-11-02");
    const moved = weekly({
      deletedInstanceDates: [day("2026-10-26")],
      exceptions: [
        {
          startDateTime: day("2026-10-23") + 14 * 60,
          endDateTime: day("2026-10-23") + 15 * 60,
        },
      ],
    });
    expect(
      outlookSchedule(appointment({ recurrence: moved }), "2026-10-20"),
    ).toMatchObject({
      date: "2026-10-23",
      time: "14:00",
      endTime: "15:00",
    });
  });

  it("counts every second week from the week of the series start", () => {
    // All-day for seven days, every two weeks, starting Monday 08.06.2026:
    // 26.10. is 20 weeks later, 19.10. would be an odd week.
    const biweekly = weekly({
      period: 2,
      startDate: day("2026-06-08"),
      endDate: day("2027-07-01"),
      startTimeOffset: 0,
      endTimeOffset: 7 * 1440,
    });
    expect(
      outlookSchedule(appointment({ recurrence: biweekly }), "2026-10-20"),
    ).toEqual({
      date: "2026-10-26",
      time: "",
      allDay: true,
      endDate: "2026-11-01",
      seriesDate: "next",
    });
  });

  it("supports daily, monthly, month-end, nth weekday and yearly patterns", () => {
    const base = { startDate: day("2026-01-01"), endDate: NEVER };
    const next = (recurrence: Partial<OutlookRecurrence>, today: string) => {
      const found = nextOccurrence(weekly({ ...base, ...recurrence }), today);
      return (
        found &&
        new Date(Date.UTC(1601, 0, 1) + found.day * 86400000)
          .toISOString()
          .slice(0, 10)
      );
    };
    // Every second day from 01.01.
    expect(next({ patternType: 0, period: 2 * 1440 }, "2026-01-04")).toBe(
      "2026-01-05",
    );
    // Day 31 falls on the last day of shorter months.
    expect(next({ patternType: 2, dayOfMonth: 31 }, "2026-02-02")).toBe(
      "2026-02-28",
    );
    // Every third month on the 15th, counted from January.
    expect(
      next({ patternType: 2, period: 3, dayOfMonth: 15 }, "2026-02-01"),
    ).toBe("2026-04-15");
    expect(next({ patternType: 4 }, "2026-04-02")).toBe("2026-04-30");
    // Last Friday of the month.
    expect(
      next({ patternType: 3, dayOfWeekBits: FRIDAY, nth: 5 }, "2026-10-01"),
    ).toBe("2026-10-30");
    // Second Monday of the month.
    expect(
      next({ patternType: 3, dayOfWeekBits: MONDAY, nth: 2 }, "2026-10-13"),
    ).toBe("2026-11-09");
    // Yearly is a monthly pattern with a period of twelve months.
    expect(
      next({ patternType: 2, period: 12, dayOfMonth: 1 }, "2026-01-02"),
    ).toBe("2027-01-01");
  });

  it("falls back to the series start when nothing is upcoming", () => {
    const ended = weekly({ endDate: day("2026-09-28") });
    expect(
      outlookSchedule(
        appointment({
          recurrence: ended,
          start: local(2026, 7, 6, 9, 30),
          end: local(2026, 7, 6, 10),
        }),
        "2026-10-20",
      ),
    ).toMatchObject({ date: "2026-07-06", time: "09:30", seriesDate: "start" });
    const hijri = weekly({ patternType: 10 });
    expect(
      outlookSchedule(appointment({ recurrence: hijri }), "2026-10-20"),
    ).toMatchObject({ date: "2026-10-20", seriesDate: "start" });
  });
});

describe("Reading dropped .msg files", () => {
  it("reads a mail with sender, recipients and text", async () => {
    const bytes = buildMsg({
      messageClass: "IPM.Note",
      subject: "Offer äöü",
      senderName: "Ada Test",
      senderSmtp: "ada@example.test",
      body: "Hello\r\nsecond line",
      delivered: new Date(Date.UTC(2026, 9, 15, 8, 44)),
      recipients: [
        { name: "Bob", email: "bob@example.test", type: "to" },
        { name: "Cy", email: "cy@example.test", type: "cc" },
      ],
    });
    expect(await readOutlookItem(new Blob([bytes]))).toEqual({
      kind: "mail",
      subject: "Offer äöü",
      sender: { name: "Ada Test", email: "ada@example.test" },
      to: [{ name: "Bob", email: "bob@example.test" }],
      cc: [{ name: "Cy", email: "cy@example.test" }],
      received: "2026-10-15T08:44:00.000Z",
      body: "Hello\r\nsecond line",
    });
  });

  it("reads a single appointment", async () => {
    const bytes = buildMsg({
      messageClass: "IPM.Appointment",
      subject: "Workshop",
      start: new Date(Date.UTC(2026, 9, 21, 9)),
      end: new Date(Date.UTC(2026, 9, 21, 9, 45)),
      location: "Room 1",
    });
    expect(await readOutlookItem(new Blob([bytes]))).toMatchObject({
      kind: "appointment",
      subject: "Workshop",
      start: "2026-10-21T09:00:00.000Z",
      end: "2026-10-21T09:45:00.000Z",
      location: "Room 1",
    });
  });

  it("rejects files that are not Outlook items", async () => {
    await expect(readOutlookItem(new Blob(["plain text"]))).rejects.toThrow(
      "This is not an Outlook item.",
    );
  });

  it("maps meeting requests and drops Exchange-internal addresses", () => {
    const fields = {
      messageClass: "IPM.Schedule.Meeting.Request",
      subject: " Kick-off ",
      senderName: "Ada",
      senderEmail: "/o=Org/ou=Exchange/cn=Recipients/cn=ada",
      apptStartWhole: "Wed, 21 Oct 2026 09:00:00 GMT",
      recipients: [{ name: "Bob", email: "/o=Org/cn=bob" }],
    };
    expect(outlookItemFromFields(fields)).toMatchObject({
      kind: "appointment",
      subject: "Kick-off",
      sender: { name: "Ada", email: "" },
      to: [{ name: "Bob", email: "" }],
    });
    // Meeting responses are mails, even though they carry appointment times.
    expect(
      outlookItemFromFields({
        ...fields,
        messageClass: "IPM.Schedule.Meeting.Resp.Pos",
      }).kind,
    ).toBe("mail");
  });
});

describe("Prefilled event", () => {
  it("turns a mail into a Mail event with escaped Markdown details", () => {
    const prefill = outlookEventPrefill(
      {
        kind: "mail",
        subject: "Offer",
        sender: { name: "Ada Test", email: "ada@example.test" },
        to: [{ name: "Bob", email: "bob@example.test" }],
        cc: [],
        received: local(2026, 10, 15, 10, 44),
        body: "Price: *10* EUR\r\n\r\n\r\n\r\nBye",
      },
      "p1",
      "2026-10-20",
    );
    expect(prefill).toMatchObject({
      projectId: "p1",
      category: "Mail",
      title: "Offer",
      date: "2026-10-15",
      time: "10:44",
      notices: [],
    });
    expect(prefill.note).toBe(
      [
        "- **From:** Ada Test \\(ada&#64;example\\.test\\)",
        "- **To:** Bob \\(bob&#64;example\\.test\\)",
        "- **Received:** 15/10/26 10&#58;44",
        "",
        "---",
        "",
        "Price&#58; \\*10\\* EUR\n\nBye",
      ].join("\n"),
    );
  });

  it("shortens very long bodies", () => {
    const prefill = outlookEventPrefill(
      {
        kind: "mail",
        subject: "",
        to: [],
        cc: [],
        body: "a".repeat(MAX_BODY_LENGTH + 10),
      },
      "p1",
      "2026-10-20",
    );
    expect(prefill.note).toMatch(/^a{50000}\n\n\*… \(text shortened\)\*$/);
  });

  it("turns an appointment into a Meeting and flags series dates", () => {
    const prefill = outlookEventPrefill(
      appointment({
        subject: "Weekly",
        location: "Room 1",
        sender: { name: "Ada", email: "" },
        to: [{ name: "Bob", email: "" }],
        recurrence: weekly(),
      }),
      "p1",
      "2026-10-20",
    );
    expect(prefill).toMatchObject({
      category: "Meeting",
      date: "2026-10-26",
      time: "09:30",
    });
    expect(prefill.note).toContain("- **When:** 26/10/26 09&#58;30–10&#58;00");
    expect(prefill.note).toContain("- **Series:** recurring appointment");
    expect(prefill.notices[0]).toMatch(/next occurrence from today/);
  });

  it("finds an existing event with the same title and date", () => {
    const event = (
      id: string,
      title: string,
      category: ProjectEvent["category"],
    ) =>
      ({
        id,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        projectId: "p1",
        category,
        title,
        date: "2026-10-21",
      }) satisfies ProjectEvent;
    const events = [
      event("n", "Workshop", "Notiz"),
      event("e", " workshop ", "Meeting"),
    ];
    expect(findSimilarEvent(events, "p1", "Workshop", "2026-10-21")?.id).toBe(
      "e",
    );
    expect(
      findSimilarEvent(events, "p2", "Workshop", "2026-10-21"),
    ).toBeUndefined();
    expect(
      findSimilarEvent(events, "p1", "Workshop", "2026-10-22"),
    ).toBeUndefined();
  });
});
