import { defineConfig, devices } from "@playwright/test";

/**
 * E2E configuration.
 *
 * Tests run against a production build rather than `next dev`, as the Next.js
 * testing guide recommends: dev mode compiles routes on first request, which
 * turns the first navigation of every spec into a timing gamble.
 *
 * `reuseExistingServer` means a server you already have running locally is used
 * as-is and no rebuild happens.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /*
   * `open: "never"` matters: the default HTML reporter tries to serve the report
   * after a failing run, which hangs a non-interactive shell.
   */
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // A cold production build is well past Playwright's 60s default.
    timeout: 240_000,
  },
});
