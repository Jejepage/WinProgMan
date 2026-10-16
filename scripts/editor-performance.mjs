// Run after npm run build: node scripts/editor-performance.mjs
// Uses a temporary Edge context; never opens an installed app/user profile.
import { chromium, expect as baseExpect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const expect = baseExpect.configure({ timeout: 120_000 });

const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:5175";
const timestamp = "2026-10-16T08:00:00.000Z";
const base = { createdAt: timestamp, updatedAt: timestamp };
const paragraph =
  "A locally stored **formatted note** with ordinary text and a [link](https://example.com).\n\n";
const table = [
  `| ${Array.from({ length: 10 }, (_, i) => `Column ${i}`).join(" | ")} |`,
  `| ${Array(10).fill("---").join(" | ")} |`,
  ...Array.from(
    { length: 100 },
    (_, row) =>
      `| ${Array.from({ length: 10 }, (_, col) => `R${row} C${col}`).join(" | ")} |`,
  ),
].join("\n");
const fixtures = [
  ...[10_000, 100_000, 500_000].map((size) => ({
    id: `text-${size}`,
    note:
      paragraph.repeat(Math.floor(size / paragraph.length)) +
      "x".repeat(size % paragraph.length) +
      "\n",
  })),
  { id: "table-100x10", note: table + "\n" },
  {
    id: "code-1000-lines",
    note:
      "```js\n" +
      Array.from(
        { length: 1000 },
        (_, i) => `const value${i} = "line ${i}";`,
      ).join("\n") +
      "\n```\n",
  },
];
const backup = {
  schemaVersion: 4,
  exportedAt: timestamp,
  projectCategories: [],
  links: [],
  todos: [],
  projects: [
    {
      ...base,
      id: "performance-project",
      name: "Synthetic editor performance",
      description: "",
      status: "Aktiv",
    },
  ],
  events: fixtures.map(({ id, note }) => ({
    ...base,
    id,
    note,
    noteFormat: "markdown",
    projectId: "performance-project",
    category: "Notiz",
    title: id,
    date: "2026-10-16",
  })),
};
const results = {
  measuredAt: new Date().toISOString(),
  mode: "production preview, fresh headless Edge context",
  methodology: {
    elapsed:
      "Node wall time includes Playwright transport, locator/actionability checks and browser work; not pure editor CPU time.",
    input:
      "Browser beforeinput capture to next requestAnimationFrame, including synchronous editor transaction/layout work; a frame opportunity, not a physical screen paint measurement.",
    heap: "CDP usedSize after explicit garbage collection; coarse retained-heap diagnostic, not proof of absence of leaks.",
    thresholds:
      "100k opening target <1000ms and input p95 <50ms; measurements only, no flaky automated pass/fail threshold.",
  },
  samples: [],
};
let server;
let browser;
let serverOutput = "";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function timed(action) {
  const start = performance.now();
  await action();
  return Math.round((performance.now() - start) * 100) / 100;
}
async function isServing() {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}
async function startServer() {
  if (await isServing())
    throw new Error(
      "Port 5175 is already serving. Stop that server before measuring the production build.",
    );
  // Launch Vite directly, so the child PID belongs to the server and cleanup is reliable on Windows.
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "5175",
      "--strictPort",
    ],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  server.stdout.on("data", (data) => {
    serverOutput = (serverOutput + data).slice(-4000);
  });
  server.stderr.on("data", (data) => {
    serverOutput = (serverOutput + data).slice(-4000);
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error(`Preview exited: ${serverOutput}`);
    if (await isServing()) return;
    await delay(100);
  }
  throw new Error(`Preview did not start: ${serverOutput}`);
}
try {
  await startServer();
  browser = await chromium.launch({ channel: "msedge" });
  results.browser = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Luxembourg",
  });
  const page = await context.newPage();
  const remoteRequests = new Set();
  page.on("request", (request) => {
    const requested = new URL(request.url());
    if (
      (requested.protocol === "http:" || requested.protocol === "https:") &&
      requested.origin !== url
    )
      remoteRequests.add(request.url());
  });
  results.remoteRequests = [];
  page.setDefaultTimeout(120_000);
  await page.goto(url);
  await page.locator('input[type="file"]').setInputFiles({
    name: "synthetic-performance.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByRole("region", { name: "Import preview" }),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Replace data", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Backup imported");
  const ready = async () => {
    await expect(page.locator(".rich-note-editor")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.locator(".ProseMirror")).toBeVisible();
  };
  const open = async (id) => {
    await page.evaluate((next) => {
      location.hash = `detail=note&id=${next}`;
    }, id);
    await ready();
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  };
  const close = async () => {
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator(".rich-note-editor")).toHaveCount(0);
  };
  for (const fixture of fixtures) {
    console.log(`Measuring ${fixture.id}`);
    const sample = { id: fixture.id, sourceCharacters: fixture.note.length };
    sample.openWallMs = await timed(() => open(fixture.id));
    sample.sourceSwitchWallMs = await timed(async () => {
      await page.getByRole("button", { name: "Markdown", exact: true }).click();
      await expect(page.locator(".rich-note-editor textarea")).toBeVisible();
    });
    sample.formattedSwitchWallMs = await timed(async () => {
      await page
        .getByRole("button", { name: "Formatted", exact: true })
        .click();
      await ready();
    });
    if (fixture.id === "text-100000") {
      await page.locator(".ProseMirror").click();
      await page.keyboard.press("Control+End");
      await page.evaluate(() => {
        window.__editorInputSamples = [];
        document.querySelector(".ProseMirror").addEventListener(
          "beforeinput",
          () => {
            const start = performance.now();
            requestAnimationFrame(() =>
              window.__editorInputSamples.push(performance.now() - start),
            );
          },
          { capture: true },
        );
      });
      for (let i = 0; i < 40; i++) {
        await page.keyboard.type("x");
        await page.waitForFunction(
          (count) => window.__editorInputSamples.length >= count,
          i + 1,
        );
      }
      const values = await page.evaluate(() => window.__editorInputSamples);
      values.sort((a, b) => a - b);
      sample.input = {
        count: values.length,
        medianMs: values[Math.floor(values.length / 2)],
        p95Ms: values[Math.ceil(values.length * 0.95) - 1],
        maxMs: values.at(-1),
      };
    }
    sample.saveWallMs = await timed(async () => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator(".rich-note-editor")).toHaveCount(0);
    });
    results.samples.push(sample);
    console.log(JSON.stringify(sample));
  }
  // Warm once before baseline. Inspect retained heap after repeated mount/destroy.
  const cdp = await context.newCDPSession(page);
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  await open("text-10000");
  await close();
  const before = await heap();
  const mounts = [];
  for (let i = 0; i < 10; i++) {
    mounts.push(await timed(() => open("text-10000")));
    await close();
  }
  results.repeatedMount = {
    count: mounts.length,
    openWallMs: mounts,
    retainedHeapBeforeBytes: before,
    retainedHeapAfterBytes: await heap(),
    remainingEditorDomNodes: await page
      .locator(".ProseMirror,.milkdown")
      .count(),
  };
  await mkdir(new URL("../test-results/editor-visual/", import.meta.url), {
    recursive: true,
  });
  await open("table-100x10");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.screenshot({
    path: fileURLToPath(
      new URL(
        "../test-results/editor-visual/light-desktop.png",
        import.meta.url,
      ),
    ),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
    document
      .querySelector(".rich-note-editor")
      .scrollIntoView({ block: "start" });
  });
  await page.locator(".ProseMirror th").first().click();
  await page.screenshot({
    path: fileURLToPath(
      new URL("../test-results/editor-visual/dark-narrow.png", import.meta.url),
    ),
  });
  results.remoteRequests = [...remoteRequests];
} catch (error) {
  results.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    if (server && server.exitCode === null) {
      server.kill();
      await new Promise((resolve) => {
        server.once("exit", resolve);
        setTimeout(resolve, 3000);
      });
    }
    await mkdir(new URL("../test-results/", import.meta.url), {
      recursive: true,
    });
    await writeFile(
      new URL("../test-results/editor-performance.json", import.meta.url),
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(JSON.stringify(results, null, 2));
  }
}
