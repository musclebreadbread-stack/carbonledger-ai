/**
 * Authorisation and status rules for the three portal operations.
 *
 * The rule with teeth is the one about re-requests: a rejected attempt may be
 * replaced exactly once, because two live replacements would both be
 * un-superseded and `aggregateByCategory` would count the supplier twice. The
 * roll-up test file covers the de-duplication; this one covers the gate that
 * stops the situation arising.
 */

import { describe, expect, it } from "vitest";
import { SAMPLE_COMPANY_ID, type Actor } from "@/lib/auth/actor";
import { Role } from "@/lib/auth/roles";
import ko from "@/messages/ko.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import zh from "@/messages/zh.json";
import {
  authorizeSupplierAction,
  recordSupplierAction,
  RE_REQUEST_DUE_DAYS,
  SUPPLIER_ACTIONS,
} from "@/lib/suppliers/transitions";
import {
  aggregateByCategory,
  rejectRequest,
  SUPPLIER_REJECTION_REASON_KEYS,
  verifyRequest,
  type SupplierDataRequest,
} from "@/lib/suppliers/types";

const NOW = "2024-12-10T00:00:00.000Z";

function actor(overrides: Partial<Actor> = {}): Actor {
  return {
    id: "user-1",
    name: "M. Kim",
    role: Role.SITE_ADMIN,
    companyId: SAMPLE_COMPANY_ID,
    ...overrides,
  };
}

function request(overrides: Partial<SupplierDataRequest> = {}): SupplierDataRequest {
  return {
    id: "REQ-1",
    companyId: SAMPLE_COMPANY_ID,
    supplierId: "s-1",
    period: "2024",
    categoryNumber: 1,
    status: "submitted",
    dueDate: "2024-12-15",
    submittedAt: "2024-12-08T00:00:00.000Z",
    reportedEmissions: 1_000,
    dataQuality: null,
    verifiedAt: null,
    rejectionReasonKey: null,
    supersedesRequestId: null,
    ...overrides,
  };
}

describe("authorizeSupplierAction", () => {
  it("refuses another company's request before anything else", () => {
    for (const action of SUPPLIER_ACTIONS) {
      expect(
        authorizeSupplierAction(actor({ companyId: "other" }), request(), action, [])
      ).toEqual({ ok: false, reason: "wrong_company" });
    }
  });

  it("lets a reviewer verify and reject but not re-request", () => {
    // Verification is a review action; a re-request inserts a row and needs write.
    const reviewer = actor({ role: Role.REVIEWER });
    expect(authorizeSupplierAction(reviewer, request(), "verify", []).ok).toBe(true);
    expect(authorizeSupplierAction(reviewer, request(), "reject", []).ok).toBe(true);
    expect(
      authorizeSupplierAction(reviewer, request({ status: "rejected" }), "re_request", [])
    ).toEqual({ ok: false, reason: "forbidden_role" });
  });

  it("refuses the read-only roles everything", () => {
    for (const role of [Role.VIEWER, Role.AUDITOR, Role.CONSULTANT]) {
      for (const action of SUPPLIER_ACTIONS) {
        expect(authorizeSupplierAction(actor({ role }), request(), action, []).ok).toBe(false);
      }
    }
  });

  it("only decides a submitted request", () => {
    for (const status of ["pending", "sent", "in_progress", "verified", "rejected"] as const) {
      expect(authorizeSupplierAction(actor(), request({ status }), "verify", [])).toEqual({
        ok: false,
        reason: "not_submitted",
      });
    }
    expect(authorizeSupplierAction(actor(), request(), "verify", []).ok).toBe(true);
  });

  it("treats a decided request as frozen — no re-verification, no reversal", () => {
    const verified = request({ status: "verified", dataQuality: 4, verifiedAt: NOW });
    expect(authorizeSupplierAction(actor(), verified, "verify", []).ok).toBe(false);
    expect(authorizeSupplierAction(actor(), verified, "reject", []).ok).toBe(false);
    // Nor may a verified figure be quietly dropped by re-requesting it.
    expect(authorizeSupplierAction(actor(), verified, "re_request", [])).toEqual({
      ok: false,
      reason: "not_rejected",
    });
  });

  it("only re-requests a rejected request", () => {
    const rejected = request({
      status: "rejected",
      rejectionReasonKey: "no_methodology_disclosed",
    });
    expect(authorizeSupplierAction(actor(), rejected, "re_request", [rejected]).ok).toBe(true);
  });

  it("refuses a second re-request for the same rejected attempt", () => {
    const rejected = request({ id: "REQ-4", status: "rejected" });
    const replacement = request({
      id: "REQ-4R",
      status: "sent",
      submittedAt: null,
      reportedEmissions: null,
      supersedesRequestId: "REQ-4",
    });

    expect(
      authorizeSupplierAction(actor(), rejected, "re_request", [rejected, replacement])
    ).toEqual({ ok: false, reason: "already_re_requested" });
  });
});

describe("verifyRequest", () => {
  it("records the assessed quality and the decision instant", () => {
    const verified = verifyRequest(request(), { dataQuality: 4, at: NOW });
    expect(verified).toMatchObject({ status: "verified", dataQuality: 4, verifiedAt: NOW });
  });

  it("does not mutate the original", () => {
    const original = request();
    verifyRequest(original, { dataQuality: 4, at: NOW });
    expect(original.status).toBe("submitted");
    expect(original.dataQuality).toBeNull();
  });

  it("refuses anything that is not submitted", () => {
    expect(() => verifyRequest(request({ status: "verified" }), { dataQuality: 4, at: NOW })).toThrow(
      /submitted/
    );
  });

  it("refuses a quality score off the 1-5 scale", () => {
    for (const score of [0, 6, 3.5, Number.NaN]) {
      expect(() => verifyRequest(request(), { dataQuality: score, at: NOW })).toThrow(/quality/i);
    }
  });

  it("makes the figure count towards reported Scope 3", () => {
    // Before: pending. After: verified. This is the whole point of verifying.
    const before = aggregateByCategory([request()])[0];
    expect(before.verifiedEmissions).toBe(0);
    expect(before.pendingEmissions).toBe(1_000);

    const after = aggregateByCategory([verifyRequest(request(), { dataQuality: 3, at: NOW })])[0];
    expect(after.verifiedEmissions).toBe(1_000);
    expect(after.pendingEmissions).toBe(0);
  });
});

describe("rejectRequest", () => {
  it("keeps the rejected figure on the row as evidence", () => {
    const rejected = rejectRequest(request(), {
      reasonKey: "missing_supporting_evidence",
      at: NOW,
    });

    expect(rejected).toMatchObject({
      status: "rejected",
      rejectionReasonKey: "missing_supporting_evidence",
      reportedEmissions: 1_000,
    });
    // Excluded from the roll-up, but still on file.
    expect(aggregateByCategory([rejected])).toEqual([]);
  });

  it("refuses an unknown reason rather than writing free text into the trail", () => {
    expect(() =>
      // @ts-expect-error deliberately passing a value outside the allowlist
      rejectRequest(request(), { reasonKey: "because-i-said-so", at: NOW })
    ).toThrow(/reason/i);
  });
});

describe("recordSupplierAction", () => {
  it("verifies with a valid score", () => {
    const result = recordSupplierAction(request(), actor(), [], {
      action: "verify",
      dataQuality: 5,
      at: NOW,
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.request.status).toBe("verified");
    expect(result.ok && result.created).toBeNull();
  });

  it("refuses a missing or out-of-range quality score", () => {
    for (const dataQuality of [null, 0, 9, 2.5]) {
      expect(
        recordSupplierAction(request(), actor(), [], { action: "verify", dataQuality, at: NOW })
      ).toEqual({ ok: false, reason: "invalid_input" });
    }
  });

  it("refuses a rejection reason outside the allowlist", () => {
    expect(
      recordSupplierAction(request(), actor(), [], {
        action: "reject",
        reasonKey: "made-up",
        at: NOW,
      })
    ).toEqual({ ok: false, reason: "invalid_input" });
    expect(
      recordSupplierAction(request(), actor(), [], { action: "reject", reasonKey: null, at: NOW })
    ).toEqual({ ok: false, reason: "invalid_input" });
  });

  it("builds a replacement pointing back at the rejected attempt", () => {
    const rejected = request({ id: "REQ-4", status: "rejected" });
    const result = recordSupplierAction(rejected, actor(), [rejected], {
      action: "re_request",
      at: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.created === null) throw new Error("expected a replacement");

    expect(result.created).toMatchObject({
      id: "REQ-4R",
      status: "sent",
      supersedesRequestId: "REQ-4",
      submittedAt: null,
      reportedEmissions: null,
      dataQuality: null,
    });
    // Same supplier, period and category — a re-request asks for the same thing.
    expect(result.created.supplierId).toBe(rejected.supplierId);
    expect(result.created.categoryNumber).toBe(rejected.categoryNumber);
    // The rejected row itself is untouched.
    expect(result.request.status).toBe("rejected");
  });

  it("gives the replacement a deadline the configured horizon out", () => {
    const rejected = request({ id: "REQ-4", status: "rejected" });
    const result = recordSupplierAction(rejected, actor(), [rejected], {
      action: "re_request",
      at: NOW,
    });

    if (!result.ok || result.created === null) throw new Error("expected a replacement");
    const days = (Date.parse(result.created.dueDate) - Date.parse(NOW)) / 86_400_000;
    expect(days).toBe(RE_REQUEST_DUE_DAYS);
  });

  it("does not collide with an id already in use", () => {
    const rejected = request({ id: "REQ-4", status: "rejected" });
    // A row already occupying the obvious id, but not superseding this one.
    const squatter = request({ id: "REQ-4R", status: "verified" });

    const result = recordSupplierAction(rejected, actor(), [rejected, squatter], {
      action: "re_request",
      at: NOW,
    });

    if (!result.ok || result.created === null) throw new Error("expected a replacement");
    expect(result.created.id).toBe("REQ-4R2");
  });

  it("does not double-count the supplier once the replacement is verified", () => {
    const rejected = request({ id: "REQ-4", status: "rejected", reportedEmissions: 6_100 });
    const created = recordSupplierAction(rejected, actor(), [rejected], {
      action: "re_request",
      at: NOW,
    });
    if (!created.ok || created.created === null) throw new Error("expected a replacement");

    // The supplier submits again and we verify the new figure.
    const submitted = { ...created.created, status: "submitted" as const, reportedEmissions: 5_740 };
    const verified = verifyRequest(submitted, { dataQuality: 3, at: NOW });

    const rolled = aggregateByCategory([rejected, verified])[0];
    expect(rolled.verifiedEmissions).toBe(5_740);
    expect(rolled.verifiedSupplierCount).toBe(1);
  });

  it("refuses an unparseable timestamp", () => {
    expect(
      recordSupplierAction(request(), actor(), [], {
        action: "verify",
        dataQuality: 3,
        at: "whenever",
      })
    ).toEqual({ ok: false, reason: "invalid_input" });
  });
});

describe("the rejection reason allowlist", () => {
  it("is translated in all four catalogues", () => {
    // An allowlisted key with no message would render as a raw key in the select.
    for (const catalogue of [ko, en, ja, zh]) {
      for (const key of SUPPLIER_REJECTION_REASON_KEYS) {
        const reasons = catalogue.supplier_rejection_reasons as Record<string, string>;
        expect(reasons[key], key).toBeTruthy();
      }
    }
  });
});
