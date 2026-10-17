import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const timestamp = "2026-10-16T08:00:00.000Z";
const base = { createdAt: timestamp, updatedAt: timestamp };
const sample = () => ({
  schemaVersion: 4,
  exportedAt: timestamp,
  projectCategories: [
    { ...base, id: "z", name: "Zulu" },
    { ...base, id: "a", name: "Alpha" },
  ],
  projects: [
    {
      ...base,
      id: "p1",
      name: "Zulu project",
      status: "Aktiv",
      description: "",
      categoryId: "z",
    },
    {
      ...base,
      id: "p2",
      name: "Alpha project",
      status: "Aktiv",
      description: "",
      categoryId: "a",
    },
    { ...base, id: "p3", name: "Notes only", status: "Aktiv", description: "" },
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
  await expect(page.getByRole("status")).toContainText("Backup imported");
}

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

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
