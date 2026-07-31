/**
 * Impure half of the notification feed: resolves the providers, applies the pure
 * rules in `./types`, and turns the resulting descriptors into localised text.
 *
 * Translation happens here, on the server, rather than in the client menu. The
 * refs a descriptor carries point into four different namespaces
 * (`approvals.stages`, `emission_sources`, `scope3_categories`,
 * `target_descriptions`), and shipping all four to the browser so a dropdown could
 * do the lookup would send the better part of the catalogue for a list of five
 * sentences.
 */

import { getFormatter, getTranslations } from "next-intl/server";
import { detectAllAnomalies } from "@/lib/ai/anomaly-detection";
import { buildSampleObservations } from "@/lib/ai/sample-data";
import { getApprovalsOverview } from "@/lib/approvals/store";
import { getSuppliersOverview } from "@/lib/suppliers/store";
import { getTargetsOverview } from "@/lib/targets/sample-data";
import type { Severity } from "@/lib/ai/types";
import {
  anomalyNotifications,
  approvalNotifications,
  sortBySeverity,
  supplierNotifications,
  targetNotifications,
  type NotificationDescriptor,
  type NotificationKind,
} from "./types";

export type { NotificationKind } from "./types";

/** One item as the header menu renders it. */
export interface LocalisedNotification {
  id: string;
  kind: NotificationKind;
  severity: Severity;
  href: string;
  /** Fully interpolated message in the active locale. */
  message: string;
}

/**
 * Every outstanding item, most severe first.
 *
 * `asOf` is injectable so a test can pin the clock: whether a supplier request is
 * overdue is a function of *when you ask*, and a test that used the real clock
 * would start failing on a date nobody chose.
 */
export async function getNotifications(asOf = new Date()): Promise<LocalisedNotification[]> {
  const [approvals, suppliers, targets] = await Promise.all([
    getApprovalsOverview(),
    getSuppliersOverview(),
    getTargetsOverview(),
  ]);

  const anomalies = detectAllAnomalies(buildSampleObservations());

  const format = await getFormatter();
  const formatDate = (isoDate: string) =>
    format.dateTime(new Date(isoDate), { dateStyle: "medium" });

  const descriptors: NotificationDescriptor[] = [
    ...supplierNotifications(suppliers.suppliers, suppliers.requests, asOf, formatDate),
    ...anomalyNotifications(anomalies.findings),
    ...targetNotifications(targets.targets),
    ...approvalNotifications(approvals.instances),
  ];

  const t = await getTranslations("notifications");
  // One translator per namespace, resolved once rather than per descriptor.
  const namespaces = new Map<string, Awaited<ReturnType<typeof getTranslations>>>();
  for (const descriptor of descriptors) {
    for (const { namespace } of Object.values(descriptor.refs)) {
      if (!namespaces.has(namespace)) {
        namespaces.set(namespace, await getTranslations(namespace));
      }
    }
  }

  return sortBySeverity(descriptors).map((descriptor) => {
    const values: Record<string, string> = { ...descriptor.literals };
    for (const [name, ref] of Object.entries(descriptor.refs)) {
      const translate = namespaces.get(ref.namespace);
      // Falls back to the raw key rather than throwing: a missing translation
      // should degrade one word of one notification, not blank the header.
      values[name] = translate ? translate(ref.key) : ref.key;
    }

    return {
      id: descriptor.id,
      kind: descriptor.kind,
      severity: descriptor.severity,
      href: descriptor.href,
      message: t(descriptor.kind, values),
    };
  });
}
