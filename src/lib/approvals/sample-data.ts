/**
 * SAMPLE (MOCK) APPROVAL INSTANCES — NOT REAL SUBMISSIONS OR SIGNATURES.
 *
 * Seeds `/approvals` while there is no live database. Payloads carry
 * `isSampleData: true` and the page renders `<SampleDataNotice />` off it.
 *
 * The fixtures are not hand-written instance objects. Each one is built by
 * *replaying* its decisions through `recordApprovalAction` — the same function
 * the Server Action calls — with a synthetic actor per signer. Two things follow
 * from that, both deliberate:
 *
 *   * the signatures are produced by the real signing path over the real
 *     payloads, so the page's verification badge is exercising production code
 *     rather than comparing placeholder strings;
 *   * the *shapes* the page has to render (a returned instance queued back at
 *     the author, a rejected chain with no outstanding steps) are whatever the
 *     transition rules actually produce, so a fixture cannot quietly encode a
 *     state the live code path can never reach.
 *
 * They are still sample signatures by sample signers — they attest to nothing.
 *
 * The five instances cover every state the UI must render: one fully approved
 * chain, one awaiting review, one awaiting approval, one returned for revision,
 * and one rejected.
 *
 * To go live, replace the provider in `./store` with a Drizzle-backed
 * implementation satisfying `ApprovalsProvider`: select `workflow_instances`
 * joined to `workflow_steps`, ordered by `step_number`.
 */

import { SAMPLE_COMPANY_ID, type Actor } from "@/lib/auth/actor";
import { Role } from "@/lib/auth/roles";
import { recordApprovalAction } from "./transitions";
import {
  WORKFLOW_STAGES,
  type ApprovalInstance,
  type ApprovalsOverview,
  type WorkflowAction,
  type WorkflowInstanceStatus,
  type WorkflowStep,
} from "./types";

interface SampleStep {
  action: WorkflowAction;
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
  /**
   * Status the replay is expected to arrive at. An assertion, not an input:
   * `buildSampleApprovalsOverview` throws if the transition rules disagree,
   * which is how a fixture that no longer matches the workflow gets caught.
   */
  status: WorkflowInstanceStatus;
  createdAt: string;
  /** Decisions taken, in order. */
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
    taken: [
      {
        action: "submit",
        commentKey: "submitted_with_invoices",
        completedAt: "2024-12-02T01:10:00.000Z",
        signerId: "user-author-01",
      },
      {
        action: "review",
        commentKey: "factors_checked",
        completedAt: "2024-12-03T05:20:00.000Z",
        signerId: "user-reviewer-01",
      },
      {
        action: "approve",
        commentKey: "approved_no_findings",
        completedAt: "2024-12-05T02:05:00.000Z",
        signerId: "user-approver-01",
      },
      {
        action: "approve",
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
    taken: [
      {
        action: "submit",
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
    taken: [
      {
        action: "submit",
        commentKey: "fuel_cards_reconciled",
        completedAt: "2024-11-28T02:00:00.000Z",
        signerId: "user-author-03",
      },
      {
        action: "review",
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
    taken: [
      {
        action: "submit",
        commentKey: "service_report_attached",
        completedAt: "2024-12-05T03:00:00.000Z",
        signerId: "user-author-02",
      },
      {
        action: "return_for_revision",
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
    taken: [
      {
        action: "submit",
        commentKey: "estimated_from_prior_year",
        completedAt: "2024-10-10T04:00:00.000Z",
        signerId: "user-author-04",
      },
      {
        action: "review",
        commentKey: "estimate_flagged",
        completedAt: "2024-10-14T02:30:00.000Z",
        signerId: "user-reviewer-01",
      },
      {
        action: "reject",
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
 * Roles the sample signers hold.
 *
 * Not uniform on purpose: the reviewers are `reviewer`, which holds
 * `can_approve` but not `can_write`, so the replay of the sample data is itself a
 * check that reviewing does not require write capability and that authoring is
 * done by someone who has it.
 */
const SAMPLE_SIGNER_ROLES: Record<string, Role> = {
  "user-author-01": Role.SITE_ADMIN,
  "user-author-02": Role.SITE_ADMIN,
  "user-author-03": Role.SITE_ADMIN,
  "user-author-04": Role.SITE_ADMIN,
  "user-reviewer-01": Role.REVIEWER,
  "user-reviewer-02": Role.REVIEWER,
  "user-approver-01": Role.COMPANY_ADMIN,
  "user-approver-02": Role.COMPANY_ADMIN,
  "user-final-01": Role.COMPANY_ADMIN,
};

export function sampleSignerName(signerId: string): string {
  return SAMPLE_SIGNER_NAMES[signerId] ?? signerId;
}

function sampleActor(signerId: string): Actor {
  return {
    id: signerId,
    name: sampleSignerName(signerId),
    role: SAMPLE_SIGNER_ROLES[signerId] ?? Role.VIEWER,
    companyId: SAMPLE_COMPANY_ID,
  };
}

/** A freshly opened instance: nothing taken, the whole chain outstanding. */
function openInstance(sample: SampleInstance): ApprovalInstance {
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
    id: sample.id,
    companyId: SAMPLE_COMPANY_ID,
    recordType: "emission_record",
    recordId: sample.id,
    recordLabel: sample.recordLabel,
    summaryKey: sample.summaryKey,
    emissions: sample.emissions,
    period: sample.period,
    currentStep: 0,
    status: "pending",
    steps,
    createdAt: sample.createdAt,
    updatedAt: sample.createdAt,
  };
}

/**
 * Builds the sample payload by replaying every decision through the real
 * transition and signing path. Async because Web Crypto is async.
 */
export async function buildSampleApprovalsOverview(): Promise<ApprovalsOverview> {
  const instances: ApprovalInstance[] = [];

  for (const sample of SAMPLE_INSTANCES) {
    let instance = openInstance(sample);

    for (const taken of sample.taken) {
      const result = await recordApprovalAction(instance, sampleActor(taken.signerId), {
        action: taken.action,
        comment: taken.commentKey,
        at: taken.completedAt,
      });

      // A fixture the workflow rules refuse is a bug in the fixture or in the
      // rules; either way it must not be papered over into a half-built chain.
      if (!result.ok) {
        throw new Error(
          `Sample instance ${sample.id} could not take ${taken.action} as ${taken.signerId}: ${result.reason}`
        );
      }
      instance = result.instance;
    }

    if (instance.status !== sample.status) {
      throw new Error(
        `Sample instance ${sample.id} replayed to status ${instance.status}, expected ${sample.status}`
      );
    }

    instances.push(instance);
  }

  return { isSampleData: true, instances };
}
