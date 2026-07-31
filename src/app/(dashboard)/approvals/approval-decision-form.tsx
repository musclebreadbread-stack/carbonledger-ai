"use client";

/**
 * The controls that advance one approval chain.
 *
 * A plain `<form>` with one submit button per permitted decision, each carrying
 * `name="action"` so the button that was pressed is the value the Server Action
 * reads. That keeps the whole thing a single form: no client state deciding which
 * action is "selected", nothing to get out of sync, and it still submits without
 * JavaScript.
 *
 * `allowedActions` is computed on the server by running the real authorisation
 * function for each candidate action, so this component cannot offer a button the
 * server would refuse. It is UX, not a security boundary — the Server Action
 * re-checks everything, because a POST can be sent without ever loading this page.
 */

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_COMMENT_LENGTH } from "@/lib/approvals/transitions";
import type { WorkflowAction, WorkflowStage } from "@/lib/approvals/types";
import { decideApproval, type ApprovalActionState } from "./actions";

/** Visual weight per action: a rejection should not look like an approval. */
const ACTION_VARIANT: Record<WorkflowAction, "default" | "destructive" | "outline"> = {
  submit: "default",
  review: "default",
  approve: "default",
  reject: "destructive",
  return_for_revision: "outline",
};

interface ApprovalDecisionFormProps {
  instanceId: string;
  /** Stage awaiting action, for the prompt above the buttons. */
  stage: WorkflowStage;
  /** Decisions the current actor may take right now. Empty renders nothing actionable. */
  allowedActions: readonly WorkflowAction[];
}

export function ApprovalDecisionForm({
  instanceId,
  stage,
  allowedActions,
}: ApprovalDecisionFormProps) {
  const t = useTranslations("approvals");
  const [state, formAction, pending] = useActionState<ApprovalActionState, FormData>(
    decideApproval,
    { status: "idle" }
  );

  // Kept outside the early return: an action can legitimately leave the actor with
  // nothing further to do, and that is not a reason to drop the confirmation.
  const outcome = (
    <>
      {/* Both outcomes are announced politely rather than shown silently: the
          table above may re-render far from where the button was pressed. */}
      {state.status === "error" && (
        <p
          role="alert"
          className="text-xs font-medium text-destructive"
          data-testid="approval-action-error"
        >
          {t(`errors.${state.reason}`)}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="text-xs font-medium text-primary"
          data-testid="approval-action-success"
        >
          {t("decision_success", {
            action: t(`actions.${state.action}`),
            record: state.recordLabel,
          })}
        </p>
      )}
    </>
  );

  if (allowedActions.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground" data-testid="approval-decision-unavailable">
          {t("decision_forbidden")}
        </p>
        {outcome}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2" data-testid="approval-decision-form">
      <input type="hidden" name="instanceId" value={instanceId} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`comment-${instanceId}`}>
          {t("decision_comment_label")}
        </label>
        <Input
          id={`comment-${instanceId}`}
          name="comment"
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={t("decision_comment_placeholder")}
          className="h-9 max-w-sm text-sm"
          data-testid="approval-comment-input"
        />
        {allowedActions.map((action) => (
          <Button
            key={action}
            type="submit"
            name="action"
            value={action}
            size="sm"
            variant={ACTION_VARIANT[action]}
            disabled={pending}
            data-testid={`approval-action-${action}`}
          >
            {t(`actions.${action}`)}
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("decision_stage", { stage: t(`stages.${stage}`) })}
      </p>

      {outcome}
    </form>
  );
}
