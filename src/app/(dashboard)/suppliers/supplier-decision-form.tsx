"use client";

/**
 * The controls for acting on one supplier submission: 승인 / 반려 / 재요청.
 *
 * One form per row, one submit button per permitted action, `name="action"` on
 * the buttons so the pressed button carries the decision. `allowedActions` is
 * computed on the server by running the real authorisation function for each
 * candidate, so a verified row offers nothing and a rejected row offers only a
 * re-request. The Server Action re-checks regardless.
 *
 * Native `<select>` rather than the Radix wrapper for the two inputs. They live
 * inside a form that must submit its value without JavaScript, and a native
 * control does that on its own; the styled wrapper would add a hidden input and a
 * portal for no gain in a table cell this size.
 */

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  MAX_DATA_QUALITY,
  MIN_DATA_QUALITY,
  SUPPLIER_REJECTION_REASON_KEYS,
} from "@/lib/suppliers/types";
import type { SupplierAction } from "@/lib/suppliers/transitions";
import { decideSupplierRequest, type SupplierActionState } from "./actions";

const ACTION_VARIANT: Record<SupplierAction, "default" | "destructive" | "outline"> = {
  verify: "default",
  reject: "destructive",
  re_request: "outline",
};

const QUALITY_SCORES = Array.from(
  { length: MAX_DATA_QUALITY - MIN_DATA_QUALITY + 1 },
  (_, index) => MIN_DATA_QUALITY + index
);

const SELECT_CLASS =
  "h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface SupplierDecisionFormProps {
  requestId: string;
  /** Actions the current actor may take on this row right now. */
  allowedActions: readonly SupplierAction[];
}

export function SupplierDecisionForm({ requestId, allowedActions }: SupplierDecisionFormProps) {
  const t = useTranslations("suppliers");
  const tReasons = useTranslations("supplier_rejection_reasons");
  const [state, formAction, pending] = useActionState<SupplierActionState, FormData>(
    decideSupplierRequest,
    { status: "idle" }
  );

  const needsQuality = allowedActions.includes("verify");
  const needsReason = allowedActions.includes("reject");

  // Rendered even when nothing is actionable any more. A successful verification
  // is precisely the case that empties `allowedActions`, and swallowing the
  // confirmation exactly when the action worked would be the wrong way round.
  const outcome = (
    <>
      {state.status === "error" && (
        <p
          role="alert"
          className="text-xs font-medium text-destructive"
          data-testid="supplier-action-error"
        >
          {t(`errors.${state.reason}`)}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="text-xs font-medium text-primary"
          data-testid="supplier-action-success"
        >
          {state.createdId === null
            ? t("decision_success", { action: t(`decision_actions.${state.action}`) })
            : t("decision_success_re_request", { request: state.createdId })}
        </p>
      )}
    </>
  );

  if (allowedActions.length === 0) {
    return (
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground" data-testid="supplier-decision-unavailable">
          {t("decision_none")}
        </span>
        {outcome}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-1" data-testid="supplier-decision-form">
      <input type="hidden" name="requestId" value={requestId} />

      <div className="flex flex-wrap items-center gap-1">
        {needsQuality && (
          <>
            <label className="sr-only" htmlFor={`quality-${requestId}`}>
              {t("data_quality")}
            </label>
            <select
              id={`quality-${requestId}`}
              name="dataQuality"
              defaultValue="3"
              className={SELECT_CLASS}
              data-testid="supplier-quality-select"
            >
              {QUALITY_SCORES.map((score) => (
                <option key={score} value={score}>
                  {t("quality_scale", { score })}
                </option>
              ))}
            </select>
          </>
        )}

        {needsReason && (
          <>
            <label className="sr-only" htmlFor={`reason-${requestId}`}>
              {t("rejection_reason")}
            </label>
            <select
              id={`reason-${requestId}`}
              name="reasonKey"
              defaultValue={SUPPLIER_REJECTION_REASON_KEYS[0]}
              className={SELECT_CLASS}
              data-testid="supplier-reason-select"
            >
              {SUPPLIER_REJECTION_REASON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {tReasons(key)}
                </option>
              ))}
            </select>
          </>
        )}

        {allowedActions.map((action) => (
          <Button
            key={action}
            type="submit"
            name="action"
            value={action}
            size="sm"
            variant={ACTION_VARIANT[action]}
            disabled={pending}
            data-testid={`supplier-action-${action}`}
          >
            {t(`decision_actions.${action}`)}
          </Button>
        ))}
      </div>

      {outcome}
    </form>
  );
}
