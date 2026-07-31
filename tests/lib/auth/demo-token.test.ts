/**
 * The demo session token buys exactly one property: you cannot edit the cookie to
 * become a role you were not given. That is what makes the role-gated controls in
 * the UI true statements rather than decoration, so the deny paths below are the
 * point of this file — a token that verified when tampered with would silently
 * turn every "viewer cannot approve" claim into a lie.
 *
 * The clock is injected everywhere. Expiry is a function of when you ask, and a
 * test that used the real clock would either never exercise the expiry branch or
 * start failing on a date nobody chose.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDemoSessionToken, readDemoSessionToken } from "@/lib/auth/demo-token";
import { TEST_ACCOUNTS } from "@/lib/auth/test-accounts";

const NOW = Date.parse("2024-06-01T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

const admin = TEST_ACCOUNTS[0];
const viewer = TEST_ACCOUNTS[4];

/** Rewrites the payload half of a token, leaving the original signature. */
function tamperPayload(token: string, mutate: (payload: Record<string, unknown>) => void): string {
  const [encoded, signature] = token.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  mutate(payload);
  const rewritten = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${rewritten}.${signature}`;
}

describe("demo session token", () => {
  it("round-trips the account it was issued for", async () => {
    const token = await createDemoSessionToken(admin.id, NOW);

    expect((await readDemoSessionToken(token, NOW))?.email).toBe(admin.email);
  });

  it("resolves role and company from the catalogue, not from the token", async () => {
    // The token carries an id and an expiry only. This is the invariant that makes
    // tampering pointless: there is no role field to edit.
    const token = await createDemoSessionToken(viewer.id, NOW);
    const [encoded] = token.split(".");
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));

    expect(Object.keys(payload).sort()).toEqual(["exp", "sub"]);
    expect((await readDemoSessionToken(token, NOW))?.role).toBe("viewer");
  });

  it("rejects a token whose subject was swapped for a more privileged account", async () => {
    const token = await createDemoSessionToken(viewer.id, NOW);
    const forged = tamperPayload(token, (payload) => {
      payload.sub = admin.id;
    });

    expect(await readDemoSessionToken(forged, NOW)).toBeNull();
  });

  it("rejects a token whose expiry was pushed out", async () => {
    const token = await createDemoSessionToken(admin.id, NOW);
    const forged = tamperPayload(token, (payload) => {
      payload.exp = Math.floor((NOW + 365 * DAY) / 1000);
    });

    expect(await readDemoSessionToken(forged, NOW)).toBeNull();
  });

  it("rejects a token signed with a different key", async () => {
    const token = await createDemoSessionToken(admin.id, NOW);

    process.env.DEMO_SESSION_SECRET = "a-different-key";
    try {
      expect(await readDemoSessionToken(token, NOW)).toBeNull();
    } finally {
      delete process.env.DEMO_SESSION_SECRET;
    }
  });

  it("accepts a token issued and read under the same configured key", async () => {
    process.env.DEMO_SESSION_SECRET = "a-configured-key";
    try {
      const token = await createDemoSessionToken(admin.id, NOW);
      expect((await readDemoSessionToken(token, NOW))?.id).toBe(admin.id);
    } finally {
      delete process.env.DEMO_SESSION_SECRET;
    }
  });

  it("is still valid a day before it expires and invalid a second after", async () => {
    const token = await createDemoSessionToken(admin.id, NOW);

    expect(await readDemoSessionToken(token, NOW + 6 * DAY)).not.toBeNull();
    expect(await readDemoSessionToken(token, NOW + 7 * DAY + 1000)).toBeNull();
  });

  it("treats the exact expiry instant as expired", async () => {
    const token = await createDemoSessionToken(admin.id, NOW);

    // Boundary pinned deliberately: `<=` rather than `<`, so a token can never be
    // accepted at the moment it lapses.
    expect(await readDemoSessionToken(token, NOW + 7 * DAY)).toBeNull();
  });

  it("names an account that exists, or nothing", async () => {
    const token = await createDemoSessionToken("aaaaaaaa-0000-0000-0000-000000000000", NOW);

    // Correctly signed, but the subject is not in the catalogue.
    expect(await readDemoSessionToken(token, NOW)).toBeNull();
  });

  describe("malformed input", () => {
    it.each([
      ["undefined", undefined],
      ["empty", ""],
      ["no separator", "notatoken"],
      ["empty payload", ".signature"],
      ["empty signature", "payload."],
      ["three parts", "a.b.c"],
      ["non-JSON payload", `${Buffer.from("not json").toString("base64url")}.sig`],
    ])("returns null for %s", async (_label, token) => {
      expect(await readDemoSessionToken(token, NOW)).toBeNull();
    });

    it("returns null for a correctly signed payload missing its fields", async () => {
      // Signature is valid; the shape is not. Both have to be checked, and a
      // missing `exp` must not be read as "never expires".
      const token = await createDemoSessionToken(admin.id, NOW);
      const noExp = tamperPayload(token, (payload) => {
        delete payload.exp;
      });
      const noSub = tamperPayload(token, (payload) => {
        delete payload.sub;
      });

      expect(await readDemoSessionToken(noExp, NOW)).toBeNull();
      expect(await readDemoSessionToken(noSub, NOW)).toBeNull();
    });
  });

  describe("determinism", () => {
    let previous: string | undefined;

    beforeEach(() => {
      previous = process.env.DEMO_SESSION_SECRET;
    });

    afterEach(() => {
      if (previous === undefined) delete process.env.DEMO_SESSION_SECRET;
      else process.env.DEMO_SESSION_SECRET = previous;
    });

    it("issues the same token for the same account and instant", async () => {
      // Not a security property, but it means a test or a cache can rely on the
      // token being a pure function of its inputs.
      const a = await createDemoSessionToken(admin.id, NOW);
      const b = await createDemoSessionToken(admin.id, NOW);

      expect(a).toBe(b);
    });

    it("issues different tokens for different accounts", async () => {
      expect(await createDemoSessionToken(admin.id, NOW)).not.toBe(
        await createDemoSessionToken(viewer.id, NOW)
      );
    });
  });
});
