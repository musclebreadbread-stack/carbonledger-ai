/**
 * Advancing an approval chain: who may act, what the act does, and what gets
 * signed.
 *
 * `./types` says which action is legal at which stage (`isActionAllowed`). That
 * is a statement about the workflow, not about the caller. This module adds the
 * two things a Server Action needs on top of it:
 *
 *   * **authorisation** — the capability, tenancy, freeze and assignment rules
 *     that `supabase/migrations/0003_rls_policies_phase2.sql` enforces in the
 *     database. Each check below names the policy it mirrors. A Server Action
 *     runs with the server's privileges against a route anyone can POST to, so
 *     these are the only checks actually standing between a request and the
 *     approval trail;
 *   * **the transition** — a pure function from (instance, decision) to a new
 *     instance, so the effect of an action is inspectable and testable without a
 *     store, a request or a clock.
 *
 * Signing is folded in at the end (`recordApprovalAction`) because the digest
 * covers the completed step, which does not exist until the transition is
 * computed. Everything below that point uses `stepSignaturePayload`, the same
 * builder `/approvals` verifies with.
 */

import { canApprove, canWrite, ownsCompany, type Actor } from "@/lib/auth/actor";
import { signPayload, stepSignaturePayload } from "./signature";
import {
  currentStage,
  isActionAllowed,
  pendingStep,
  WORKFLOW_STAGES,
  type ApprovalInstance,
  type WorkflowAction,
  type WorkflowStage,
  type WorkflowStep,
} from "./types";

/**
 * Why an action was refused.
 *
 * Stable keys rather than sentences: the Server Action returns one of these and
 * the client translates it, so a refusal reads in the user's language without the
 * server having to know which language that is. They are also deliberately
 * specific — "you are not the assignee" and "that step is already signed" send a
 * user to different places, and collapsing both into "forbidden" would make the
 * UI unhelpful in exactly the situation where it matters.
 */
export type ApprovalDenial =
  | "unauthenticated"
  | "forbidden_role"
  | "wrong_company"
  | "not_found"
  | "instance_closed"
  | "action_not_allowed"
  | "step_frozen"
  | "not_assignee"
  | "invalid_input";

export type ApprovalAuthorization =
  | { ok: true; stage: WorkflowStage; step: WorkflowStep }
  | { ok: false; reason: ApprovalDenial };

/** Longest comment accepted. Free text goes into the audit trail, not a log line. */
export const MAX_COMMENT_LENGTH = 500;

/**
 * Whether `actor` may take `action` on `instance`, and against which step.
 *
 * Order matters for what a caller learns: tenancy is checked before anything
 * else, so a probe for another company's instance cannot distinguish "not yours"
 * from "wrong stage" and use the difference to enumerate other tenants' records.
 */
export function authorizeApprovalAction(
  actor: Actor,
  instance: ApprovalInstance,
  action: WorkflowAction
): ApprovalAuthorization {
  // `auth.company_owns_workflow_instance(instance_id)` — every policy on
  // workflow_instances and workflow_steps in 0003 is anded with this.
  if (!ownsCompany(actor, instance.companyId)) {
    return { ok: false, reason: "wrong_company" };
  }

  // Capability. Recording a step is an INSERT on workflow_steps, which
  // `approver_create_workflow_steps` gates on `auth.can_approve()`; the author's
  // submission additionally opens the instance, which
  // `writer_create_workflow_instances` gates on `auth.can_write()`. So a
  // reviewer may review but not author, and a viewer may do neither.
  if (!canApprove(actor.role)) {
    return { ok: false, reason: "forbidden_role" };
  }
  if (action === "submit" && !canWrite(actor.role)) {
    return { ok: false, reason: "forbidden_role" };
  }

  // A finished chain takes no further action. 0003 has no policy that reopens
  // one and no DELETE policy on either table: "an approval that ran is a fact
  // about the record it approved".
  const stage = currentStage(instance);
  if (stage === null) {
    return { ok: false, reason: "instance_closed" };
  }

  if (!isActionAllowed(stage, action)) {
    return { ok: false, reason: "action_not_allowed" };
  }

  const step = pendingStep(instance);
  if (step === null) {
    // `currentStage` says the chain is open but the log has nothing outstanding.
    // Refusing beats inventing a step to sign.
    return { ok: false, reason: "instance_closed" };
  }

  // `assignee_complete_workflow_steps` allows UPDATE only while
  // `completed_at IS NULL`. Once a step is signed the decision is frozen: no
  // re-signing, no reassignment. This branch is unreachable through
  // `pendingStep` today and is kept as a guard rather than an assumption,
  // because it is the rule an audit trail lives or dies by.
  if (step.completedAt !== null) {
    return { ok: false, reason: "step_frozen" };
  }

  // `assignee_id IS NULL OR assignee_id = auth.current_user_id()` on insert, and
  // `assignee_id = auth.current_user_id()` on update: an unclaimed step may be
  // picked up by any approver, an assigned one only by its assignee.
  if (step.assigneeId !== null && step.assigneeId !== actor.id) {
    return { ok: false, reason: "not_assignee" };
  }

  return { ok: true, stage, step };
}

/** Where the chain sits after an action at `stageIndex`. */
function nextChainState(
  action: WorkflowAction,
  stageIndex: number
): { currentStep: number; status: ApprovalInstance["status"] } {
  if (action === "reject") {
    // Terminates where it stopped, so the progress bar reports how far it got
    // rather than showing a rejected record as a completed chain.
    return { currentStep: stageIndex + 1, status: "rejected" };
  }
  if (action === "return_for_revision") {
    // 재요청: back to the author with the instance still open. This is the whole
    // distinction from a rejection, and the reason `currentStep` cannot simply be
    // the number of steps taken.
    return { currentStep: 0, status: "in_progress" };
  }
  const advanced = stageIndex + 1;
  return {
    currentStep: advanced,
    status: advanced >= WORKFLOW_STAGES.length ? "approved" : "in_progress",
  };
}

/**
 * Records a decision against the pending step and re-plans the outstanding
 * chain. Pure: no clock, no signing, no store.
 *
 * Completed steps are never touched. Outstanding ones are dropped and re-created
 * from the new position, which is what lets a return re-queue the whole
 * author→final chain behind the two steps already in the log.
 */
export function applyApprovalAction(
  instance: ApprovalInstance,
  actor: Actor,
  input: {
    action: WorkflowAction;
    comment: string | null;
    signature: string;
    at: string;
  }
): ApprovalInstance {
  const target = pendingStep(instance);
  if (target === null) {
    throw new Error(`No outstanding step on instance ${instance.id}`);
  }

  const stageIndex = WORKFLOW_STAGES.indexOf(target.stage);
  const { currentStep, status } = nextChainState(input.action, stageIndex);

  const completed: WorkflowStep = {
    ...target,
    assigneeNameKey: target.assigneeNameKey ?? target.stage,
    // Claiming the step on completion is what `WITH CHECK (assignee_id =
    // auth.current_user_id())` guarantees in the database: you cannot complete a
    // step and hand it to someone else on the way out.
    assigneeId: actor.id,
    action: input.action,
    commentKey: input.comment,
    digitalSignature: input.signature,
    signerId: actor.id,
    signerName: actor.name,
    completedAt: input.at,
  };

  const kept: WorkflowStep[] = [];
  for (const step of [...instance.steps].sort((a, b) => a.stepNumber - b.stepNumber)) {
    if (step.completedAt !== null) {
      kept.push({ ...step });
    } else if (step.stepNumber === target.stepNumber) {
      kept.push(completed);
    }
    // Any other outstanding step is re-planned below.
  }

  if (status === "in_progress") {
    let nextNumber = kept.reduce((max, step) => Math.max(max, step.stepNumber), -1) + 1;
    for (let index = currentStep; index < WORKFLOW_STAGES.length; index += 1) {
      kept.push({
        stepNumber: nextNumber,
        stage: WORKFLOW_STAGES[index],
        assigneeNameKey: WORKFLOW_STAGES[index],
        assigneeId: null,
        action: null,
        commentKey: null,
        digitalSignature: null,
        signerId: null,
        signerName: null,
        completedAt: null,
      });
      nextNumber += 1;
    }
  }

  return {
    ...instance,
    currentStep,
    status,
    steps: kept,
    updatedAt: input.at,
  };
}

export type ApprovalActionResult =
  | { ok: true; instance: ApprovalInstance; stage: WorkflowStage; signature: string }
  | { ok: false; reason: ApprovalDenial };

/**
 * The whole operation: authorise, apply, sign, return the new instance.
 *
 * Used by the Server Action and by the sample seeder in `./sample-data`, on
 * purpose — the fixtures are built by replaying decisions through this function,
 * so the shapes the page renders are the shapes an actual action produces and
 * the seeded signatures are produced by the real signing path.
 *
 * Signing happens after the transition because the digest commits to the
 * completed step (stage, action, signer, timestamp) together with the instance's
 * emission figure. The signature is then written back into that step, so
 * verification recomputes over exactly the row it is checking.
 */
export async function recordApprovalAction(
  instance: ApprovalInstance,
  actor: Actor,
  input: { action: WorkflowAction; comment?: string | null; at: string }
): Promise<ApprovalActionResult> {
  const comment = input.comment?.trim() ? input.comment.trim() : null;
  if (comment !== null && comment.length > MAX_COMMENT_LENGTH) {
    return { ok: false, reason: "invalid_input" };
  }
  if (Number.isNaN(Date.parse(input.at))) {
    return { ok: false, reason: "invalid_input" };
  }

  const authorization = authorizeApprovalAction(actor, instance, input.action);
  if (!authorization.ok) return authorization;

  // Applied once with a placeholder to obtain the completed step, signed, then
  // the digest is written into that step. Two passes rather than duplicating the
  // payload assembly here, which is what `stepSignaturePayload` exists to prevent.
  const provisional = applyApprovalAction(instance, actor, {
    action: input.action,
    comment,
    signature: "",
    at: input.at,
  });

  const signedStep = provisional.steps.find(
    (step) => step.stepNumber === authorization.step.stepNumber
  );
  const payload = signedStep ? stepSignaturePayload(provisional, signedStep) : null;
  if (signedStep === undefined || payload === null) {
    throw new Error(`Transition produced no signable step for instance ${instance.id}`);
  }

  const signature = await signPayload(payload);

  return {
    ok: true,
    stage: authorization.stage,
    signature,
    instance: {
      ...provisional,
      steps: provisional.steps.map((step) =>
        step.stepNumber === signedStep.stepNumber ? { ...step, digitalSignature: signature } : step
      ),
    },
  };
}
