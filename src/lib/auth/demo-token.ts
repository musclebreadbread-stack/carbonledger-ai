/**
 * Signing and verification for the demo session token.
 *
 * Split from `./demo-session` so the crypto and the expiry rules can be tested
 * directly: that module imports `next/headers`, which is only usable inside a
 * request, and the interesting cases here — a tampered payload, an expired token,
 * a signature from a different key — are exactly the ones a test should cover.
 *
 * Web Crypto rather than `node:crypto`: this is reachable from Server Components
 * and Server Actions, and `crypto.subtle` is the one HMAC available in every
 * runtime Next.js may place those in.
 */

import { findTestAccountById, type TestAccount } from "./test-accounts";

export const DEMO_SESSION_COOKIE = "cl_demo_session";

/**
 * Seven days. The login form no longer offers a "remember me" choice, because the
 * demo session always lasted this long regardless of the checkbox.
 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Signing key.
 *
 * The fallback is a fixed literal, which would be indefensible for a real session
 * but is the honest choice here: the only thing it protects is the integrity of a
 * demo role claim on a deployment that has no database and whose passwords are
 * printed on the login page. Set `DEMO_SESSION_SECRET` and the fallback is never
 * used; connect Supabase and this whole module is inert.
 */
function signingKey(): string {
  return process.env.DEMO_SESSION_SECRET || "carbonledger-demo-session-key";
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromBase64Url(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

interface SessionPayload {
  /** Test account id. */
  sub: string;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

/**
 * Constant-time-ish comparison of two base64url signatures.
 *
 * Length-then-XOR rather than `===`. The secret here is low value, but a
 * signature comparison is the one place where the habit costs nothing and its
 * absence is the kind of thing that gets copied into code where it matters.
 */
function signaturesMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

/** Serialises and signs a session for the given account. */
export async function createDemoSessionToken(accountId: string, now = Date.now()): Promise<string> {
  const payload: SessionPayload = {
    sub: accountId,
    exp: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await hmac(encoded)}`;
}

/**
 * Verifies a token and returns the account it names, or null.
 *
 * Every failure — malformed, bad signature, expired, unknown id — collapses to
 * null. There is nothing useful a caller can do differently between them and
 * distinguishing them in a response is how oracles get built.
 */
export async function readDemoSessionToken(
  token: string | undefined,
  now = Date.now()
): Promise<TestAccount | null> {
  if (!token) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  if (!signaturesMatch(signature, await hmac(encoded))) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))) as SessionPayload;
  } catch {
    return null;
  }

  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp * 1000 <= now) return null;

  return findTestAccountById(payload.sub);
}
