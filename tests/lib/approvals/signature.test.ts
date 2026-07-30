/**
 * The signature only earns its place in an audit trail if editing the approved
 * figure breaks it. These tests pin that property, plus the canonical-encoding
 * property that stops two different payloads producing the same digest.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canonicalPayload,
  formatSignatureShort,
  signPayload,
  signatureAlgorithm,
  verifySignature,
  type SignaturePayload,
} from "@/lib/approvals/signature";
import { buildSampleApprovalsOverview, sampleSignaturePayload, sampleSignerId } from "@/lib/approvals/sample-data";
import { WORKFLOW_STAGES, chainProgressPercent, countByStage, currentStage, isActionAllowed } from "@/lib/approvals/types";

function payload(overrides: Partial<SignaturePayload> = {}): SignaturePayload {
  return {
    recordType: "emission_record",
    recordId: "rec-1",
    stage: "approver",
    action: "approve",
    signerId: "user-1",
    signerName: "Y. Seo",
    emissions: 1_234.5,
    signedAt: "2024-12-05T02:05:00.000Z",
    ...overrides,
  };
}

const originalKey = process.env.APPROVAL_SIGNING_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.APPROVAL_SIGNING_KEY;
  else process.env.APPROVAL_SIGNING_KEY = originalKey;
});

describe("canonicalPayload", () => {
  it("length-prefixes every field so distinct payloads cannot collide", () => {
    // Without length prefixes these two would serialise identically.
    const a = canonicalPayload(payload({ signerId: "a", recordId: "bc" }));
    const b = canonicalPayload(payload({ signerId: "ab", recordId: "c" }));
    expect(a).not.toBe(b);
  });

  it("formats emissions to the precision of the numeric column", () => {
    expect(canonicalPayload(payload({ emissions: 1_234.5 }))).toContain("1234.500000");
  });

  it("does not produce 'undefined' for a non-finite figure", () => {
    expect(canonicalPayload(payload({ emissions: Number.NaN }))).toContain("3:NaN");
  });
});

describe("signPayload / verifySignature without a signing key", () => {
  beforeEach(() => {
    delete process.env.APPROVAL_SIGNING_KEY;
  });

  it("produces a self-describing versioned digest", async () => {
    const signature = await signPayload(payload());
    expect(signature).toMatch(/^v1:sha256:[0-9a-f]{64}$/);
    expect(signatureAlgorithm()).toBe("sha256");
  });

  it("verifies against the payload it was made from", async () => {
    const data = payload();
    expect(await verifySignature(await signPayload(data), data)).toBe(true);
  });

  it("is deterministic for the same payload", async () => {
    expect(await signPayload(payload())).toBe(await signPayload(payload()));
  });

  it("FAILS once the approved emission figure is edited", async () => {
    // The single property that makes this useful for an MRV audit trail.
    const signature = await signPayload(payload({ emissions: 1_234.5 }));
    expect(await verifySignature(signature, payload({ emissions: 1_234.6 }))).toBe(false);
  });

  it("fails when the signer, stage or action is changed", async () => {
    const signature = await signPayload(payload());

    expect(await verifySignature(signature, payload({ signerId: "someone-else" }))).toBe(false);
    expect(await verifySignature(signature, payload({ stage: "reviewer" }))).toBe(false);
    expect(await verifySignature(signature, payload({ action: "reject" }))).toBe(false);
    expect(await verifySignature(signature, payload({ signedAt: "2025-01-01T00:00:00.000Z" }))).toBe(
      false
    );
  });

  it("rejects a malformed or unknown-algorithm signature instead of throwing", async () => {
    const data = payload();
    expect(await verifySignature("not-a-signature", data)).toBe(false);
    expect(await verifySignature("v1:md5:abcdef", data)).toBe(false);
    expect(await verifySignature("v9:sha256:abcdef", data)).toBe(false);
  });
});

describe("signPayload / verifySignature with a signing key", () => {
  beforeEach(() => {
    process.env.APPROVAL_SIGNING_KEY = "test-signing-key";
  });

  it("switches to an HMAC and records that in the stored string", async () => {
    const signature = await signPayload(payload());
    expect(signature).toMatch(/^v1:hmac-sha256:[0-9a-f]{64}$/);
    expect(signatureAlgorithm()).toBe("hmac-sha256");
  });

  it("produces a different digest from the unkeyed form", async () => {
    const keyed = await signPayload(payload());
    delete process.env.APPROVAL_SIGNING_KEY;
    const unkeyed = await signPayload(payload());

    expect(keyed.split(":")[2]).not.toBe(unkeyed.split(":")[2]);
  });

  it("does not verify under a different key", async () => {
    const signature = await signPayload(payload());
    process.env.APPROVAL_SIGNING_KEY = "a-different-key";
    expect(await verifySignature(signature, payload())).toBe(false);
  });

  it("still verifies signatures captured before a key existed", async () => {
    // Adding a key later must not retroactively invalidate the audit trail.
    delete process.env.APPROVAL_SIGNING_KEY;
    const legacy = await signPayload(payload());

    process.env.APPROVAL_SIGNING_KEY = "newly-added-key";
    expect(await verifySignature(legacy, payload())).toBe(true);
  });

  it("refuses loudly rather than reporting 'invalid' when the key is gone", async () => {
    const signature = await signPayload(payload());
    delete process.env.APPROVAL_SIGNING_KEY;

    // Reporting false here would tell an auditor the signature was forged.
    await expect(verifySignature(signature, payload())).rejects.toThrow(
      /APPROVAL_SIGNING_KEY/
    );
  });
});

describe("formatSignatureShort", () => {
  it("truncates the digest but keeps the algorithm visible", () => {
    expect(formatSignatureShort(`v1:sha256:${"a".repeat(64)}`)).toBe("v1:sha256:aaaaaaaaaaaa…");
  });

  it("leaves a short or malformed value alone", () => {
    expect(formatSignatureShort("v1:sha256:abc")).toBe("v1:sha256:abc");
    expect(formatSignatureShort("garbage")).toBe("garbage");
  });
});

describe("workflow chain helpers", () => {
  it("allows only the actions that belong to each stage", () => {
    expect(isActionAllowed("author", "submit")).toBe(true);
    expect(isActionAllowed("author", "approve")).toBe(false);
    expect(isActionAllowed("reviewer", "return_for_revision")).toBe(true);
    expect(isActionAllowed("approver", "review")).toBe(false);
    // The final stage may confirm or send back, but never outright reject.
    expect(isActionAllowed("final", "reject")).toBe(false);
    expect(isActionAllowed("final", "approve")).toBe(true);
  });

  it("has an allowed action for every stage", () => {
    const actions = ["submit", "review", "approve", "reject", "return_for_revision"] as const;
    for (const stage of WORKFLOW_STAGES) {
      expect(actions.some((action) => isActionAllowed(stage, action))).toBe(true);
    }
  });
});

describe("the sample approval instances", () => {
  it("carry signatures that verify against the real signing code", async () => {
    delete process.env.APPROVAL_SIGNING_KEY;
    const { instances } = await buildSampleApprovalsOverview();

    let checked = 0;
    for (const instance of instances) {
      for (const step of instance.steps) {
        if (step.digitalSignature === null) continue;
        const signerId = sampleSignerId(instance.id, step.stepNumber);
        expect(signerId).not.toBeNull();
        const verified = await verifySignature(
          step.digitalSignature,
          sampleSignaturePayload(instance, step, signerId as string)
        );
        expect(verified).toBe(true);
        checked += 1;
      }
    }

    expect(checked).toBeGreaterThan(5);
  });

  it("cover every status the UI has to render", async () => {
    const { instances } = await buildSampleApprovalsOverview();
    const counts = countByStage(instances);

    expect(counts.approved).toBeGreaterThan(0);
    expect(counts.rejected).toBeGreaterThan(0);
    expect(counts.returned).toBeGreaterThan(0);
    expect(counts.awaitingReview).toBeGreaterThan(0);
    expect(counts.awaitingApproval).toBeGreaterThan(0);
  });

  it("does not show a rejected instance as a completed chain", async () => {
    const { instances } = await buildSampleApprovalsOverview();
    const rejected = instances.find((instance) => instance.status === "rejected");

    expect(rejected).toBeDefined();
    expect(chainProgressPercent(rejected!)).toBeLessThan(100);
    expect(currentStage(rejected!)).toBeNull();
  });

  it("renders a full four-stage chain for an open instance", async () => {
    const { instances } = await buildSampleApprovalsOverview();
    const open = instances.find((instance) => instance.status === "in_progress");

    expect(open?.steps).toHaveLength(WORKFLOW_STAGES.length);
    expect(open?.steps.some((step) => step.completedAt === null)).toBe(true);
  });
});
