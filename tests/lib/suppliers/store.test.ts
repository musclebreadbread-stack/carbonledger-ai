/**
 * What "persists" means for the supplier portal with no database.
 *
 * A committed decision is visible to later reads of the same module instance, a
 * refused one changes nothing, and nothing is ever deleted — the rejected attempt
 * and its replacement both stay on file, which is what keeps the Scope 3 roll-up
 * from counting a supplier twice. The limits no test can assert (a restart, or a
 * second server process, losing the state) are documented in the store itself.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SAMPLE_COMPANY_ID, type Actor } from "@/lib/auth/actor";
import { Role } from "@/lib/auth/roles";
import {
  getSuppliersOverview,
  mutateSupplierRequest,
  resetSuppliersStore,
} from "@/lib/suppliers/store";
import { recordSupplierAction } from "@/lib/suppliers/transitions";

const ACTOR: Actor = {
  id: "user-store-test",
  name: "Store Test",
  role: Role.SITE_ADMIN,
  companyId: SAMPLE_COMPANY_ID,
};

const AT = "2024-12-11T00:00:00.000Z";

// Module state leaks between cases unless it is reset.
beforeEach(resetSuppliersStore);
afterEach(resetSuppliersStore);

describe("the suppliers store", () => {
  it("hands out copies, so a caller cannot edit the store through its result", async () => {
    const first = await getSuppliersOverview();
    first.requests[0].reportedEmissions = 999_999;

    const second = await getSuppliersOverview();
    expect(second.requests[0].reportedEmissions).not.toBe(999_999);
  });

  it("makes a verification visible to the next read", async () => {
    const result = await mutateSupplierRequest("REQ-003", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, {
        action: "verify",
        dataQuality: 4,
        at: AT,
      })
    );
    expect(result.ok).toBe(true);

    const { requests } = await getSuppliersOverview();
    expect(requests.find((request) => request.id === "REQ-003")).toMatchObject({
      status: "verified",
      dataQuality: 4,
      verifiedAt: AT,
    });
  });

  it("inserts the replacement next to the request it supersedes", async () => {
    await mutateSupplierRequest("REQ-008", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, {
        action: "reject",
        reasonKey: "boundary_mismatch",
        at: AT,
      })
    );
    const result = await mutateSupplierRequest("REQ-008", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, { action: "re_request", at: AT })
    );
    expect(result.ok).toBe(true);

    const { requests } = await getSuppliersOverview();
    const index = requests.findIndex((request) => request.id === "REQ-008");
    expect(requests[index + 1]).toMatchObject({
      id: "REQ-008R",
      status: "sent",
      supersedesRequestId: "REQ-008",
    });
    // The rejected attempt survives — nothing is deleted, ever.
    expect(requests[index].status).toBe("rejected");
  });

  it("refuses a second re-request once a replacement exists", async () => {
    await mutateSupplierRequest("REQ-008", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, {
        action: "reject",
        reasonKey: "boundary_mismatch",
        at: AT,
      })
    );
    await mutateSupplierRequest("REQ-008", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, { action: "re_request", at: AT })
    );

    const again = await mutateSupplierRequest("REQ-008", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, { action: "re_request", at: AT })
    );

    expect(again).toEqual({ ok: false, reason: "already_re_requested" });
    const { requests } = await getSuppliersOverview();
    expect(requests.filter((request) => request.supersedesRequestId === "REQ-008")).toHaveLength(1);
  });

  it("leaves the store untouched when refused", async () => {
    const before = await getSuppliersOverview();
    const result = await mutateSupplierRequest("REQ-001", (request, siblings) =>
      // Already verified, so not decidable.
      recordSupplierAction(request, ACTOR, siblings, { action: "verify", dataQuality: 1, at: AT })
    );

    expect(result).toEqual({ ok: false, reason: "not_submitted" });
    expect((await getSuppliersOverview()).requests).toEqual(before.requests);
  });

  it("reports not_found for an unknown request", async () => {
    const result = await mutateSupplierRequest("REQ-nope", () => {
      throw new Error("must not be called");
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("re-seeds after a reset", async () => {
    await mutateSupplierRequest("REQ-003", (request, siblings) =>
      recordSupplierAction(request, ACTOR, siblings, { action: "verify", dataQuality: 2, at: AT })
    );
    resetSuppliersStore();

    const { requests } = await getSuppliersOverview();
    expect(requests.find((request) => request.id === "REQ-003")?.status).toBe("submitted");
  });
});
