/**
 * Tests for supplier token issuing and verification.
 *
 * These are the tests that matter most in this directory. Everything else here
 * decides *what* a submission means; this decides *whether the caller is allowed
 * to make one at all*, and it is the only thing standing between a public
 * endpoint and a service-role write.
 *
 * The negative cases are the point. A verifier that accepts a valid token is easy;
 * one that rejects a token whose payload was edited, whose signature came from
 * another secret, or which claims a ten-year life is what makes the design sound.
 */

import { assert, assertEquals, assertFalse, assertNotEquals } from "@std/assert";
import {
  isUuid,
  secretsMatch,
  signSupplierToken,
  SUPPLIER_TOKEN_MAX_LIFETIME_SECONDS,
  type SupplierTokenClaims,
  verifySupplierToken,
} from "../_shared/auth.ts";

const SECRET = "test-secret-do-not-use-in-production";
const NOW = 1_700_000_000;

const CLAIMS: SupplierTokenClaims = {
  requestId: "11111111-1111-4111-8111-111111111111",
  supplierId: "22222222-2222-4222-8222-222222222222",
  companyId: "33333333-3333-4333-8333-333333333333",
  exp: NOW + 3600,
};

Deno.test("a token this platform issued verifies and returns its claims intact", async () => {
  const token = await signSupplierToken(CLAIMS, SECRET);
  const result = await verifySupplierToken(token, SECRET, NOW);

  assert(result.ok, "a freshly signed token must verify");
  assertEquals(result.claims, CLAIMS);
});

Deno.test("a token signed with a different secret is refused", async () => {
  // This is what rotating SUPPLIER_PORTAL_TOKEN_SECRET does to every outstanding
  // token, and the property the docs' revocation advice depends on.
  const token = await signSupplierToken(CLAIMS, "some-other-secret");
  const result = await verifySupplierToken(token, SECRET, NOW);

  assertFalse(result.ok);
  if (!result.ok) assertEquals(result.reason, "bad_signature");
});

Deno.test("editing the payload invalidates the signature", async () => {
  const token = await signSupplierToken(CLAIMS, SECRET);
  const [version, _payload, signature] = token.split(".");

  // Re-encode the claims pointing at a different company, keeping the original
  // signature. This is the attack the whole scheme exists to stop: without the
  // signature check, a supplier could submit against any tenant they can name.
  const forged = btoa(
    JSON.stringify({ ...CLAIMS, companyId: "44444444-4444-4444-8444-444444444444" }),
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

  const result = await verifySupplierToken(`${version}.${forged}.${signature}`, SECRET, NOW);
  assertFalse(result.ok);
  if (!result.ok) assertEquals(result.reason, "bad_signature");
});

Deno.test("an expired token is refused", async () => {
  const token = await signSupplierToken({ ...CLAIMS, exp: NOW - 1 }, SECRET);
  const result = await verifySupplierToken(token, SECRET, NOW);

  assertFalse(result.ok);
  if (!result.ok) assertEquals(result.reason, "expired");
});

Deno.test("expiry is exclusive: a token expiring exactly now is refused", async () => {
  const token = await signSupplierToken({ ...CLAIMS, exp: NOW }, SECRET);
  const result = await verifySupplierToken(token, SECRET, NOW);

  assertFalse(result.ok);
  if (!result.ok) assertEquals(result.reason, "expired");
});

Deno.test("a validly signed token claiming an excessive lifetime is refused", async () => {
  // A mis-issued token, not a forged one — which is exactly why it has to be
  // caught here. Accepting it would turn a bug in the issuing code into a
  // credential valid for years.
  const token = await signSupplierToken(
    { ...CLAIMS, exp: NOW + SUPPLIER_TOKEN_MAX_LIFETIME_SECONDS + 1 },
    SECRET,
  );
  const result = await verifySupplierToken(token, SECRET, NOW);

  assertFalse(result.ok);
  if (!result.ok) assertEquals(result.reason, "lifetime_too_long");
});

Deno.test("a token at exactly the maximum lifetime is accepted", async () => {
  const token = await signSupplierToken(
    { ...CLAIMS, exp: NOW + SUPPLIER_TOKEN_MAX_LIFETIME_SECONDS },
    SECRET,
  );
  const result = await verifySupplierToken(token, SECRET, NOW);
  assert(result.ok);
});

Deno.test("claims that are not three uuids and a number are refused", async () => {
  for (
    const [label, claims] of [
      ["request id is not a uuid", { ...CLAIMS, requestId: "not-a-uuid" }],
      ["supplier id is missing", { ...CLAIMS, supplierId: undefined }],
      ["company id is a number", { ...CLAIMS, companyId: 7 }],
      ["exp is a string", { ...CLAIMS, exp: "soon" }],
      ["exp is not finite", { ...CLAIMS, exp: Number.POSITIVE_INFINITY }],
    ] as const
  ) {
    // Signed properly, so only the claim validation can catch these.
    const token = await signSupplierToken(claims as unknown as SupplierTokenClaims, SECRET);
    const result = await verifySupplierToken(token, SECRET, NOW);
    assertFalse(result.ok, label);
    if (!result.ok) assertEquals(result.reason, "invalid_claims", label);
  }
});

Deno.test("structurally broken tokens are refused as malformed", async () => {
  for (
    const candidate of [
      "",
      "not-a-token",
      "v1.only-two-parts",
      "v2.aaa.bbb",
      "v1.aaa.bbb.ccc",
      // Characters outside the base64url alphabet.
      "v1.a+b/c.=====",
      null,
      42,
      {},
    ]
  ) {
    const result = await verifySupplierToken(candidate, SECRET, NOW);
    assertFalse(result.ok, `${JSON.stringify(candidate)} must not verify`);
  }
});

Deno.test("an absurdly long token is refused before any crypto runs", async () => {
  const result = await verifySupplierToken(`v1.${"a".repeat(5000)}.b`, SECRET, NOW);
  assertFalse(result.ok);
  if (!result.ok) assertEquals(result.reason, "malformed");
});

Deno.test("two signatures over the same claims are identical, over different claims are not", async () => {
  // Determinism is what lets a token be re-sent in a reminder email without
  // invalidating the one already in the supplier's inbox.
  const first = await signSupplierToken(CLAIMS, SECRET);
  const second = await signSupplierToken(CLAIMS, SECRET);
  assertEquals(first, second);

  const other = await signSupplierToken({ ...CLAIMS, exp: CLAIMS.exp + 1 }, SECRET);
  assertNotEquals(first, other);
});

Deno.test("secretsMatch compares equal secrets and rejects everything else", async () => {
  assert(await secretsMatch("hunter2", "hunter2"));
  assertFalse(await secretsMatch("hunter2 ", "hunter2"));
  assertFalse(await secretsMatch("", "hunter2"));
  assertFalse(await secretsMatch(null, "hunter2"));
  // A prefix must not match: this is the case a length-then-compare shortcut
  // would get right by accident and a truncating compare would get wrong.
  assertFalse(await secretsMatch("hunter", "hunter2"));
});

Deno.test("isUuid accepts canonical uuids and rejects near-misses", () => {
  assert(isUuid("11111111-1111-4111-8111-111111111111"));
  assert(isUuid("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"));
  assertFalse(isUuid("11111111111141118111111111111111"));
  assertFalse(isUuid("11111111-1111-4111-8111-11111111111"));
  assertFalse(isUuid("11111111-1111-4111-8111-111111111111 "));
  assertFalse(isUuid(""));
  assertFalse(isUuid(undefined));
});
