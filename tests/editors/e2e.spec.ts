import { test, expect, type Page } from "@playwright/test";

async function createProject(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "+ New project", exact: true })
    .click();
  await page.getByLabel("Project name", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

async function openProject(page: Page, name: string) {
  await page
    .getByRole("button", { name: /Projects/, exact: false })
    .first()
    .click();
  await page.getByRole("button", { name, exact: true }).click();
}

test("event details are consistent without notes; related tasks can be added, linked and unlinked", async ({
  page,
}) => {
  await createProject(page, "Event workflow");
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Supplier meeting");
  await page.keyboard.press("Control+Enter");
  await page
    .getByRole("button", { name: "Supplier meeting", exact: true })
    .click();
  const details = page.locator(".event-details");
  await expect(details).toContainText("No note text.");
  await details.getByLabel("New related task").fill("Review proposal");
  await details
    .getByRole("button", { name: "Add related task", exact: true })
    .click();
  await expect(
    details.getByRole("checkbox", {
      name: "Review proposal completed",
      exact: true,
    }),
  ).toBeVisible();
  await details
    .getByRole("checkbox", { name: "Review proposal completed", exact: true })
    .click();
  await expect(
    page.locator(".todo-item").getByRole("checkbox", {
      name: "Review proposal completed",
      exact: true,
    }),
  ).toBeChecked();
  await details
    .getByRole("button", { name: "Unlink Review proposal", exact: true })
    .click();
  await expect(details).toContainText("No related tasks yet.");
  await details
    .getByLabel("Existing task")
    .selectOption({ label: "Review proposal" });
  await details.getByRole("button", { name: "Link task", exact: true }).click();
  await expect(
    details.getByRole("checkbox", {
      name: "Review proposal completed",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: "Review proposal edit", exact: true })
    .click();
  const taskDialog = page.getByRole("dialog", {
    name: "Edit task",
    exact: true,
  });
  await expect(taskDialog.getByLabel("Origin event")).toHaveValue(/.+/);
  await taskDialog
    .getByRole("button", { name: "Unlink event", exact: true })
    .click();
  await page.keyboard.press("Control+Enter");
  await expect(details).toContainText("No related tasks yet.");
  await page
    .getByRole("button", { name: "Edit event Supplier meeting", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Discarded edit");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Supplier meeting", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Edit event Supplier meeting",
      exact: true,
    }),
  ).toBeFocused();
  await page
    .locator('section[aria-label="Events"]')
    .getByRole("button", { name: "Timeline", exact: true })
    .click();
  await expect(page.locator(".timeline .event-details")).toContainText(
    "Related tasks",
  );
});

test("cross-tab project and task editors retain drafts and explicitly resolve conflicts", async ({
  page,
  context,
}) => {
  await createProject(page, "Concurrent project");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Original task");
  await page.keyboard.press("Control+Enter");
  const other = await context.newPage();
  await other.goto("/");
  await openProject(other, "Concurrent project");
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("My project draft");
  await other
    .getByRole("button", { name: "Edit project", exact: true })
    .click();
  await other.getByLabel("Name", { exact: true }).fill("Latest project");
  await other.keyboard.press("Control+Enter");
  await expect(page.getByRole("dialog")).toContainText(
    "This item has changed in another window.",
  );
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "My project draft",
  );
  await page
    .getByRole("button", { name: "Review changes", exact: true })
    .click();
  await expect(page.locator(".conflict-comparison")).toContainText(
    "Latest project",
  );
  await page
    .getByRole("button", { name: "Overwrite with my version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My project draft", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole("heading", { name: "My project draft", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Original task edit", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("My task draft");
  await other
    .getByRole("button", { name: "Original task edit", exact: true })
    .click();
  await other.getByLabel("Title", { exact: true }).fill("Latest task");
  await other.keyboard.press("Control+Enter");
  await expect(page.getByRole("dialog")).toContainText(
    "This item has changed in another window.",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "My task draft",
  );
  await page
    .getByRole("button", { name: "Reload latest version", exact: true })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Latest task",
  );
  await expect(page.locator(".conflict-notice")).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("deleting the parent in another window preserves an open project draft", async ({
  page,
  context,
}) => {
  await createProject(page, "Parent deletion");
  const other = await context.newPage();
  await other.goto("/");
  await openProject(other, "Parent deletion");
  await page.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Preserved draft");
  await other
    .getByRole("button", { name: "Edit project", exact: true })
    .click();
  other.once("dialog", (d) => void d.accept());
  await other
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("The item was deleted.");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Preserved draft",
  );
  await expect(
    page.getByRole("button", {
      name: "Overwrite with my version",
      exact: true,
    }),
  ).toHaveCount(0);
  await other.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Overwrite with my version",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Overwrite with my version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Preserved draft", exact: true }),
  ).toBeVisible();
});
