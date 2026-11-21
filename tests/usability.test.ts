import { describe, expect, it } from "vitest";
import { readRoute, routeHash, sameRoute } from "../src/app/route";
import { notePreview } from "../src/features/events/EventsPanel";

describe("Ansichten in der Adresse", () => {
  it("liest Hauptansichten und Projektseiten und ignoriert Editoren", () => {
    expect(readRoute("#view=tasks")).toEqual({ view: "Tasks" });
    expect(readRoute("#project=abc-1")).toEqual({
      view: "Project",
      projectId: "abc-1",
    });
    expect(readRoute("#detail=task&id=1")).toBeNull();
    expect(readRoute("#detail=event&mode=new&project=abc")).toBeNull();
    expect(readRoute("#view=project")).toBeNull();
    expect(readRoute("#view=unknown")).toBeNull();
    expect(readRoute("")).toBeNull();
  });
  it("schreibt Adressen, die wieder gelesen werden", () => {
    for (const route of [
      { view: "Dashboard" as const },
      { view: "Brainstorm" as const },
      { view: "Project" as const, projectId: "a b&c" },
    ])
      expect(sameRoute(readRoute(routeHash(route)), route)).toBe(true);
    // A project page without id falls back to the project list.
    expect(routeHash({ view: "Project" })).toBe("#view=projects");
  });
});

describe("Notizvorschau", () => {
  it("zeigt Markdown als kurzen Klartext", () => {
    expect(
      notePreview("# Titel\n\n- **Punkt** mit [Link](https://x.test)\n> Zitat"),
    ).toBe("Titel · Punkt mit Link · Zitat");
    expect(notePreview("<b>Fett</b> und `code`")).toBe("Fett und code");
    expect(notePreview("a".repeat(200), 10)).toBe(`${"a".repeat(10)} …`);
  });
});
