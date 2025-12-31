import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:8081",
    actionTimeout: 30000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  reporter: [["list"], ["junit", { outputFile: "test-results/results.xml" }]],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ]
});
