import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

test("gelöschte Aufgaben lassen sich per Rückgängig und über den Papierkorb wiederherstellen", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Tasks");
  const rows = page.locator(".todo-item");
  const before = await rows.count();
  expect(before).toBeGreaterThan(0);
  const title = (
    await rows
      .first()
      .getByRole("button", { name: / edit$/ })
      .innerText()
  ).trim();

  await rows
    .first()
    .getByRole("button", { name: / edit$/ })
    .click();
  await page.getByRole("button", { name: /delete$/ }).click();
  await expect(page.getByRole("status")).toContainText("Moved to trash");
  await expect(rows).toHaveCount(before - 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rows).toHaveCount(before);

  await rows
    .first()
    .getByRole("button", { name: / edit$/ })
    .click();
  await page.getByRole("button", { name: /delete$/ }).click();
  await expect(rows).toHaveCount(before - 1);
  await navigate(page, "Settings");
  const trash = page.getByRole("region", { name: "Trash" });
  await expect(trash).toContainText(title);
  await trash.getByRole("button", { name: "Restore" }).click();
  await expect(trash).toContainText("The trash is empty");
  await navigate(page, "Tasks");
  await expect(rows).toHaveCount(before);
  await page.reload();
  await navigate(page, "Tasks");
  await expect(rows).toHaveCount(before);
});

test("ein gelöschtes Projekt kehrt mit allen Inhalten aus dem Papierkorb zurück", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Tasks");
  const total = await page.locator(".todo-item").count();
  await navigate(page, "Projects");
  await page.locator(".project-title").first().click();
  await page.getByRole("button", { name: "Edit project" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await navigate(page, "Tasks");
  expect(await page.locator(".todo-item").count()).toBeLessThan(total);
  await navigate(page, "Settings");
  const trash = page.getByRole("region", { name: "Trash" });
  await trash.getByRole("button", { name: "Restore" }).first().click();
  await navigate(page, "Tasks");
  await expect(page.locator(".todo-item")).toHaveCount(total);
});
