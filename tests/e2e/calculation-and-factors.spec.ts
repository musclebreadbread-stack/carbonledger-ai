import { expect, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

test.describe("emission pre-calculation", () => {
  test("calculates a result with the existing calculation engine", async ({ page }) => {
    await page.goto("/emissions/new");
    await page.locator("#activityData").fill("1000");
    await page.getByTestId("calculate-emissions").click();

    const result = page.getByTestId("calculation-result");
    await expect(result).toContainText(ko.emissions_new.total_co2e);
    await expect(result).toContainText("2.178 tCO2e");
    await expect(result).toContainText("CO2e");
  });

  test("validates activity data and does not pretend persistence exists", async ({ page }) => {
    await page.goto("/emissions/new");
    await page.getByTestId("calculate-emissions").click();

    await expect(page.getByTestId("activity-error")).toHaveText(ko.emissions_new.invalid_activity);
    await expect(page.getByRole("button", { name: ko.emissions_new.save_draft })).toBeDisabled();
    await expect(page.getByRole("button", { name: ko.emissions_new.submit_approval })).toBeDisabled();
    await expect(page.getByText(ko.emissions_new.persistence_unavailable)).toBeVisible();
  });

  test("changes source choices and units with the selected scope", async ({ page }) => {
    await page.goto("/emissions/new");
    await page.locator("#scope").selectOption("scope2");

    await expect(page.locator("#sourceType option")).toHaveCount(2);
    await expect(page.locator("#unit")).toHaveValue("kWh");
  });

  /*
   * Process emissions are the one source type with no published default factor.
   * The engine would quietly use 1.0, so the form has to demand the factor and
   * must not report a number until it has one.
   */
  test("requires an explicit factor for process emissions instead of defaulting", async ({
    page,
  }) => {
    await page.goto("/emissions/new");
    await page.locator("#sourceType").selectOption("process_emissions");
    await expect(page.locator("#unit")).toHaveValue("t");

    await page.locator("#activityData").fill("500");
    await page.getByTestId("calculate-emissions").click();
    await expect(page.getByTestId("activity-error")).toHaveText(
      ko.emissions_new.invalid_process_ef
    );
    await expect(page.getByTestId("calculation-result")).toHaveCount(0);

    await page.getByTestId("process-ef").fill("1.4");
    await page.getByTestId("calculate-emissions").click();
    await expect(page.getByTestId("calculation-result")).toContainText("0.7 tCO2e");
  });
});

test.describe("emission factor library", () => {
  test("searches the library and reports an empty result", async ({ page }) => {
    await page.goto("/emission-factors");
    await expect(page.getByTestId("factor-row")).toHaveCount(6);

    await page.getByTestId("factor-search").fill(ko.emission_factors.item_r410a);
    await expect(page.getByTestId("factor-row")).toHaveCount(1);
    await expect(page.getByTestId("factor-row")).toContainText(ko.emission_factors.item_r410a);

    await page.getByTestId("factor-search").fill("no-such-factor");
    await expect(page.getByTestId("factor-empty")).toHaveText(ko.emission_factors.no_results);
  });

  test("disables version comparison instead of silently doing nothing", async ({ page }) => {
    await page.goto("/emission-factors");
    await expect(page.getByRole("button", { name: ko.emission_factors.compare_versions })).toBeDisabled();
    await expect(page.getByText(ko.emission_factors.compare_unavailable)).toBeVisible();
  });
});
