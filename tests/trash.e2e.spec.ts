import { expect, test, type Page } from "@playwright/test";

async function navigate(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: name !== "Projects" })
    .click();
}

test("gelöschte Aufgaben lassen sich per Rückgängig und über den Papierkorb wiederherstellen", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Tasks");
  const rows = page.locator(".todo-item");
  const before = await rows.count();
  expect(before).toBeGreaterThan(0);
  const title = (
    await rows
      .first()
      .getByRole("button", { name: / edit$/ })
      .innerText()
  ).trim();

  await rows
    .first()
    .getByRole("button", { name: / edit$/ })
    .click();
  await page.getByRole("button", { name: /delete$/ }).click();
  await expect(page.getByRole("status")).toContainText("Moved to trash");
  await expect(rows).toHaveCount(before - 1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(rows).toHaveCount(before);

  await rows
    .first()
    .getByRole("button", { name: / edit$/ })
    .click();
  await page.getByRole("button", { name: /delete$/ }).click();
  await expect(rows).toHaveCount(before - 1);
  await navigate(page, "Settings");
  const trash = page.getByRole("region", { name: "Trash" });
  await expect(trash).toContainText(title);
  await trash.getByRole("button", { name: "Restore" }).click();
  await expect(trash).toContainText("The trash is empty");
  await navigate(page, "Tasks");
  await expect(rows).toHaveCount(before);
  await page.reload();
  await navigate(page, "Tasks");
  await expect(rows).toHaveCount(before);
});

test("ein gelöschtes Projekt kehrt mit allen Inhalten aus dem Papierkorb zurück", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Tasks");
  const total = await page.locator(".todo-item").count();
  await navigate(page, "Projects");
  await page.locator(".project-title").first().click();
  await page.getByRole("button", { name: "Edit project" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await navigate(page, "Tasks");
  expect(await page.locator(".todo-item").count()).toBeLessThan(total);
  await navigate(page, "Settings");
  const trash = page.getByRole("region", { name: "Trash" });
  await trash.getByRole("button", { name: "Restore" }).first().click();
  await navigate(page, "Tasks");
  await expect(page.locator(".todo-item")).toHaveCount(total);
});

test("eine ersetzte lokale Fassung erscheint als Hinweis, lässt sich vergleichen und als Kopie wiederherstellen", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await navigate(page, "Tasks");
  const rows = page.locator(".todo-item");
  const before = await rows.count();
  // Simuliert das Ergebnis eines Syncs: eine ersetzte lokale Aufgabe im Papierkorb.
  await page.evaluate(async () => {
    const deviceId = "e2e-device-0001";
    localStorage.setItem("winprogman-device-id", deviceId);
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("winprogman", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("app", "readwrite");
      const store = tx.objectStore("app");
      const get = store.get("data");
      get.onsuccess = () => {
        const data = get.result;
        const todo = data.todos[0];
        const id = `conflict-${todo.id}-1`;
        data.tombstones.push({
          kind: "todo",
          id,
          rev: 1,
          deletedAt: new Date().toISOString(),
          conflict: { of: todo.id, by: deviceId, device: "Büro-PC" },
          record: { ...todo, id, title: "Meine verdrängte Fassung" },
        });
        store.put(data, "data");
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  const note = page.getByRole("button", {
    name: /Changed on another computer/,
  });
  await expect(note).toBeVisible();
  await note.click();
  const trash = page.getByRole("region", { name: "Trash" });
  await expect(trash).toContainText("changed on Büro-PC");
  await trash.getByText("Compare versions").click();
  await expect(trash.locator(".conflict-compare")).toContainText(
    "Meine verdrängte Fassung",
  );
  await trash.getByRole("button", { name: "Restore as copy" }).click();
  await expect(trash).toContainText("The trash is empty");
  await expect(note).toHaveCount(0);
  await navigate(page, "Tasks");
  await expect(rows).toHaveCount(before + 1);
  await expect(
    page.getByText("Meine verdrängte Fassung (other version)"),
  ).toBeVisible();
});
