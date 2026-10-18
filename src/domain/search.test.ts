import { describe, expect, it } from "vitest";
import { searchAll } from "./search";
import { demoData } from "./demo";
import { emptyData } from "./types";

describe("searchAll", () => {
  const data = demoData();
  it("findet unabhängig von Groß-/Kleinschreibung und Akzenten in allen Bereichen", () => {
    const withBrainstorm = {
      ...data,
      brainstorm: { ...data.brainstorm, text: "Idee: **Café-Konzept** testen" },
    };
    const hit = searchAll(withBrainstorm, "CAFE konzept");
    expect(hit.map((r) => r.kind)).toEqual(["brainstorm"]);
    expect(hit[0].snippet).toContain("Café-Konzept");
    const project = data.projects[0];
    expect(
      searchAll(data, project.name.toUpperCase()).some(
        (r) => r.kind === "project" && r.id === project.id,
      ),
    ).toBe(true);
  });
  it("verlangt alle Wörter, sucht Projektnummern und trennt Notizen von Ereignissen", () => {
    expect(searchAll(data, "zzz-gibt-es-nicht")).toEqual([]);
    expect(searchAll(data, "   ")).toEqual([]);
    const number = data.projects[1].number;
    expect(
      searchAll(data, `#${number}`).some(
        (r) => r.kind === "project" && r.id === data.projects[1].id,
      ),
    ).toBe(true);
    const note = data.events.find((e) => e.category === "Notiz");
    if (note)
      expect(
        searchAll(data, note.title).find((r) => r.id === note.id)?.kind,
      ).toBe("note");
  });
  it("sortiert Titeltreffer vor Textfunden und begrenzt die Anzahl", () => {
    const base = emptyData();
    const project = data.projects[0];
    const results = searchAll(
      {
        ...base,
        projects: [project],
        events: [
          {
            ...data.events[0],
            projectId: project.id,
            id: "a",
            title: "Nebensache",
            note: "enthält Wort Budget im Text",
          },
          {
            ...data.events[0],
            projectId: project.id,
            id: "b",
            title: "Budget planen",
            note: "",
          },
        ],
      },
      "budget",
    );
    expect(results.map((r) => r.id)).toEqual(["b", "a"]);
    expect(searchAll(data, "e", 3).length).toBeLessThanOrEqual(3);
  });
});
