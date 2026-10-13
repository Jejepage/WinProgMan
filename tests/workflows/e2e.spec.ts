import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function project(page: Page, name: string) {
  await page
    .getByRole("button", { name: "+ New project", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}
async function capture(
  page: Page,
  title: string,
  kind: "Task" | "Event" | "Note" = "Task",
  date = "today",
) {
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Quick capture" });
  await dialog.getByLabel("Title", { exact: true }).fill(title);
  await dialog
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption(kind);
  if (kind !== "Note")
    await dialog
      .getByLabel(kind === "Task" ? "Due date (optional)" : "Date", {
        exact: true,
      })
      .fill(date);
  return dialog;
}

test("V2 capture, full-text search, agenda, focus, stable numbering and project restore", async ({
  page,
}) => {
  test.setTimeout(60000);
  page.on("dialog", (d) => void d.accept());
  await page.goto("/");
  await project(page, "Alpha");
  await expect(page.locator(".project-metadata")).toContainText("PRJ-001");
  const task = await capture(page, "Prepare proposal");
  await task.getByLabel("Do next", { exact: true }).check();
  await page.keyboard.press("Control+Enter");
  await expect(task).not.toBeVisible();
  await expect(page.locator(".todo-item")).toHaveCount(1);
  const note = await capture(page, "Architecture notes", "Note");
  await note
    .getByLabel("Note text", { exact: true })
    .fill(
      "## Storage decision\nUse **transactional** snapshots for the quartz migration.",
    );
  await note.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(note).not.toBeVisible();
  await page.keyboard.press("Control+Shift+f");
  const search = page.getByRole("dialog", { name: "Search everything" });
  await search.getByRole("searchbox").fill("QUARTZ transactional");
  await expect(search.locator(".search-result")).toHaveCount(1);
  await expect(search.locator("mark").first()).toBeVisible();
  await search.locator(".search-result").click();
  await expect(page.locator(".event-details")).toContainText(
    "quartz migration",
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.keyboard.press("Control+Shift+f");
    await search.getByRole("searchbox").fill("Prepare proposal");
    await search.locator(".search-result").click();
    await expect(
      page.getByRole("dialog").getByLabel("Title", { exact: true }),
    ).toHaveValue("Prepare proposal");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Next 7 Days", exact: true }),
  ).toContainText("Prepare proposal");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await project(page, "Beta");
  await expect(page.locator(".project-metadata")).toContainText("PRJ-002");
  const event = await capture(page, "Beta meeting", "Event");
  await event.getByLabel("Time (optional)").fill("09:00");
  await event.getByRole("button", { name: "Save event", exact: true }).click();
  await expect(event).not.toBeVisible();
  await page.getByRole("button", { name: "Dashboard", exact: true }).click();
  const agenda = page.getByRole("region", { name: "Next 7 Days", exact: true });
  await expect(agenda).toContainText("PRJ-001");
  await expect(agenda).toContainText("PRJ-002");
  await page.getByRole("button", { name: "Tasks", exact: true }).click();
  await page.getByRole("button", { name: "Focus", exact: true }).click();
  const focus = page.getByRole("dialog", { name: "Focus mode" });
  await expect(focus).toContainText("PRJ-001");
  await focus
    .getByRole("button", { name: "Mark completed", exact: true })
    .click();
  await expect(focus).not.toBeVisible();
  await expect(
    page.getByRole("checkbox", {
      name: "Prepare proposal completed",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await page.getByRole("button", { name: "Alpha", exact: true }).click();
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const trash = page.getByRole("region", { name: "Trash", exact: true });
  await expect(trash).toContainText("Alpha");
  await trash.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(trash).toContainText("Trash is empty");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await page.getByRole("button", { name: "Alpha", exact: true }).click();
  await expect(page.locator(".project-metadata")).toContainText("PRJ-001");
  await expect(page.locator(".todo-item")).toContainText("Prepare proposal");
  await expect(page.locator(".event-item")).toContainText("Architecture notes");
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: /Projects/ })
    .click();
  await project(page, "Gamma");
  await expect(page.locator(".project-metadata")).toContainText("PRJ-003");
});

test("V2 dialog keyboard, narrow dark layout and invalid import clears previous preview", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto("/");
  await project(page, "Keyboard project");
  await page.getByRole("button", { name: /Quick Capture/ }).click();
  const dialog = page.getByRole("dialog", { name: "Quick capture" });
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await dialog.getByLabel("Title", { exact: true }).fill("Do not save");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: /Quick Capture/ }),
  ).toBeFocused();
  await expect(page.locator(".todo-item")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+f");
  const search = page.getByRole("dialog", { name: "Search everything" });
  await search.getByRole("searchbox").fill("Keyboard");
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  const download = await downloadPromise;
  const buffer = await readFile((await download.path())!);
  await page.locator('input[type="file"]').setInputFiles({
    name: "valid.json",
    mimeType: "application/json",
    buffer,
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Invalid JSON");
});
