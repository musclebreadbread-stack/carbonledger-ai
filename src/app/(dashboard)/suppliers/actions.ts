"use server";

/**
 * Server Actions behind `/suppliers`.
 *
 * Same posture as `../approvals/actions.ts`: the actor comes from the session,
 * the request is re-read from the store by id, the clock is taken here, and the
 * authorisation rules live in `src/lib/suppliers/transitions.ts` where they can be
 * unit-tested against every denial path.
 *
 * The one input that needs care is `reasonKey`. It is rendered back through
 * `supplier_rejection_reasons.<key>`, so an unvalidated value would either put a
 * raw string where a translated reason belongs or write arbitrary text into the
 * audit trail. It is checked against the allowlist in
 * `src/lib/suppliers/types.ts`, not merely checked for being a string.
 */

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/auth/current-actor";
import { mutateSupplierRequest } from "@/lib/suppliers/store";
import {
  isSupplierAction,
  recordSupplierAction,
  type SupplierAction,
  type SupplierDenial,
} from "@/lib/suppliers/transitions";

export type SupplierActionState =
  | { status: "idle" }
  | {
      status: "success";
      action: SupplierAction;
      /** Id of the row acted on, echoed so the confirmation names it. */
      requestId: string;
      /** Id of the replacement request, for a re-request. */
      createdId: string | null;
    }
  | { status: "error"; reason: SupplierDenial };

// As in `../approvals/actions.ts`: no exported constant for the idle state,
// because a `"use server"` module may only export async functions.

/**
 * Verifies (승인), rejects (반려) or re-requests (재요청) one supplier submission.
 *
 * `dataQuality` arrives as a form string and is parsed with `Number.parseInt`
 * rather than `Number`, then range-checked in the transition layer: `Number("")`
 * is 0 and `Number("3abc")` is NaN, and a quality score that silently became 0
 * would be written into the inventory as an assessment nobody made.
 */
export async function decideSupplierRequest(
  _previous: SupplierActionState,
  formData: FormData
): Promise<SupplierActionState> {
  const actor = await getCurrentActor();
  if (actor === null) {
    return { status: "error", reason: "unauthenticated" };
  }

  const requestId = formData.get("requestId");
  const action = formData.get("action");

  if (typeof requestId !== "string" || requestId.length === 0 || !isSupplierAction(action)) {
    return { status: "error", reason: "invalid_input" };
  }

  const rawQuality = formData.get("dataQuality");
  const dataQuality =
    typeof rawQuality === "string" && rawQuality.trim() !== ""
      ? Number.parseInt(rawQuality, 10)
      : null;

  const rawReason = formData.get("reasonKey");
  const reasonKey = typeof rawReason === "string" ? rawReason : null;

  const at = new Date().toISOString();

  const result = await mutateSupplierRequest(requestId, (request, siblings) =>
    recordSupplierAction(request, actor, siblings, { action, dataQuality, reasonKey, at })
  );

  if (!result.ok) {
    return { status: "error", reason: result.reason };
  }

  revalidatePath("/suppliers");

  return {
    status: "success",
    action: result.action,
    requestId,
    createdId: result.created?.id ?? null,
  };
}
