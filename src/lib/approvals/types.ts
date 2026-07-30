/**
 * Typed contract for the approval workflow served at `/approvals`.
 *
 * The workflow is the four-stage chain the product promises:
 *   작성자 (author) → 검토자 (reviewer) → 승인자 (approver) → 최종확정 (final)
 *
 * Mirrors `workflow_definitions`, `workflow_instances` and `workflow_steps` in
 * `src/lib/db/schema/workflows.ts`. `workflow_steps.step_number` maps onto
 * `WORKFLOW_STAGES` below by index, and `workflow_steps.digital_signature` holds
 * the signature produced by `./signature.ts`.
 *
 * `emission_records` already carries `status`, `submitted_by`, `reviewed_by` and
 * `approved_by`, so a database-backed provider can drive the whole chain from
 * the record row and use `workflow_steps` for the audit detail.
 */

/** The four stages, in order. Index === `workflow_steps.step_number`. */
export type WorkflowStage = "author" | "reviewer" | "approver" | "final";

/** Ordered stage list. Exported so the UI never hard-codes the sequence. */
export const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  "author",
  "reviewer",
  "approver",
  "final",
] as const;

/**
 * What a participant did at a stage.
 *
 * `return_for_revision` (재요청) is distinct from `reject` (반려): a return sends
 * the record back to the author with the instance still open, whereas a reject
 * terminates it. Collapsing the two would lose the difference between "fix this"
 * and "this is not going forward".
 */
export type WorkflowAction = "submit" | "review" | "approve" | "reject" | "return_for_revision";

/** Instance-level status, matching the `workflow_status` enum. */
export type WorkflowInstanceStatus = "pending" | "in_progress" | "approved" | "rejected";

/** A completed or awaiting step of one instance. */
export interface WorkflowStep {
  stepNumber: number;
  stage: WorkflowStage;
  /** Key under `approvals.roles` describing who acts at this stage. */
  assigneeNameKey: string | null;
  action: WorkflowAction | null;
  /** Key under `approval_comments`, or a stored free-text comment. */
  commentKey: string | null;
  /**
   * Signature digest as stored in `workflow_steps.digital_signature`, or null
   * when the step has not been signed. Never the raw signer identity — see
   * `./signature.ts` for the format.
   */
  digitalSignature: string | null;
  /** ISO-8601 timestamp, or null while the step is outstanding. */
  completedAt: string | null;
}

/** One record moving through the chain. */
export interface ApprovalInstance {
  id: string;
  /** Type of record under approval, e.g. `emission_record`. */
  recordType: string;
  recordId: string;
  /** Human-facing record label, e.g. `ER-2024-0117`. Not translated. */
  recordLabel: string;
  /** Key under `approvals.record_summaries` describing what is being approved. */
  summaryKey: string;
  /** Emissions the record accounts for, in tCO2e. */
  emissions: number;
  /** Reporting period as `YYYY-MM`. */
  period: string;
  /**
   * Index into `WORKFLOW_STAGES` of the stage awaiting action. Equal to
   * `WORKFLOW_STAGES.length` once the chain is complete.
   */
  currentStep: number;
  status: WorkflowInstanceStatus;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalsOverview {
  /** True when these are sample instances rather than real submissions. */
  isSampleData: boolean;
  instances: ApprovalInstance[];
}

export type ApprovalsProvider = (options?: {
  companyId?: string;
}) => Promise<ApprovalsOverview>;

/** The stage a given instance is waiting on, or null when it is finished. */
export function currentStage(instance: ApprovalInstance): WorkflowStage | null {
  if (instance.status === "approved" || instance.status === "rejected") return null;
  return WORKFLOW_STAGES[instance.currentStep] ?? null;
}

/** Steps that have been acted on, in stage order. */
export function completedSteps(instance: ApprovalInstance): WorkflowStep[] {
  return instance.steps
    .filter((step) => step.completedAt !== null)
    .sort((a, b) => a.stepNumber - b.stepNumber);
}

/**
 * Completion of the chain as a percentage, 0-100.
 *
 * A rejected instance reports the progress it reached rather than 100%: it is
 * finished, but it did not complete the chain, and showing a full bar for a
 * rejected record would be actively misleading.
 */
export function chainProgressPercent(instance: ApprovalInstance): number {
  const done = completedSteps(instance).length;
  return Math.round((Math.min(done, WORKFLOW_STAGES.length) / WORKFLOW_STAGES.length) * 100);
}

/** Counts of instances by status, for the KPI row. */
export interface ApprovalCounts {
  total: number;
  awaitingReview: number;
  awaitingApproval: number;
  approved: number;
  rejected: number;
  /** Instances sent back to the author for revision. */
  returned: number;
}

export function countByStage(instances: readonly ApprovalInstance[]): ApprovalCounts {
  const counts: ApprovalCounts = {
    total: instances.length,
    awaitingReview: 0,
    awaitingApproval: 0,
    approved: 0,
    rejected: 0,
    returned: 0,
  };

  for (const instance of instances) {
    if (instance.status === "approved") {
      counts.approved += 1;
      continue;
    }
    if (instance.status === "rejected") {
      counts.rejected += 1;
      continue;
    }
    // An open instance whose last action was a return is queued back at the
    // author, which is a different worklist from a fresh submission.
    const last = completedSteps(instance).at(-1);
    if (last?.action === "return_for_revision") {
      counts.returned += 1;
      continue;
    }
    const stage = currentStage(instance);
    if (stage === "reviewer") counts.awaitingReview += 1;
    else if (stage === "approver" || stage === "final") counts.awaitingApproval += 1;
  }

  return counts;
}

/**
 * Whether `action` is legal at `stage`.
 *
 * Kept as data rather than scattered `if`s so the rule is stated once and the
 * unit test can enumerate it exhaustively.
 */
export function isActionAllowed(stage: WorkflowStage, action: WorkflowAction): boolean {
  switch (stage) {
    case "author":
      return action === "submit";
    case "reviewer":
      return action === "review" || action === "reject" || action === "return_for_revision";
    case "approver":
      return action === "approve" || action === "reject" || action === "return_for_revision";
    case "final":
      return action === "approve" || action === "return_for_revision";
  }
}
