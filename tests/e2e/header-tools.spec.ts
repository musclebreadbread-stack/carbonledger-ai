import { expect, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

async function signInViewer(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .locator('[data-testid="test-account-signin"][data-account-email="viewer@hankook-mfg.co.kr"]')
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe("header productivity tools", () => {
  test("the advertised Ctrl+K shortcut opens the command palette", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+K");

    await expect(page.getByTestId("command-palette-input")).toBeVisible();
    await expect(page.getByRole("dialog")).toContainText(ko.command_palette.title);
  });

  test("the visible search trigger opens it too", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("command-palette-trigger").click();

    await expect(page.getByTestId("command-palette-input")).toBeFocused();
  });

  test("filtering and Enter navigate to the best matching page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+K");
    await page.getByTestId("command-palette-input").fill(ko.nav.targets);
    await page.getByTestId("command-palette-input").press("Enter");

    await expect(page).toHaveURL(/\/targets$/);
    await expect(page.locator("h1")).toHaveText(ko.targets.title);
  });

  test("an unmatched query shows an honest empty state", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+K");
    await page.getByTestId("command-palette-input").fill("definitely-no-such-command");

    await expect(page.getByTestId("command-empty")).toHaveText(ko.command_palette.empty);
  });

  test("the palette does not reintroduce pages hidden from a viewer", async ({ page }) => {
    await signInViewer(page);
    await page.keyboard.press("Control+K");

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("option", { name: ko.nav.settings, exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("option", { name: ko.nav.approvals, exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("option", { name: ko.nav.dashboard, exact: true })).toBeVisible();
  });

  test("the bell opens a derived queue whose links resolve", async ({ page }) => {
    await page.goto("/dashboard");
    const bell = page.getByTestId("notification-bell");
    const count = Number(await bell.getAttribute("data-notification-count"));
    expect(count).toBeGreaterThan(0);

    await bell.click();
    const items = page.getByTestId("notification-item");
    await expect(items).toHaveCount(count);

    for (const href of await items.evaluateAll((links) => links.map((link) => link.getAttribute("href")))) {
      expect(href).toMatch(/^\//);
      const response = await page.request.get(href!);
      expect(response.status(), `${href} should resolve`).toBe(200);
    }
  });

  test("the viewer's queue only points to routes visible to that role", async ({ page }) => {
    await signInViewer(page);
    const visible = new Set(
      await page.locator("aside nav a[href]").evaluateAll((links) =>
        links.map((link) => link.getAttribute("href")).filter((href): href is string => href !== null)
      )
    );

    await page.getByTestId("notification-bell").click();
    const hrefs = await page.getByTestId("notification-item").evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")).filter((href): href is string => href !== null)
    );
    for (const href of hrefs) expect(visible.has(href), href).toBe(true);
  });
});
