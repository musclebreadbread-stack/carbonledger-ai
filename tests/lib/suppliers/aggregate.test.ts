import { describe, expect, it } from "vitest";
import { SAMPLE_AS_OF, buildSampleSuppliersOverview } from "@/lib/suppliers/sample-data";
import {
  aggregateByCategory,
  countRequests,
  isOverdue,
  reRequest,
  responseRatePercent,
  type SupplierDataRequest,
} from "@/lib/suppliers/types";

function request(overrides: Partial<SupplierDataRequest> = {}): SupplierDataRequest {
  return {
    id: "r1",
    supplierId: "s1",
    period: "2024",
    categoryNumber: 1,
    status: "verified",
    dueDate: "2024-11-30",
    submittedAt: "2024-11-20T00:00:00.000Z",
    reportedEmissions: 100,
    dataQuality: 3,
    rejectionReasonKey: null,
    supersedesRequestId: null,
    ...overrides,
  };
}

describe("aggregateByCategory", () => {
  it("sums verified submissions per category", () => {
    const result = aggregateByCategory([
      request({ id: "a", reportedEmissions: 100 }),
      request({ id: "b", supplierId: "s2", reportedEmissions: 250 }),
      request({ id: "c", categoryNumber: 4, reportedEmissions: 40 }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      categoryNumber: 1,
      verifiedEmissions: 350,
      verifiedSupplierCount: 2,
    });
    expect(result[1].categoryNumber).toBe(4);
  });

  it("keeps unverified submissions out of the verified total", () => {
    const result = aggregateByCategory([
      request({ id: "a", reportedEmissions: 100 }),
      request({ id: "b", status: "submitted", dataQuality: null, reportedEmissions: 900 }),
    ]);

    expect(result[0].verifiedEmissions).toBe(100);
    expect(result[0].pendingEmissions).toBe(900);
    expect(result[0].pendingSupplierCount).toBe(1);
  });

  it("excludes rejected submissions entirely", () => {
    const result = aggregateByCategory([
      request({ id: "a", reportedEmissions: 100 }),
      request({
        id: "bad",
        status: "rejected",
        reportedEmissions: 5_000,
        rejectionReasonKey: "no_methodology_disclosed",
      }),
    ]);

    expect(result[0].verifiedEmissions).toBe(100);
    expect(result[0].pendingEmissions).toBe(0);
  });

  it("does not double-count a rejected request that was re-requested and verified", () => {
    // The bug this rule exists to prevent: both rows are in the table, and a
    // plain groupBy would add them together.
    const result = aggregateByCategory([
      request({ id: "REQ-1", status: "rejected", reportedEmissions: 600 }),
      request({ id: "REQ-1R", reportedEmissions: 540, supersedesRequestId: "REQ-1" }),
    ]);

    expect(result[0].verifiedEmissions).toBe(540);
    expect(result[0].verifiedSupplierCount).toBe(1);
  });

  it("drops a superseded request even when it had been verified", () => {
    const result = aggregateByCategory([
      request({ id: "REQ-1", reportedEmissions: 600 }),
      request({ id: "REQ-1R", reportedEmissions: 540, supersedesRequestId: "REQ-1" }),
    ]);

    expect(result[0].verifiedEmissions).toBe(540);
  });

  it("ignores requests with no reported figure", () => {
    const result = aggregateByCategory([
      request({ id: "a", reportedEmissions: 100 }),
      request({ id: "b", status: "sent", submittedAt: null, reportedEmissions: null }),
    ]);

    expect(result[0].verifiedSupplierCount).toBe(1);
  });

  it("returns categories in ascending order", () => {
    const result = aggregateByCategory([
      request({ id: "a", categoryNumber: 12 }),
      request({ id: "b", categoryNumber: 1 }),
      request({ id: "c", categoryNumber: 4 }),
    ]);

    expect(result.map((entry) => entry.categoryNumber)).toEqual([1, 4, 12]);
  });

  it("returns nothing for no requests", () => {
    expect(aggregateByCategory([])).toEqual([]);
  });
});

describe("isOverdue", () => {
  const asOf = new Date("2024-12-10T00:00:00.000Z");

  it("flags a request the supplier has not answered past its due date", () => {
    expect(
      isOverdue(
        request({ status: "sent", submittedAt: null, reportedEmissions: null }),
        asOf
      )
    ).toBe(true);
  });

  it("does not blame the supplier for our own verification backlog", () => {
    // Submitted before the deadline, still unverified afterwards: our delay.
    expect(isOverdue(request({ status: "submitted", dataQuality: null }), asOf)).toBe(false);
  });

  it("is false for a future due date", () => {
    expect(
      isOverdue(
        request({ status: "sent", submittedAt: null, dueDate: "2025-06-30" }),
        asOf
      )
    ).toBe(false);
  });

  it("is false rather than true for an unparseable due date", () => {
    expect(
      isOverdue(request({ status: "sent", submittedAt: null, dueDate: "whenever" }), asOf)
    ).toBe(false);
  });
});

describe("countRequests", () => {
  it("partitions every request into exactly one bucket", () => {
    const { requests } = buildSampleSuppliersOverview();
    const counts = countRequests(requests, SAMPLE_AS_OF);

    expect(
      counts.awaitingSupplier + counts.awaitingVerification + counts.verified + counts.rejected
    ).toBe(counts.total);
  });

  it("counts overdue independently of the status buckets", () => {
    const { requests } = buildSampleSuppliersOverview();
    const counts = countRequests(requests, SAMPLE_AS_OF);

    expect(counts.overdue).toBeGreaterThan(0);
    expect(counts.overdue).toBeLessThanOrEqual(counts.awaitingSupplier);
  });
});

describe("responseRatePercent", () => {
  it("counts a rejected submission as a response", () => {
    // "Replied badly" is a different problem from "never replied".
    const rate = responseRatePercent([
      request({ id: "a" }),
      request({ id: "b", status: "rejected" }),
    ]);
    expect(rate).toBe(100);
  });

  it("counts an unanswered request against the rate", () => {
    const rate = responseRatePercent([
      request({ id: "a" }),
      request({ id: "b", status: "sent", submittedAt: null, reportedEmissions: null }),
    ]);
    expect(rate).toBe(50);
  });

  it("is 0 rather than NaN with no requests", () => {
    expect(responseRatePercent([])).toBe(0);
  });
});

describe("reRequest", () => {
  it("builds a fresh request pointing back at the rejected one", () => {
    const rejected = request({ id: "REQ-9", status: "rejected", rejectionReasonKey: "x" });
    const replacement = reRequest(rejected, { id: "REQ-9R", dueDate: "2025-01-31" });

    expect(replacement).toMatchObject({
      id: "REQ-9R",
      status: "sent",
      supersedesRequestId: "REQ-9",
      submittedAt: null,
      reportedEmissions: null,
      rejectionReasonKey: null,
    });
    expect(replacement.categoryNumber).toBe(rejected.categoryNumber);
    expect(replacement.supplierId).toBe(rejected.supplierId);
  });

  it("does not mutate the original", () => {
    const rejected = request({ id: "REQ-9", status: "rejected" });
    reRequest(rejected, { id: "REQ-9R", dueDate: "2025-01-31" });
    expect(rejected.status).toBe("rejected");
  });

  it("refuses to re-request anything that was not rejected", () => {
    // Re-requesting a verified submission would silently drop a good figure.
    expect(() => reRequest(request(), { id: "x", dueDate: "2025-01-31" })).toThrow(/rejected/);
  });
});

describe("the sample supplier data", () => {
  it("rolls up to a Scope 3 category 1 total that excludes the rejected attempt", () => {
    const { requests } = buildSampleSuppliersOverview();
    const cat1 = aggregateByCategory(requests).find((entry) => entry.categoryNumber === 1);

    // 8420.5 + 11260 + 5740 (the replacement), not + 6100 (the rejected one).
    expect(cat1?.verifiedEmissions).toBe(25_420.5);
    expect(cat1?.verifiedSupplierCount).toBe(3);
  });
});
