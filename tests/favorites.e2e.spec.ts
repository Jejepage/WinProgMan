import { expect, test } from "@playwright/test";

test("Wichtig-Stern, Filter, Bericht, Link ohne Bearbeiten und Dashboard-Links", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();

  await page
    .getByRole("button", { name: /^Mark as important: Website/ })
    .click();
  await page.getByLabel("Important only").check();
  await expect(
    page.locator(".projects-table tbody tr:not(.topic-group-row)"),
  ).toHaveCount(1);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Report" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^winprogman-report-.*\.md$/);

  await page
    .getByRole("button", { name: "Website überarbeiten", exact: true })
    .click();
  await page.getByRole("button", { name: "Add link", exact: true }).click();
  await page.getByLabel("Label").fill("Schnelllink");
  await page.getByLabel("URL or path").fill("example.com");
  await page.getByRole("button", { name: "Save link" }).click();
  await expect(page.locator(".project-header .links-list")).toContainText(
    "Schnelllink",
  );
  await expect(
    page.getByRole("button", { name: "Edit project" }),
  ).toBeVisible();

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Dashboard" })
    .click();
  await page.getByRole("button", { name: "Add dashboard link" }).click();
  await page.getByLabel("Label").fill("Docs");
  await page.getByLabel("URL or path").fill("https://example.org");
  await page.getByRole("button", { name: "Save link" }).click();
  await page.reload();
  await expect(page.locator(".dashboard-links")).toContainText("Docs");
});
