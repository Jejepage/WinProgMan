import { describe, expect, it } from "vitest";
import {
  activeProjects,
  groupProjects,
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
  it("zählt Notizen auch mit künftigem Datum nicht als kommende Ereignisse", () => {
    const note = { ...event("note", "2099-10-16"), category: "Notiz" as const };
    expect(upcoming(note, "2026-10-16")).toBe(false);
    const data = emptyData();
    data.projects = [
      {
        ...base,
        id: "p",
        name: "Notes only",
        description: "",
        status: "Aktiv",
      },
    ];
    data.events = [note];
    expect(activeProjects(data, "2026-10-16")).toEqual([]);
    data.todos = [todo("no-date")];
    expect(activeProjects(data, "2026-10-16")).toHaveLength(1);
  });
  it("gruppiert nur gefilterte Projekte nach Topic, ohne leere Gruppen oder Änderungen an IDs", () => {
    const topics = [
      { ...base, id: "z", name: "Zulu" },
      { ...base, id: "a", name: "Alpha" },
      { ...base, id: "empty", name: "Empty" },
      { ...base, id: "named-none", name: "No topic" },
    ];
    const projects = [
      {
        ...base,
        id: "p1",
        name: "First",
        description: "",
        status: "Aktiv" as const,
        categoryId: "z",
      },
      {
        ...base,
        id: "p2",
        name: "Second",
        description: "",
        status: "Aktiv" as const,
      },
      {
        ...base,
        id: "p3",
        name: "Third",
        description: "",
        status: "Aktiv" as const,
        categoryId: "a",
      },
      {
        ...base,
        id: "p4",
        name: "Fourth",
        description: "",
        status: "Aktiv" as const,
        categoryId: "named-none",
      },
    ];
    expect(
      groupProjects(projects, topics).map((group) => [
        group.id,
        group.projects.map((project) => project.id),
      ]),
    ).toEqual([
      ["a", ["p3"]],
      ["named-none", ["p4"]],
      ["z", ["p1"]],
      ["", ["p2"]],
    ]);
    expect(
      groupProjects(
        projects.filter((project) => project.id === "p1"),
        topics,
      ).map((group) => group.id),
    ).toEqual(["z"]);
    expect(projects[0].id).toBe("p1");
    expect(topics[0].id).toBe("z");
  });
  it("leitet ruhend ab und zählt offene Aufgaben ohne Datum", () => {
    const data = emptyData();
    data.projects = ["p", "q", "r", "s"].map((id) => ({
      ...base,
      id,
      name: id,
      description: "",
      status: "Abgeschlossen",
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
  it("sortiert offene Do-next-Aufgaben zuerst und erledigte weiterhin ans Ende", () => {
    const todos = [
      todo("early", "2026-10-12"),
      { ...todo("next-later", "2026-10-15"), doNext: true },
      { ...todo("next-earlier", "2026-10-14"), doNext: true },
      { ...todo("done-next", "2026-10-01", true), doNext: true },
    ];
    expect(sortTodos(todos).map((value) => value.id)).toEqual([
      "next-earlier",
      "next-later",
      "early",
      "done-next",
    ]);
  });
});
