import { expect, test } from "@playwright/test";

test("Strg+K durchsucht alles, springt zum Treffer und führt Befehle aus", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Search and commands" });
  await expect(palette).toBeVisible();
  const search = palette.getByRole("combobox");
  await expect(search).toBeFocused();

  const project = await page
    .locator(".project-title")
    .first()
    .innerText()
    .catch(() => "");
  await search.fill("nichts-passendes-xyz");
  await expect(palette.getByRole("status")).toContainText("Nothing found");

  await search.fill("new task");
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(page.locator(".editor:visible")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: "Search", exact: true }).click();
  await search.fill(project.split(" ")[0] || "a");
  const options = palette.getByRole("option");
  await expect(options.first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);

  await page.keyboard.press("Control+k");
  await search.fill("Settings");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Trash" })).toBeVisible();
  await page.screenshot({
    path: "test-results/visual/settings-sync.png",
    fullPage: true,
  });

  await page.keyboard.press("Control+k");
  await search.fill("a");
  await page.screenshot({ path: "test-results/visual/palette.png" });
});

test("Dichte lässt sich unter Settings wählen und bleibt nach Reload erhalten", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute(
    "data-density",
    "comfortable",
  );
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const group = page.getByRole("group", { name: "Density", exact: true });
  await group.getByRole("button", { name: "Compact", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
});
