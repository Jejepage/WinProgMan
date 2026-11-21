import { expect, test } from "@playwright/test";

test("the project page returns to the view it was opened from", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();

  // Dashboard → project → back to the dashboard.
  await page
    .locator(".dashboard-projects")
    .getByRole("button", { name: "Website überarbeiten" })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Website überarbeiten" }),
  ).toBeVisible();
  const back = page.getByRole("button", { name: "← Dashboard", exact: true });
  await expect(back).toBeVisible();
  // The origin survives a reload of the project page.
  await page.reload();
  await back.click();
  await expect(page).toHaveURL(/#view=dashboard$/);
  await expect(page.locator(".dashboard-projects")).toBeVisible();

  // Browser Back from the dashboard reopens the project with the same origin.
  await page.goBack();
  await expect(back).toBeVisible();

  // Tasks → project → back to the tasks.
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Tasks", exact: true })
    .click();
  await page
    .locator(".tasks-table")
    .getByRole("button", { name: "Website überarbeiten" })
    .first()
    .click();
  await page.getByRole("button", { name: "← Tasks", exact: true }).click();
  await expect(page).toHaveURL(/#view=tasks$/);

  // Opened from the project list, it still says "All projects".
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();
  await page
    .getByRole("button", { name: "Website überarbeiten", exact: true })
    .click();
  await page
    .getByRole("button", { name: "← All projects", exact: true })
    .click();
  await expect(page).toHaveURL(/#view=projects$/);
});
