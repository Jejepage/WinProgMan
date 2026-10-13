import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/e2e.spec.ts",
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "msedge",
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Luxembourg",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: true,
  },
});
