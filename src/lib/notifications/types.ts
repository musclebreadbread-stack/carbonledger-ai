/**
 * The work-queue feed behind the header's bell.
 *
 * The bell was decoration: a button with no handler and a permanent red dot, so
 * it claimed there was always something unread and could never say what. Nothing
 * in the product surfaced "what needs me next" at all — a reviewer had to open
 * /approvals, /suppliers, /targets and /ai-insights in turn to find out.
 *
 * Everything here is *derived*. There is no notifications table, no read/unread
 * state and no delivery: an item exists exactly as long as the underlying
 * condition does, which is why a stale notification is impossible and why nothing
 * needs to be marked read. The tradeoff is the honest one — dismissal is not
 * offered, because there is nowhere to record it.
 *
 * This module is pure. The rules below take already-loaded data and a clock and
 * return descriptors; resolving providers and translating the descriptors happens
 * in `./index`, which is the impure half. That split is what makes the rules
 * exhaustively testable, and the boundaries (a target with no data is not
 * "behind"; our own verification backlog is not supplier lateness) are the part
 * worth testing.
 */

import type { Severity } from "@/lib/ai/types";
import { currentStage, type ApprovalInstance } from "@/lib/approvals/types";
import {
  isAwaitingVerification,
  isOverdue,
  type Supplier,
  type SupplierDataRequest,
} from "@/lib/suppliers/types";
import { assessTarget, type ReductionTarget } from "@/lib/targets/types";
import type { Finding } from "@/lib/ai/types";

export type NotificationKind =
  | "approval_awaiting"
  | "supplier_overdue"
  | "supplier_awaiting_verification"
  | "anomaly_high"
  | "target_behind";

/**
 * A reference to a message that must be looked up before interpolation.
 *
 * Stage names, emission source names and target descriptions are all stored as
 * message keys, so a notification cannot carry them as text without picking a
 * language. Carrying the namespace and key instead keeps this module free of
 * `next-intl` and keeps the feed translatable.
 */
export interface MessageRef {
  namespace: string;
  key: string;
}

export interface NotificationDescriptor {
  /** Stable across renders: derived from the underlying row's id. */
  id: string;
  kind: NotificationKind;
  severity: Severity;
  /** Where clicking it takes you. */
  href: string;
  /** ICU arguments that are already display-ready (labels, dates, names). */
  literals: Record<string, string>;
  /** ICU arguments that need resolving through a message namespace first. */
  refs: Record<string, MessageRef>;
}

/** High before medium before low; ties keep provider order, which is stable. */
const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function sortBySeverity(
  descriptors: readonly NotificationDescriptor[]
): NotificationDescriptor[] {
  return [...descriptors].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

/**
 * Approvals still waiting at a stage.
 *
 * `currentStage` returns null for a closed chain, which is the whole filter: an
 * approved or rejected instance is not waiting on anyone, and a "pending" status
 * with no outstanding stage would otherwise nag forever.
 *
 * Medium, not high. A chain awaiting review is the system working as designed;
 * only the supplier and anomaly cases below represent something having gone
 * wrong.
 */
export function approvalNotifications(
  instances: readonly ApprovalInstance[]
): NotificationDescriptor[] {
  return instances.flatMap((instance) => {
    const stage = currentStage(instance);
    if (stage === null) return [];
    return [
      {
        id: `approval:${instance.id}`,
        kind: "approval_awaiting" as const,
        severity: "medium" as Severity,
        href: "/approvals",
        literals: { record: instance.recordLabel },
        refs: { stage: { namespace: "approvals.stages", key: stage } },
      },
    ];
  });
}

/**
 * Supplier requests that are overdue, or submitted and awaiting our verification.
 *
 * Overdue is high and verification-pending is medium, because the two are owed by
 * different parties: `isOverdue` already refuses to count a submitted request as
 * late (that backlog is ours), so the split here follows the same line rather
 * than inventing a second one.
 *
 * A request whose supplier is missing from the roster is skipped rather than
 * labelled with a raw id — an unnameable notification is worse than none.
 */
export function supplierNotifications(
  suppliers: readonly Supplier[],
  requests: readonly SupplierDataRequest[],
  asOf: Date,
  formatDate: (isoDate: string) => string
): NotificationDescriptor[] {
  const nameOf = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

  return requests.flatMap<NotificationDescriptor>((request) => {
    const supplier = nameOf.get(request.supplierId);
    if (supplier === undefined) return [];

    if (isOverdue(request, asOf)) {
      return [
        {
          id: `supplier-overdue:${request.id}`,
          kind: "supplier_overdue" as const,
          severity: "high" as Severity,
          href: "/suppliers",
          literals: { supplier, date: formatDate(request.dueDate) },
          refs: {},
        },
      ];
    }

    if (isAwaitingVerification(request)) {
      return [
        {
          id: `supplier-verify:${request.id}`,
          kind: "supplier_awaiting_verification" as const,
          severity: "medium" as Severity,
          href: "/suppliers",
          literals: { supplier },
          refs: {},
        },
      ];
    }

    return [];
  });
}

/**
 * High-severity AI findings only.
 *
 * Medium and low findings are left to `/ai-insights`. The bell is a queue of
 * things someone should act on today; forwarding every finding would reproduce the
 * page it links to and make the count meaningless.
 *
 * `sourceKey` decides the namespace the same way `/ai-insights` does: `catN` keys
 * name a Scope 3 category, everything else names an emission source. A finding
 * with no source is dropped, for the same reason as an unnameable supplier.
 */
export function anomalyNotifications(findings: readonly Finding[]): NotificationDescriptor[] {
  return findings.flatMap((finding) => {
    if (finding.severity !== "high" || finding.sourceKey === null) return [];
    const namespace = /^cat\d+$/.test(finding.sourceKey)
      ? "scope3_categories"
      : "emission_sources";
    return [
      {
        id: `anomaly:${finding.id}`,
        kind: "anomaly_high" as const,
        severity: "high" as Severity,
        href: "/ai-insights",
        literals: {},
        refs: { source: { namespace, key: finding.sourceKey } },
      },
    ];
  });
}

/**
 * Targets behind their linear pathway.
 *
 * `assessTarget` distinguishes `behind` from `no_data`, and only the first is
 * reported: a target whose company has not filed a measurement yet is not failing,
 * and saying it is would put a permanent red badge on every newly created target.
 *
 * A target with no `descriptionKey` is skipped — there would be nothing to call it.
 */
export function targetNotifications(
  targets: readonly ReductionTarget[]
): NotificationDescriptor[] {
  return targets.flatMap((target) => {
    if (target.descriptionKey === null) return [];
    if (assessTarget(target).verdict !== "behind") return [];
    return [
      {
        id: `target:${target.id}`,
        kind: "target_behind" as const,
        severity: "high" as Severity,
        href: "/targets",
        literals: {},
        refs: { target: { namespace: "target_descriptions", key: target.descriptionKey } },
      },
    ];
  });
}
