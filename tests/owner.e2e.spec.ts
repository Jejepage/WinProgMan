import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

async function openProject(page: Page, name: string) {
  await navigate(page, "Projects");
  await page.getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: "Edit project" }).click();
}

test("projects get an owner from a dropdown, shown in list, filter and dashboard", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();

  await openProject(page, "Website überarbeiten");
  const owner = page.getByRole("combobox", { name: "Owner" });
  await expect(owner).toHaveValue("");
  await owner.selectOption({ label: "New person…" });
  await page.getByRole("textbox", { name: "Owner" }).fill("  Anna Müller ");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Owner of Website überarbeiten" }),
  ).toHaveValue("Anna Müller");

  // The second project offers the name from the list; a differently cased
  // entry is stored with the known spelling.
  await openProject(page, "Arbeitsplatz erneuern");
  await expect(
    page.getByRole("combobox", { name: "Owner" }).locator("option"),
  ).toHaveText(["Not assigned", "Anna Müller", "New person…"]);
  await page
    .getByRole("combobox", { name: "Owner" })
    .selectOption({ label: "New person…" });
  await page.getByRole("textbox", { name: "Owner" }).fill("anna müller");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Owner of Arbeitsplatz erneuern" }),
  ).toHaveValue("Anna Müller");
  await page.getByRole("button", { name: "Edit project" }).click();
  await page
    .getByRole("combobox", { name: "Owner" })
    .selectOption({ label: "Not assigned" });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Owner of Arbeitsplatz erneuern" }),
  ).toHaveValue("");

  await page.reload();
  await navigate(page, "Projects");
  const rows = page.locator(".projects-table tbody tr:not(.topic-group-row)");
  await expect(
    rows
      .filter({ hasText: "Website überarbeiten" })
      .locator(".project-owner-cell select"),
  ).toHaveValue("Anna Müller");
  const filter = page.getByLabel("Filter owner");
  await filter.selectOption("Anna Müller");
  await expect(rows).toHaveCount(1);
  await filter.selectOption("none");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Arbeitsplatz erneuern");
  await filter.selectOption("");
  await expect(rows).toHaveCount(2);

  await navigate(page, "Dashboard");
  await expect(page.locator(".dashboard-projects")).toContainText(
    "Owner: Anna Müller",
  );
});
