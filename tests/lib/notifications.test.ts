import { describe, expect, it } from "vitest";
import type { Finding } from "@/lib/ai/types";
import type { ApprovalInstance } from "@/lib/approvals/types";
import type { Supplier, SupplierDataRequest } from "@/lib/suppliers/types";
import type { ReductionTarget } from "@/lib/targets/types";
import {
  anomalyNotifications,
  approvalNotifications,
  sortBySeverity,
  supplierNotifications,
  targetNotifications,
} from "@/lib/notifications/types";

function approval(overrides: Partial<ApprovalInstance> = {}): ApprovalInstance {
  return {
    id: "a1",
    companyId: "company-1",
    recordType: "emission_record",
    recordId: "record-1",
    recordLabel: "ER-1",
    summaryKey: "boiler_monthly",
    emissions: 1,
    period: "2024-01",
    currentStep: 1,
    status: "in_progress",
    steps: [],
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

const supplier: Supplier = {
  id: "s1",
  name: "Sample Supplier",
  contactName: null,
  contactEmail: null,
  industryKey: null,
  country: null,
  status: "active",
  annualSpendMillionKrw: null,
};

function request(overrides: Partial<SupplierDataRequest> = {}): SupplierDataRequest {
  return {
    id: "r1",
    companyId: "company-1",
    supplierId: supplier.id,
    period: "2024",
    categoryNumber: 1,
    status: "sent",
    dueDate: "2024-01-01",
    submittedAt: null,
    reportedEmissions: null,
    dataQuality: null,
    verifiedAt: null,
    rejectionReasonKey: null,
    supersedesRequestId: null,
    ...overrides,
  };
}

function target(overrides: Partial<ReductionTarget> = {}): ReductionTarget {
  return {
    id: "t1",
    targetType: "absolute",
    status: "active",
    scope: null,
    baseYear: 2020,
    targetYear: 2030,
    baseEmissions: 100,
    targetEmissions: 50,
    targetReductionPct: 50,
    methodologyKey: null,
    descriptionKey: "absolute_2030",
    progress: [{ year: 2025, actualEmissions: 90 }],
    ...overrides,
  };
}

describe("derived notifications", () => {
  it("creates one item for an open approval and none for a closed chain", () => {
    expect(approvalNotifications([approval()])).toMatchObject([
      { id: "approval:a1", kind: "approval_awaiting", href: "/approvals" },
    ]);
    expect(approvalNotifications([approval({ status: "approved" })])).toEqual([]);
  });

  it("marks a supplier-owned overdue request high severity", () => {
    expect(
      supplierNotifications([supplier], [request()], new Date("2024-02-01T00:00:00Z"), (date) => date)
    ).toMatchObject([{ kind: "supplier_overdue", severity: "high", href: "/suppliers" }]);
  });

  it("does not blame a submitted request on the supplier even after its deadline", () => {
    const items = supplierNotifications(
      [supplier],
      [request({ status: "submitted", submittedAt: "2024-01-02T00:00:00Z" })],
      new Date("2024-02-01T00:00:00Z"),
      (date) => date
    );
    expect(items).toMatchObject([{ kind: "supplier_awaiting_verification", severity: "medium" }]);
  });

  it("skips an orphaned supplier request", () => {
    expect(
      supplierNotifications([], [request()], new Date("2024-02-01T00:00:00Z"), (date) => date)
    ).toEqual([]);
  });

  it("only promotes named high-severity findings", () => {
    const finding = (severity: Finding["severity"], sourceKey: string | null): Finding => ({
      id: `${severity}-${sourceKey}`,
      titleKey: "outlier_high",
      severity,
      source: "deterministic",
      period: "2024-01",
      sourceKey,
      detail: {},
    });
    expect(anomalyNotifications([finding("high", "boiler_1")])).toHaveLength(1);
    expect(anomalyNotifications([finding("medium", "boiler_1"), finding("high", null)])).toEqual([]);
  });

  it("uses the Scope 3 namespace for category findings", () => {
    const [item] = anomalyNotifications([{
      id: "f1",
      titleKey: "scope3_uncalculated",
      severity: "high",
      source: "deterministic",
      period: null,
      sourceKey: "cat4",
      detail: {},
    }]);
    expect(item.refs.source.namespace).toBe("scope3_categories");
  });

  it("creates an item only when a named target is behind", () => {
    expect(targetNotifications([target()])).toMatchObject([
      { kind: "target_behind", severity: "high", href: "/targets" },
    ]);
    expect(targetNotifications([target({ progress: [], descriptionKey: null })])).toEqual([]);
  });

  it("sorts high before medium before low without mutating its input", () => {
    const input = [
      { ...approvalNotifications([approval({ id: "low" })])[0], severity: "low" as const },
      approvalNotifications([approval({ id: "medium" })])[0],
      { ...approvalNotifications([approval({ id: "high" })])[0], severity: "high" as const },
    ];
    const original = [...input];
    expect(sortBySeverity(input).map((item) => item.severity)).toEqual(["high", "medium", "low"]);
    expect(input).toEqual(original);
  });
});
