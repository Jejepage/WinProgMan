import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const timestamp = "2026-10-16T08:00:00.000Z";
const base = { createdAt: timestamp, updatedAt: timestamp };
const sample = () => ({
  schemaVersion: 6,
  tombstones: [],
  brainstorm: { text: "", revision: 0, updatedAt: timestamp },
  exportedAt: timestamp,
  projectCategories: [
    { ...base, id: "z", name: "Zulu" },
    { ...base, id: "a", name: "Alpha" },
  ],
  projects: [
    {
      ...base,
      id: "p1",
      number: 1,
      name: "Zulu project",
      status: "Aktiv",
      description: "",
      categoryId: "z",
    },
    {
      ...base,
      id: "p2",
      number: 2,
      name: "Alpha project",
      status: "Aktiv",
      description: "",
      categoryId: "a",
    },
    {
      ...base,
      id: "p3",
      number: 3,
      name: "Notes only",
      status: "Aktiv",
      description: "",
    },
  ],
  todos: [
    {
      ...base,
      id: "t1",
      projectId: "p1",
      title: "Flag this task",
      completed: false,
    },
  ],
  events: [
    {
      ...base,
      id: "e1",
      projectId: "p1",
      title: "A meeting",
      category: "Meeting",
      date: "2099-10-16",
    },
    {
      ...base,
      id: "n1",
      projectId: "p3",
      title: "Legacy note",
      category: "Notiz",
      date: "2099-10-16",
      note: "**Literal legacy text**",
    },
  ],
  links: [
    {
      ...base,
      id: "l1",
      projectId: "p1",
      label: "Local folder",
      target: "C:\\Users\\User\\Documents\\",
    },
    {
      ...base,
      id: "l2",
      projectId: "p1",
      label: "Web docs",
      target: "https://example.com/docs",
    },
    {
      ...base,
      id: "l3",
      projectId: "p1",
      label: "SharePoint docs",
      target: "https://tenant.sharepoint.com/sites/docs",
    },
  ],
});

async function loadSample(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Load sample data" }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "feedback.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(sample())),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(page.locator('.message[role="status"]')).toContainText(
    "Backup imported",
  );
}

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

test("Design und Symbolnavigation bleiben gespeichert und alle Seiten erreichbar", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Settings");
  const design = page.getByRole("group", {
    name: "Design variant",
    exact: true,
  });
  const sidebar = page.getByRole("group", { name: "Sidebar", exact: true });
  await design.getByRole("button", { name: "Color", exact: true }).click();
  await sidebar
    .getByRole("button", { name: "Icons only", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "color");
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-icons/);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.reload();
  await navigate(page, "Settings");
  await expect(
    design.getByRole("button", { name: "Color", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    sidebar.getByRole("button", { name: "Icons only", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-design", "color");
  await expect(page.locator(".app-shell")).toHaveClass(/sidebar-icons/);
  for (const view of [
    "Dashboard",
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
    path: "test-results/visual/color-icons-dark.png",
    fullPage: true,
  });
  await design.getByRole("button", { name: "Classic", exact: true }).click();
  await sidebar
    .getByRole("button", { name: "Icons and labels", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "classic");
  await expect(page.locator(".app-shell")).not.toHaveClass(/sidebar-icons/);
});

test("Projektnummern sind editierbar, eindeutig und unabhängig von Filtern dauerhaft", async ({
  page,
}) => {
  await loadSample(page);
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "Zulu project", exact: true }).click();
  const header = page.locator(".project-header");
  await header
    .getByRole("button", { name: "Edit project", exact: true })
    .click();
  const number = header.getByLabel("Project number", { exact: true });
  await expect(number).toHaveValue("1");
  await number.fill("2");
  await header.getByRole("button", { name: "Save", exact: true }).click();
  await expect(number).toBeVisible();
  await expect(header).toContainText(/number.*(already|used|unique|assigned)/i);
  await expect(number).toHaveValue("2");
  await number.fill("42");
  await header.getByRole("button", { name: "Save", exact: true }).click();
  await expect(number).toHaveCount(0);
  await page.reload();
  await navigate(page, "Projects");
  await page.getByLabel("Search projects").fill("Zulu");
  await expect(page.locator(".project-topic-group")).toContainText("PRJ-042");
  await page.getByLabel("Search projects").fill("");
  await expect(
    page.locator(".project-topic-group").filter({ hasText: "Alpha project" }),
  ).toContainText("PRJ-002");
  await page
    .getByRole("button", { name: "+ New project", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill("Next number");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await expect(
    header.getByLabel("Project number", { exact: true }),
  ).toHaveValue("43");
});

test("Brainstorm speichert beim sofortigen Seitenwechsel und ersetzt Sicherungen ohne alten Autosave", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Brainstorm");
  const rich = page.locator(
    '[contenteditable="true"][aria-label="Brainstorm text"]',
  );
  await expect(rich).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toHaveCount(0);
  await rich.fill("Idea before navigation");
  await navigate(page, "Dashboard");
  await page.reload();
  await navigate(page, "Brainstorm");
  await expect(rich).toContainText("Idea before navigation");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  const source = page.getByRole("textbox", {
    name: "Brainstorm text",
    exact: true,
  });
  await source.fill("# Daily ideas\n\n- Keep this thought\n");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(backup.schemaVersion).toBe(6);
  expect(backup.brainstorm.text).toBe("# Daily ideas\n\n- Keep this thought\n");
  await navigate(page, "Brainstorm");
  await source.fill("Pending text that import must replace");
  const restored = {
    ...backup,
    brainstorm: {
      ...backup.brainstorm,
      text: "Imported Brainstorm",
      revision: backup.brainstorm.revision + 1,
    },
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: "brainstorm.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(restored)),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText(/Brainstorm/i);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(page.locator('.message[role="status"]')).toContainText(
    "Backup imported",
  );
  await navigate(page, "Brainstorm");
  await page.reload();
  await navigate(page, "Brainstorm");
  await expect(rich).toContainText("Imported Brainstorm");
  await expect(rich).not.toContainText("Pending text");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rich).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/visual/brainstorm-mobile.png",
    fullPage: true,
  });
});

test("Brainstorm stellt letzte Eingabe nach direktem Reload wieder her und bleibt beim Laden der Beispiele erhalten", async ({
  page,
}) => {
  await page.goto("/");
  await navigate(page, "Brainstorm");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  const source = page.getByRole("textbox", {
    name: "Brainstorm text",
    exact: true,
  });
  await source.fill("Spontaneous thought with final word RECOVERED");
  // Reload directly after the edit, without waiting for debounce or changing views.
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await navigate(page, "Brainstorm");
  const rich = page.locator(
    '[contenteditable="true"][aria-label="Brainstorm text"]',
  );
  await expect(rich).toContainText("final word RECOVERED");
  await expect(page.locator(".brainstorm-status")).toHaveText("Saved");
  await navigate(page, "Dashboard");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Projects");
  await expect(
    page.getByRole("button", { name: "Arbeitsplatz erneuern", exact: true }),
  ).toBeVisible();
  await navigate(page, "Brainstorm");
  await expect(rich).toContainText(
    "Spontaneous thought with final word RECOVERED",
  );
  await page.reload();
  await navigate(page, "Brainstorm");
  await expect(rich).toContainText("final word RECOVERED");
});

test("Brainstorm aktualisiert saubere zweite Tabs und erhält Entwürfe bei konkurrierendem Speichern", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await navigate(page, "Brainstorm");
  const first = page.locator(
    '[contenteditable="true"][aria-label="Brainstorm text"]',
  );
  await expect(first).toBeVisible();
  const secondPage = await context.newPage();
  await secondPage.goto("/");
  await navigate(secondPage, "Brainstorm");
  const second = secondPage.locator(
    '[contenteditable="true"][aria-label="Brainstorm text"]',
  );
  await expect(second).toBeVisible();
  await first.fill("Shared saved thought");
  await expect(page.locator(".brainstorm-status")).toHaveText("Saved");
  await expect(second).toContainText("Shared saved thought");

  // Freeze only the second tab's debounce so the competing draft cannot win a timing race.
  const frozenTime = new Date("2026-10-17T10:00:00Z");
  await secondPage.clock.install({ time: frozenTime });
  await secondPage.clock.pauseAt(new Date("2026-10-17T10:00:01Z"));
  await second.fill("Second tab draft must survive");
  await expect(secondPage.locator(".brainstorm-status")).toHaveText(
    "Unsaved changes…",
  );
  await first.fill("First tab newer durable thought");
  // Clock mocking affects both pages in this browser context; navigation flushes explicitly.
  await navigate(page, "Dashboard");
  await expect(page.locator(".brainstorm-status")).toHaveText("Saved");
  await expect(secondPage.getByRole("alert")).toContainText(
    /changed elsewhere.*draft is preserved/i,
  );
  await expect(second).toHaveText("Second tab draft must survive");
  await secondPage.clock.runFor(1000);
  await expect(secondPage.getByRole("alert")).toContainText(
    /changed elsewhere.*draft is preserved/i,
  );
  await expect(second).toHaveText("Second tab draft must survive");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(backup.brainstorm.text.trim()).toBe("First tab newer durable thought");
  secondPage.on("dialog", (dialog) => dialog.accept());
  await secondPage.close({ runBeforeUnload: true });
});

test("alte Notizadressen und vertauschte Detailrouten erhalten den gespeicherten Objekttyp", async ({
  page,
}) => {
  await loadSample(page);
  await page.goto("/#detail=event&id=n1");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Edit note", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".detail-page").getByLabel("Category", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page.goto("/#detail=note&id=e1");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Edit event", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".detail-page").getByLabel("Category", { exact: true }),
  ).toHaveValue("Meeting");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Events", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".event-item")).toHaveCount(1);
  await expect(page.locator(".event-item")).toContainText("A meeting");
  await navigate(page, "Notes");
  await expect(page.locator(".note-item")).toHaveCount(1);
  await expect(page.locator(".note-item")).toContainText("Legacy note");
});

test("Topics, direkte Flags und strikt getrennte Notes bleiben nach Reload und Sicherung erhalten", async ({
  page,
}) => {
  await loadSample(page);
  await navigate(page, "Projects");
  await expect(page.locator(".table-wrap thead")).toHaveCount(1);
  await expect(
    page.getByRole("columnheader", { name: "Topic", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".topic-group-heading")).toHaveText([
    "Alpha 1",
    "Zulu 1",
    "No topic 1",
  ]);
  await expect(page.locator(".project-topic-group").nth(1)).toContainText(
    "PRJ-001",
  );
  await page.screenshot({
    path: "test-results/visual/feedback-topics.png",
    fullPage: true,
  });
  await page.getByLabel("Search projects").fill("Zulu");
  await expect(page.locator(".topic-group-heading")).toHaveText(["Zulu 1"]);
  await page.getByLabel("Search projects").fill("");
  await page.getByLabel("Filter topic").selectOption("a");
  await expect(page.locator(".topic-group-heading")).toHaveText(["Alpha 1"]);
  await page.getByLabel("Filter topic").selectOption("");

  await navigate(page, "Tasks");
  const flag = page.getByRole("button", {
    name: "Flag this task Do next",
    exact: true,
  });
  await flag.click();
  await expect(flag).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".detail-page")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/visual/feedback-tasks.png",
    fullPage: true,
  });
  await navigate(page, "Dashboard");
  await expect(page.locator(".dashboard-next")).toContainText("Flag this task");
  await expect(page.locator(".dashboard-project-row")).not.toContainText(
    "Notes only",
  );
  await navigate(page, "Tasks");
  await flag.click();
  await expect(flag).toHaveAttribute("aria-pressed", "false");
  await flag.click();
  await page
    .getByRole("checkbox", { name: "Flag this task completed", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Flag this task completed",
      exact: true,
    }),
  ).toBeChecked();
  await expect(flag).toBeDisabled();
  await expect(flag).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("checkbox", { name: "Flag this task completed", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Flag this task completed",
      exact: true,
    }),
  ).not.toBeChecked();
  await flag.click();

  await navigate(page, "Events");
  await expect(page.locator(".event-item")).toHaveCount(1);
  await expect(
    page
      .getByRole("combobox", { name: "Category" })
      .locator('option[value="Notiz"]'),
  ).toHaveCount(0);
  await navigate(page, "Notes");
  await expect(page.locator(".note-item")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Timeline", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show note Legacy note", exact: true })
    .click();
  await expect(page.locator(".event-note")).toHaveText(
    "**Literal legacy text**",
  );
  await page.getByLabel("Search notes").fill("Legacy");
  await page.screenshot({
    path: "test-results/visual/feedback-notes.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "New note", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Time (optional)")).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("Discarded note");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Search notes")).toHaveValue("Legacy");
  await page.getByLabel("Search notes").fill("");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Saved note");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await page.getByLabel("Note text (optional)").fill("**New Markdown**");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".note-item")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Open note Saved note", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Edit note", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(page.getByLabel("Note text (optional)")).toHaveValue(
    "**New Markdown**",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Notes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open note Saved note", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete note Saved note", exact: true })
    .click();
  await page
    .locator(".delete-confirm")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Saved note",
  );
  await page
    .getByRole("button", { name: "Delete note Saved note", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.locator(".note-item")).toHaveCount(1);
  await navigate(page, "Tasks");
  await expect(flag).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(backup.todos[0].doNext).toBe(true);
  expect(backup.events).toHaveLength(2);
  expect(
    backup.events.find((item: { id: string }) => item.id === "n1").note,
  ).toBe("**Literal legacy text**");
});

test("Linktypen und Projektentwürfe mit Save/Cancel; getrennte Projektbereiche auch im schmalen Fenster", async ({
  page,
}) => {
  await loadSample(page);
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "Zulu project", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Tasks/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Events/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Notes/ })).toBeVisible();
  const header = page.locator(".project-header");
  await expect(
    header.getByRole("button", { name: "Add link", exact: true }),
  ).toHaveCount(0);
  await expect(header.locator(".row-actions")).toHaveCount(0);
  await expect(header.locator(".links-list li").nth(0)).toContainText("Folder");
  await expect(header.locator(".links-list li").nth(1)).toContainText(
    "Website",
  );
  await expect(header.locator(".links-list li").nth(2)).toContainText(
    "SharePoint",
  );
  await expect(header.getByRole("link", { name: /Web docs/ })).toHaveAttribute(
    "href",
    "https://example.com/docs",
  );
  await header
    .getByRole("button", { name: "Edit project", exact: true })
    .click();
  await header.getByLabel("Name", { exact: true }).fill("Discard name");
  page.once("dialog", (dialog) => dialog.accept());
  await header
    .locator(".links-list li")
    .first()
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await header.getByRole("button", { name: "Add link", exact: true }).click();
  await header.getByLabel("Label", { exact: true }).fill("Discard link");
  await header.getByLabel("URL or path").fill("https://discard.example.com");
  await header.getByRole("button", { name: "Save link", exact: true }).click();
  await header.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    header.getByRole("heading", { name: "Zulu project", exact: true }),
  ).toBeVisible();
  await expect(header.locator(".links-list li")).toHaveCount(3);
  await expect(header).not.toContainText("Discard link");
  await header
    .getByRole("button", { name: "Edit project", exact: true })
    .click();
  await header.getByRole("button", { name: "Add link", exact: true }).click();
  await header.getByLabel("Label", { exact: true }).fill("New site");
  await header.getByLabel("URL or path").fill("new.example.com");
  await header.getByRole("button", { name: "Save link", exact: true }).click();
  await header.getByRole("button", { name: "Save", exact: true }).click();
  await expect(header.locator(".row-actions")).toHaveCount(0);
  await expect(header.getByRole("link", { name: /New site/ })).toHaveAttribute(
    "href",
    "https://new.example.com",
  );
  await page.screenshot({
    path: "test-results/visual/feedback-project-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/visual/feedback-project-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await navigate(page, "Projects");
  await page.getByRole("button", { name: "Zulu project", exact: true }).click();
  await expect(header.locator(".links-list li")).toHaveCount(4);
  await navigate(page, "Settings");
  await expect(page.locator(".storage-settings")).toContainText(
    "Choose a storage folder in the Windows app",
  );
});
