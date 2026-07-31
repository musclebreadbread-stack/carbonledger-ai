/**
 * Authenticating callers that hold no Supabase session.
 *
 * Two kinds of caller reach these functions, and neither can present a JWT:
 *
 *  1. **A supplier.** `0003_rls_policies_phase2.sql` states it plainly —
 *     "Suppliers themselves are not users of this system and hold no JWT, so
 *     there is no supplier-side policy to write". They are authenticated by a
 *     capability token this platform issued, signed with HMAC-SHA256 and bound to
 *     exactly one data request, one supplier and one company.
 *  2. **The scheduler.** `pg_cron` calling through `pg_net`, presenting a shared
 *     secret in a header.
 *
 * ## Why a signed token rather than a random one in a table
 *
 * A random token needs a lookup table, a table needs RLS policies, and a public
 * function reading it needs the service role — so the table would be one more
 * thing that has to be scoped correctly. A signed token needs no storage: the
 * claims travel with it and the signature is the authority. The cost is that it
 * cannot be revoked individually before it expires, which is why `exp` is short
 * (see `SUPPLIER_TOKEN_MAX_LIFETIME_SECONDS`) and why rotating
 * `SUPPLIER_PORTAL_TOKEN_SECRET` invalidates every outstanding token at once.
 *
 * ## What the signature does *not* do
 *
 * It proves the token was issued by us. It does not prove the request still
 * exists, still belongs to that company, or is still open. Every one of those is
 * re-checked against the database, because a token minted three weeks ago
 * describes the world as it was then.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Longest life a submission token may claim: 30 days, in seconds. */
export const SUPPLIER_TOKEN_MAX_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * What a submission token asserts.
 *
 * `companyId` is carried even though it is derivable from the request row, and
 * that redundancy is the point: the lookup filters on both, so a token replayed
 * against a request that has since been reassigned finds nothing instead of
 * writing across a tenant boundary.
 */
export interface SupplierTokenClaims {
  /** `supplier_data_requests.id`. */
  requestId: string;
  /** `supplier_data_requests.supplier_id`. */
  supplierId: string;
  /** `supplier_data_requests.company_id`. */
  companyId: string;
  /** Expiry as seconds since the epoch. */
  exp: number;
}

export type TokenFailure =
  | "malformed"
  | "bad_signature"
  | "expired"
  | "lifetime_too_long"
  | "invalid_claims";

export type TokenResult =
  | { ok: true; claims: SupplierTokenClaims }
  | { ok: false; reason: TokenFailure };

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/**
 * The return type is `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`
 * because Web Crypto's `BufferSource` will not accept a view over a
 * possibly-shared buffer, which is what the unparameterised type widens to.
 */
function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> | null {
  // Reject anything outside the alphabet up front: `atob` is lenient about some
  // malformed input, and a token is not a place to be lenient.
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "=",
  );
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** Version prefix, so a future signing change is distinguishable rather than ambiguous. */
const TOKEN_VERSION = "v1";

/**
 * Mints a submission token.
 *
 * Lives here rather than in the Next.js app so the issuing and verifying sides
 * cannot drift apart. The app issues tokens through this same function shape when
 * it sends a data request; the tests below are what keeps the pair honest.
 */
export async function signSupplierToken(
  claims: SupplierTokenClaims,
  secret: string,
): Promise<string> {
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const message = `${TOKEN_VERSION}.${payload}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    encoder.encode(message),
  );
  return `${message}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies a submission token and returns its claims.
 *
 * Order matters: the signature is checked before the claims are trusted for
 * anything, so a forged payload never reaches the shape validation. `nowSeconds`
 * is a parameter rather than a read of the clock so expiry is testable.
 */
export async function verifySupplierToken(
  token: unknown,
  secret: string,
  nowSeconds: number,
): Promise<TokenResult> {
  if (typeof token !== "string" || token.length === 0 || token.length > 4096) {
    return { ok: false, reason: "malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [version, payload, signature] = parts as [string, string, string];
  if (version !== TOKEN_VERSION) return { ok: false, reason: "malformed" };

  const signatureBytes = base64UrlDecode(signature);
  const payloadBytes = base64UrlDecode(payload);
  if (signatureBytes === null || payloadBytes === null) {
    return { ok: false, reason: "malformed" };
  }

  // `crypto.subtle.verify` compares in constant time, which is why the comparison
  // is not hand-rolled here.
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    signatureBytes,
    encoder.encode(`${version}.${payload}`),
  );
  if (!valid) return { ok: false, reason: "bad_signature" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(payloadBytes));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "invalid_claims" };
  }
  const candidate = parsed as Record<string, unknown>;

  if (
    !isUuid(candidate.requestId) ||
    !isUuid(candidate.supplierId) ||
    !isUuid(candidate.companyId)
  ) {
    return { ok: false, reason: "invalid_claims" };
  }
  const exp = candidate.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) {
    return { ok: false, reason: "invalid_claims" };
  }

  if (exp <= nowSeconds) return { ok: false, reason: "expired" };
  // A validly signed token that claims a ten-year life is a mis-issued token, and
  // accepting it would make the short expiry above decorative. Refusing it turns
  // an issuing bug into a visible failure instead of a standing credential.
  if (exp - nowSeconds > SUPPLIER_TOKEN_MAX_LIFETIME_SECONDS) {
    return { ok: false, reason: "lifetime_too_long" };
  }

  return {
    ok: true,
    claims: {
      requestId: candidate.requestId,
      supplierId: candidate.supplierId,
      companyId: candidate.companyId,
      exp,
    },
  };
}

/**
 * Compares two secrets without leaking their contents through timing.
 *
 * Both sides are hashed first, so the comparison always runs over 32 bytes and
 * the loop length reveals nothing about the real secret's length — which a plain
 * byte-by-byte compare of the raw values would.
 */
export async function secretsMatch(provided: string | null, expected: string): Promise<boolean> {
  if (provided === null) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/** Header the scheduler presents its shared secret in. */
export const CRON_SECRET_HEADER = "x-cron-secret";

/**
 * Whether a request is an authorised scheduler invocation.
 *
 * Supabase's own `Authorization` check is not enough on its own: with
 * `verify_jwt = true` a function accepts *any* valid project JWT, including the
 * anon key that ships in the browser bundle. A separate secret means a job that
 * rewrites `target_progress` for every tenant cannot be triggered by anyone who
 * has merely read the front end's JavaScript.
 */
export async function isAuthorisedSchedulerCall(
  request: Request,
  expectedSecret: string,
): Promise<boolean> {
  return await secretsMatch(request.headers.get(CRON_SECRET_HEADER), expectedSecret);
}
