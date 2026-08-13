import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 7_000,
  },
  fullyParallel: false,
  outputDir: "test-results/playwright",
  projects: [
    {
      name: "chromium-desktop",
      testIgnore: "pwa.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        serviceWorkers: "block",
      },
    },
    {
      name: "chromium-mobile",
      testIgnore: "pwa.spec.ts",
      use: {
        ...devices["Pixel 7"],
        channel: "chrome",
        contextOptions: {
          reducedMotion: "reduce",
        },
        serviceWorkers: "block",
      },
    },
    {
      name: "chromium-pwa",
      testMatch: "pwa.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        serviceWorkers: "allow",
      },
    },
  ],
  reporter: "list",
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173",
    reuseExistingServer: true,
    timeout: 120_000,
    url: "http://127.0.0.1:4173",
  },
});
