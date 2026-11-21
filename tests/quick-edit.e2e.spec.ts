import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

test("status, owner and dates are changed directly in the project list", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await navigate(page, "Projects");
  const rows = page.locator(".projects-table tbody tr:not(.topic-group-row)");
  await expect(rows.first()).toHaveAttribute("aria-selected", "true");

  // Status: stored at once, with Undo.
  const status = page.getByRole("combobox", {
    name: "Status of Arbeitsplatz erneuern",
  });
  await status.selectOption({ label: "Paused" });
  await expect(page.locator(".message[role=status]")).toContainText(
    "Arbeitsplatz erneuern: status set to Paused.",
  );
  // Choosing in a row does not select that row.
  await expect(rows.first()).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(status).toHaveValue("Abgeschlossen");

  // Owner: a new person is typed and stored with Enter.
  const owner = page.getByRole("combobox", {
    name: "Owner of Website überarbeiten",
  });
  await owner.selectOption({ label: "New person…" });
  await page
    .getByRole("textbox", { name: "New owner of Website überarbeiten" })
    .fill("Anna Müller");
  await page.keyboard.press("Enter");
  await expect(owner).toHaveValue("Anna Müller");
  // The new name is offered for the other project right away.
  await page
    .getByRole("combobox", { name: "Owner of Arbeitsplatz erneuern" })
    .selectOption("Anna Müller");

  // Dates are hidden until switched on; the choice is remembered.
  await expect(page.locator(".projects-table thead")).not.toContainText(
    "Start",
  );
  await page.getByRole("checkbox", { name: "Dates" }).check();
  await expect(page.locator(".projects-table thead")).toContainText("Start");
  await page
    .getByRole("button", { name: "Change start date of Website überarbeiten" })
    .click();
  const start = page.getByLabel("Start date of Website überarbeiten");
  await start.fill("2026-12-01");
  await start.press("Enter");
  await expect(
    page.getByRole("button", {
      name: "Change start date of Website überarbeiten",
    }),
  ).toHaveText("01.12.26");
  // Esc keeps the old value.
  await page
    .getByRole("button", { name: "Change end date of Website überarbeiten" })
    .click();
  const end = page.getByLabel("End date of Website überarbeiten");
  await end.fill("2027-03-31");
  await end.press("Escape");
  await expect(
    page.getByRole("button", {
      name: "Change end date of Website überarbeiten",
    }),
  ).toHaveText("—");

  await page.reload();
  await navigate(page, "Projects");
  await expect(page.getByRole("checkbox", { name: "Dates" })).toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Owner of Arbeitsplatz erneuern" }),
  ).toHaveValue("Anna Müller");

  // The project page offers the same quick fields; Edit still works.
  await page
    .getByRole("button", { name: "Website überarbeiten", exact: true })
    .click();
  await expect(page.locator(".project-header")).toContainText("01.12.26");
  await page
    .getByRole("combobox", { name: "Status of Website überarbeiten" })
    .selectOption({ label: "Planned" });
  await page.getByRole("button", { name: "Edit project" }).click();
  await expect(
    page.getByRole("combobox", { name: "Status", exact: true }),
  ).toHaveValue("Geplant");
  await page.getByLabel("End date", { exact: true }).fill("2027-03-31");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".project-header")).toContainText("31.03.27");
});

test("the due date of a task is changed directly in the list", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await navigate(page, "Tasks");
  const due = page.getByRole("button", {
    name: "Change due date of Ideen sammeln",
  });
  await expect(due).toHaveText("—");
  await due.click();
  const field = page.getByLabel("Due date of Ideen sammeln");
  await field.fill("2030-05-17");
  await field.press("Enter");
  await expect(due).toHaveText("17.05.30");
  await page.reload();
  await expect(due).toHaveText("17.05.30");
  // Emptying the field removes the date again.
  await due.click();
  await field.fill("");
  await field.press("Enter");
  await expect(due).toHaveText("—");
});
