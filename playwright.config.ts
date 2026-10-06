import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Each remote scenario renders up to five WebGL clients simultaneously.
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  timeout: 60000,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run serve",
      url: "http://localhost:8000/games",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: "npm run dev",
      env: { BROWSER: "none" },
      url: "http://localhost:8080",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
