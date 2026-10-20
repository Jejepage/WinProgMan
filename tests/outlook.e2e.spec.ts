import { expect, test, type Page } from "@playwright/test";
import { buildMsg } from "./msgFixture";

const mail = buildMsg({
  messageClass: "IPM.Note",
  subject: "Angebot Druckerei",
  senderName: "Ada Test",
  senderSmtp: "ada@example.test",
  body: "Guten Tag,\r\nanbei das Angebot.",
  delivered: new Date(Date.UTC(2026, 9, 15, 8, 44)),
  recipients: [{ name: "Bob", email: "bob@example.test", type: "to" }],
});
const meeting = buildMsg({
  messageClass: "IPM.Appointment",
  subject: "Abstimmung Layout",
  start: new Date(Date.UTC(2026, 9, 21, 9)),
  end: new Date(Date.UTC(2026, 9, 21, 9, 45)),
  location: "Raum 1",
});

/** Simulates Outlook dropping virtual .msg files (as Edge delivers them). */
async function drop(
  page: Page,
  selector: string,
  files: { name: string; bytes: Uint8Array }[],
) {
  await page.evaluate(
    ({ selector, files }) => {
      const transfer = new DataTransfer();
      for (const file of files)
        transfer.items.add(
          new File(
            [Uint8Array.from(atob(file.data), (c) => c.charCodeAt(0))],
            file.name,
          ),
        );
      transfer.setData("text/plain", "Outlook");
      const target = document.querySelector(selector)!;
      for (const type of ["dragenter", "dragover", "drop"])
        target.dispatchEvent(
          new DragEvent(type, {
            dataTransfer: transfer,
            bubbles: true,
            cancelable: true,
          }),
        );
    },
    {
      selector,
      files: files.map((file) => ({
        name: file.name,
        data: Buffer.from(file.bytes).toString("base64"),
      })),
    },
  );
}

async function openProject(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample data" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();
  await page
    .getByRole("button", { name: "Website überarbeiten", exact: true })
    .click();
  await expect(page.locator(".outlook-drop-zone")).toBeVisible();
}

test("Outlook-Mail auf Projekt ziehen, vorbelegt speichern und nach Reload behalten", async ({
  page,
}) => {
  await openProject(page);
  // While dragging, the overlay marks the project as drop target.
  await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "x.msg"));
    document
      .querySelector(".project-workspace")!
      .dispatchEvent(
        new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }),
      );
  });
  await expect(page.locator(".outlook-drop-overlay")).toBeVisible();

  await drop(page, ".project-workspace", [
    { name: "Angebot Druckerei.msg", bytes: mail },
  ]);
  await expect(page.getByRole("heading", { name: "New event" })).toBeVisible();
  await expect(page.locator(".outlook-drop-overlay")).toHaveCount(0);
  // Mail content is never put into the URL, only a token.
  expect(decodeURIComponent(page.url())).not.toContain("Angebot");
  expect(page.url()).toContain("prefill=");
  await expect(page.locator(".detail-page").getByLabel("Category")).toHaveValue(
    "Mail",
  );
  await expect(page.locator(".detail-page").getByLabel("Title")).toHaveValue(
    "Angebot Druckerei",
  );
  await expect(page.locator(".detail-page").getByLabel("Date")).toHaveValue(
    "2026-10-15",
  );
  await expect(
    page.locator(".detail-page").getByLabel("Time (optional)"),
  ).toHaveValue("10:44");
  const editor = page.locator(".rich-note-editor");
  await expect(editor).toContainText("From:");
  await expect(editor).toContainText("Ada Test (ada@example.test)");
  await expect(editor).toContainText("anbei das Angebot.");

  await page
    .locator(".detail-page")
    .getByRole("button", { name: "Save" })
    .click();
  await expect(page.locator(".outlook-drop-zone")).toBeVisible();
  const events = page.getByRole("region", { name: "Events" });
  await expect(
    events.getByRole("button", { name: "Angebot Druckerei", exact: true }),
  ).toBeVisible();

  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();
  await page
    .getByRole("button", { name: "Website überarbeiten", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Events" }).getByRole("button", {
      name: "Angebot Druckerei",
      exact: true,
    }),
  ).toBeVisible();

  // Dropping the same mail again warns about the existing event.
  await drop(page, ".project-workspace", [
    { name: "Angebot Druckerei.msg", bytes: mail },
  ]);
  await expect(
    page.getByText(/already has an event “Angebot Druckerei”/),
  ).toBeVisible();
  await page
    .locator(".detail-page")
    .getByRole("button", { name: "Cancel" })
    .click();
});

test("Termin vorbelegen, Abbruch, Hinweise und Schutz vor Fehl-Drops", async ({
  page,
}) => {
  await openProject(page);
  const before = await page.locator(".event-item").count();

  await drop(page, ".project-workspace", [
    { name: "Abstimmung Layout.msg", bytes: meeting },
    { name: "Angebot Druckerei.msg", bytes: mail },
  ]);
  await expect(page.locator(".detail-page").getByLabel("Category")).toHaveValue(
    "Meeting",
  );
  await expect(page.locator(".detail-page").getByLabel("Title")).toHaveValue(
    "Abstimmung Layout",
  );
  await expect(page.locator(".detail-page").getByLabel("Date")).toHaveValue(
    "2026-10-21",
  );
  await expect(
    page.locator(".detail-page").getByLabel("Time (optional)"),
  ).toHaveValue("11:00");
  await expect(page.locator(".rich-note-editor")).toContainText("Raum 1");
  await expect(
    page.getByText(/Only the first of 2 dropped items/),
  ).toBeVisible();

  // After a reload the in-memory prefill is gone; the page says so.
  await page.reload();
  await expect(
    page.getByText(/no longer available after reloading/),
  ).toBeVisible();
  await expect(page.locator(".detail-page").getByLabel("Title")).toHaveValue(
    "",
  );
  await page
    .locator(".detail-page")
    .getByRole("button", { name: "Cancel" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Projects" })
    .click();
  await page
    .getByRole("button", { name: "Website überarbeiten", exact: true })
    .click();
  await expect(page.locator(".event-item")).toHaveCount(before);

  // Other files are refused without leaving the project.
  await drop(page, ".project-workspace", [
    { name: "notes.txt", bytes: new TextEncoder().encode("just text") },
  ]);
  await expect(page.getByRole("alert")).toContainText(
    "Only Outlook mails and calendar items can be dropped here.",
  );
  await expect(page.locator(".outlook-drop-zone")).toBeVisible();

  // A file dropped outside the project is ignored instead of opening it.
  const url = page.url();
  await drop(page, "nav", [{ name: "Angebot Druckerei.msg", bytes: mail }]);
  await expect(page.locator(".outlook-drop-zone")).toBeVisible();
  expect(page.url()).toBe(url);
  const prevented = await page.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(["x"], "x.msg"));
    const event = new DragEvent("drop", {
      dataTransfer: transfer,
      bubbles: true,
      cancelable: true,
    });
    document.querySelector("nav")!.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
});
