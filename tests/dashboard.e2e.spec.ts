import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

test("important projects lead the dashboard, blocks collapse and Open tasks leads to Tasks", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  const important = page.locator(".dashboard-important");
  await expect(important).toContainText("Mark projects with the star");

  await navigate(page, "Projects");
  await page
    .getByRole("button", { name: /^Mark as important: Arbeitsplatz/ })
    .click();
  await navigate(page, "Dashboard");

  // The starred project shows even without open work, above the work block.
  await expect(important).toContainText("Arbeitsplatz erneuern");
  await expect(page.locator(".dashboard-projects")).not.toContainText(
    "Arbeitsplatz erneuern",
  );
  const importantBox = await important.boundingBox();
  const workBox = await page.locator(".dashboard-projects").boundingBox();
  expect(importantBox!.y).toBeLessThan(workBox!.y);

  const toggle = important.getByRole("button", { name: "Important projects" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(important.getByText("Arbeitsplatz erneuern")).toBeHidden();
  const work = page
    .locator(".dashboard-projects")
    .getByRole("button", { name: "Projects with open work" });
  await work.click();
  await expect(work).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(work).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(important.getByText("Arbeitsplatz erneuern")).toBeVisible();

  await page
    .getByRole("button", { name: /Open tasks/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Tasks", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Show completed" }),
  ).not.toBeChecked();
});

test("Fluent can be chosen, survives reload and keeps badges readable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await navigate(page, "Settings");
  await page
    .getByRole("group", { name: "Design variant" })
    .getByRole("button", { name: "Fluent", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "fluent");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-design", "fluent");

  for (const theme of ["Light", "Dark"]) {
    await navigate(page, "Settings");
    await page
      .getByRole("group", { name: "Color theme" })
      .getByRole("button", { name: theme, exact: true })
      .click();
    await page.getByRole("button", { name: "Close settings" }).click();
    for (const view of ["Dashboard", "Events"]) {
      await navigate(page, view);
      const lowest = await page.evaluate(() => {
        const channels = (value: string) =>
          (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
        const luminance = ([r, g, b]: number[]) => {
          const lin = (c: number) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        };
        const ratios = [
          ...document.querySelectorAll(
            ".status-label[data-status], .category[data-category]",
          ),
        ].map((badge) => {
          const style = getComputedStyle(badge);
          const a = luminance(channels(style.color));
          const b = luminance(channels(style.backgroundColor));
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        });
        return Math.min(...ratios);
      });
      expect(lowest).toBeGreaterThanOrEqual(4.5);
    }
  }
  // The menu keeps its subtitles as decoration only; names stay accessible.
  await expect(
    page
      .getByRole("navigation")
      .getByRole("button", { name: "Tasks", exact: true }),
  ).toBeVisible();
});
