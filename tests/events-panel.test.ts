import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EventsPanel } from "../src/features/events/EventsPanel";
import type { Project, ProjectEvent } from "../src/domain/types";

const base = {
  createdAt: "2026-10-16T08:00:00Z",
  updatedAt: "2026-10-16T08:00:00Z",
};
const project: Project = {
  number: 1,
  ...base,
  id: "project",
  name: "Garden",
  description: "",
  status: "Aktiv",
};
const event: ProjectEvent = {
  ...base,
  id: "event",
  projectId: project.id,
  category: "Meeting",
  title: "Planning meeting",
  date: "2026-10-16",
};
const oldNote: ProjectEvent = {
  ...base,
  id: "old-note",
  projectId: project.id,
  category: "Notiz",
  title: "Old idea",
  date: "2026-10-15",
  note: "**literal** <script>",
};
const newNote: ProjectEvent = {
  ...oldNote,
  id: "new-note",
  title: "Fresh idea",
  date: "2026-10-16",
};
const render = (props: Partial<ComponentProps<typeof EventsPanel>> = {}) =>
  renderToStaticMarkup(
    createElement(EventsPanel, {
      events: [oldNote, event, newNote],
      projects: [project],
      today: "2026-10-16",
      busy: false,
      onChange: async () => true,
      onProject: () => {},
      ...props,
    }),
  );

describe("separate event and note surfaces", () => {
  it("keeps notes out of the events list and category choices", () => {
    const html = render();
    expect(html).toContain("Planning meeting");
    expect(html).not.toContain("Old idea");
    expect(html).not.toContain("Fresh idea");
    expect(html).not.toContain('value="Notiz"');
  });

  it("shows notes newest first with legacy content and no event controls", () => {
    const html = render({ notesOnly: true, initialMode: "timeline" });
    expect(html.indexOf("Fresh idea")).toBeLessThan(html.indexOf("Old idea"));
    expect(html).not.toContain("Planning meeting");
    expect(html).not.toContain("Timeline");
    expect(html).not.toContain('aria-label="Category"');
    expect(html).not.toContain('class="event-phase"');
    expect(html).toContain("**literal** &lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("searches notes by project without leaking events from that project", () => {
    const html = render({
      notesOnly: true,
      search: "garden",
      onSearchChange: () => {},
    });
    expect(html).toContain("Fresh idea");
    expect(html).toContain('aria-label="Search notes"');
    expect(html).not.toContain("Planning meeting");
    expect(render({ notesOnly: true, search: "absent" })).toContain(
      "No notes match this search and filter.",
    );
  });

  it("gives a note its own editor with project, date and Markdown but no event fields", () => {
    const html = render({
      notesOnly: true,
      detailOnly: true,
      initialEvent: oldNote,
    });
    expect(html).toContain('aria-label="Project"');
    expect(html).toContain('type="date"');
    expect(html).toContain('aria-label="Format note"');
    expect(html).toContain("Delete note");
    expect(html).not.toContain("Delete event");
    expect(html).not.toContain('aria-label="Category"');
    expect(html).not.toContain('type="time"');
  });
});
