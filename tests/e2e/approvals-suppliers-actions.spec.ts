/**
 * The interactive halves of `/approvals` and `/suppliers`, end to end.
 *
 * `dashboard-pages.spec.ts` proves both pages render the right content. This file
 * proves the Server Actions behind them work through a real browser: a decision
 * pressed in the UI advances the chain, is signed, survives a reload, and is
 * refused when it should be.
 *
 * Two things about this file that are not incidental:
 *
 * 1. **It mutates shared state.** There is no database; both pages read an
 *    in-memory store in the serving process (see `src/lib/approvals/store.ts`).
 *    Every spec in the run shares it, so the file is `mode: "serial"` — its own
 *    tests must not interleave — and each test acts on a *different* record so
 *    they do not fight over one. A consequence worth stating: a retry re-runs
 *    against already-mutated state, so `retries` must stay at 0 for this file to
 *    be meaningful. That is a property of having no database, not of the tests.
 *
 * 2. **It only touches records nothing else asserts on.** The permanently
 *    rejected chain (ER-2024-0109), the permanently returned one (ER-2024-0124),
 *    the rejected/re-requested supplier pair (REQ-004/REQ-004R) and one submitted
 *    request (REQ-009) are left alone, because `dashboard-pages.spec.ts` reads
 *    them to check that every status renders.
 *
 * Assertions prefer the resulting data — a status attribute, a new step row, a
 * signature badge — over the confirmation text. The confirmation is UI; the
 * recorded decision is the thing that has to be true.
 */

import { expect, type Locator, type Page, test } from "@playwright/test";
import { MESSAGES } from "./fixtures";

const ko = MESSAGES.ko;

test.describe.configure({ mode: "serial" });

/** The chain card for one record. */
function chain(page: Page, recordLabel: string): Locator {
  return page.locator(`[data-testid="approval-chain"][data-record-label="${recordLabel}"]`);
}

/** One row of the supplier requests table. */
function requestRow(page: Page, requestId: string): Locator {
  return page.locator(`[data-request-id="${requestId}"]`);
}

test.describe("approvals: advancing the chain", () => {
  test("names the acting user and role, so the signature is attributable", async ({ page }) => {
    await page.goto("/approvals");

    // Without a Supabase session the app acts as the documented stand-in
    // operator. The page has to say who that is and under which role, rather than
    // signing anonymously — and the role is also the answer to "why is that button
    // missing".
    await expect(page.getByTestId("approval-actor")).toContainText(ko.user_roles.site_admin);
  });

  test("offers only the actions the current stage permits", async ({ page }) => {
    await page.goto("/approvals");

    // ER-2024-0122 is awaiting the 승인자: approve, reject or send back.
    const card = chain(page, "ER-2024-0122");
    await expect(card.getByTestId("approval-action-approve")).toBeVisible();
    await expect(card.getByTestId("approval-action-reject")).toBeVisible();
    await expect(card.getByTestId("approval-action-return_for_revision")).toBeVisible();
    // Reviewing is the previous stage's action, submitting the author's.
    await expect(card.getByTestId("approval-action-review")).toHaveCount(0);
    await expect(card.getByTestId("approval-action-submit")).toHaveCount(0);

    // ER-2024-0121 is awaiting the 검토자, so the offer is different.
    const awaitingReview = chain(page, "ER-2024-0121");
    await expect(awaitingReview.getByTestId("approval-action-review")).toBeVisible();
    await expect(awaitingReview.getByTestId("approval-action-approve")).toHaveCount(0);

    // ER-2024-0124 was returned, so it is back at the 작성자 and only submitting
    // is on offer — the difference between a return and a rejection, in the UI.
    const returned = chain(page, "ER-2024-0124");
    await expect(returned.getByTestId("approval-action-submit")).toBeVisible();
    await expect(returned.getByTestId("approval-action-review")).toHaveCount(0);
  });

  test("a closed chain offers nothing at all", async ({ page }) => {
    await page.goto("/approvals");

    for (const label of ["ER-2024-0117", "ER-2024-0109"]) {
      const card = chain(page, label);
      await expect(card.getByTestId("approval-decision-form")).toHaveCount(0);
      await expect(card).toContainText(ko.approvals.decision_closed);
    }
  });

  test("records a review, advances 검토자 → 승인자 and signs the step", async ({ page }) => {
    await page.goto("/approvals");
    const card = chain(page, "ER-2024-0121");

    const stepsBefore = await card.getByTestId("approval-step").count();

    await card.getByTestId("approval-comment-input").fill("e2e review comment");
    await card.getByTestId("approval-action-review").click();

    await expect(card.getByTestId("approval-action-success")).toBeVisible();

    // The chain moved on: the reviewer's action is no longer on offer, the
    // approver's is.
    await expect(card.getByTestId("approval-action-approve")).toBeVisible();
    await expect(card.getByTestId("approval-action-review")).toHaveCount(0);

    // The decision is in the log with its comment and a verified signature.
    await expect(card).toContainText("e2e review comment");
    await expect(card).toContainText(ko.approvals.actions.review);
    // The row count is unchanged: the outstanding reviewer step became a completed
    // one, and the rest of the chain was re-planned rather than duplicated.
    expect(await card.getByTestId("approval-step").count()).toBe(stepsBefore);
    for (const badge of await card.getByTestId("signature-badge").all()) {
      await expect(badge).toHaveText(ko.approvals.signature_verified);
    }
  });

  test("the recorded decision survives a fresh request", async ({ page }) => {
    // The honest test of the in-memory store: a *new* request to the server, not
    // client state left over from the action's response.
    await page.goto("/approvals");
    const card = chain(page, "ER-2024-0121");

    await expect(card).toContainText("e2e review comment");
    await expect(card.getByTestId("approval-action-approve")).toBeVisible();
  });

  test("returns a record to the 작성자 without closing the chain", async ({ page }) => {
    await page.goto("/approvals");
    const card = chain(page, "ER-2024-0122");

    await card.getByTestId("approval-comment-input").fill("e2e send back");
    await card.getByTestId("approval-action-return_for_revision").click();

    // Still open, but back at the author: only submitting is on offer now.
    await expect(card.getByTestId("approval-action-submit")).toBeVisible();
    await expect(card.getByTestId("approval-action-approve")).toHaveCount(0);
    await expect(card).toHaveAttribute("data-status", "in_progress");
    await expect(card).toContainText(ko.approvals.actions.return_for_revision);
    // The earlier decisions are still in the log — a return is not an erasure.
    await expect(card).toContainText(ko.approvals.actions.submit);
    await expect(card).toContainText(ko.approvals.actions.review);
  });

  test("a rejection closes the chain and freezes it", async ({ page }) => {
    await page.goto("/approvals");
    const card = chain(page, "ER-2024-0121");

    await card.getByTestId("approval-comment-input").fill("e2e reject");
    await card.getByTestId("approval-action-reject").click();

    await expect(card).toHaveAttribute("data-status", "rejected");
    // Nothing further can be done: no re-signing, no reassignment, no deletion.
    await expect(card.getByTestId("approval-decision-form")).toHaveCount(0);
    await expect(card).toContainText(ko.approvals.decision_closed);
    // The rejection is on the record, and so is everything that preceded it.
    await expect(card).toContainText(ko.approvals.actions.reject);
    await expect(card).toContainText("e2e reject");
  });

  test("every signature on the page still verifies after real decisions", async ({ page }) => {
    // The integration this whole design turns on: the Server Action signs through
    // `stepSignaturePayload` and the page re-verifies through the same builder. If
    // the two ever diverged, the badges on the steps just recorded would go red.
    await page.goto("/approvals");

    const badges = page.getByTestId("signature-badge");
    const count = await badges.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      await expect(badges.nth(index)).toHaveText(ko.approvals.signature_verified);
    }
    await expect(page.getByText(ko.approvals.signature_invalid)).toHaveCount(0);
  });
});

test.describe("suppliers: verify, reject, re-request", () => {
  test("offers nothing on a request that has already been decided", async ({ page }) => {
    await page.goto("/suppliers");

    // REQ-001 is verified; REQ-004 is rejected but already superseded by
    // REQ-004R, so a second replacement would double-count the supplier.
    for (const requestId of ["REQ-001", "REQ-004"]) {
      const row = requestRow(page, requestId);
      await expect(row.getByTestId("supplier-decision-form")).toHaveCount(0);
      await expect(row.getByTestId("supplier-decision-unavailable")).toBeVisible();
    }
  });

  test("a submitted request offers verify and reject, but not re-request", async ({ page }) => {
    await page.goto("/suppliers");

    // Re-requesting only follows a rejection; offering it here would let a live
    // submission be replaced before anybody looked at it.
    const row = requestRow(page, "REQ-009");
    await expect(row.getByTestId("supplier-action-verify")).toBeVisible();
    await expect(row.getByTestId("supplier-action-reject")).toBeVisible();
    await expect(row.getByTestId("supplier-action-re_request")).toHaveCount(0);
  });

  test("verifies a submission and moves the figure into reported Scope 3", async ({ page }) => {
    await page.goto("/suppliers");

    // REQ-003 is Scope 3 category 4, submitted but unverified: 1,980.25 tCO2e
    // sitting in the roll-up's pending column, which is the whole reason that
    // column is kept separate. Verifying must move it to the reported column.
    const categoryFour = page
      .getByTestId("scope3-aggregate-row")
      .filter({ has: page.locator("td", { hasText: /^4$/ }) })
      .first();
    // Columns: #, category, verified emissions, verified suppliers, pending
    // emissions, pending suppliers.
    const verifiedCell = categoryFour.locator("td").nth(2);
    const pendingCell = categoryFour.locator("td").nth(4);

    await expect(verifiedCell).not.toContainText("1,980.25");
    await expect(pendingCell).toContainText("1,980.25");

    const row = requestRow(page, "REQ-003");
    await row.getByTestId("supplier-quality-select").selectOption("5");
    await row.getByTestId("supplier-action-verify").click();

    await expect(requestRow(page, "REQ-003")).toHaveAttribute("data-status", "verified");
    await expect(requestRow(page, "REQ-003")).toContainText(
      ko.suppliers.quality_scale.replace("{score}", "5")
    );

    // The figure crossed from unverified to reported, in both directions at once.
    await expect(verifiedCell).toContainText("1,980.25");
    await expect(pendingCell).not.toContainText("1,980.25");
  });

  test("the verification survives a fresh request", async ({ page }) => {
    await page.goto("/suppliers");

    await expect(requestRow(page, "REQ-003")).toHaveAttribute("data-status", "verified");
    // Verified rows are frozen: no re-verification, no reversal.
    await expect(requestRow(page, "REQ-003").getByTestId("supplier-decision-form")).toHaveCount(0);
  });

  test("rejects a submission with a stated reason, then re-requests it", async ({ page }) => {
    await page.goto("/suppliers");

    const row = requestRow(page, "REQ-008");
    await row.getByTestId("supplier-reason-select").selectOption("boundary_mismatch");
    await row.getByTestId("supplier-action-reject").click();

    const rejected = requestRow(page, "REQ-008");
    await expect(rejected).toHaveAttribute("data-status", "rejected");
    await expect(rejected).toContainText(ko.supplier_rejection_reasons.boundary_mismatch);
    // The rejected figure stays on the row as evidence of what was claimed.
    await expect(rejected).toContainText("733.4");

    // A rejection is followed by a new request, not by reopening the old one.
    await expect(rejected.getByTestId("supplier-action-re_request")).toBeVisible();
    await expect(rejected.getByTestId("supplier-action-verify")).toHaveCount(0);

    await rejected.getByTestId("supplier-action-re_request").click();

    const replacement = requestRow(page, "REQ-008R");
    await expect(replacement).toBeVisible();
    await expect(replacement).toHaveAttribute("data-status", "sent");
    await expect(replacement).toContainText(ko.suppliers.re_request_badge);
    // The superseded attempt is still there, now labelled as such, and offers no
    // second replacement.
    await expect(requestRow(page, "REQ-008")).toContainText(ko.suppliers.supersedes);
    await expect(
      requestRow(page, "REQ-008").getByTestId("supplier-action-re_request")
    ).toHaveCount(0);
  });

  test("does not double-count the supplier after the re-request", async ({ page }) => {
    await page.goto("/suppliers");

    // REQ-008 (rejected, 733.4) and REQ-008R (sent, no figure) are both category
    // 2. Neither contributes, and the category must appear exactly once.
    const rows = await page
      .getByTestId("scope3-aggregate-row")
      .evaluateAll((all) => all.map((row) => row.querySelector("td")?.textContent?.trim() ?? ""));
    expect(rows.length).toBe(new Set(rows).size);
  });

  test("no unresolved messages after the interactions", async ({ page }) => {
    // The new controls add roughly thirty strings per locale. A missing one
    // renders as a key path, which is easy to miss in a screenshot.
    for (const route of ["/approvals", "/suppliers"]) {
      await page.goto(route);
      const rendered = await page.locator("main").innerText();
      expect(rendered, `${route} should not render a raw message key`).not.toMatch(
        /\b(?:approvals|suppliers|user_roles)\.[a-z_]+\b/
      );
      expect(rendered).not.toContain("MISSING_MESSAGE");
      expect(rendered, `${route} should not leak an ICU placeholder`).not.toMatch(
        /\{[a-zA-Z]\w*\}/
      );
    }
  });
});
