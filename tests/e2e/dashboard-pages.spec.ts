/**
 * Content guards for the five pages the sidebar linked to before they existed:
 * `/targets`, `/approvals`, `/suppliers`, `/scope3` and `/ai-insights`.
 *
 * `routing.spec.ts` proves these routes resolve. This file proves they resolve
 * to the *right* thing — a page that renders an empty table, or renders raw
 * message keys, or shows an unsubstituted `{count}` placeholder, satisfies a
 * status-code check and fails here.
 *
 * Every assertion works on server-rendered DOM text. As noted in `fixtures.ts`,
 * this sandbox has no CJK fonts, so screenshots are useless and text assertions
 * are the only meaningful check.
 *
 * Scope note. `/approvals` and `/suppliers` are no longer read-only: both carry
 * Server Actions, covered by `approvals-suppliers-actions.spec.ts`. That file
 * mutates the in-memory store this one reads, so the assertions here are
 * deliberately written against the parts of the sample data it does not touch —
 * instance counts, the permanently rejected and permanently returned chains, and
 * the rejected/re-requested supplier pair. Adding an assertion here about a
 * mutable row would make this file order-dependent.
 */

import { expect, type Page, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

/** Counts fixed by the `sample-data.ts` providers under `src/lib`. */
const SAMPLE_TARGETS = 4;
const SAMPLE_APPROVAL_INSTANCES = 5;
const SCOPE3_CATEGORY_COUNT = 15;

/**
 * No page may leak an unsubstituted ICU placeholder or a raw message key.
 *
 * A missing interpolation value renders as `{name}` and next-intl renders a
 * missing key as the key path itself; both look plausible enough in a screenshot
 * to ship, so they are asserted against directly on every page.
 *
 * Reads `innerText` of `<main>` rather than `textContent` of `<body>`. Two
 * reasons, and the first one cost a debugging round: `textContent` includes the
 * contents of inline `<script>` tags, and the RSC flight payload embeds the
 * whole message catalogue verbatim — so every `{count}` in `ko.json` shows up as
 * a false positive. `innerText` returns only rendered text. Scoping to `<main>`
 * also excludes the sidebar, which is shared and covered elsewhere.
 */
async function expectNoUnresolvedMessages(page: Page, route: string) {
  const rendered = await page.locator("main").innerText();

  expect(rendered, `${route} should not contain an unsubstituted ICU placeholder`).not.toMatch(
    /\{[a-zA-Z]\w*\}/
  );
  expect(rendered, `${route} should not render a raw message key`).not.toContain("MISSING_MESSAGE");
  // next-intl falls back to the key path when a message is absent, which always
  // contains a dot between two identifier-ish words and never appears in copy.
  expect(rendered, `${route} should not render a message key path`).not.toMatch(
    /\b(?:targets|approvals|suppliers|scope3|ai)\.[a-z_]+\b/
  );
}

test.describe("targets", () => {
  test("renders the heading, sample notice and every sample target", async ({ page }) => {
    await page.goto("/targets");

    await expect(page.locator("h1")).toHaveText(ko.targets.title);
    await expect(page.getByTestId("sample-data-notice")).toContainText(
      ko.targets.sample_data_notice
    );
    await expect(page.getByTestId("target-row")).toHaveCount(SAMPLE_TARGETS);
    await expect(page.getByTestId("target-detail")).toHaveCount(SAMPLE_TARGETS);
  });

  test("shows all three target types the product promises", async ({ page }) => {
    await page.goto("/targets");

    const body = page.locator("body");
    await expect(body).toContainText(ko.targets.type_absolute);
    await expect(body).toContainText(ko.targets.type_intensity);
    await expect(body).toContainText(ko.targets.type_sbti);
  });

  test("a target with no measured year says so instead of claiming 0% progress", async ({
    page,
  }) => {
    await page.goto("/targets");

    // The draft Scope 3 target has an empty progress array.
    await expect(page.getByText(ko.targets.no_progress_data)).toBeVisible();
    await expect(page.getByText(ko.targets.verdict_no_data).first()).toBeVisible();
  });

  test("progress bars stay within their track", async ({ page }) => {
    await page.goto("/targets");

    const bars = page.getByRole("progressbar");
    const count = await bars.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const value = Number(await bars.nth(index).getAttribute("aria-valuenow"));
      // The clamp in `assessTarget` is what keeps an over-achieving target from
      // overflowing the bar; this is the assertion that it reached the UI.
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  test("states the SBTi threshold as a number, fully interpolated", async ({ page }) => {
    await page.goto("/targets");

    const expected = ko.targets.sbti_threshold.replace("{rate}", "4.2");
    await expect(page.getByText(expected)).toBeVisible();
  });

  test("no unresolved messages", async ({ page }) => {
    await page.goto("/targets");
    await expectNoUnresolvedMessages(page, "/targets");
  });
});

test.describe("approvals", () => {
  test("renders every sample instance and the four-stage chain", async ({ page }) => {
    await page.goto("/approvals");

    await expect(page.locator("h1")).toHaveText(ko.approvals.title);
    await expect(page.getByTestId("approval-row")).toHaveCount(SAMPLE_APPROVAL_INSTANCES);
    await expect(page.getByTestId("approval-chain")).toHaveCount(SAMPLE_APPROVAL_INSTANCES);

    // All four stage labels must appear, including stages not yet reached.
    const body = page.locator("body");
    await expect(body).toContainText(ko.approvals.stages.author);
    await expect(body).toContainText(ko.approvals.stages.reviewer);
    await expect(body).toContainText(ko.approvals.stages.approver);
    await expect(body).toContainText(ko.approvals.stages.final);
  });

  test("every rendered signature verifies", async ({ page }) => {
    await page.goto("/approvals");

    const badges = page.getByTestId("signature-badge");
    const count = await badges.count();
    // The sample data signs each completed step with the real signing code, so
    // there must be signatures to check; zero would mean the page silently
    // rendered no chain at all.
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await expect(badges.nth(index)).toHaveText(ko.approvals.signature_verified);
    }
    await expect(page.getByText(ko.approvals.signature_invalid)).toHaveCount(0);
  });

  test("distinguishes a rejection from a return for revision", async ({ page }) => {
    await page.goto("/approvals");

    const body = page.locator("body");
    await expect(body).toContainText(ko.approvals.actions.reject);
    await expect(body).toContainText(ko.approvals.actions.return_for_revision);
  });

  test("names the signature algorithm actually in force", async ({ page }) => {
    await page.goto("/approvals");

    // No APPROVAL_SIGNING_KEY in this environment, so the unkeyed digest is used
    // and the page must say so rather than implying a keyed signature.
    const expected = ko.approvals.signature_algorithm.replace("{algorithm}", "sha256");
    await expect(page.getByText(expected)).toBeVisible();
  });

  test("no unresolved messages", async ({ page }) => {
    await page.goto("/approvals");
    await expectNoUnresolvedMessages(page, "/approvals");
  });
});

test.describe("suppliers", () => {
  test("renders suppliers, requests and the Scope 3 roll-up", async ({ page }) => {
    await page.goto("/suppliers");

    await expect(page.locator("h1")).toHaveText(ko.suppliers.title);
    await expect(page.getByTestId("supplier-row").first()).toBeVisible();
    await expect(page.getByTestId("supplier-request-row").first()).toBeVisible();
    await expect(page.getByTestId("scope3-aggregate-row").first()).toBeVisible();
  });

  test("shows all four portal operations", async ({ page }) => {
    await page.goto("/suppliers");

    const body = page.locator("body");
    await expect(body).toContainText(ko.suppliers.request_statuses.submitted);
    await expect(body).toContainText(ko.suppliers.request_statuses.verified);
    await expect(body).toContainText(ko.suppliers.request_statuses.rejected);
    await expect(body).toContainText(ko.suppliers.re_request_badge);
  });

  test("keeps verified and unverified emissions in separate columns", async ({ page }) => {
    await page.goto("/suppliers");

    const body = page.locator("body");
    await expect(body).toContainText(ko.suppliers.verified_emissions);
    await expect(body).toContainText(ko.suppliers.pending_emissions);
    await expect(body).toContainText(ko.suppliers.aggregate_description);
  });

  test("does not double-count a re-requested submission", async ({ page }) => {
    await page.goto("/suppliers");

    // The re-request badge proves a superseding request is present in the table.
    await expect(page.getByText(ko.suppliers.re_request_badge).first()).toBeVisible();

    // And the roll-up must still list each category at most once.
    const numbers = await page
      .getByTestId("scope3-aggregate-row")
      .evaluateAll((rows) => rows.map((row) => row.querySelector("td")?.textContent?.trim() ?? ""));
    expect(numbers.length).toBe(new Set(numbers).size);
  });

  test("no unresolved messages", async ({ page }) => {
    await page.goto("/suppliers");
    await expectNoUnresolvedMessages(page, "/suppliers");
  });
});

test.describe("scope 3 categories", () => {
  test("renders all 15 categories, split upstream and downstream", async ({ page }) => {
    await page.goto("/scope3");

    await expect(page.locator("h1")).toHaveText(ko.scope3.title);
    await expect(page.getByTestId("scope3-category-row")).toHaveCount(SCOPE3_CATEGORY_COUNT);

    const body = page.locator("body");
    await expect(body).toContainText(ko.scope3.upstream_title);
    await expect(body).toContainText(ko.scope3.downstream_title);
  });

  test("names every category from the standard", async ({ page }) => {
    await page.goto("/scope3");

    const body = page.locator("body");
    for (const name of Object.values(ko.scope3_categories)) {
      await expect(body).toContainText(name);
    }
  });

  test("shows a relevant-but-uncalculated category as not calculated, not as zero", async ({
    page,
  }) => {
    await page.goto("/scope3");

    // Categories 8 and 11 are relevant with null emissions in the sample data.
    await expect(page.getByText(ko.scope3.not_calculated).first()).toBeVisible();
    await expect(page.getByText(ko.scope3.not_calculated_note)).toBeVisible();
  });

  test("treats not-relevant as a disclosure with a stated reason", async ({ page }) => {
    await page.goto("/scope3");

    const body = page.locator("body");
    await expect(body).toContainText(ko.scope3.relevance_not_relevant);
    await expect(body).toContainText(ko.scope3.relevance_not_assessed);
    await expect(body).toContainText(ko.scope3_exclusion_reasons.no_franchises);
  });

  test("no unresolved messages", async ({ page }) => {
    await page.goto("/scope3");
    await expectNoUnresolvedMessages(page, "/scope3");
  });
});

test.describe("ai insights", () => {
  test("renders findings from all three detectors", async ({ page }) => {
    await page.goto("/ai-insights");

    await expect(page.locator("h1")).toHaveText(ko.ai.title);

    // The sample series has faults planted for each detector, so an empty
    // findings table means the analysis did not run, not that the data is clean.
    const rows = page.getByTestId("ai-finding-row");
    expect(await rows.count()).toBeGreaterThan(0);

    const body = page.locator("body");
    await expect(body).toContainText(ko.ai.anomalies_title);
    await expect(body).toContainText(ko.ai.missing_title);
  });

  test("detects the planted outlier, intensity anomaly and step change", async ({ page }) => {
    await page.goto("/ai-insights");

    const findings = (await page.getByTestId("ai-finding-row").allTextContents()).join("\n");

    // Asserted by source name rather than by message text so the test still
    // means something if the wording changes.
    expect(findings).toContain(ko.emission_sources.boiler_1); // outlier
    expect(findings).toContain(ko.emission_sources.grid_electricity); // intensity
    expect(findings).toContain(ko.emission_sources.steam_purchased); // step change
    expect(findings).toContain(ko.emission_sources.company_fleet); // period gaps
    expect(findings).toContain(ko.emission_sources.refrigerant_topup); // no activity data
  });

  test("flags the unassessed Scope 3 category", async ({ page }) => {
    await page.goto("/ai-insights");

    // Category 15 is `not_assessed` in the sample inventory.
    const expected = ko.ai.findings.scope3_not_assessed.replace("{category}", "15");
    await expect(page.getByText(expected)).toBeVisible();
  });

  test("labels findings as deterministic rather than model-generated", async ({ page }) => {
    await page.goto("/ai-insights");

    await expect(page.getByText(ko.ai.source_deterministic).first()).toBeVisible();
    await expect(page.getByText(ko.ai.determinism_note)).toBeVisible();
    // No OPENAI_API_KEY in this environment, so the page must say the generative
    // features are on fallback rather than implying a model ran.
    await expect(page.getByText(ko.ai.model_not_configured)).toBeVisible();
  });

  test("no unresolved messages", async ({ page }) => {
    await page.goto("/ai-insights");
    await expectNoUnresolvedMessages(page, "/ai-insights");
  });
});

test.describe("localisation of the new pages", () => {
  /*
   * The new pages add twelve message namespaces. Switching locale is the cheapest
   * end-to-end check that all four catalogues actually resolve at runtime — the
   * parity unit test proves the keys match, but not that the page asks for the
   * keys it thinks it does.
   */
  for (const [route, heading] of [
    ["/targets", (m: typeof MESSAGES.en) => m.targets.title],
    ["/approvals", (m: typeof MESSAGES.en) => m.approvals.title],
    ["/suppliers", (m: typeof MESSAGES.en) => m.suppliers.title],
    ["/scope3", (m: typeof MESSAGES.en) => m.scope3.title],
    ["/ai-insights", (m: typeof MESSAGES.en) => m.ai.title],
  ] as const) {
    test(`${route} renders in English after switching locale`, async ({ page }) => {
      await page.goto(route);

      await page.getByTestId("locale-switcher").first().click();
      await page.getByRole("menuitem", { name: "English", exact: true }).click();

      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator("h1")).toHaveText(heading(MESSAGES.en));
      await expectNoUnresolvedMessages(page, `${route} (en)`);
    });
  }
});
