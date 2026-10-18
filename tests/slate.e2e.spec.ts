import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

/** Lowest text/background contrast of all badges currently on the page. */
async function lowestBadgeContrast(page: Page) {
  return page.evaluate(() => {
    const channels = (value: string) =>
      (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = ([r, g, b]: number[]) => {
      const lin = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const badges = [
      ...document.querySelectorAll(
        ".status-label[data-status], .status-pill[data-status], .category[data-category]",
      ),
    ];
    const ratios = badges.map((badge) => {
      const style = getComputedStyle(badge);
      const a = luminance(channels(style.color));
      const b = luminance(channels(style.backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    return { count: badges.length, lowest: Math.min(...ratios) };
  });
}

test("Slate lässt sich wählen, bleibt nach Reload erhalten und hat lesbare Marken in Hell und Dunkel", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Settings");
  await page
    .getByRole("group", { name: "Design variant" })
    .getByRole("button", { name: "Slate", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-design", "slate");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-design", "slate");

  for (const theme of ["Light", "Dark"]) {
    await navigate(page, "Settings");
    await page
      .getByRole("group", { name: "Color theme" })
      .getByRole("button", { name: theme, exact: true })
      .click();
    await page.getByRole("button", { name: "Close settings" }).click();
    for (const view of ["Dashboard", "Projects", "Events"]) {
      await navigate(page, view);
      const { count, lowest } = await lowestBadgeContrast(page);
      if (count > 0) expect(lowest).toBeGreaterThanOrEqual(4.5);
    }
  }

  // Dieselbe Aufteilung wie bei Classic: Seitenleiste links, Inhalt rechts daneben.
  const sidebar = await page.locator(".sidebar").boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(sidebar!.x).toBeLessThan(main!.x);
  expect(sidebar!.height).toBeGreaterThan(main!.height / 2);
});
