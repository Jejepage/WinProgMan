import { expect, test } from "@playwright/test";

test("Markdown fields use a proportional font and can stay white in dark mode", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings" })
    .click();
  await page
    .getByRole("group", { name: "Color theme" })
    .getByRole("button", { name: "Dark" })
    .click();
  await page.getByRole("button", { name: "Always white" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();

  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Notes" })
    .click();
  await page
    .getByRole("button", { name: /^Open note / })
    .first()
    .click();
  const surface = page.locator(".rich-note-editor .milkdown");
  const text = surface.locator(".ProseMirror");
  await expect(text).toBeVisible();
  const style = async () =>
    surface.evaluate((node) => {
      const prose = node.querySelector(".ProseMirror")!;
      return {
        background: getComputedStyle(node).backgroundColor,
        color: getComputedStyle(prose).color,
        font: getComputedStyle(prose).fontFamily,
      };
    });
  const white = await style();
  expect(white.background).toBe("rgb(255, 255, 255)");
  expect(white.color).toBe("rgb(0, 0, 0)");
  expect(white.font).not.toMatch(/mono/i);

  // The choice survives a reload; "Follow design" restores the dark field.
  await page.reload();
  await expect(text).toBeVisible();
  expect((await style()).background).toBe("rgb(255, 255, 255)");
  await page.evaluate(() =>
    localStorage.setItem("winprogman-markdown-paper", "theme"),
  );
  await page.reload();
  await expect(text).toBeVisible();
  expect((await style()).background).not.toBe("rgb(255, 255, 255)");
});
