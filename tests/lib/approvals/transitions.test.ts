/**
 * The rules that stand between a POST and the approval trail.
 *
 * A Server Action is a public endpoint running with the server's privileges, so
 * these checks are not a second line of defence behind RLS — for the duration of
 * a request they are the only line. The deny paths therefore get as much
 * attention as the happy path, and the two properties an MRV audit trail actually
 * needs are pinned explicitly: a completed step never changes, and a signature
 * stops verifying if the approved figure is edited.
 */

import { describe, expect, it } from "vitest";
import { canApprove, canWrite, SAMPLE_COMPANY_ID, type Actor } from "@/lib/auth/actor";
import { Role } from "@/lib/auth/roles";
import { stepSignaturePayload, verifySignature } from "@/lib/approvals/signature";
import {
  applyApprovalAction,
  authorizeApprovalAction,
  MAX_COMMENT_LENGTH,
  recordApprovalAction,
} from "@/lib/approvals/transitions";
import {
  chainProgressPercent,
  completedSteps,
  currentStage,
  pendingStep,
  WORKFLOW_STAGES,
  type ApprovalInstance,
  type WorkflowStep,
} from "@/lib/approvals/types";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "user-1",
    name: "M. Kim",
    role: Role.SITE_ADMIN,
    companyId: SAMPLE_COMPANY_ID,
    ...overrides,
  };
}

function openInstance(overrides: Partial<ApprovalInstance> = {}): ApprovalInstance {
  const steps: WorkflowStep[] = WORKFLOW_STAGES.map((stage, index) => ({
    stepNumber: index,
    stage,
    assigneeNameKey: stage,
    assigneeId: null,
    action: null,
    commentKey: null,
    digitalSignature: null,
    signerId: null,
    signerName: null,
    completedAt: null,
  }));

  return {
    id: "instance-1",
    companyId: SAMPLE_COMPANY_ID,
    recordType: "emission_record",
    recordId: "instance-1",
    recordLabel: "ER-2024-0001",
    summaryKey: "boiler_monthly",
    emissions: 1_234.5,
    period: "2024-11",
    currentStep: 0,
    status: "pending",
    steps,
    createdAt: "2024-12-01T00:00:00.000Z",
    updatedAt: "2024-12-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Walks an instance forward, failing loudly rather than silently skipping. */
async function take(
  instance: ApprovalInstance,
  who: Actor,
  action: Parameters<typeof recordApprovalAction>[2]["action"],
  at: string
): Promise<ApprovalInstance> {
  const result = await recordApprovalAction(instance, who, { action, comment: null, at });
  if (!result.ok) throw new Error(`unexpected refusal: ${result.reason}`);
  return result.instance;
}

describe("capability predicates mirror the RLS helpers", () => {
  it("gives approve to reviewers and above, write only to site_admin and above", () => {
    // Straight from the role table in 0003_rls_policies_phase2.sql.
    expect(canApprove(Role.REVIEWER)).toBe(true);
    expect(canWrite(Role.REVIEWER)).toBe(false);
    expect(canWrite(Role.SITE_ADMIN)).toBe(true);
    expect(canApprove(Role.SITE_ADMIN)).toBe(true);
  });

  it("gives neither to the read-only roles", () => {
    for (const role of [Role.VIEWER, Role.AUDITOR, Role.CONSULTANT]) {
      expect(canApprove(role)).toBe(false);
      expect(canWrite(role)).toBe(false);
    }
  });
});

describe("authorizeApprovalAction", () => {
  it("refuses another company's instance before looking at anything else", () => {
    const result = authorizeApprovalAction(
      actor({ companyId: "some-other-company" }),
      openInstance(),
      "submit"
    );
    expect(result).toEqual({ ok: false, reason: "wrong_company" });
  });

  it("does not leak the stage to a caller from another company", () => {
    // Same instance, an action that is wrong for the stage. A cross-tenant caller
    // must not be able to tell "not yours" from "wrong stage".
    const outsider = actor({ companyId: "other" });
    expect(authorizeApprovalAction(outsider, openInstance(), "approve")).toEqual({
      ok: false,
      reason: "wrong_company",
    });
  });

  it("refuses a viewer and an auditor outright", () => {
    for (const role of [Role.VIEWER, Role.AUDITOR, Role.CONSULTANT]) {
      expect(authorizeApprovalAction(actor({ role }), openInstance(), "submit")).toEqual({
        ok: false,
        reason: "forbidden_role",
      });
    }
  });

  it("lets a reviewer review but not author", async () => {
    const reviewer = actor({ role: Role.REVIEWER });

    // Authoring is a write: `writer_create_workflow_instances` needs can_write.
    expect(authorizeApprovalAction(reviewer, openInstance(), "submit")).toEqual({
      ok: false,
      reason: "forbidden_role",
    });

    const submitted = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    expect(authorizeApprovalAction(reviewer, submitted, "review").ok).toBe(true);
  });

  it("refuses an action the stage does not permit", async () => {
    const submitted = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    // A reviewer reviews; approving is the approver's step.
    expect(authorizeApprovalAction(actor(), submitted, "approve")).toEqual({
      ok: false,
      reason: "action_not_allowed",
    });
    // And the final stage may confirm or send back, never outright reject.
    let instance = await take(submitted, actor(), "review", "2024-12-03T00:00:00.000Z");
    instance = await take(instance, actor(), "approve", "2024-12-04T00:00:00.000Z");
    expect(authorizeApprovalAction(actor(), instance, "reject")).toEqual({
      ok: false,
      reason: "action_not_allowed",
    });
  });

  it("refuses every action on a closed chain", async () => {
    let instance = openInstance();
    for (const [index, action] of (["submit", "review", "approve", "approve"] as const).entries()) {
      instance = await take(instance, actor(), action, `2024-12-0${index + 2}T00:00:00.000Z`);
    }
    expect(instance.status).toBe("approved");

    for (const action of ["approve", "reject", "return_for_revision", "submit"] as const) {
      expect(authorizeApprovalAction(actor(), instance, action)).toEqual({
        ok: false,
        reason: "instance_closed",
      });
    }
  });

  it("refuses a rejected chain too", async () => {
    let instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(instance, actor(), "reject", "2024-12-03T00:00:00.000Z");

    expect(authorizeApprovalAction(actor(), instance, "return_for_revision")).toEqual({
      ok: false,
      reason: "instance_closed",
    });
  });

  it("lets only the assignee act on an assigned step", async () => {
    const submitted = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    const assigned: ApprovalInstance = {
      ...submitted,
      steps: submitted.steps.map((step) =>
        step.completedAt === null && step.stage === "reviewer"
          ? { ...step, assigneeId: "user-nominated" }
          : step
      ),
    };

    expect(authorizeApprovalAction(actor({ id: "someone-else" }), assigned, "review")).toEqual({
      ok: false,
      reason: "not_assignee",
    });
    expect(authorizeApprovalAction(actor({ id: "user-nominated" }), assigned, "review").ok).toBe(
      true
    );
  });

  it("lets any approver claim an unassigned step", async () => {
    // `assignee_id IS NULL OR assignee_id = auth.current_user_id()`.
    const submitted = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    expect(pendingStep(submitted)?.assigneeId).toBeNull();
    expect(authorizeApprovalAction(actor({ id: "anyone" }), submitted, "review").ok).toBe(true);
  });

  it("refuses when the log has no outstanding step despite an open status", () => {
    // Defensive: rather than invent a step to sign.
    const instance = openInstance({
      status: "in_progress",
      currentStep: 1,
      steps: [
        {
          stepNumber: 0,
          stage: "author",
          assigneeNameKey: "author",
          assigneeId: "user-1",
          action: "submit",
          commentKey: null,
          digitalSignature: "v1:sha256:deadbeef",
          signerId: "user-1",
          signerName: "M. Kim",
          completedAt: "2024-12-02T00:00:00.000Z",
        },
      ],
    });

    expect(authorizeApprovalAction(actor(), instance, "review")).toEqual({
      ok: false,
      reason: "instance_closed",
    });
  });
});

describe("the four-stage chain", () => {
  it("runs 작성자 → 검토자 → 승인자 → 최종확정 to approval", async () => {
    let instance = openInstance();
    const stagesSeen: (string | null)[] = [currentStage(instance)];

    instance = await take(instance, actor({ id: "a" }), "submit", "2024-12-02T00:00:00.000Z");
    stagesSeen.push(currentStage(instance));
    instance = await take(
      instance,
      actor({ id: "r", role: Role.REVIEWER }),
      "review",
      "2024-12-03T00:00:00.000Z"
    );
    stagesSeen.push(currentStage(instance));
    instance = await take(instance, actor({ id: "p" }), "approve", "2024-12-04T00:00:00.000Z");
    stagesSeen.push(currentStage(instance));
    instance = await take(instance, actor({ id: "f" }), "approve", "2024-12-05T00:00:00.000Z");

    expect(stagesSeen).toEqual(["author", "reviewer", "approver", "final"]);
    expect(instance.status).toBe("approved");
    expect(currentStage(instance)).toBeNull();
    expect(chainProgressPercent(instance)).toBe(100);
    expect(completedSteps(instance)).toHaveLength(4);
    // Nothing outstanding on a finished chain.
    expect(pendingStep(instance)).toBeNull();
  });

  it("records a distinct signer per stage", async () => {
    let instance = openInstance();
    instance = await take(instance, actor({ id: "a", name: "K. Park" }), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(
      instance,
      actor({ id: "r", name: "M. Kim", role: Role.REVIEWER }),
      "review",
      "2024-12-03T00:00:00.000Z"
    );

    expect(completedSteps(instance).map((step) => step.signerId)).toEqual(["a", "r"]);
    expect(completedSteps(instance).map((step) => step.signerName)).toEqual(["K. Park", "M. Kim"]);
    // Completing a step claims it; it cannot be handed on in the same breath.
    expect(completedSteps(instance).map((step) => step.assigneeId)).toEqual(["a", "r"]);
  });

  it("keeps the pending step's stage equal to WORKFLOW_STAGES[currentStep] throughout", async () => {
    let instance = openInstance();
    const actions = ["submit", "review", "return_for_revision", "submit", "review"] as const;

    for (const [index, action] of actions.entries()) {
      expect(pendingStep(instance)?.stage).toBe(WORKFLOW_STAGES[instance.currentStep]);
      instance = await take(instance, actor(), action, `2024-12-1${index}T00:00:00.000Z`);
    }
    expect(pendingStep(instance)?.stage).toBe(WORKFLOW_STAGES[instance.currentStep]);
  });
});

describe("reject versus return for revision", () => {
  it("a rejection ends the chain short of 100%", async () => {
    let instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(instance, actor(), "review", "2024-12-03T00:00:00.000Z");
    instance = await take(instance, actor(), "reject", "2024-12-04T00:00:00.000Z");

    expect(instance.status).toBe("rejected");
    expect(chainProgressPercent(instance)).toBeLessThan(100);
    expect(currentStage(instance)).toBeNull();
    // No outstanding rows: a terminated chain has nothing left to do.
    expect(instance.steps.every((step) => step.completedAt !== null)).toBe(true);
  });

  it("a return sends the record back to the author with the chain still open", async () => {
    let instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(instance, actor(), "return_for_revision", "2024-12-03T00:00:00.000Z");

    expect(instance.status).toBe("in_progress");
    // The distinction from a rejection: back at stage 0, not finished.
    expect(instance.currentStep).toBe(0);
    expect(currentStage(instance)).toBe("author");
    expect(pendingStep(instance)?.stage).toBe("author");
    // Both earlier decisions survive in the log.
    expect(completedSteps(instance).map((step) => step.action)).toEqual([
      "submit",
      "return_for_revision",
    ]);
    // And the whole remaining chain is re-queued behind them.
    expect(instance.steps).toHaveLength(2 + WORKFLOW_STAGES.length);
  });

  it("can be re-submitted after a return and go on to approval", async () => {
    let instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(instance, actor(), "return_for_revision", "2024-12-03T00:00:00.000Z");
    for (const [index, action] of (["submit", "review", "approve", "approve"] as const).entries()) {
      instance = await take(instance, actor(), action, `2024-12-0${index + 4}T00:00:00.000Z`);
    }

    expect(instance.status).toBe("approved");
    // Six decisions for a four-stage chain, because the author's step was taken
    // twice. `chainProgressPercent` clamps rather than reporting 150%.
    expect(completedSteps(instance)).toHaveLength(6);
    expect(chainProgressPercent(instance)).toBe(100);
  });

  it("allows a return from the final stage as well", async () => {
    let instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(instance, actor(), "review", "2024-12-03T00:00:00.000Z");
    instance = await take(instance, actor(), "approve", "2024-12-04T00:00:00.000Z");
    expect(currentStage(instance)).toBe("final");

    instance = await take(instance, actor(), "return_for_revision", "2024-12-05T00:00:00.000Z");
    expect(currentStage(instance)).toBe("author");
    expect(instance.status).toBe("in_progress");
  });
});

describe("a completed step is frozen", () => {
  it("is byte-identical after every later action", async () => {
    let instance = await take(openInstance(), actor({ id: "a" }), "submit", "2024-12-02T00:00:00.000Z");
    const original = { ...completedSteps(instance)[0] };

    instance = await take(instance, actor({ id: "r" }), "review", "2024-12-03T00:00:00.000Z");
    instance = await take(instance, actor({ id: "p" }), "return_for_revision", "2024-12-04T00:00:00.000Z");
    instance = await take(instance, actor({ id: "a" }), "submit", "2024-12-05T00:00:00.000Z");

    const after = completedSteps(instance)[0];
    // Not "still verifies" — identical. A signature, signer or timestamp that can
    // be rewritten after the fact certifies nothing.
    expect(after).toEqual(original);
  });

  it("cannot be re-signed by replaying the same action", async () => {
    let instance = openInstance();
    for (const [index, action] of (["submit", "review", "approve", "approve"] as const).entries()) {
      instance = await take(instance, actor(), action, `2024-12-0${index + 2}T00:00:00.000Z`);
    }
    const signatures = completedSteps(instance).map((step) => step.digitalSignature);

    const replay = await recordApprovalAction(instance, actor(), {
      action: "approve",
      comment: null,
      at: "2024-12-09T00:00:00.000Z",
    });

    expect(replay.ok).toBe(false);
    expect(completedSteps(instance).map((step) => step.digitalSignature)).toEqual(signatures);
  });

  it("throws rather than half-applying when there is nothing outstanding", async () => {
    let instance = openInstance();
    for (const [index, action] of (["submit", "review", "approve", "approve"] as const).entries()) {
      instance = await take(instance, actor(), action, `2024-12-0${index + 2}T00:00:00.000Z`);
    }

    expect(() =>
      applyApprovalAction(instance, actor(), {
        action: "approve",
        comment: null,
        signature: "v1:sha256:00",
        at: "2024-12-09T00:00:00.000Z",
      })
    ).toThrow(/No outstanding step/);
  });
});

describe("the signature captured by an action", () => {
  it("verifies against the payload rebuilt from the stored step", async () => {
    const instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    const step = completedSteps(instance)[0];
    const payload = stepSignaturePayload(instance, step);

    expect(payload).not.toBeNull();
    expect(await verifySignature(step.digitalSignature as string, payload!)).toBe(true);
  });

  it("STOPS verifying once the approved emission figure is edited", async () => {
    // The property the whole signature exists for, now exercised through the
    // action path rather than only through hand-built payloads.
    const instance = await take(openInstance(), actor(), "submit", "2024-12-02T00:00:00.000Z");
    const step = completedSteps(instance)[0];

    const edited = { ...instance, emissions: instance.emissions + 0.1 };
    const payload = stepSignaturePayload(edited, step);

    expect(await verifySignature(step.digitalSignature as string, payload!)).toBe(false);
  });

  it("differs between two stages of the same record", async () => {
    let instance = await take(openInstance(), actor({ id: "a" }), "submit", "2024-12-02T00:00:00.000Z");
    instance = await take(instance, actor({ id: "r" }), "review", "2024-12-03T00:00:00.000Z");

    const [first, second] = completedSteps(instance);
    expect(first.digitalSignature).not.toBe(second.digitalSignature);
  });

  it("has no payload for an unsigned step", () => {
    const instance = openInstance();
    expect(stepSignaturePayload(instance, instance.steps[0])).toBeNull();
  });
});

describe("input validation", () => {
  it("refuses an over-long comment", async () => {
    const result = await recordApprovalAction(openInstance(), actor(), {
      action: "submit",
      comment: "x".repeat(MAX_COMMENT_LENGTH + 1),
      at: "2024-12-02T00:00:00.000Z",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("refuses an unparseable timestamp rather than signing an invalid instant", async () => {
    const result = await recordApprovalAction(openInstance(), actor(), {
      action: "submit",
      comment: null,
      at: "whenever",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("normalises a blank comment to none rather than storing whitespace", async () => {
    const result = await recordApprovalAction(openInstance(), actor(), {
      action: "submit",
      comment: "   ",
      at: "2024-12-02T00:00:00.000Z",
    });
    expect(result.ok).toBe(true);
    expect(result.ok && completedSteps(result.instance)[0].commentKey).toBeNull();
  });

  it("keeps a trimmed comment as free text on the step", async () => {
    const result = await recordApprovalAction(openInstance(), actor(), {
      action: "submit",
      comment: "  invoices attached  ",
      at: "2024-12-02T00:00:00.000Z",
    });
    expect(result.ok && completedSteps(result.instance)[0].commentKey).toBe("invoices attached");
  });

  it("does not mutate the instance it was given", async () => {
    const instance = openInstance();
    await recordApprovalAction(instance, actor(), {
      action: "submit",
      comment: null,
      at: "2024-12-02T00:00:00.000Z",
    });

    expect(instance.status).toBe("pending");
    expect(instance.steps.every((step) => step.completedAt === null)).toBe(true);
  });
});
