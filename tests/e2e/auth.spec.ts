/**
 * Sign-in has to actually do something.
 *
 * Before this, `/login` accepted any two strings and navigated to the dashboard,
 * where the header showed a hard-coded name and email and the sidebar showed every
 * page to everyone. So the assertions worth making are not "the form submits" but
 * "the session that came out of it changed what the app shows" — the identity in
 * the header, the pages in the nav, and the person a signature would be attributed
 * to.
 *
 * These specs run in demo mode (no `NEXT_PUBLIC_SUPABASE_URL` in this environment),
 * which is the path the published test accounts take. Playwright gives each test a
 * fresh context, so the session cookie does not leak between them.
 *
 * Read-only with respect to the in-memory approvals/suppliers store, deliberately:
 * `approvals-suppliers-actions.spec.ts` mutates it, and an assertion here about a
 * mutable row would make one of the two files order-dependent.
 */

import { expect, type Page, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

const ACCOUNTS = {
  companyAdmin: { email: "admin@hankook-mfg.co.kr", name: "김관리", role: ko.user_roles.company_admin },
  reviewer: { email: "reviewer@hankook-mfg.co.kr", name: "박검토", role: ko.user_roles.reviewer },
  auditor: { email: "auditor@hankook-mfg.co.kr", name: "정감사", role: ko.user_roles.auditor },
  viewer: { email: "viewer@hankook-mfg.co.kr", name: "최열람", role: ko.user_roles.viewer },
} as const;

const PASSWORD = "CarbonLedger!2024";

/** Signs in through the test-account shortcut and waits for the dashboard. */
async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator(`[data-testid="test-account-signin"][data-account-email="${email}"]`).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Nav labels currently rendered in the sidebar. */
async function navLabels(page: Page): Promise<string[]> {
  return page.locator("aside nav a").allInnerTexts();
}

test.describe("the sign-in screen", () => {
  test("says which sign-in path is live", async ({ page }) => {
    await page.goto("/login");

    // Demo mode in this environment. If this ever flips, the password below stops
    // working and the reason has to be visible on screen rather than guessed.
    await expect(page.getByTestId("login-mode-notice")).toContainText(ko.auth.demo_mode_title);
  });

  test("lists all five test accounts with the shared password", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByTestId("test-account-row")).toHaveCount(5);
    await expect(page.getByTestId("test-accounts")).toContainText(PASSWORD);
    for (const account of Object.values(ACCOUNTS)) {
      await expect(page.getByTestId("test-accounts")).toContainText(account.email);
      await expect(page.getByTestId("test-accounts")).toContainText(account.role);
    }
  });

  test("filling an account puts its credentials in the form without submitting", async ({
    page,
  }) => {
    await page.goto("/login");

    await page
      .locator(`[data-testid="test-account-fill"][data-account-email="${ACCOUNTS.viewer.email}"]`)
      .click();

    await expect(page.locator("#email")).toHaveValue(ACCOUNTS.viewer.email);
    await expect(page.locator("#password")).toHaveValue(PASSWORD);
    // Still on the login page: filling is not submitting.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("rejects a wrong password and says so", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(ACCOUNTS.companyAdmin.email);
    await page.locator("#password").fill("not-the-password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-error")).toHaveText(ko.auth.invalid_credentials);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("rejects an unknown account with the same message as a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nobody@example.com");
    await page.locator("#password").fill(PASSWORD);
    await page.getByTestId("login-submit").click();

    // Identical wording on purpose: distinguishing the two tells an anonymous
    // caller which addresses are registered.
    await expect(page.getByTestId("login-error")).toHaveText(ko.auth.invalid_credentials);
  });

  test("the SSO buttons are disabled rather than silently inert", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("button", { name: ko.auth.google_sso })).toBeDisabled();
    await expect(page.getByRole("button", { name: ko.auth.microsoft })).toBeDisabled();
  });

  test("links to a password reset page that exists", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: ko.auth.forgot_password }).click();

    // This link used to 404: there was no /forgot-password route at all.
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByText(ko.auth.forgot_password_title)).toBeVisible();
    await expect(page.getByTestId("forgot-password-demo-notice")).toContainText(
      ko.auth.forgot_password_demo
    );
  });
});

test.describe("a signed-in session", () => {
  test("puts the real account in the header, not a hard-coded one", async ({ page }) => {
    await signIn(page, ACCOUNTS.companyAdmin.email);

    await page.getByTestId("user-menu-trigger").click();
    const identity = page.getByTestId("user-menu-identity");
    await expect(identity).toContainText(ACCOUNTS.companyAdmin.name);
    await expect(identity).toContainText(ACCOUNTS.companyAdmin.email);
    await expect(identity).toContainText(ACCOUNTS.companyAdmin.role);
    // The values this replaced.
    await expect(identity).not.toContainText("admin@company.com");
  });

  test("shows the role and its permissions in settings", async ({ page }) => {
    await signIn(page, ACCOUNTS.companyAdmin.email);
    await page.goto("/settings");

    await expect(page.getByTestId("account-role")).toHaveText(ACCOUNTS.companyAdmin.role);
    // company_admin holds five of the seven permissions.
    await expect(page.getByTestId("account-permission")).toHaveCount(5);
    await expect(page.getByTestId("account-summary")).toContainText(ACCOUNTS.companyAdmin.email);
  });

  test("survives navigation and a full reload", async ({ page }) => {
    await signIn(page, ACCOUNTS.reviewer.email);

    await page.goto("/emissions");
    await page.reload();

    await page.getByTestId("user-menu-trigger").click();
    await expect(page.getByTestId("user-menu-identity")).toContainText(ACCOUNTS.reviewer.name);
  });

  test("attributes approval signatures to the signed-in user", async ({ page }) => {
    await signIn(page, ACCOUNTS.reviewer.email);
    await page.goto("/approvals");

    // Anonymous visitors see the site-admin stub; a real session must replace it.
    const actor = page.getByTestId("approval-actor");
    await expect(actor).toContainText(ACCOUNTS.reviewer.name);
    await expect(actor).toContainText(ACCOUNTS.reviewer.role);
  });

  test("signing out returns to the login screen and drops the identity", async ({ page }) => {
    await signIn(page, ACCOUNTS.viewer.email);

    await page.getByTestId("user-menu-trigger").click();
    await page.getByTestId("sign-out").click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/dashboard");
    await page.getByTestId("user-menu-trigger").click();
    // Back to the anonymous stub, which offers sign-in rather than sign-out.
    await expect(page.getByTestId("sign-in-link")).toBeVisible();
  });

  test("/login redirects an already signed-in visitor onward", async ({ page }) => {
    await signIn(page, ACCOUNTS.viewer.email);

    await page.goto("/login");

    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe("the nav follows the role", () => {
  test("an anonymous visitor sees every destination", async ({ page }) => {
    await page.goto("/dashboard");

    const labels = await navLabels(page);
    // A database-less deployment is a product preview; nothing is hidden behind a
    // role the visitor never chose.
    expect(labels).toContain(ko.nav.settings);
    expect(labels).toContain(ko.nav.approvals);
    expect(labels).toContain(ko.nav.audit_log);
  });

  test("the company admin keeps everything", async ({ page }) => {
    await signIn(page, ACCOUNTS.companyAdmin.email);

    const labels = await navLabels(page);
    expect(labels).toContain(ko.nav.settings);
    expect(labels).toContain(ko.nav.audit_log);
    expect(labels).toContain(ko.nav.approvals);
    expect(labels).toContain(ko.nav.suppliers);
  });

  test("the viewer loses the write and admin surfaces", async ({ page }) => {
    await signIn(page, ACCOUNTS.viewer.email);

    const labels = await navLabels(page);
    expect(labels).not.toContain(ko.nav.settings);
    expect(labels).not.toContain(ko.nav.audit_log);
    expect(labels).not.toContain(ko.nav.approvals);
    expect(labels).not.toContain(ko.nav.suppliers);
    // But still reaches the inventory a reader legitimately needs.
    expect(labels).toContain(ko.nav.dashboard);
    expect(labels).toContain(ko.nav.emissions);
    expect(labels).toContain(ko.nav.reports);
  });

  test("the auditor keeps the audit log and loses approvals", async ({ page }) => {
    await signIn(page, ACCOUNTS.auditor.email);

    const labels = await navLabels(page);
    // The pair that motivates the filter being capability-shaped rather than
    // permission-derived: reading the log is the auditor's job, approving is not.
    expect(labels).toContain(ko.nav.audit_log);
    expect(labels).not.toContain(ko.nav.approvals);
  });

  test("every link the filtered nav offers still resolves", async ({ page }) => {
    await signIn(page, ACCOUNTS.viewer.email);

    const hrefs = await page
      .locator("aside a[href]")
      .evaluateAll((anchors) =>
        anchors
          .map((anchor) => anchor.getAttribute("href"))
          .filter((href): href is string => href !== null && href.startsWith("/") && !href.includes("?"))
      );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of [...new Set(hrefs)]) {
      const response = await page.request.get(href);
      expect(response.status(), `${href} should not 404`).toBe(200);
    }
  });
});
