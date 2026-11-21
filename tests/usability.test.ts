import { describe, expect, it } from "vitest";
import {
  originLabel,
  projectOriginState,
  readProjectOrigin,
  readRoute,
  routeHash,
  sameRoute,
} from "../src/app/route";
import { notePreview } from "../src/features/events/EventsPanel";
import { projectPeriod, withQuickFields } from "../src/domain/projectFields";
import type { Project } from "../src/domain/types";

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

describe("Direkte Projektänderungen", () => {
  const base: Project = {
    id: "p1",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    number: 1,
    status: "Aktiv",
    name: "Alpha",
    description: "",
  };
  const other: Project = { ...base, id: "p2", owner: "Anna Müller" };
  const now = "2026-11-21T10:00:00.000Z";

  it("übernimmt die bekannte Schreibweise des Owners und entfernt leere Owner", () => {
    const named = withQuickFields(
      base,
      { owner: " anna müller " },
      [base, other],
      now,
    );
    expect(named?.owner).toBe("Anna Müller");
    expect(named?.updatedAt).toBe(now);
    const removed = withQuickFields(named!, { owner: "" }, [base, other], now);
    expect(removed && "owner" in removed).toBe(false);
  });

  it("setzt und entfernt Start- und Enddatum und meldet unveränderte Werte", () => {
    const dated = withQuickFields(
      base,
      { startDate: "2026-12-01", endDate: "2027-03-31" },
      [base],
      now,
    )!;
    expect(projectPeriod(dated)).toBe("Start 01.12.26 – End 31.03.27");
    const cleared = withQuickFields(dated, { startDate: "" }, [dated], now)!;
    expect("startDate" in cleared).toBe(false);
    expect(projectPeriod(cleared)).toBe("End 31.03.27");
    expect(
      withQuickFields(
        dated,
        { status: "Aktiv", endDate: "2027-03-31" },
        [dated],
        now,
      ),
    ).toBeNull();
    expect(projectPeriod(base)).toBe("");
  });
});

describe("Herkunft der Projektseite", () => {
  it("liest die Herkunft aus dem Verlaufseintrag und fällt sonst auf die Projektliste zurück", () => {
    expect(readProjectOrigin(projectOriginState("Dashboard"))).toBe(
      "Dashboard",
    );
    expect(readProjectOrigin(null)).toBe("Projects");
    expect(readProjectOrigin({ from: "Settings" })).toBe("Projects");
    expect(originLabel("Projects")).toBe("All projects");
    expect(originLabel("Tasks")).toBe("Tasks");
  });
});
