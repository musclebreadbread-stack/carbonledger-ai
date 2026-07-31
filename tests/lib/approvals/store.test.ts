/**
 * What "persists" means with no database.
 *
 * These tests pin the store's actual contract rather than implying a durable
 * write path: a committed decision is visible to later reads *of the same module
 * instance*, a refused one changes nothing, and `reset` puts the fixtures back.
 * The limits that no test can assert — a restart or a second server process
 * losing the state entirely — are documented at the top of the store itself.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_COMPANY_ID, type Actor } from "@/lib/auth/actor";
import { Role } from "@/lib/auth/roles";
import {
  getApprovalInstance,
  getApprovalsOverview,
  mutateApprovalInstance,
  resetApprovalsStore,
} from "@/lib/approvals/store";
import { recordApprovalAction } from "@/lib/approvals/transitions";
import { completedSteps, currentStage } from "@/lib/approvals/types";
import { stepSignaturePayload, verifySignature } from "@/lib/approvals/signature";
const ACTOR: Actor = {
  id: "user-store-test",
  name: "Store Test",
  role: Role.SITE_ADMIN,
  companyId: SAMPLE_COMPANY_ID,
};

// The store is module state, so it leaks between cases unless it is reset.
beforeEach(resetApprovalsStore);
afterEach(resetApprovalsStore);

/** The sample instance awaiting review: ER-2024-0121. */
const AWAITING_REVIEW = "aaaaaaa1-0000-4000-8000-000000000002";

describe("the approvals store", () => {
  it("seeds from the sample fixtures", async () => {
    const overview = await getApprovalsOverview();
    expect(overview.isSampleData).toBe(true);
    expect(overview.instances).toHaveLength(5);
  });

  it("hands out copies, so a caller cannot edit the store through its result", async () => {
    const first = await getApprovalsOverview();
    first.instances[0].emissions = 999_999;
    first.instances[0].steps[0].digitalSignature = "tampered";

    const second = await getApprovalsOverview();
    expect(second.instances[0].emissions).not.toBe(999_999);
    expect(second.instances[0].steps[0].digitalSignature).not.toBe("tampered");
  });

  it("makes a committed decision visible to the next read", async () => {
    const before = await getApprovalInstance(AWAITING_REVIEW);
    expect(currentStage(before!)).toBe("reviewer");

    const result = await mutateApprovalInstance(AWAITING_REVIEW, (instance) =>
      recordApprovalAction(instance, ACTOR, {
        action: "review",
        comment: "checked",
        at: "2024-12-11T00:00:00.000Z",
      })
    );
    expect(result.ok).toBe(true);

    // The point of the exercise: a separate read sees the advance.
    const after = await getApprovalInstance(AWAITING_REVIEW);
    expect(currentStage(after!)).toBe("approver");
    expect(completedSteps(after!).at(-1)).toMatchObject({
      action: "review",
      signerId: ACTOR.id,
      commentKey: "checked",
    });
  });

  it("signs the new step so the page's badge still verifies it", async () => {
    await mutateApprovalInstance(AWAITING_REVIEW, (instance) =>
      recordApprovalAction(instance, ACTOR, {
        action: "review",
        comment: null,
        at: "2024-12-11T00:00:00.000Z",
      })
    );

    const instance = await getApprovalInstance(AWAITING_REVIEW);
    const step = completedSteps(instance!).at(-1)!;
    const payload = stepSignaturePayload(instance!, step);

    expect(payload).not.toBeNull();
    expect(await verifySignature(step.digitalSignature as string, payload!)).toBe(true);
  });

  it("leaves the store untouched when the action is refused", async () => {
    const before = await getApprovalInstance(AWAITING_REVIEW);

    const result = await mutateApprovalInstance(AWAITING_REVIEW, (instance) =>
      // Wrong company: must not half-apply.
      recordApprovalAction(instance, { ...ACTOR, companyId: "someone-else" }, {
        action: "review",
        comment: null,
        at: "2024-12-11T00:00:00.000Z",
      })
    );

    expect(result).toEqual({ ok: false, reason: "wrong_company" });
    expect(await getApprovalInstance(AWAITING_REVIEW)).toEqual(before);
  });

  it("reports not_found for an unknown instance", async () => {
    const result = await mutateApprovalInstance("no-such-instance", async () => {
      throw new Error("must not be called");
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("does not lose a decision when two mutations race", async () => {
    // Both start from the same pre-state if the store does not serialise access;
    // the second would then overwrite the first and one approval step would
    // silently disappear.
    const [first, second] = await Promise.all([
      mutateApprovalInstance(AWAITING_REVIEW, (instance) =>
        recordApprovalAction(instance, ACTOR, {
          action: "review",
          comment: "first",
          at: "2024-12-11T00:00:00.000Z",
        })
      ),
      mutateApprovalInstance(AWAITING_REVIEW, (instance) =>
        recordApprovalAction(instance, ACTOR, {
          action: "review",
          comment: "second",
          at: "2024-12-11T00:00:01.000Z",
        })
      ),
    ]);

    // Exactly one succeeds: whichever ran second finds the reviewer step gone and
    // "review" no longer legal at the approver stage.
    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    const instance = await getApprovalInstance(AWAITING_REVIEW);
    expect(completedSteps(instance!).filter((step) => step.action === "review")).toHaveLength(1);
  });

  it("re-seeds after a reset", async () => {
    await mutateApprovalInstance(AWAITING_REVIEW, (instance) =>
      recordApprovalAction(instance, ACTOR, {
        action: "review",
        comment: null,
        at: "2024-12-11T00:00:00.000Z",
      })
    );
    expect(currentStage((await getApprovalInstance(AWAITING_REVIEW))!)).toBe("approver");

    resetApprovalsStore();
    expect(currentStage((await getApprovalInstance(AWAITING_REVIEW))!)).toBe("reviewer");
  });
});
