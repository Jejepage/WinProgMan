import { describe, expect, it } from "vitest";
import {
  emptyData,
  type AppData,
  type ProjectEvent,
  type Todo,
} from "../src/domain/types";
import {
  addCalendarDays,
  agendaItems,
  highlightParts,
  parseCaptureDate,
  searchAll,
  searchableText,
} from "../src/domain/workflows";

const base = {
  createdAt: "2026-10-13T00:00:00.000Z",
  updatedAt: "2026-10-13T00:00:00.000Z",
};
function fixture(): AppData {
  return {
    ...emptyData(),
    projects: [
      {
        ...base,
        id: "p",
        projectNumber: 14,
        name: "Document Management",
        description: "Digital strategy",
        status: "Aktiv",
      },
      {
        ...base,
        id: "q",
        projectNumber: 37,
        name: "Harbour",
        description: "",
        status: "Pausiert",
      },
    ],
  };
}
function todo(
  id: string,
  dueDate?: string,
  completed = false,
  projectId = "p",
): Todo {
  return {
    ...base,
    id,
    projectId,
    title: id,
    completed,
    ...(dueDate ? { dueDate } : {}),
  };
}
function event(id: string, date: string, time?: string): ProjectEvent {
  return {
    ...base,
    id,
    projectId: "p",
    title: id,
    category: "Meeting",
    date,
    ...(time ? { time } : {}),
  };
}

describe("capture dates and calendar windows", () => {
  it("recognizes explicit dates, today and tomorrow without guessing invalid dates", () => {
    expect(parseCaptureDate(" ToMoRrOw ", "2026-12-31")).toBe("2027-01-01");
    expect(parseCaptureDate("today", "2026-10-13")).toBe("2026-10-13");
    expect(parseCaptureDate("2024-02-29", "2026-10-13")).toBe("2024-02-29");
    for (const input of [
      "2026-02-29",
      "2026-04-31",
      "2026-13-01",
      "next monday",
      "13/10/2026",
      "",
    ])
      expect(parseCaptureDate(input, "2026-10-13")).toBeNull();
  });
  it("crosses DST, leap days, month and year boundaries as calendar days", () => {
    expect(addCalendarDays("2026-03-27", 6)).toBe("2026-04-02");
    expect(addCalendarDays("2026-10-23", 6)).toBe("2026-10-29");
    expect(addCalendarDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("includes today through day six, excludes completed and undated tasks, distinguishes overdue", () => {
    const data = fixture();
    data.todos = [
      todo("late", "2026-10-12"),
      todo("today", "2026-10-13"),
      todo("six", "2026-10-19", false, "q"),
      todo("seven", "2026-10-20"),
      todo("undated"),
      todo("done", "2026-10-13", true),
    ];
    data.events = [
      event("old-meeting", "2026-10-12"),
      event("early-meeting", "2026-10-13", "00:01"),
      event("next-week", "2026-10-20"),
    ];
    expect(agendaItems(data, "2026-10-13").map((item) => item.id)).toEqual([
      "today",
      "early-meeting",
      "six",
    ]);
    expect(
      agendaItems(data, "2026-10-13", "today").map((item) => item.id),
    ).toEqual(["today", "early-meeting"]);
    expect(
      agendaItems(data, "2026-10-13", "later").map((item) => item.id),
    ).toEqual(["next-week", "seven"]);
    expect(
      agendaItems(data, "2026-10-13", "overdue").map((item) => item.id),
    ).toEqual(["late"]);
  });
  it("sorts events without times before timed events and keeps original arrays intact", () => {
    const data = fixture();
    data.events = [
      event("late", "2026-10-13", "14:00"),
      event("early", "2026-10-13", "09:00"),
      event("untimed", "2026-10-13"),
    ];
    expect(agendaItems(data, "2026-10-13").map((item) => item.id)).toEqual([
      "untimed",
      "early",
      "late",
    ]);
    expect(data.events[0].id).toBe("late");
  });
});

describe("local full text search", () => {
  it("searches all words across project context and a complete Markdown note", () => {
    const data = fixture();
    data.events = [
      {
        ...event("meeting", "2026-10-13"),
        title: "Supplier discussion",
        note: `${"Background text. ".repeat(50)}The **technical** _requirements_ include accessibility.`,
        noteFormat: "markdown",
      },
    ];
    const results = searchAll(data, "prj-014 TECHNICAL requirements");
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toContain("technical requirements");
    expect(results[0].snippet.startsWith("…")).toBe(true);
    expect(results[0].project.id).toBe("p");
    expect(searchAll(data, "technical nonexistent")).toEqual([]);
  });
  it("groups notes independently and includes task titles, descriptions, link labels and targets", () => {
    const data = fixture();
    data.todos = [todo("Review strategy")];
    data.events = [
      { ...event("Strategy notes", "2026-10-13"), category: "Notiz" },
    ];
    data.links = [
      {
        ...base,
        id: "link",
        projectId: "p",
        label: "Portal",
        target: "https://strategy.example.test",
      },
    ];
    expect(searchAll(data, "strategy").map((result) => result.group)).toEqual([
      "Projects",
      "Tasks",
      "Notes",
      "Links",
    ]);
    expect(searchAll(data, "portal")[0].type).toBe("link");
    expect(searchAll(data, " ")).toEqual([]);
    expect(searchAll(data, "PRJ-037")[0].project.id).toBe("q");
  });
  it("excludes orphaned records when their project is absent", () => {
    const data = fixture();
    data.todos = [todo("missing", undefined, false, "deleted-project")];
    expect(searchAll(data, "missing")).toEqual([]);
    expect(agendaItems(data, "2026-10-13")).toEqual([]);
  });
  it("removes formatting around words and preserves link labels and destinations", () => {
    expect(
      searchableText(
        "# **Technical** _requirements_\n- [API docs](https://example.test/docs)",
      ),
    ).toBe("Technical requirements API docs https://example.test/docs");
  });
  it("highlights multiple words case-insensitively and treats regex characters literally", () => {
    const parts = highlightParts("API C++ API [x]", "api c++ [x]");
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(
      ["API", "C++", "API", "[x]"],
    );
    expect(parts.map((part) => part.text).join("")).toBe("API C++ API [x]");
  });
});
