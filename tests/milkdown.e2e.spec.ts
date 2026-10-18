import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { ExportEnvelope } from "../src/domain/types";

const timestamp = "2026-10-16T08:00:00.000Z";
const base = { createdAt: timestamp, updatedAt: timestamp };
const legacy = "**Literal legacy**\r\n  Indented <tag>\r\nLast line";
const originalMarkdown =
  "Heading\n=======\n\nA _word_ and [reference][docs].\n\n[docs]: https://example.com/docs\n";
const code = "const value = `literal`;\n\tconsole.log(value);";

function fixture(): ExportEnvelope {
  return {
    schemaVersion: 6,
    tombstones: [],
    brainstorm: { text: "", revision: 0, updatedAt: timestamp },
    exportedAt: timestamp,
    projectCategories: [],
    projects: [
      {
        ...base,
        id: "p1",
        number: 1,
        name: "Editor project",
        description: "",
        status: "Aktiv",
      },
    ],
    links: [],
    todos: [],
    events: [
      {
        ...base,
        id: "legacy",
        projectId: "p1",
        title: "Legacy",
        category: "Notiz",
        date: "2026-10-16",
        note: legacy,
      },
      {
        ...base,
        id: "markdown",
        projectId: "p1",
        title: "Markdown",
        category: "Notiz",
        date: "2026-10-16",
        note: originalMarkdown,
        noteFormat: "markdown",
      },
      {
        ...base,
        id: "html",
        projectId: "p1",
        title: "Raw HTML",
        category: "Notiz",
        date: "2026-10-16",
        note: '<script>window.untrustedNote = true</script>\n<img src="https://untrusted.example/track.png" onerror="window.untrustedNote = true">',
        noteFormat: "markdown",
      },
      {
        ...base,
        id: "image",
        projectId: "p1",
        title: "Image",
        category: "Notiz",
        date: "2026-10-16",
        note: "![Preserved image](https://untrusted.example/image.png)",
        noteFormat: "markdown",
      },
      {
        ...base,
        id: "table",
        projectId: "p1",
        title: "Table and code",
        category: "Meeting",
        date: "2026-10-16",
        note: `| Name | Value |\n| --- | --- |\n| Keep | 42 |\n\n\`\`\`js\n${code}\n\`\`\`\n`,
        noteFormat: "markdown",
      },
    ],
  };
}

async function importBackup(page: Page, backup: ExportEnvelope) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "editor.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup imported");
}

async function load(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Load sample data" }),
  ).toBeVisible();
  await importBackup(page, fixture());
}

async function open(page: Page, id: string, kind = "note") {
  await page.goto(`/#detail=${kind}&id=${id}`);
  await expect(page.locator(".rich-note-editor")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}

const rich = (page: Page) =>
  page.locator('.ProseMirror[contenteditable="true"]');
const source = (page: Page) =>
  page.locator('textarea[aria-label="Note text (optional)"]');

test("wide tables scroll inside a narrow editor with readable reachable columns", async ({
  page,
}) => {
  await load(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "markdown");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  const headers = Array.from(
    { length: 10 },
    (_, index) => `Column ${index + 1}`,
  );
  const values = Array.from(
    { length: 10 },
    (_, index) => `Readable value ${index + 1}`,
  );
  await source(page).fill(
    `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n| ${values.join(" | ")} |\n`,
  );
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  const wrapper = rich(page).locator(".milkdown-table-block .table-wrapper");
  await wrapper.scrollIntoViewIfNeeded();
  await expect(rich(page).locator("table.children th")).toHaveCount(10);
  const metrics = await wrapper.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(metrics.scroll).toBeGreaterThan(metrics.client);
  expect(
    (await rich(page).locator("table.children th").first().boundingBox())!
      .width,
  ).toBeGreaterThanOrEqual(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await wrapper.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  expect(
    await wrapper.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  const lastColumn = rich(page).locator("table.children th").last();
  const bounds = await lastColumn.boundingBox();
  const viewport = await wrapper.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    viewport!.x + viewport!.width + 1,
  );
  expect(bounds!.x).toBeGreaterThanOrEqual(viewport!.x - 1);
  await lastColumn.click();
  await expect(lastColumn).toContainText("Column 10");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("canceling delete confirmation preserves the complete note draft and parent Cancel restores storage", async ({
  page,
}) => {
  await load(page);
  const before = (await exportBackup(page)).events;
  await open(page, "markdown");
  await page.getByLabel("Title", { exact: true }).fill("Uncommitted title");
  await rich(page).fill("Uncommitted body");
  await rich(page).press("Control+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete note Markdown", exact: true })
    .click();
  await expect(page.locator(".delete-confirm")).toBeVisible();
  await page
    .locator(".delete-confirm")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(page.locator(".rich-note-editor")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Uncommitted title",
  );
  await expect(rich(page)).toHaveText("Uncommitted body");
  await expect(rich(page).locator("strong")).toHaveText("Uncommitted body");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  expect((await exportBackup(page)).events).toEqual(before);
});

test("mixed-format links edit and remove their whole range and an open link dialog blocks Save", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await source(page).fill("[one **two** three](https://example.com)");
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await rich(page).locator("strong").getByText("two", { exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Edit link" });
  await expect(dialog.getByLabel("Link text")).toHaveValue("one two three");
  await expect(dialog.getByLabel("Link destination")).toHaveValue(
    "https://example.com",
  );
  await expect(
    page.getByRole("button", { name: "Markdown", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Formatted", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".event-editor")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Apply or close the link editor",
  );
  await expect(dialog).toBeVisible();
  await dialog
    .getByLabel("Link destination")
    .fill("https://example.com/updated");
  await dialog.getByRole("button", { name: "Apply link", exact: true }).click();
  // Different mark nesting can split one logical link into adjacent anchor nodes.
  expect((await rich(page).locator("a").allTextContents()).join("")).toBe(
    "one two three",
  );
  expect(
    await rich(page)
      .locator("a")
      .evaluateAll((anchors) =>
        anchors.every(
          (anchor) =>
            anchor.getAttribute("href") === "https://example.com/updated",
        ),
      ),
  ).toBe(true);
  await expect(rich(page).locator("strong")).toHaveText("two");
  await rich(page).locator("strong").getByText("two", { exact: true }).click();
  await expect(dialog.getByLabel("Link text")).toHaveValue("one two three");
  await expect(dialog.getByLabel("Link destination")).toHaveValue(
    "https://example.com/updated",
  );
  await dialog
    .getByRole("button", { name: "Remove link", exact: true })
    .click();
  await expect(rich(page).locator("a")).toHaveCount(0);
  await expect(rich(page)).toHaveText("one two three");
  await expect(rich(page).locator("strong")).toHaveText("two");
  await save(page);
  await page.reload();
  await open(page, "markdown");
  await expect(rich(page).locator("a")).toHaveCount(0);
  await expect(rich(page).locator("strong")).toHaveText("two");
});

async function exportBackup(page: Page): Promise<ExportEnvelope> {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  const downloaded = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export JSON ↓", exact: true })
    .click();
  return JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  ) as ExportEnvelope;
}

async function save(page: Page) {
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".event-editor")).toHaveCount(0);
}

async function paste(page: Page, plain: string, html = "") {
  await rich(page).focus();
  await rich(page).evaluate(
    (element, data) => {
      const clipboard = new DataTransfer();
      clipboard.setData("text/plain", data.plain);
      if (data.html) clipboard.setData("text/html", data.html);
      element.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { plain, html },
  );
}

test("formatted toolbar, keyboard history and source switching preserve saved edits", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await rich(page).fill("Formatted words");
  await rich(page).press("Control+a");
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(rich(page).locator("strong")).toHaveText("Formatted words");
  await rich(page).press("Control+i");
  await expect(rich(page).locator("em")).toHaveText("Formatted words");
  await rich(page).press("ArrowRight");
  await rich(page).press("End");
  await rich(page).pressSequentially(" appended");
  await rich(page).press("Control+z");
  await expect(rich(page)).not.toContainText("appended");
  await rich(page).press("Control+y");
  await expect(rich(page)).toContainText("appended");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(source(page)).toHaveValue(/Formatted words/);
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await expect(rich(page).locator("strong")).toContainText("Formatted words");
  await save(page);
  await page.reload();
  await open(page, "markdown");
  await expect(rich(page)).toContainText("appended");
  await expect(rich(page).locator("strong")).toContainText("Formatted words");
});

test("unchanged legacy and Markdown sources keep exact bytes and cancel discards the whole draft", async ({
  page,
}) => {
  await load(page);
  for (const id of ["legacy", "markdown"]) {
    await open(page, id);
    await page.getByRole("button", { name: "Markdown", exact: true }).click();
    if (id === "markdown")
      await expect(source(page)).toHaveValue(originalMarkdown);
    await page.getByRole("button", { name: "Formatted", exact: true }).click();
    await page.getByLabel("Title", { exact: true }).fill(`${id} renamed`);
    await save(page);
  }
  const backup = await exportBackup(page);
  expect(backup.events.find((event) => event.id === "legacy")).toMatchObject({
    note: legacy,
    projectId: "p1",
    createdAt: timestamp,
  });
  expect(
    backup.events.find((event) => event.id === "legacy")?.noteFormat,
  ).toBeUndefined();
  expect(backup.events.find((event) => event.id === "markdown")?.note).toBe(
    originalMarkdown,
  );
  await open(page, "markdown");
  await rich(page).fill("Discard formatted replacement");
  await page.getByLabel("Title", { exact: true }).fill("Discard title");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await source(page).fill("Discard source replacement");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.reload();
  const after = await exportBackup(page);
  expect(after.events).toEqual(backup.events);
});

test("event tables support row and column actions while code survives save, reload and backup round trip", async ({
  page,
}) => {
  await load(page);
  await open(page, "table", "event");
  const table = rich(page).locator("table.children");
  await expect(table.locator("tr")).toHaveCount(2);
  await table.getByText("42", { exact: true }).click();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page.getByRole("button", { name: "Row below", exact: true }).click();
  await expect(table.locator("tr")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page.getByRole("button", { name: "Column right", exact: true }).click();
  await expect(table.locator("tr").first().locator("th, td")).toHaveCount(3);
  await table.locator("tr").nth(1).locator("td").last().click();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete column", exact: true })
    .click();
  await expect(table.locator("tr").first().locator("th, td")).toHaveCount(2);
  await table.locator("tr").last().locator("td").first().click();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete row", exact: true }).click();
  await expect(table.locator("tr")).toHaveCount(2);
  await table.getByText("Keep", { exact: true }).click();
  await page.keyboard.press("End");
  await page.keyboard.insertText(" edited");
  await save(page);
  const backup = await exportBackup(page);
  const saved = backup.events.find((event) => event.id === "table")!;
  expect(saved.note).toContain("Keep edited");
  expect(saved.note).toContain(code);
  expect(saved).toMatchObject({
    category: "Meeting",
    projectId: "p1",
    noteFormat: "markdown",
  });
  await importBackup(page, backup);
  await page.reload();
  await open(page, "table", "event");
  await expect(table).toContainText("Keep edited");
  await expect(rich(page).locator(".cm-content")).toContainText(
    "console.log(value)",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await exportBackup(page)).events).toEqual(backup.events);
});

test("link editor rejects unsafe protocols and keeps a valid destination", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await rich(page).fill("Documentation");
  await rich(page).press("Control+a");
  await rich(page).press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Edit link" });
  await dialog.getByLabel("Link destination").fill("javascript:alert(1)");
  await dialog.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(rich(page).locator("a")).toHaveCount(0);
  await dialog.getByLabel("Link destination").fill("https://example.com/docs");
  await dialog.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    rich(page).getByRole("link", { name: "Documentation" }),
  ).toHaveAttribute("href", "https://example.com/docs");
  await rich(page).getByRole("link", { name: "Documentation" }).click();
  await dialog.getByLabel("Link text").fill("Updated documentation");
  await dialog.getByRole("button", { name: "Apply link", exact: true }).click();
  await expect(
    rich(page).getByRole("link", {
      name: "Updated documentation",
      exact: true,
    }),
  ).toHaveAttribute("href", "https://example.com/docs");
  await save(page);
  expect(
    (await exportBackup(page)).events.find((event) => event.id === "markdown")
      ?.note,
  ).toContain("https://example.com/docs");
});

test("HTML clipboard carries tables, code and checkbox states without active HTML", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await rich(page).fill("");
  await paste(
    page,
    "Name Value\nItem 42\nconst x = '<safe>';\nOpen\nDone",
    '<table><tr><td>Name</td><td>Value</td></tr><tr><td>Item</td><td>42</td></tr></table><pre><code class="language-js">const x = &apos;&lt;safe&gt;&apos;;</code></pre><ul><li><input type="checkbox">Open</li><li><input type="checkbox" checked>Done</li></ul><iframe src="https://untrusted.example/frame"></iframe>',
  );
  await expect(rich(page).locator("table.children")).toContainText("42");
  await expect(rich(page)).toContainText("const x = '<safe>';");
  await expect(rich(page).locator("iframe, input, script")).toHaveCount(0);
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(source(page)).toHaveValue(/\[ \] (?:&#x20;)?Open/);
  await expect(source(page)).toHaveValue(/\[x\] (?:&#x20;)?Done/);
  await expect(source(page)).toHaveValue(/const x = '<safe>';/);
  await save(page);
  await page.reload();
  await open(page, "markdown");
  await expect(rich(page).locator("table.children")).toContainText("Item");
  await expect(rich(page)).toContainText("Done");
});

test("paste replaces only selection, Ctrl+Shift+V stays literal and files cannot upload", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await rich(page).fill("before middle after");
  await rich(page).evaluate((element) => {
    const text = document
      .createTreeWalker(element, NodeFilter.SHOW_TEXT)
      .nextNode()!;
    const selection = window.getSelection()!;
    const range = document.createRange();
    range.setStart(text, 7);
    range.setEnd(text, 13);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await paste(page, "replacement", "<strong>replacement</strong>");
  await expect(rich(page)).toHaveText("before replacement after");
  await expect(rich(page).locator("strong")).toHaveText("replacement");
  await rich(page).press("Control+End");
  await rich(page).press("Enter");
  await rich(page).dispatchEvent("keydown", {
    key: "v",
    code: "KeyV",
    ctrlKey: true,
    shiftKey: true,
    bubbles: true,
  });
  await paste(page, "**Shortcut literal**", "<strong>Formatted HTML</strong>");
  await expect(rich(page)).toContainText("**Shortcut literal**");
  await expect(rich(page)).not.toContainText("Formatted HTML");
  const before = await rich(page).innerText();
  await rich(page).evaluate((element) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(["synthetic"], "image.png", { type: "image/png" }),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
    element.dispatchEvent(
      new DragEvent("drop", {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator(".editor-notice")).toContainText(
    "attachments are not supported",
  );
  expect(await rich(page).innerText()).toBe(before);
  await expect(rich(page).locator('img[src], a[href^="blob:"]')).toHaveCount(0);
  await save(page);
  const note =
    (await exportBackup(page)).events.find((event) => event.id === "markdown")
      ?.note || "";
  expect(note).not.toContain("blob:");
  expect(note).not.toContain("image.png");
});

test("toolbar Enter and Space work and list switching changes the current list without nesting", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await rich(page).fill("Keyboard words");
  await rich(page).press("Control+a");
  await page.getByRole("button", { name: "Bold", exact: true }).press("Enter");
  await expect(rich(page).locator("strong")).toHaveText("Keyboard words");
  await page
    .getByRole("button", { name: "Italic", exact: true })
    .press("Space");
  await expect(rich(page).locator("em")).toHaveText("Keyboard words");
  await rich(page).fill("List entry");
  await rich(page).press("Control+a");
  await page
    .getByRole("button", { name: "Checkbox list", exact: true })
    .press("Enter");
  await expect(rich(page).locator("li")).toHaveCount(1);
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(source(page)).toHaveValue(/\[ \] .*List entry/);
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await page
    .getByRole("button", { name: "Numbered list", exact: true })
    .click();
  await expect(rich(page).locator("ol li")).toHaveCount(1);
  await expect(rich(page).locator("ul")).toHaveCount(0);
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await expect(rich(page).locator("ul li")).toHaveCount(1);
  await expect(rich(page).locator("ol")).toHaveCount(0);
  await page.getByRole("button", { name: "Bullet list", exact: true }).click();
  await expect(rich(page).locator("li")).toHaveCount(0);
  await expect(rich(page)).toHaveText("List entry");
});

test("formatted HTML and literal plain paste stay safe, and checkbox lists are Markdown", async ({
  page,
}) => {
  await load(page);
  await open(page, "markdown");
  await rich(page).fill("");
  await paste(
    page,
    "Pasted bold",
    "<p><strong>Pasted bold</strong><script>window.untrustedNote = true</script></p>",
  );
  await expect(rich(page).locator("strong")).toHaveText("Pasted bold");
  await rich(page).press("End");
  await rich(page).press("Enter");
  await page.getByRole("checkbox", { name: "Paste as plain text" }).check();
  await paste(
    page,
    "**Literal stars**",
    "<p><strong>Different HTML</strong></p>",
  );
  await expect(rich(page)).toContainText("**Literal stars**");
  await expect(rich(page).locator("strong")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Paste as plain text" }).uncheck();
  await rich(page).press("End");
  await rich(page).press("Enter");
  await page
    .getByRole("button", { name: "Checkbox list", exact: true })
    .click();
  await page.keyboard.insertText("Checkable item");
  await save(page);
  const note =
    (await exportBackup(page)).events.find((event) => event.id === "markdown")
      ?.note || "";
  expect(note).toMatch(/\[ \] Checkable item/);
  expect(note).toContain("Pasted bold");
  expect(note).not.toContain("<script>");
  await page.reload();
  await open(page, "markdown");
  await expect(rich(page)).toContainText("Checkable item");
  expect(await page.evaluate(() => "untrustedNote" in window)).toBe(false);
});

test("unsupported HTML stays source-only and image notes do not request remote resources", async ({
  page,
}) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("untrusted.example"))
      remoteRequests.push(request.url());
  });
  await load(page);
  await open(page, "html");
  await expect(source(page)).toHaveValue(
    fixture().events.find((event) => event.id === "html")!.note!,
  );
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await expect(source(page)).toBeVisible();
  await expect(page.locator(".editor-notice")).toContainText("raw HTML");
  await save(page);
  await open(page, "image");
  // ProseMirror inserts empty separator IMG elements for cursor placement.
  await expect(rich(page).locator("img[src]")).toHaveCount(0);
  await expect(rich(page).locator("[data-image-placeholder]")).toContainText(
    "Preserved image",
  );
  await expect(rich(page)).toContainText("Preserved image");
  await save(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Notes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Show note Image", exact: true })
    .click();
  await expect(page.locator(".markdown-note img")).toHaveCount(0);
  await expect(page.locator(".markdown-note:visible")).toContainText(
    "Preserved image",
  );
  expect(remoteRequests).toEqual([]);
  expect(await page.evaluate(() => "untrustedNote" in window)).toBe(false);
  const backup = await exportBackup(page);
  expect(backup.events.find((event) => event.id === "html")?.note).toBe(
    fixture().events.find((event) => event.id === "html")?.note,
  );
  expect(backup.events.find((event) => event.id === "image")?.note).toBe(
    fixture().events.find((event) => event.id === "image")?.note,
  );
});

test("edited source transfers formatting, hard breaks and code safely in a narrow dark window", async ({
  page,
}) => {
  await load(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "markdown");
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  const edited =
    "## Source heading\n\nFirst **bold** line\nSecond ~~struck~~ line\n\n- [ ] Pending\n- [x] Finished\n\n```text\n<tag> is literal\n```\n";
  await source(page).fill(edited);
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await expect(rich(page).locator("h2")).toHaveText("Source heading");
  await expect(rich(page).locator("strong")).toHaveText("bold");
  await expect(rich(page).locator("del")).toHaveText("struck");
  await expect(rich(page).locator("br")).not.toHaveCount(0);
  await expect(rich(page).locator("pre code, .cm-content")).toContainText(
    "<tag> is literal",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Markdown", exact: true }).click();
  await expect(source(page)).toHaveValue(edited);
  await page.getByRole("button", { name: "Formatted", exact: true }).click();
  await save(page);
  await page.reload();
  await open(page, "markdown");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(rich(page).locator("h2")).toHaveText("Source heading");
  await expect(rich(page).locator("del")).toHaveText("struck");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await exportBackup(page)).events.find((event) => event.id === "markdown")
      ?.note,
  ).toBe(edited);
});
