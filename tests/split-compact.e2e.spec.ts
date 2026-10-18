import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { ExportEnvelope } from "../src/domain/types";

const timestamp = "2026-10-17T08:00:00.000Z";
const base = { createdAt: timestamp, updatedAt: timestamp };
const projectName =
  "Compact project with a deliberately long descriptive title";

test("backup actions appear exclusively in Settings in every design and export can be previewed through the file picker", async ({
  page,
}) => {
  await load(page);
  for (const variant of ["classic", "color", "split-compact"]) {
    await design(page, variant as "classic" | "color" | "split-compact");
    for (const view of [
      "Dashboard",
      "Projects",
      "Tasks",
      "Events",
      "Notes",
      "Brainstorm",
    ]) {
      await navigate(page, view);
      await expect(
        page.getByRole("button", { name: "Export JSON ↓", exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Import JSON ↑", exact: true }),
      ).toHaveCount(0);
    }
    await navigate(page, "Projects");
    await page.getByRole("button", { name: projectName, exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Export JSON ↓", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Import JSON ↑", exact: true }),
    ).toHaveCount(0);
    await navigate(page, "Settings");
    const backup = page.getByRole("region", { name: "Backup", exact: true });
    await expect(
      backup.getByRole("heading", { name: "Import & export", exact: true }),
    ).toBeVisible();
    await expect(
      backup.getByRole("button", { name: "Export JSON ↓", exact: true }),
    ).toBeVisible();
    await expect(
      backup.getByRole("button", { name: "Import JSON ↑", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("button", { name: /JSON/ }),
    ).toHaveCount(0);
  }
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const original = JSON.parse(
    await readFile((await (await downloadEvent).path())!, "utf8"),
  ) as ExportEnvelope;
  expect(original.projects[0].name).toBe(projectName);
  const chooserEvent = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import JSON ↑", exact: true })
    .click();
  await (
    await chooserEvent
  ).setFiles({
    name: "settings-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(original)),
  });
  const preview = page.getByRole("region", {
    name: "Import preview",
    exact: true,
  });
  await expect(preview).toContainText("1 Projects");
  await preview.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(preview).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Backup", exact: true }),
  ).toBeVisible();
  await navigate(page, "Projects");
  await expect(
    page.getByRole("button", { name: projectName, exact: true }),
  ).toBeVisible();
});

async function load(page: Page, appearanceFixture = false) {
  const backup: ExportEnvelope = {
    schemaVersion: 6,
    tombstones: [],
    exportedAt: timestamp,
    brainstorm: { text: "", revision: 0, updatedAt: timestamp },
    projectCategories: [{ ...base, id: "topic", name: "Delivery" }],
    projects: [
      {
        ...base,
        id: "p1",
        number: 42,
        name: projectName,
        status: "Aktiv",
        categoryId: "topic",
        description:
          "A long description with enough words to wrap in the blue project file without clipping the editor or its actions.",
      },
    ],
    links: [
      {
        ...base,
        id: "link",
        projectId: "p1",
        label: "Documentation with a long descriptive link label",
        target: "https://example.com/docs",
      },
    ],
    todos: [
      {
        ...base,
        id: "t1",
        projectId: "p1",
        title: "Review compact task",
        completed: false,
        doNext: true,
      },
      {
        ...base,
        id: "t2",
        projectId: "p1",
        title: "Completed compact task",
        completed: true,
      },
    ],
    events: [
      {
        ...base,
        id: "past-event",
        projectId: "p1",
        title: "Past review meeting",
        category: "Meeting",
        date: "2000-01-01",
      },
      {
        ...base,
        id: "event",
        projectId: "p1",
        title: "Upcoming planning meeting",
        category: "Meeting",
        date: "2099-10-17",
      },
      {
        ...base,
        id: "note",
        projectId: "p1",
        title: "Design notes",
        category: "Notiz",
        date: "2026-10-17",
        note: "# Original note\n\nKeep this paragraph.",
        noteFormat: "markdown",
      },
      ...[1, 2, 3].map((index) => ({
        ...base,
        id: `future-${index}`,
        projectId: "p1",
        title: `Further upcoming meeting ${index}`,
        category: "Meeting" as const,
        date: `2099-11-0${index}`,
      })),
      ...[1, 2, 3].map((index) => ({
        ...base,
        id: `old-note-${index}`,
        projectId: "p1",
        title: `Historical note ${index}`,
        category: "Notiz" as const,
        date: `2000-01-0${index}`,
        note: "Preserved historical note.",
      })),
    ],
  };
  if (appearanceFixture) {
    for (const [index, status] of (
      ["Geplant", "Pausiert", "Abgeschlossen"] as const
    ).entries()) {
      const id = `status-${index}`;
      backup.projects.push({
        ...base,
        id,
        number: 100 + index,
        name: `Status project ${status}`,
        description: "",
        status,
        categoryId: "topic",
      });
      backup.todos.push({
        ...base,
        id: `work-${index}`,
        projectId: id,
        title: `Open work ${status}`,
        completed: false,
      });
    }
    for (const [index, category] of (
      ["Telefonat", "Milestone", "Beschluss"] as const
    ).entries()) {
      backup.events.push({
        ...base,
        id: `type-${index}`,
        projectId: "p1",
        title: `Typed event ${category}`,
        category,
        date: "2099-10-18",
      });
    }
    backup.links = ["Docs", "Website", "Folder"].map((label, index) => ({
      ...base,
      id: `short-link-${index}`,
      projectId: "p1",
      label,
      target: `https://example.com/${index}`,
    }));
  }
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Load sample data" }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "compact.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup imported");
}

test("statuses and event types use distinct readable badges; compact topics and project links stay compact", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await load(page, true);
  const statuses = ["Geplant", "Aktiv", "Pausiert", "Abgeschlossen"];
  const categories = ["Meeting", "Telefonat", "Milestone", "Beschluss"];
  async function badges(selector: string, attribute: string, values: string[]) {
    const backgrounds = [];
    for (const value of values) {
      const badge = page
        .locator(`${selector}[${attribute}="${value}"]:visible`)
        .first();
      await expect(badge).toBeVisible();
      await expect(badge).not.toHaveText("");
      const colors = await badge.evaluate((element) => {
        const style = getComputedStyle(element);
        const luminance = (color: string) => {
          const channels = (color.match(/[\d.]+/g) || [])
            .slice(0, 3)
            .map(Number)
            .map((channel) => {
              const normalized = channel / 255;
              return normalized <= 0.04045
                ? normalized / 12.92
                : Math.pow((normalized + 0.055) / 1.055, 2.4);
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const background = luminance(style.backgroundColor);
        const foreground = luminance(style.color);
        return {
          background: style.backgroundColor,
          contrast:
            (Math.max(background, foreground) + 0.05) /
            (Math.min(background, foreground) + 0.05),
        };
      });
      expect(colors.contrast, `${value} contrast`).toBeGreaterThanOrEqual(4.5);
      backgrounds.push(colors.background);
    }
    expect(new Set(backgrounds).size).toBe(values.length);
  }
  for (const variant of ["classic", "color", "split-compact"] as const) {
    await design(page, variant);
    for (const theme of ["Light", "Dark"]) {
      await navigate(page, "Settings");
      await page
        .getByRole("group", { name: "Color theme", exact: true })
        .getByRole("button", { name: theme, exact: true })
        .click();
      await page
        .getByRole("button", { name: "Close settings", exact: true })
        .click();
      await navigate(page, "Projects");
      await badges(".status-pill", "data-status", statuses);
      if (variant === "split-compact") {
        const heading = page.locator(".topic-group-heading").first();
        expect(
          await heading.evaluate((element) =>
            parseFloat(getComputedStyle(element).fontSize),
          ),
        ).toBeLessThanOrEqual(14);
        expect(
          (await page.locator(".topic-group-row").first().boundingBox())!
            .height,
        ).toBeLessThanOrEqual(36);
        await expect(heading.locator(".count")).toHaveCSS(
          "color",
          await heading.evaluate((element) => getComputedStyle(element).color),
        );
      }
      await navigate(page, "Dashboard");
      await badges(".status-pill", "data-status", statuses);
      await badges(".category", "data-category", categories);
      await navigate(page, "Events");
      await badges(".category", "data-category", categories);
    }
  }
  await navigate(page, "Projects");
  await page.getByRole("button", { name: projectName, exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Design", exact: true }),
  ).toHaveCount(0);
  const links = page.locator(".project-header .project-links-display");
  await expect(links).toHaveCSS("display", "flex");
  await expect(links).toHaveCSS("flex-wrap", "wrap");
  const first = (await links.locator("li").nth(0).boundingBox())!;
  const second = (await links.locator("li").nth(1).boundingBox())!;
  expect(second.x).toBeGreaterThan(first.x);
  expect(Math.abs(second.y - first.y)).toBeLessThan(2);
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await expect(
    page.locator(".project-header .project-links-display"),
  ).toHaveCount(0);
  await expect(page.locator(".project-header .links-list li")).toHaveCount(3);
  await expect(
    page
      .locator(".project-header .links-list li")
      .first()
      .getByRole("button", { name: "Edit", exact: true }),
  ).toBeVisible();
});

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}

async function design(
  page: Page,
  value: "classic" | "color" | "split-compact",
) {
  const alreadyOpen = await page
    .getByRole("heading", { name: "Settings", exact: true })
    .isVisible();
  if (!alreadyOpen) await navigate(page, "Settings");
  await page
    .getByRole("group", { name: "Design variant", exact: true })
    .getByRole("button", {
      name:
        value === "classic"
          ? "Classic"
          : value === "color"
            ? "Color"
            : "Split Compact",
      exact: true,
    })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-design", value);
  await expect(
    page.getByRole("combobox", { name: "Design", exact: true }),
  ).toHaveCount(0);
  if (!alreadyOpen)
    await page
      .getByRole("button", { name: "Close settings", exact: true })
      .click();
}

test("Split Compact restores sidebar placement and supports icons independently of placement and theme", async ({
  page,
}) => {
  await load(page);
  await design(page, "split-compact");
  await navigate(page, "Settings");
  const shell = page.locator(".app-shell");
  const sidebar = page.locator(".sidebar");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const placement = page.getByRole("group", {
    name: "Navigation placement",
    exact: true,
  });
  const labels = page.getByRole("group", { name: "Sidebar", exact: true });
  await expect(shell).toHaveAttribute("data-navigation", "sidebar");
  for (const theme of ["Light", "Dark"]) {
    await page
      .getByRole("group", { name: "Color theme", exact: true })
      .getByRole("button", { name: theme, exact: true })
      .click();
    for (const position of ["Sidebar", "Top navigation"]) {
      await placement
        .getByRole("button", { name: position, exact: true })
        .click();
      for (const mode of ["Icons and labels", "Icons only"]) {
        await labels.getByRole("button", { name: mode, exact: true }).click();
        const text = nav.locator(".nav-text").first();
        if (mode === "Icons only") await expect(text).toBeHidden();
        else await expect(text).toBeVisible();
        const bar = (await sidebar.boundingBox())!;
        const main = (await page.locator("main").boundingBox())!;
        if (position === "Sidebar") {
          expect(bar.width).toBe(mode === "Icons only" ? 76 : 240);
          expect(main.x).toBeGreaterThanOrEqual(bar.x + bar.width);
        } else {
          expect(bar.width).toBe(1440);
          expect(main.y).toBeGreaterThanOrEqual(bar.y + bar.height);
        }
      }
    }
  }
  await placement.getByRole("button", { name: "Sidebar", exact: true }).click();
  await page.reload();
  await expect(shell).toHaveAttribute("data-navigation", "sidebar");
  await expect(nav.locator(".nav-text").first()).toBeHidden();
  for (const view of [
    "Projects",
    "Tasks",
    "Events",
    "Notes",
    "Brainstorm",
    "Settings",
  ]) {
    await navigate(page, view);
    await expect(
      page.getByRole("heading", { name: view, exact: true }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: "test-results/visual/split-sidebar-icons-dark.png",
    fullPage: true,
  });
  await labels
    .getByRole("button", { name: "Icons and labels", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/visual/split-sidebar-labels-dark.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.locator(".nav-text").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await labels.getByRole("button", { name: "Icons only", exact: true }).click();
  await expect(nav.locator(".nav-text").first()).toBeHidden();
  await navigate(page, "Projects");
  await page.getByRole("button", { name: projectName, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: projectName, exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Sidebar draft survives design changes");
  await design(page, "classic");
  await design(page, "split-compact");
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Sidebar draft survives design changes");
  await expect(shell).toHaveAttribute("data-navigation", "sidebar");
  await expect(nav.locator(".nav-text").first()).toBeHidden();
});

test("Classic remains the default; both designs support every color mode and restore preferences", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-design", "classic");
  await navigate(page, "Settings");
  for (const variant of ["classic", "split-compact"] as const) {
    await design(page, variant);
    for (const theme of ["Light", "Dark", "System"]) {
      await page
        .getByRole("group", { name: "Color theme", exact: true })
        .getByRole("button", { name: theme, exact: true })
        .click();
      await page.emulateMedia({ colorScheme: "dark" });
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        theme === "Light" ? "light" : "dark",
      );
      await page.emulateMedia({ colorScheme: "light" });
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        theme === "Dark" ? "dark" : "light",
      );
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute(
        "data-design",
        variant,
      );
      await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        theme === "Dark" ? "dark" : "light",
      );
      await navigate(page, "Settings");
      await expect(
        page
          .getByRole("group", { name: "Color theme", exact: true })
          .getByRole("button", { name: theme, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
  }
  await page
    .getByRole("group", { name: "Design variant", exact: true })
    .getByRole("button", { name: "Classic", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "classic");
});

test("switching design retains the open project, unsaved project and link drafts, and project search", async ({
  page,
}) => {
  await load(page);
  await page.getByLabel("Search projects").fill("Compact project");
  await page.getByRole("button", { name: projectName, exact: true }).click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Unsaved project title");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Unsaved description");
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByLabel("Label", { exact: true }).fill("Unsaved link label");
  await page
    .getByLabel("URL or path", { exact: true })
    .fill("https://example.com/draft");
  for (const variant of [
    "split-compact",
    "classic",
    "split-compact",
  ] as const) {
    await design(page, variant);
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
      "Unsaved project title",
    );
    await expect(
      page.getByRole("textbox", { name: "Description", exact: true }),
    ).toHaveValue("Unsaved description");
    await expect(page.getByLabel("Label", { exact: true })).toHaveValue(
      "Unsaved link label",
    );
    await expect(page.getByLabel("URL or path", { exact: true })).toHaveValue(
      "https://example.com/draft",
    );
  }
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await page
    .locator(".project-header")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: projectName, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Unsaved link label", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "← All projects", exact: true })
    .click();
  await expect(page.getByLabel("Search projects")).toHaveValue(
    "Compact project",
  );
});

test("task and Markdown drafts and list filters survive design changes with explicit Save and Cancel", async ({
  page,
}) => {
  await load(page);
  await navigate(page, "Tasks");
  await page.getByLabel("Search tasks").fill("Review compact");
  await page.getByRole("button", { name: "Open tasks", exact: true }).click();
  await page
    .getByRole("button", { name: "Review compact task edit", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Unsaved task title");
  await page
    .getByLabel("Due date (optional)", { exact: true })
    .fill("2099-11-01");
  await design(page, "split-compact");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsaved task title",
  );
  await expect(
    page.getByLabel("Due date (optional)", { exact: true }),
  ).toHaveValue("2099-11-01");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Search tasks")).toHaveValue("Review compact");
  await expect(
    page.getByRole("button", { name: "Open tasks", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Review compact task edit", exact: true }),
  ).toBeVisible();
  await navigate(page, "Notes");
  await page.getByRole("button", { name: "Design notes", exact: true }).click();
  const rich = page.locator('[contenteditable="true"][role="textbox"]');
  await expect(rich).toBeVisible();
  await rich.fill("A rich text draft that must survive both designs.");
  await design(page, "classic");
  await expect(rich).toContainText(
    "A rich text draft that must survive both designs.",
  );
  await design(page, "split-compact");
  await expect(rich).toContainText(
    "A rich text draft that must survive both designs.",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await navigate(page, "Notes");
  await page.getByRole("button", { name: "Design notes", exact: true }).click();
  await expect(rich).toContainText(
    "A rich text draft that must survive both designs.",
  );
});

test("Split Compact keeps project actions, timeline and narrow layouts usable", async ({
  page,
}) => {
  await load(page);
  await design(page, "split-compact");
  await page.getByRole("button", { name: projectName, exact: true }).click();
  await expect(page.locator(".project-header")).toContainText("42");
  const events = page.locator(
    ".detail-columns > .events-panel:not(.notes-panel)",
  );
  const notes = page.locator(".detail-columns > .notes-panel");
  await expect(events.locator(".event-item")).toHaveCount(3);
  await expect(
    events.getByRole("button", { name: "Past review meeting", exact: true }),
  ).toHaveCount(0);
  await events
    .getByRole("button", { name: "All events (5)", exact: true })
    .click();
  await expect(events.locator(".event-item")).toHaveCount(5);
  await expect(
    events.getByRole("button", { name: "Past review meeting", exact: true }),
  ).toBeVisible();
  await events
    .getByRole("button", { name: "Upcoming only", exact: true })
    .click();
  await expect(events.locator(".event-item")).toHaveCount(3);
  await expect(notes.locator(".event-item")).toHaveCount(3);
  await expect(
    notes.getByRole("button", { name: "Historical note 1", exact: true }),
  ).toHaveCount(0);
  await notes
    .getByRole("button", { name: "All notes (4)", exact: true })
    .click();
  await expect(notes.locator(".event-item")).toHaveCount(4);
  await expect(
    notes.getByRole("button", { name: "Historical note 1", exact: true }),
  ).toBeVisible();
  await notes
    .getByRole("button", { name: "Recent notes", exact: true })
    .click();
  await page
    .getByRole("checkbox", {
      name: "Review compact task completed",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Review compact task completed",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", {
      name: "Review compact task completed",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Review compact task completed",
      exact: true,
    }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Review compact task Do next", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Review compact task Do next",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Timeline", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(events.locator(".event-item")).toHaveCount(5);
  await expect(
    events.getByRole("button", { name: "Past review meeting", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(events.locator(".event-item")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/visual/split-compact-project.png",
    fullPage: true,
  });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: projectName, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/visual/split-compact-project-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await navigate(page, "Tasks");
  await expect(
    page.getByRole("button", { name: "Review compact task edit", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/split-compact-tasks.png",
    fullPage: true,
  });
});
