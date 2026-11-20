import { expect, test } from "@playwright/test";

test("the project list shows the tasks of the selected project beside it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();

  const side = page.locator(".projects-side-tasks");
  const rows = page.locator(".projects-table tbody tr:not(.topic-group-row)");
  // Without an earlier choice the first project shown is selected.
  await expect(rows.first()).toHaveAttribute("aria-selected", "true");
  await expect(side).toContainText("Website überarbeiten");
  await expect(side.locator(".tasks-table tbody tr")).toHaveCount(3);
  // The project column is gone in the side list.
  await expect(side.locator(".tasks-table thead")).not.toContainText("Project");

  // Both lists sit next to each other on a wide window.
  const table = await page.locator(".projects-panel").boundingBox();
  const tasks = await side.boundingBox();
  expect(tasks!.x).toBeGreaterThan(table!.x + table!.width - 1);

  // A click on the row (not the name) selects; the choice survives reload.
  const second = rows.filter({ hasText: "Arbeitsplatz erneuern" });
  await second.locator("td").nth(1).click();
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(side).toContainText("Arbeitsplatz erneuern");
  await expect(side).toContainText("No open tasks");
  await side.getByRole("switch", { name: "Show completed" }).check();
  await expect(side.locator(".tasks-table tbody tr")).toHaveCount(1);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();
  await expect(second).toHaveAttribute("aria-selected", "true");

  // Keyboard selection and the name still opening the project page.
  await rows.first().focus();
  await page.keyboard.press("Enter");
  await expect(side).toContainText("Website überarbeiten");
  await side.getByRole("button", { name: /Website überarbeiten/ }).click();
  await expect(page.locator(".project-header h1")).toHaveText(
    "Website überarbeiten",
  );
});
