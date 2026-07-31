"use server";

/**
 * Server Actions behind `/approvals`.
 *
 * A Server Action is a POST endpoint on the page that declares it. It is
 * reachable by anyone who can send that POST, whether or not the UI ever
 * rendered a button for them, and it runs with the server's privileges rather
 * than the caller's — so the row-level policies in
 * `supabase/migrations/0003_rls_policies_phase2.sql` are not standing between a
 * request and the approval trail. Everything this file trusts is therefore:
 *
 *   * the actor, resolved from the session and never from the request body;
 *   * the instance, re-read from the store by id;
 *   * the clock, taken here rather than accepted as a field — a client-supplied
 *     timestamp goes into the signed payload, so accepting one would let a caller
 *     backdate a signature.
 *
 * From the client it takes only what a client legitimately knows: which instance,
 * which decision, and what the human wants to say about it. The authorisation
 * itself is in `src/lib/approvals/transitions.ts`, pure and unit-tested.
 */

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { mutateApprovalInstance } from "@/lib/approvals/store";
import { recordApprovalAction, type ApprovalDenial } from "@/lib/approvals/transitions";
import { isWorkflowAction, type WorkflowAction } from "@/lib/approvals/types";

/**
 * What the form gets back.
 *
 * Refusals carry a stable reason key, not a sentence: the client translates it,
 * so the message appears in the user's language without this module knowing which
 * language that is. `recordLabel` is echoed on success so the confirmation names
 * the record acted on, which matters on a page listing five chains at once.
 */
export type ApprovalActionState =
  | { status: "idle" }
  | { status: "success"; action: WorkflowAction; recordLabel: string }
  | { status: "error"; reason: ApprovalDenial };

// No constant for the idle state, despite it being repeated in the form: a
// `"use server"` module may only export async functions, so a shared value here
// would be a build error. Types are erased and are fine.

/**
 * Records one decision against one approval chain, capturing a digital
 * signature.
 *
 * Shaped for `useActionState`, hence the leading previous-state argument. The
 * previous state is deliberately ignored: an action that resumed from
 * client-supplied state would be trusting the client with the thing it is not
 * allowed to know.
 */
export async function decideApproval(
  _previous: ApprovalActionState,
  formData: FormData
): Promise<ApprovalActionState> {
  const actor = await getCurrentActor();
  if (actor === null) {
    return { status: "error", reason: "unauthenticated" };
  }

  const instanceId = formData.get("instanceId");
  const action = formData.get("action");
  const comment = formData.get("comment");

  if (typeof instanceId !== "string" || instanceId.length === 0 || !isWorkflowAction(action)) {
    return { status: "error", reason: "invalid_input" };
  }
  if (comment !== null && typeof comment !== "string") {
    return { status: "error", reason: "invalid_input" };
  }

  const at = new Date().toISOString();

  const result = await mutateApprovalInstance(instanceId, (instance) =>
    recordApprovalAction(instance, actor, { action, comment, at })
  );

  if (!result.ok) {
    return { status: "error", reason: result.reason };
  }

  // The page re-reads the store and re-verifies every signature on render, so
  // invalidating the path is what makes the new step and its badge appear. In
  // Next.js 16 this also ships a freshly rendered payload for the current route
  // in the action's own response, so the table updates in one roundtrip.
  revalidatePath("/approvals");

  return {
    status: "success",
    action: result.instance.steps.find((step) => step.completedAt === at)?.action ?? action,
    recordLabel: result.instance.recordLabel,
  };
}
