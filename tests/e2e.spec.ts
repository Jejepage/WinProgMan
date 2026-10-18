import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function openEditor(page: Page, trigger: Locator) {
  const pageCount = page.context().pages().length;
  await trigger.click();
  await expect(
    page.locator(".editor:visible, .event-editor:visible"),
  ).toBeVisible();
  await expect(
    page.locator(
      ".todo-item:visible, .event-item:visible, .tasks-table:visible",
    ),
  ).toHaveCount(0);
  expect(page.context().pages()).toHaveLength(pageCount);
  await page.screenshot({
    path: "test-results/visual/detail-view.png",
    fullPage: true,
  });
  return page;
}

async function saveEditor(page: Page, detail: Page) {
  await detail.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator(".editor:visible, .event-editor:visible"),
  ).toHaveCount(0);
}

async function createProject(page: Page, name = "Browserprojekt") {
  await page
    .getByRole("button", { name: "+ New project", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test("vollständiger CRUD-Ablauf, Timeline, Sicherung und atomarer Import", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Load sample data" }),
  ).toBeVisible();
  await createProject(page);

  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await expect(
    page
      .locator(".project-header")
      .getByRole("button", { name: "Save", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Edit project", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("Geprüftes Projekt");
  await page.getByLabel("Description").fill("Browserabnahme");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Geprüftes Projekt", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByLabel("Label").fill("Dokumentation");
  await page.getByLabel("URL or path").fill("example.com/docs");
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  const linkRow = page.locator(".links-list li");
  await expect(linkRow.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.com/docs",
  );
  await linkRow.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("URL or path").fill("C:\\Projekte\\Dokumentation");
  await page.getByRole("button", { name: "Save link", exact: true }).click();
  await expect(linkRow).toContainText("C:\\Projekte\\Dokumentation");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Aufgabe prüfen");
  await page
    .getByLabel("Due date (optional)", { exact: true })
    .fill("2020-01-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".todo-item")).toContainText("Overdue");
  await page
    .getByRole("checkbox", { name: "Aufgabe prüfen completed", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Aufgabe prüfen completed",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "Aufgabe prüfen completed", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Aufgabe prüfen completed",
      exact: true,
    }),
  ).not.toBeChecked();
  const taskEditor = await openEditor(
    page,
    page.getByRole("button", { name: "Aufgabe prüfen edit", exact: true }),
  );
  await expect(taskEditor.getByLabel("Title", { exact: true })).toHaveValue(
    "Aufgabe prüfen",
  );
  await taskEditor
    .getByLabel("Title", { exact: true })
    .fill("Aufgabe fertig prüfen");
  await saveEditor(page, taskEditor);
  await expect(page.locator(".todo-item")).toContainText(
    "Aufgabe fertig prüfen",
  );

  await page.getByRole("button", { name: "Add event", exact: true }).click();
  const editor = page.locator(".event-editor");
  await editor.getByLabel("Title", { exact: true }).fill("Meeting prüfen");
  await editor.getByLabel("Date", { exact: true }).fill("2099-01-01");
  await editor.getByLabel("Time (optional)").fill("09:30");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  const eventEditor = await openEditor(
    page,
    page.getByRole("button", {
      name: "Open event Meeting prüfen",
      exact: true,
    }),
  );
  await expect(eventEditor.getByLabel("Title", { exact: true })).toHaveValue(
    "Meeting prüfen",
  );
  await eventEditor
    .getByRole("button", { name: "Markdown", exact: true })
    .click();
  await eventEditor
    .getByLabel("Note text (optional)")
    .fill("Zeile eins\n<script>kein HTML</script>\nZeile drei");
  await saveEditor(page, eventEditor);
  await expect(page.locator(".markdown-note")).not.toBeVisible();
  const eventTitleEditor = await openEditor(
    page,
    page.getByRole("button", { name: "Meeting prüfen", exact: true }),
  );
  await expect(
    eventTitleEditor.getByLabel("Title", { exact: true }),
  ).toHaveValue("Meeting prüfen");
  await eventTitleEditor.getByLabel("Title", { exact: true }).fill("Verworfen");
  await eventTitleEditor
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Meeting prüfen", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Verworfen", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show note Meeting prüfen", exact: true })
    .click();
  await expect(page.locator(".markdown-note")).toBeVisible();
  await expect(page.locator(".markdown-note")).toHaveText(
    "Zeile eins\n<script>kein HTML</script>\nZeile drei",
  );
  await page
    .locator('section[aria-label="Events"]')
    .getByRole("button", { name: "Timeline", exact: true })
    .click();
  await expect(page.locator(".today-marker")).toBeVisible();
  await expect(page.locator(".timeline .event-item")).toHaveCount(1);
  await page
    .locator('section[aria-label="Events"]')
    .getByLabel("Category", { exact: true })
    .selectOption("Telefonat");
  await expect(page.locator(".timeline .event-item")).toHaveCount(0);
  await page
    .locator('section[aria-label="Events"]')
    .getByLabel("Category", { exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(editor.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(editor.getByLabel("Date", { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".event-item")).toHaveCount(2);

  await page.reload();
  await page
    .getByRole("button", { name: /Projects/, exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Geprüftes Projekt", exact: true })
    .click();
  await expect(page.locator(".todo-item")).toContainText(
    "Aufgabe fertig prüfen",
  );
  await expect(page.locator(".event-item")).toHaveCount(2);
  await expect(linkRow).toContainText("C:\\Projekte\\Dokumentation");

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const download = await downloadEvent;
  const filePath = await download.path();
  const backup = JSON.parse(await readFile(filePath!, "utf8"));
  expect(backup.projects).toHaveLength(1);
  expect(backup.todos).toHaveLength(1);
  expect(backup.events).toHaveLength(2);
  expect(backup.links).toHaveLength(1);

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Geprüftes Projekt", exact: true })
    .click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...backup, schemaVersion: 999 })),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Only backup formats 1, 2, 3, 4 and 5 are supported.",
  );
  await expect(
    page.getByRole("heading", { name: "Geprüftes Projekt", exact: true }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText("1 Projects");
  await page
    .getByRole("region", { name: "Import preview" })
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("button", {
      name: "Delete event Meeting prüfen",
      exact: true,
    }),
  ).toHaveCount(0);
  await openEditor(
    page,
    page.getByRole("button", {
      name: "Open event Meeting prüfen",
      exact: true,
    }),
  );
  await page
    .getByRole("button", {
      name: "Delete event Meeting prüfen",
      exact: true,
    })
    .click();
  await page
    .locator(".delete-confirm")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Meeting prüfen",
  );
  await page
    .getByRole("button", { name: "Delete event Meeting prüfen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.locator(".event-item")).toHaveCount(1);
  const deleteTaskEditor = await openEditor(
    page,
    page.getByRole("button", {
      name: "Aufgabe fertig prüfen edit",
      exact: true,
    }),
  );
  deleteTaskEditor.once("dialog", (dialog) => dialog.accept());
  await deleteTaskEditor
    .getByRole("button", { name: "Aufgabe fertig prüfen delete", exact: true })
    .click();
  await expect(page.locator(".todo-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await linkRow.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(linkRow).toHaveCount(0);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup imported");
  await page.locator(".project-title").click();
  await expect(page.locator(".todo-item")).toHaveCount(1);
  await expect(page.locator(".event-item")).toHaveCount(2);
  await expect(linkRow).toHaveCount(1);
  await page.locator(".breadcrumb").click();
  await page
    .locator(".table-wrap tbody tr:has(.project-title) .project-title")
    .click();
  await page.getByRole("button", { name: "Edit project" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(page.locator(".project-header")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Load sample data" }),
  ).toBeVisible();
});

test("schmales Fenster und explizite Beispieldaten", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await expect(page.locator(".dashboard-project-row")).not.toHaveCount(0);
  const assertNoOverflow = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await assertNoOverflow();
  await page
    .getByRole("button", { name: /Projects/, exact: false })
    .first()
    .click();
  await page.locator(".project-title").first().click();
  await page
    .locator('section[aria-label="Events"]')
    .getByRole("button", { name: "Timeline", exact: true })
    .click();
  await assertNoOverflow();
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await assertNoOverflow();
});

test("Projektstatus und Kategorien bleiben erhalten; Überblick zeigt alle offenen Aufgaben", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("region", { name: "Project topics" });
  await settings.getByLabel("Topic name").fill("Privat");
  await settings.getByRole("button", { name: "Add topic" }).click();
  await expect(settings.locator("li")).toHaveCount(1);
  await mkdir("test-results/visual", { recursive: true });
  await page.screenshot({
    path: "test-results/visual/settings-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/visual/settings-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await page
    .getByRole("button", { name: "+ New project", exact: true })
    .click();
  await page
    .getByLabel("Project name", { exact: true })
    .fill("Kategorienprojekt");
  await page
    .getByRole("combobox", { name: "Project status", exact: true })
    .selectOption("Geplant");
  await page
    .getByRole("combobox", { name: "Project topic", exact: true })
    .selectOption({ label: "Privat" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/visual/project-create-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.locator(".project-header")).toContainText(
    "Planned · Privat",
  );
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Pausiert");
  await page
    .locator(".project-header")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.getByRole("button", { name: "Settings" }).click();
  await settings.getByRole("button", { name: "Rename" }).click();
  await settings.getByLabel("Topic name").fill("Persönlich");
  await settings.getByRole("button", { name: "Save topic" }).click();
  await expect(settings.locator("li")).toContainText("Persönlich");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await page.getByRole("checkbox", { name: "Planned" }).uncheck();
  await page.getByRole("checkbox", { name: "Paused" }).uncheck();
  await page.getByRole("checkbox", { name: "Completed" }).uncheck();
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Paused" }).check();
  await page.getByRole("checkbox", { name: "In progress" }).uncheck();
  await page.getByLabel("Filter topic").selectOption({ label: "Persönlich" });
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(1);

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await downloadEvent).path())!, "utf8"),
  );
  expect(backup.schemaVersion).toBe(5);
  expect(backup.projectCategories[0].name).toBe("Persönlich");
  expect(backup.projects[0].status).toBe("Pausiert");
  expect(backup.projects[0].categoryId).toBe(backup.projectCategories[0].id);

  await page.getByRole("button", { name: "Settings" }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await settings.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(settings.locator("li")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await settings.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(settings.locator("li")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await expect(page.locator(".topic-group-heading")).toContainText("No topic");
  for (const name of ["Planned", "In progress", "Completed"])
    await page.getByRole("checkbox", { name }).check();
  await page.getByLabel("Filter topic").selectOption("");

  const timestamp = backup.exportedAt;
  const completedProject = {
    ...backup.projects[0],
    id: "completed-project",
    number: backup.projects[0].number + 1,
    name: "Abgeschlossenes Projekt",
    status: "Abgeschlossen",
  };
  const imported = {
    ...backup,
    projects: [...backup.projects, completedProject],
    todos: [
      ...Array.from({ length: 7 }, (_, i) => ({
        id: `open-${i}`,
        createdAt: timestamp,
        updatedAt: timestamp,
        projectId: backup.projects[0].id,
        title: `Offene Aufgabe ${i + 1}`,
        completed: false,
        ...(i === 0 ? { dueDate: "2020-01-01" } : {}),
      })),
      {
        id: "completed-open",
        createdAt: timestamp,
        updatedAt: timestamp,
        projectId: completedProject.id,
        title: "Offen trotz Abschluss",
        completed: false,
      },
      {
        id: "done",
        createdAt: timestamp,
        updatedAt: timestamp,
        projectId: completedProject.id,
        title: "Bereits erledigt",
        completed: true,
      },
    ],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: "categories.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(imported)),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toContainText("1 project topics");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(2);
  await expect(page.locator(".topic-group-heading").first()).toContainText(
    "Persönlich",
  );
  await page.reload();
  await expect(page.locator(".overview-todo")).toHaveCount(8);
  await expect(
    page.locator(".overview-todo").filter({ hasText: "Offene Aufgabe 7" }),
  ).toBeVisible();
  await expect(
    page.locator(".overview-todo").filter({ hasText: "Offen trotz Abschluss" }),
  ).toBeVisible();
  await expect(
    page.locator(".overview-todo").filter({ hasText: "Bereits erledigt" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".overview-todo").filter({ hasText: "Offene Aufgabe 1" }),
  ).toContainText("Overdue");
});

test("Markdown-Notizen, formatierte Zwischenablage und alte Klartext-Sicherungen", async ({
  page,
}) => {
  await page.goto("/");
  await createProject(page, "Markdownprojekt");
  await page.getByRole("button", { name: "Add note", exact: true }).click();
  const editor = page.locator(".event-editor");
  await editor.getByRole("button", { name: "Markdown", exact: true }).click();
  const source = editor.locator("textarea");
  await editor.getByLabel("Title", { exact: true }).fill("Markdownabnahme");
  const markdown =
    "## Bericht\n\n**Fett** und *kursiv*.\n\n- Erstens\n- Zweitens\n\n> Ein Zitat\n\n| Thema | Stand |\n| --- | --- |\n| Browser | geprüft |\n| SehrLangesTabellenfeldOhneLeerzeichenZurLayoutprüfungAufKleinenBildschirmen | Ein weiteres ausführliches Ergebnis |\n\n```ts\nconst wert = '<script>';\n```\n\n[Sicher](https://example.com) [Gefährlich](javascript:alert(1))\n\n<script>window.__markdownUnsafe = true</script>\n<img src=x onerror=\"window.__markdownUnsafe = true\">";
  await source.fill(markdown);
  await mkdir("test-results/visual", { recursive: true });
  await page.screenshot({
    path: "test-results/visual/markdown-editor-desktop.png",
    fullPage: true,
  });
  await editor.getByRole("button", { name: "Formatted", exact: true }).click();
  await expect(editor.getByRole("status")).toContainText("raw HTML");
  await expect(source).toHaveValue(markdown);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/visual/markdown-editor-mobile.png",
    fullPage: true,
  });
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".event-details")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Show note Markdownabnahme", exact: true })
    .click();
  await expect(
    page
      .locator(".event-item")
      .getByRole("heading", { name: "Bericht", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __markdownUnsafe?: boolean }).__markdownUnsafe,
    ),
  ).toBeUndefined();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await page.locator(".project-title").click();
  const markdownEditor = await openEditor(
    page,
    page.getByRole("button", {
      name: "Open note Markdownabnahme",
      exact: true,
    }),
  );
  await expect(markdownEditor.getByLabel("Note text (optional)")).toHaveValue(
    markdown,
  );
  await markdownEditor
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
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
  expect(backup.schemaVersion).toBe(5);
  expect(backup.events[0].note).toBe(markdown);
  expect(backup.events[0].noteFormat).toBe("markdown");
  const legacyNote = "**Klartext bleibt Klartext**\n<script>kein HTML</script>";
  const legacyEvent = {
    ...backup.events[0],
    id: "legacy-note",
    title: "Alte Klartextnotiz",
    note: legacyNote,
  };
  delete legacyEvent.noteFormat;
  const legacy = {
    ...structuredClone(backup),
    schemaVersion: 2,
    events: [legacyEvent],
  };
  delete legacy.brainstorm;
  for (const project of legacy.projects) delete project.number;
  for (const value of [backup, legacy]) {
    await page.locator('input[type="file"]').setInputFiles({
      name: "notes.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(value)),
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Replace data", exact: true })
      .click();
    await page.locator(".project-title").click();
    await page.locator(".event-note-toggle[aria-expanded]").click();
    if (value === backup) {
      await expect(
        page
          .locator(".event-item")
          .getByRole("heading", { name: "Bericht", exact: true }),
      ).toBeVisible();
    }
  }
  await expect(page.locator(".event-note")).toHaveText(legacyNote);
  await expect(
    page.locator(".event-note strong, .event-note script"),
  ).toHaveCount(0);
  const legacyEditor = await openEditor(
    page,
    page.getByRole("button", {
      name: "Open note Alte Klartextnotiz",
      exact: true,
    }),
  );
  await saveEditor(page, legacyEditor);
  await expect(page.locator(".event-note")).toHaveText(legacyNote);
  await expect(
    page.locator(".event-note strong, .event-note script"),
  ).toHaveCount(0);
  const editedLegacyEditor = await openEditor(
    page,
    page.getByRole("button", {
      name: "Open note Alte Klartextnotiz",
      exact: true,
    }),
  );
  await editedLegacyEditor
    .getByRole("button", { name: "Markdown", exact: true })
    .click();
  const legacySource = editedLegacyEditor.locator("textarea");
  const escapedLegacy = await legacySource.inputValue();
  await legacySource.fill(`${escapedLegacy}\nZusatz`);
  await saveEditor(page, editedLegacyEditor);
  await expect(page.locator(".markdown-note")).toHaveText(
    `${legacyNote}\nZusatz`,
  );
  await expect(
    page.locator(".markdown-note strong, .markdown-note script"),
  ).toHaveCount(0);
});

test("header actions, task filters and integrated event timeline", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(
    nav.getByRole("button", { name: "Timeline", exact: true }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(
    page.locator(".page-heading").getByRole("button", { name: "Add task" }),
  ).toBeVisible();
  const rows = page.locator(".tasks-table tbody tr");
  const initial = await rows.count();
  const openCount = await page
    .locator('.tasks-table input[aria-label$=" completed"]:not(:checked)')
    .count();
  const taskLabel = await rows
    .first()
    .getByRole("checkbox", { name: / completed$/ })
    .getAttribute("aria-label");
  const checkbox = page.getByRole("checkbox", {
    name: taskLabel!,
    exact: true,
  });
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await page.getByRole("button", { name: "Open tasks", exact: true }).click();
  await expect(rows).toHaveCount(openCount - 1);
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await expect(rows).toHaveCount(initial);
  await nav.getByRole("button", { name: "Events", exact: true }).click();
  await expect(
    page
      .locator(".page-heading")
      .getByRole("button", { name: "Add event", exact: true }),
  ).toBeVisible();
  const selector = await page
    .getByLabel("Category", { exact: true })
    .boundingBox();
  const toggle = await page
    .getByRole("button", { name: "List", exact: true })
    .boundingBox();
  expect(selector).not.toBeNull();
  expect(toggle).not.toBeNull();
  expect(
    Math.abs(selector!.y + selector!.height - toggle!.y - toggle!.height),
  ).toBeLessThan(2);
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".today-marker")).toBeVisible();
});

test("Add task and Add event use detail pages, preserve filters and only save confirmed drafts", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const detail = page.locator(".detail-page");
  const pageCount = page.context().pages().length;

  await nav.getByRole("button", { name: /Projects/ }).click();
  await page
    .getByRole("button", { name: "Arbeitsplatz erneuern", exact: true })
    .click();
  for (const kind of ["task", "event"] as const) {
    await openEditor(
      page,
      page.getByRole("button", { name: `Add ${kind}`, exact: true }),
    );
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText(
      `New ${kind}`,
    );
    await expect(page).toHaveURL(new RegExp(`detail=${kind}.*mode=new`));
    await expect(
      detail
        .getByRole("combobox", { name: "Project", exact: true })
        .locator("option:checked"),
    ).toHaveText("Arbeitsplatz erneuern");
    await detail.getByLabel("Title", { exact: true }).fill(`Projekt-${kind}`);
    await expect(detail.getByRole("button", { name: /Delete/ })).toHaveCount(0);
    await saveEditor(page, page);
    await expect(
      page.getByRole("heading", { name: "Arbeitsplatz erneuern", exact: true }),
    ).toBeVisible();
  }

  await nav.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search tasks" }).fill("Projekt");
  await page.getByRole("button", { name: "Open tasks", exact: true }).click();
  await openEditor(
    page,
    page.getByRole("button", { name: "Add task", exact: true }),
  );
  await detail.getByLabel("Title", { exact: true }).fill("Verworfene Aufgabe");
  await detail.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Search tasks" }),
  ).toHaveValue("Projekt");
  await expect(
    page.getByRole("button", { name: "Open tasks", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tasks-table tbody tr:visible")).toHaveCount(1);
  await openEditor(
    page,
    page.getByRole("button", { name: "Add task", exact: true }),
  );
  await detail
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({
      label: "Arbeitsplatz erneuern",
    });
  await detail.getByLabel("Title", { exact: true }).fill("Projekt-global-task");
  await saveEditor(page, page);
  await expect(
    page.getByRole("searchbox", { name: "Search tasks" }),
  ).toHaveValue("Projekt");
  await expect(page.locator(".tasks-table tbody tr:visible")).toHaveCount(2);

  await nav.getByRole("button", { name: "Events", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search events" }).fill("Projekt");
  await page.getByLabel("Category", { exact: true }).selectOption("Meeting");
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  for (const save of [false, true]) {
    await openEditor(
      page,
      page.getByRole("button", { name: "Add event", exact: true }),
    );
    await detail
      .getByRole("combobox", { name: "Project", exact: true })
      .selectOption({
        label: "Arbeitsplatz erneuern",
      });
    await detail
      .getByLabel("Title", { exact: true })
      .fill(save ? "Projekt-global-event" : "Verworfenes Ereignis");
    await detail
      .getByRole("button", { name: save ? "Save" : "Cancel", exact: true })
      .click();
    await expect(
      page.getByRole("searchbox", { name: "Search events" }),
    ).toHaveValue("Projekt");
    await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
      "Meeting",
    );
    await expect(
      page.getByRole("button", { name: "Timeline", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".timeline .event-item:visible")).toHaveCount(
      save ? 2 : 1,
    );
  }
  expect(page.context().pages()).toHaveLength(pageCount);

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
  const owner = backup.projects.find(
    (project: { name: string }) => project.name === "Arbeitsplatz erneuern",
  );
  expect(backup.projects[0].id).not.toBe(owner.id);
  expect(backup.todos).toHaveLength(6);
  expect(backup.events).toHaveLength(8);
  for (const item of [...backup.todos, ...backup.events]) {
    expect(item.title).not.toMatch(/^Verworfen/);
    if (item.title.startsWith("Projekt-"))
      expect(item.projectId).toBe(owner.id);
  }
  await page.reload();
  await nav.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(page.locator(".tasks-table tbody tr")).toHaveCount(6);
  await nav.getByRole("button", { name: "Events", exact: true }).click();
  await expect(page.locator(".event-item")).toHaveCount(7);
});

test("text search combines with existing list filters and can be cleared", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  const nav = page.getByRole("navigation", { name: "Main navigation" });

  await nav.getByRole("button", { name: /Projects/ }).click();
  await page
    .getByRole("searchbox", { name: "Search projects" })
    .fill("arbeitsplatz");
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(1);
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toContainText("Arbeitsplatz erneuern");
  await page.getByRole("checkbox", { name: "Completed" }).uncheck();
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(0);
  await expect(
    page.getByText("No projects match the current search or filters."),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Completed" }).check();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(2);

  await nav.getByRole("button", { name: "Tasks" }).click();
  await page
    .getByRole("searchbox", { name: "Search tasks" })
    .fill("arbeitsplatz erneuern");
  await expect(page.locator(".tasks-table tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Open tasks" }).click();
  await expect(page.locator(".tasks-table tbody tr")).toHaveCount(0);
  await expect(
    page.getByText("No tasks match this search and filter."),
  ).toBeVisible();
  await page.getByRole("button", { name: "All tasks" }).click();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".tasks-table tbody tr")).toHaveCount(4);

  await nav.getByRole("button", { name: "Events" }).click();
  await page
    .getByRole("searchbox", { name: "Search events" })
    .fill("ENTWURF ABSTIMMEN");
  await expect(page.locator(".event-item")).toHaveCount(1);
  await page.getByLabel("Category", { exact: true }).selectOption("Telefonat");
  await expect(page.locator(".event-item")).toHaveCount(0);
  await expect(
    page.getByText("No events match this search and filter."),
  ).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption("");
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.locator(".timeline .event-item")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".timeline .event-item")).toHaveCount(5);
});

test("Do next, event dates, project controls and theme work after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await expect(page.locator(".dashboard-next-row")).toHaveCount(1);
  const nav = page.getByRole("navigation", { name: "Main navigation" });

  await nav.getByRole("button", { name: "Tasks" }).click();
  await expect(page.locator(".tasks-table th")).toContainText([
    "Completed",
    "Do next",
    "Task",
    "Project",
    "Due date",
    "Created",
  ]);
  await expect(page.locator(".tasks-table tbody tr").first()).toContainText(
    "Entwurf besprechen",
  );
  await expect(page.locator(".tasks-table tbody tr").first()).toHaveClass(
    /is-do-next/,
  );
  const firstTaskEditor = await openEditor(
    page,
    page.getByRole("button", { name: "Entwurf besprechen edit" }),
  );
  await firstTaskEditor.getByLabel("Do next", { exact: true }).uncheck();
  await saveEditor(page, firstTaskEditor);
  await expect(page.locator(".tasks-table tbody tr").first()).toContainText(
    "Bestehende Inhalte sichten",
  );
  const secondTaskEditor = await openEditor(
    page,
    page.getByRole("button", { name: "Bestehende Inhalte sichten edit" }),
  );
  await secondTaskEditor.getByLabel("Do next", { exact: true }).check();
  await saveEditor(page, secondTaskEditor);
  await page.reload();
  await nav.getByRole("button", { name: "Tasks" }).click();
  await expect(page.locator(".tasks-table tbody tr").first()).toContainText(
    "Bestehende Inhalte sichten",
  );
  await expect(page.locator(".tasks-table tbody tr").first()).toContainText(
    "Do next",
  );

  await nav.getByRole("button", { name: "Events" }).click();
  await expect(page.locator(".event-item.is-past")).not.toHaveCount(0);
  await expect(page.locator(".event-item.is-upcoming")).not.toHaveCount(0);
  await expect(
    page
      .locator(".event-item")
      .getByText(/^(Past|Today|Upcoming)$/, { exact: true }),
  ).toHaveCount(0);
  const pastEventEditor = await openEditor(
    page,
    page.locator(".event-item.is-past .event-date-button").first(),
  );
  await pastEventEditor.reload();
  await expect(
    pastEventEditor.getByRole("heading", { name: "Edit event" }),
  ).toBeVisible();
  await pastEventEditor
    .locator(".event-editor")
    .getByRole("button", { name: "Cancel" })
    .click();
  await expect(page.locator(".event-item:visible")).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit event/ })).toHaveCount(
    0,
  );

  await nav.getByRole("button", { name: /Projects/ }).click();
  await expect(
    page.locator(".table-wrap").getByRole("button", { name: "Delete" }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Completed" }).uncheck();
  await expect(
    page.locator(".table-wrap tbody tr:has(.project-title)"),
  ).toHaveCount(1);
  await page
    .locator(".table-wrap tbody tr:has(.project-title) .project-title")
    .click();
  await page.getByRole("button", { name: "Edit project" }).click();
  await expect(
    page.getByRole("button", { name: "Delete project" }),
  ).toBeVisible();

  await nav.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await nav.getByRole("button", { name: "Settings" }).click();
  await expect(
    page.getByRole("button", { name: "Dark", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "System", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await nav.getByRole("button", { name: "Dashboard" }).click();
  await expect(page.locator(".dashboard-next-row")).toHaveCount(1);
  await page.locator(".dashboard-next-row input[type='checkbox']").click();
  await expect(page.locator(".dashboard-next-row")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".dashboard-next-row")).toHaveCount(0);
});
