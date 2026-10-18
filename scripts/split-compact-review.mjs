import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Fresh synthetic browser profile; never accesses the native installation.
const browser = await chromium.launch({ channel: "msedge" });
const output = "test-results/split-review";
await mkdir(output, { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const nav = (name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
const screenshot = async (name) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    name,
  ).toBe(true);
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
};
try {
  await page.goto(process.env.REVIEW_URL || "http://127.0.0.1:5174");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await expect(page.locator(".dashboard-project-row").first()).toBeVisible();
  for (const design of ["classic", "split-compact"]) {
    await page
      .getByRole("combobox", { name: "Design", exact: true })
      .selectOption(design);
    for (const theme of ["Light", "Dark"]) {
      await nav("Settings");
      await page
        .getByRole("group", { name: "Color theme", exact: true })
        .getByRole("button", { name: theme, exact: true })
        .click();
      for (const view of [
        "Dashboard",
        "Projects",
        "Tasks",
        "Events",
        "Notes",
        "Brainstorm",
        "Settings",
      ]) {
        await nav(view);
        await screenshot(`${design}-${theme}-${view}`);
      }
      await nav("Projects");
      await page
        .getByRole("button", { name: "Website überarbeiten", exact: true })
        .click();
      await screenshot(`${design}-${theme}-project`);
      await page
        .getByRole("button", { name: "Edit project", exact: true })
        .click();
      await page.getByRole("button", { name: "Add link", exact: true }).click();
      await screenshot(`${design}-${theme}-project-editor`);
      await page
        .locator(".project-header > .editor")
        .first()
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await page.getByRole("button", { name: "Add note", exact: true }).click();
      await expect(
        page.locator('.detail-page [contenteditable="true"]'),
      ).toBeVisible();
      await screenshot(`${design}-${theme}-note-editor`);
      await page.setViewportSize({ width: 390, height: 844 });
      await screenshot(`${design}-${theme}-note-editor-mobile`);
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      if (design === "split-compact")
        await screenshot(`${design}-${theme}-project-mobile`);
      await page.setViewportSize({ width: 1440, height: 1000 });
      await nav("Tasks");
      await page
        .getByRole("searchbox", { name: "Search tasks", exact: true })
        .fill("No matching task at all");
      await screenshot(`${design}-${theme}-empty-tasks`);
      await page
        .getByRole("searchbox", { name: "Search tasks", exact: true })
        .fill("");
    }
  }
  console.log(`Visual review screenshots: ${output}`);
} finally {
  await browser.close();
}
