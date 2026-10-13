import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function createProject(page: Page, name = "Browserprojekt") {
  await page
    .getByRole("button", { name: "+ Neues Projekt", exact: true })
    .click();
  await page.getByLabel("Projektname", { exact: true }).fill(name);
  await page
    .getByRole("button", { name: "Projekt anlegen", exact: true })
    .click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
}

test("vollständiger CRUD-Ablauf, Timeline, Sicherung und atomarer Import", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Beispieldaten laden" }),
  ).toBeVisible();
  await createProject(page);

  await page
    .getByRole("button", { name: "Projekt bearbeiten", exact: true })
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Geprüftes Projekt");
  await page.getByLabel("Kurzbeschreibung").fill("Browserabnahme");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Geprüftes Projekt", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "+ Link hinzufügen", exact: true })
    .click();
  await page.getByLabel("Anzeigename").fill("Dokumentation");
  await page.getByLabel("URL oder Pfad").fill("https://example.com/docs");
  await page
    .getByRole("button", { name: "Link speichern", exact: true })
    .click();
  const linkRow = page.locator(".links-list li");
  await expect(linkRow.getByRole("link")).toHaveAttribute(
    "href",
    "https://example.com/docs",
  );
  await linkRow
    .getByRole("button", { name: "Bearbeiten", exact: true })
    .click();
  await page.getByLabel("URL oder Pfad").fill("C:\\Projekte\\Dokumentation");
  await page
    .getByRole("button", { name: "Link speichern", exact: true })
    .click();
  await expect(linkRow).toContainText("C:\\Projekte\\Dokumentation");

  await page.getByRole("button", { name: "+ To-Do", exact: true }).click();
  await page.getByLabel("Titel", { exact: true }).fill("Aufgabe prüfen");
  await page.getByLabel("Datum (optional)", { exact: true }).fill("2020-01-01");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".todo-item")).toContainText("Überfällig");
  await page
    .getByRole("checkbox", { name: "Aufgabe prüfen erledigt", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Aufgabe prüfen erledigt",
      exact: true,
    }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "Aufgabe prüfen erledigt", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Aufgabe prüfen erledigt",
      exact: true,
    }),
  ).not.toBeChecked();
  await page
    .getByRole("button", { name: "Aufgabe prüfen bearbeiten", exact: true })
    .click();
  await page.getByLabel("Titel", { exact: true }).fill("Aufgabe fertig prüfen");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();

  await page
    .getByRole("button", { name: "Ereignis hinzufügen", exact: true })
    .click();
  const editor = page.locator(".event-editor");
  await editor.getByLabel("Titel", { exact: true }).fill("Meeting prüfen");
  await editor.getByLabel("Datum", { exact: true }).fill("2099-01-01");
  await editor.getByLabel("Uhrzeit (optional)").fill("09:30");
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Ereignis Meeting prüfen bearbeiten",
      exact: true,
    })
    .click();
  await editor
    .getByLabel("Notiztext (optional)")
    .fill("Zeile eins\n<script>kein HTML</script>\nZeile drei");
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".event-note")).toHaveText(
    "Zeile eins\n<script>kein HTML</script>\nZeile drei",
  );
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await expect(page.locator(".today-marker")).toBeVisible();
  await expect(page.locator(".timeline .event-item")).toHaveCount(1);
  await page
    .locator('section[aria-label="Ereignisse"]')
    .getByLabel("Kategorie", { exact: true })
    .selectOption("Notiz");
  await expect(page.locator(".timeline .event-item")).toHaveCount(0);
  await page
    .locator('section[aria-label="Ereignisse"]')
    .getByLabel("Kategorie", { exact: true })
    .selectOption("");
  await page
    .getByRole("button", { name: "Ereignis hinzufügen", exact: true })
    .click();
  await editor.getByLabel("Kategorie", { exact: true }).selectOption("Notiz");
  await expect(editor.getByLabel("Datum", { exact: true })).toBeDisabled();
  await editor.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator(".event-item")).toHaveCount(2);

  await page.reload();
  await page
    .getByRole("button", { name: /Projekte/, exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Projekt öffnen", exact: true })
    .click();
  await expect(page.locator(".todo-item")).toContainText(
    "Aufgabe fertig prüfen",
  );
  await expect(page.locator(".event-item")).toHaveCount(2);
  await expect(linkRow).toContainText("C:\\Projekte\\Dokumentation");

  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSON exportieren ↓", exact: true })
    .click();
  const download = await downloadEvent;
  const filePath = await download.path();
  const backup = JSON.parse(await readFile(filePath!, "utf8"));
  expect(backup.projects).toHaveLength(1);
  expect(backup.todos).toHaveLength(1);
  expect(backup.events).toHaveLength(2);
  expect(backup.links).toHaveLength(1);

  await page.locator('input[type="file"]').setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...backup, schemaVersion: 999 })),
  });
  await expect(page.getByRole("alert")).toContainText("schemaVersion");
  await expect(
    page.getByRole("heading", { name: "Geprüftes Projekt", exact: true }),
  ).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("region", { name: "Importvorschau" }),
  ).toContainText("1 Projekte");
  await page
    .getByRole("region", { name: "Importvorschau" })
    .getByRole("button", { name: "Abbrechen", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Importvorschau" }),
  ).toHaveCount(0);

  await page
    .getByRole("button", {
      name: "Ereignis Meeting prüfen löschen",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Endgültig löschen", exact: true })
    .click();
  await expect(page.locator(".event-item")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Aufgabe fertig prüfen löschen", exact: true })
    .click();
  await expect(page.locator(".todo-item")).toHaveCount(0);
  page.once("dialog", (dialog) => dialog.accept());
  await linkRow.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(linkRow).toHaveCount(0);

  await page.locator('input[type="file"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Bestand ersetzen", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Sicherung importiert");
  await page
    .getByRole("button", { name: "Projekt öffnen", exact: true })
    .click();
  await expect(page.locator(".todo-item")).toHaveCount(1);
  await expect(page.locator(".event-item")).toHaveCount(2);
  await expect(linkRow).toHaveCount(1);
  await page
    .getByRole("button", { name: "← Alle Projekte", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .locator(".project-card")
    .getByRole("button", { name: "Löschen", exact: true })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .locator(".project-card")
    .getByRole("button", { name: "Löschen", exact: true })
    .click();
  await expect(page.locator(".project-card")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Beispieldaten laden" }),
  ).toBeVisible();
});

test("schmales Fenster und explizite Beispieldaten", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Beispieldaten laden", exact: true })
    .click();
  await expect(page.locator(".overview-card")).not.toHaveCount(0);
  const assertNoOverflow = async () =>
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  await assertNoOverflow();
  await page
    .getByRole("button", { name: /Projekte/, exact: false })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Projekt öffnen", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await assertNoOverflow();
  await page
    .getByRole("button", { name: "Ereignis hinzufügen", exact: true })
    .click();
  await assertNoOverflow();
});
