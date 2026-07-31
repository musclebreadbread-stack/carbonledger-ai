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
  /*
   * Retries under CI, but not everywhere: `approvals-suppliers-actions.spec.ts`
   * pins `retries: 0` for itself, because it mutates a shared in-memory store and
   * a second attempt would run against state the first attempt already changed.
   * The reasoning is in that file's header.
   */
  retries: process.env.CI ? 2 : 0,
  /*
   * One worker under CI, for the same reason: workers are separate processes but
   * they share the single server, so parallel specs would race on that same store.
   */
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
    // Production builds fail closed by design. E2E intentionally exercises the
    // published demo accounts, so opt in explicitly with a test-only cookie key.
    env: {
      ENABLE_DEMO_MODE: "true",
      DEMO_SESSION_SECRET: "playwright-only-demo-session-secret-32-bytes",
    },
    // A cold production build is well past Playwright's 60s default.
    timeout: 240_000,
  },
});
