import { describe, expect, it } from "vitest";
import {
  activeProjects,
  localToday,
  overdue,
  sortEvents,
  sortTodos,
  upcoming,
} from "../src/domain/queries";
import { emptyData, type ProjectEvent, type Todo } from "../src/domain/types";

const base = {
  createdAt: "2026-10-13T00:00:00.000Z",
  updatedAt: "2026-10-13T00:00:00.000Z",
  projectId: "p",
};
const todo = (id: string, dueDate?: string, completed = false): Todo => ({
  ...base,
  id,
  title: id,
  completed,
  ...(dueDate ? { dueDate } : {}),
});
const event = (id: string, date: string, time?: string): ProjectEvent => ({
  ...base,
  id,
  title: id,
  date,
  category: "Meeting",
  ...(time ? { time } : {}),
});

describe("fachliche Kalendergrenzen", () => {
  it("nutzt den lokalen Kalendertag statt UTC", () => {
    const date = new Date(2026, 9, 13, 0, 15);
    expect(localToday(date)).toBe("2026-10-13");
  });
  it("markiert nur offene Aufgaben vor heute als überfällig", () => {
    expect(overdue(todo("yesterday", "2026-10-12"), "2026-10-13")).toBe(true);
    for (const value of [
      todo("today", "2026-10-13"),
      todo("tomorrow", "2026-10-14"),
      todo("no-date"),
      todo("done", "2026-10-12", true),
    ]) {
      expect(overdue(value, "2026-10-13")).toBe(false);
    }
  });
  it("behält heutige Ereignisse unabhängig von verstrichener Uhrzeit", () => {
    expect(upcoming(event("past", "2026-10-12"), "2026-10-13")).toBe(false);
    expect(upcoming(event("today", "2026-10-13", "00:01"), "2026-10-13")).toBe(
      true,
    );
    expect(upcoming(event("future", "2026-10-14"), "2026-10-13")).toBe(true);
  });
  it("leitet ruhend ab und zählt offene Aufgaben ohne Datum", () => {
    const data = emptyData();
    data.projects = ["p", "q", "r", "s"].map((id) => ({
      ...base,
      id,
      name: id,
      description: "",
    }));
    data.todos = [
      todo("no-date"),
      { ...todo("done", "2026-10-12", true), projectId: "q" },
    ];
    data.events = [
      { ...event("past", "2026-10-12"), projectId: "r" },
      { ...event("today", "2026-10-13", "00:00"), projectId: "s" },
    ];
    expect(activeProjects(data, "2026-10-13").map((p) => p.id)).toEqual([
      "p",
      "s",
    ]);
    expect(activeProjects(data, "2026-10-14").map((p) => p.id)).toEqual(["p"]);
  });
  it("sortiert chronologisch, offene Aufgaben zuerst und Ereignisse ohne Uhrzeit zuerst; verändert keine Eingaben", () => {
    const todos = [
      todo("done", "2026-10-01", true),
      todo("none"),
      todo("future", "2026-10-14"),
      todo("past", "2026-10-12"),
    ];
    expect(sortTodos(todos).map((t) => t.id)).toEqual([
      "past",
      "future",
      "none",
      "done",
    ]);
    expect(todos[0].id).toBe("done");
    const events = [
      event("late", "2026-10-13", "15:00"),
      event("next", "2026-10-14"),
      event("all-day", "2026-10-13"),
      event("early", "2026-10-13", "09:00"),
    ];
    expect(sortEvents(events).map((e) => e.id)).toEqual([
      "all-day",
      "early",
      "late",
      "next",
    ]);
    expect(events[0].id).toBe("late");
  });
});
