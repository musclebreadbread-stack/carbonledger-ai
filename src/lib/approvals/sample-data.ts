/**
 * SAMPLE (MOCK) APPROVAL INSTANCES — NOT REAL SUBMISSIONS OR SIGNATURES.
 *
 * Drives `/approvals` while there is no live database. Payloads carry
 * `isSampleData: true` and the page renders `<SampleDataNotice />` off it.
 *
 * The signatures below are produced by the real `signPayload` from
 * `./signature.ts` over the sample payloads, so the page's verification badge is
 * exercising the actual signing code rather than a placeholder string. They are
 * still sample signatures by sample signers — they attest to nothing.
 *
 * The five instances cover every state the UI must render: one fully approved
 * chain, one awaiting review, one awaiting approval, one returned for revision,
 * and one rejected.
 *
 * To go live, replace `getApprovalsOverview` with a Drizzle-backed
 * implementation satisfying `ApprovalsProvider`: select `workflow_instances`
 * joined to `workflow_steps`, ordered by `step_number`.
 */

import { signPayload, type SignaturePayload } from "./signature";
import {
  WORKFLOW_STAGES,
  type ApprovalInstance,
  type ApprovalsOverview,
  type ApprovalsProvider,
  type WorkflowAction,
  type WorkflowInstanceStatus,
  type WorkflowStep,
} from "./types";

interface SampleStep {
  action: WorkflowAction;
  assigneeNameKey: string;
  commentKey: string | null;
  completedAt: string;
  signerId: string;
}

interface SampleInstance {
  id: string;
  recordLabel: string;
  summaryKey: string;
  emissions: number;
  period: string;
  status: WorkflowInstanceStatus;
  createdAt: string;
  updatedAt: string;
  /** Completed steps, in stage order starting at the author stage. */
  taken: SampleStep[];
}

const SAMPLE_INSTANCES: readonly SampleInstance[] = [
  {
    id: "aaaaaaa1-0000-4000-8000-000000000001",
    recordLabel: "ER-2024-0117",
    summaryKey: "boiler_monthly",
    emissions: 1_234.5,
    period: "2024-11",
    status: "approved",
    createdAt: "2024-12-02T01:10:00.000Z",
    updatedAt: "2024-12-06T07:42:00.000Z",
    taken: [
      {
        action: "submit",
        assigneeNameKey: "author",
        commentKey: "submitted_with_invoices",
        completedAt: "2024-12-02T01:10:00.000Z",
        signerId: "user-author-01",
      },
      {
        action: "review",
        assigneeNameKey: "reviewer",
        commentKey: "factors_checked",
        completedAt: "2024-12-03T05:20:00.000Z",
        signerId: "user-reviewer-01",
      },
      {
        action: "approve",
        assigneeNameKey: "approver",
        commentKey: "approved_no_findings",
        completedAt: "2024-12-05T02:05:00.000Z",
        signerId: "user-approver-01",
      },
      {
        action: "approve",
        assigneeNameKey: "final",
        commentKey: "locked_for_reporting",
        completedAt: "2024-12-06T07:42:00.000Z",
        signerId: "user-final-01",
      },
    ],
  },
  {
    id: "aaaaaaa1-0000-4000-8000-000000000002",
    recordLabel: "ER-2024-0121",
    summaryKey: "grid_electricity_monthly",
    emissions: 2_891.0,
    period: "2024-11",
    status: "in_progress",
    createdAt: "2024-12-04T00:30:00.000Z",
    updatedAt: "2024-12-04T00:30:00.000Z",
    taken: [
      {
        action: "submit",
        assigneeNameKey: "author",
        commentKey: "meter_readings_attached",
        completedAt: "2024-12-04T00:30:00.000Z",
        signerId: "user-author-02",
      },
    ],
  },
  {
    id: "aaaaaaa1-0000-4000-8000-000000000003",
    recordLabel: "ER-2024-0122",
    summaryKey: "fleet_quarterly",
    emissions: 456.75,
    period: "2024-10",
    status: "in_progress",
    createdAt: "2024-11-28T02:00:00.000Z",
    updatedAt: "2024-12-01T06:15:00.000Z",
    taken: [
      {
        action: "submit",
        assigneeNameKey: "author",
        commentKey: "fuel_cards_reconciled",
        completedAt: "2024-11-28T02:00:00.000Z",
        signerId: "user-author-03",
      },
      {
        action: "review",
        assigneeNameKey: "reviewer",
        commentKey: "mileage_cross_checked",
        completedAt: "2024-12-01T06:15:00.000Z",
        signerId: "user-reviewer-01",
      },
    ],
  },
  {
    id: "aaaaaaa1-0000-4000-8000-000000000004",
    recordLabel: "ER-2024-0124",
    summaryKey: "refrigerant_topup",
    emissions: 89.2,
    period: "2024-11",
    status: "in_progress",
    createdAt: "2024-12-05T03:00:00.000Z",
    updatedAt: "2024-12-07T01:25:00.000Z",
    taken: [
      {
        action: "submit",
        assigneeNameKey: "author",
        commentKey: "service_report_attached",
        completedAt: "2024-12-05T03:00:00.000Z",
        signerId: "user-author-02",
      },
      {
        action: "return_for_revision",
        assigneeNameKey: "reviewer",
        commentKey: "gwp_version_mismatch",
        completedAt: "2024-12-07T01:25:00.000Z",
        signerId: "user-reviewer-02",
      },
    ],
  },
  {
    id: "aaaaaaa1-0000-4000-8000-000000000005",
    recordLabel: "ER-2024-0109",
    summaryKey: "purchased_steam",
    emissions: 1_370.0,
    period: "2024-09",
    status: "rejected",
    createdAt: "2024-10-10T04:00:00.000Z",
    updatedAt: "2024-10-16T08:10:00.000Z",
    taken: [
      {
        action: "submit",
        assigneeNameKey: "author",
        commentKey: "estimated_from_prior_year",
        completedAt: "2024-10-10T04:00:00.000Z",
        signerId: "user-author-04",
      },
      {
        action: "review",
        assigneeNameKey: "reviewer",
        commentKey: "estimate_flagged",
        completedAt: "2024-10-14T02:30:00.000Z",
        signerId: "user-reviewer-01",
      },
      {
        action: "reject",
        assigneeNameKey: "approver",
        commentKey: "no_supplier_invoice",
        completedAt: "2024-10-16T08:10:00.000Z",
        signerId: "user-approver-02",
      },
    ],
  },
];

/** Signer display names, keyed by the sample signer ids above. */
const SAMPLE_SIGNER_NAMES: Record<string, string> = {
  "user-author-01": "K. Park",
  "user-author-02": "J. Lee",
  "user-author-03": "S. Choi",
  "user-author-04": "H. Yoon",
  "user-reviewer-01": "M. Kim",
  "user-reviewer-02": "D. Jang",
  "user-approver-01": "Y. Seo",
  "user-approver-02": "B. Han",
  "user-final-01": "CFO Office",
};

/**
 * Builds the signature payload for a sample step.
 *
 * Exported because the page verifies the signatures it renders, and verification
 * has to reconstruct byte-identical payloads. Keeping one function for both
 * signing and verifying is what makes the badge meaningful — two independent
 * copies of this logic would drift and the badge would silently go red.
 */
export function sampleSignaturePayload(
  instance: ApprovalInstance,
  step: WorkflowStep,
  signerId: string
): SignaturePayload {
  return {
    recordType: instance.recordType,
    recordId: instance.recordId,
    stage: step.stage,
    action: step.action as WorkflowAction,
    signerId,
    signerName: SAMPLE_SIGNER_NAMES[signerId] ?? signerId,
    emissions: instance.emissions,
    signedAt: step.completedAt as string,
  };
}

/** Signer ids per instance/step, so verification can rebuild the payloads. */
export function sampleSignerId(instanceId: string, stepNumber: number): string | null {
  const instance = SAMPLE_INSTANCES.find((candidate) => candidate.id === instanceId);
  return instance?.taken[stepNumber]?.signerId ?? null;
}

export function sampleSignerName(signerId: string): string {
  return SAMPLE_SIGNER_NAMES[signerId] ?? signerId;
}

/**
 * Builds the sample payload, signing each completed step with the real signing
 * code. Async because Web Crypto is async.
 */
export async function buildSampleApprovalsOverview(): Promise<ApprovalsOverview> {
  const instances: ApprovalInstance[] = [];

  for (const sample of SAMPLE_INSTANCES) {
    // `currentStep` is the number of completed steps for an open instance, and
    // the full chain length once approved. A rejected instance stops where it
    // was rejected, which is also the count of steps taken.
    const currentStep =
      sample.status === "approved" ? WORKFLOW_STAGES.length : sample.taken.length;

    const instance: ApprovalInstance = {
      id: sample.id,
      recordType: "emission_record",
      recordId: sample.id,
      recordLabel: sample.recordLabel,
      summaryKey: sample.summaryKey,
      emissions: sample.emissions,
      period: sample.period,
      currentStep,
      status: sample.status,
      steps: [],
      createdAt: sample.createdAt,
      updatedAt: sample.updatedAt,
    };

    // Completed steps first, then a placeholder row for the stage still
    // outstanding so the UI can render the whole four-stage chain rather than
    // only the part that has happened.
    for (const [index, taken] of sample.taken.entries()) {
      const step: WorkflowStep = {
        stepNumber: index,
        stage: WORKFLOW_STAGES[index],
        assigneeNameKey: taken.assigneeNameKey,
        action: taken.action,
        commentKey: taken.commentKey,
        digitalSignature: null,
        completedAt: taken.completedAt,
      };
      step.digitalSignature = await signPayload(
        sampleSignaturePayload(instance, step, taken.signerId)
      );
      instance.steps.push(step);
    }

    if (sample.status === "in_progress" || sample.status === "pending") {
      for (let index = sample.taken.length; index < WORKFLOW_STAGES.length; index += 1) {
        instance.steps.push({
          stepNumber: index,
          stage: WORKFLOW_STAGES[index],
          assigneeNameKey: WORKFLOW_STAGES[index],
          action: null,
          commentKey: null,
          digitalSignature: null,
          completedAt: null,
        });
      }
    }

    instances.push(instance);
  }

  return { isSampleData: true, instances };
}

/** Active approvals provider. Returns sample instances. */
export const getApprovalsOverview: ApprovalsProvider = async () => {
  return buildSampleApprovalsOverview();
};
