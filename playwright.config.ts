import { defineConfig, devices } from "@playwright/test";
import { UI_BASE_URL } from "./e2e/config";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 300_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "e2e-results/report", open: "never" }],
    ["json", { outputFile: "e2e-results/report/results.json" }],
  ],
  use: {
    baseURL: UI_BASE_URL,
    headless: false,
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
    timezoneId: "Asia/Dili",
    screenshot: "on",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
    acceptDownloads: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
