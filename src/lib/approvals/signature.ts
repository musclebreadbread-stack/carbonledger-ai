/**
 * Digital signature capture for approval steps (전자서명).
 *
 * What this is
 * ------------
 * A signature here binds a decision to the exact thing that was decided: the
 * record, its emission figure, the stage, the signer and the moment. The stored
 * value is a digest of a canonical serialisation of those fields, so if anyone
 * later edits the emission figure the stored signature no longer verifies. That
 * is the property an ISO 14064 / MRV audit trail actually needs from a
 * signature: evidence that the approved number is the number still on file.
 *
 * What this is not
 * ----------------
 * This is not a PKI signature. There is no per-user private key, so an unkeyed
 * digest proves *integrity* (the payload was not altered) but not
 * *authenticity* (only the named signer could have produced it). When
 * `APPROVAL_SIGNING_KEY` is set the digest is an HMAC instead, which adds
 * server-side authenticity — a client cannot forge a step without the key. The
 * algorithm is recorded in the stored string so a verifier never has to guess,
 * and so an unkeyed signature can never be mistaken for a keyed one.
 *
 * Upgrading to real per-user asymmetric keys means adding a `v2:` prefix and
 * teaching `verifySignature` to dispatch on it; nothing else needs to change.
 *
 * Everything is built on Web Crypto (`globalThis.crypto.subtle`), which is
 * available in Node and in the edge runtime alike, so signing works from a Route
 * Handler, a Server Action or a script without a Node-only import.
 */

import type { WorkflowAction, WorkflowStage } from "./types";

/** The facts a signature commits to. All of them go into the digest. */
export interface SignaturePayload {
  /** Type of record signed, e.g. `emission_record`. */
  recordType: string;
  recordId: string;
  stage: WorkflowStage;
  action: WorkflowAction;
  /** Signer's user id. */
  signerId: string;
  /** Signer's display name at signing time, kept for the human-readable trail. */
  signerName: string;
  /**
   * The emission figure being signed off, in tCO2e. Included so that editing
   * the number invalidates the signature — the single most important thing a
   * carbon-accounting signature has to detect.
   */
  emissions: number;
  /** ISO-8601 instant of signing. */
  signedAt: string;
}

const VERSION = "v1";

/**
 * Canonical serialisation of a payload.
 *
 * Field order is fixed here rather than taken from `Object.keys`, and every
 * value is length-prefixed, so no two distinct payloads can serialise
 * identically. Without length prefixes a signer named `a` acting on record `bc`
 * and one named `ab` acting on `c` would produce the same joined string.
 *
 * `emissions` is written with `toFixed(6)` to match the `numeric(18,6)` column
 * it comes from, so a value that round-trips through Postgres still verifies.
 */
export function canonicalPayload(payload: SignaturePayload): string {
  const fields: string[] = [
    payload.recordType,
    payload.recordId,
    payload.stage,
    payload.action,
    payload.signerId,
    payload.signerName,
    Number.isFinite(payload.emissions) ? payload.emissions.toFixed(6) : "NaN",
    payload.signedAt,
  ];
  return fields.map((field) => `${field.length}:${field}`).join("|");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Server-side signing key, when one is configured.
 *
 * Read lazily rather than at module load so that setting the variable in a test
 * or at container start is honoured, and so importing this module never depends
 * on the environment being ready.
 */
function signingKeyMaterial(): string | null {
  const key = process.env.APPROVAL_SIGNING_KEY;
  return key && key.length > 0 ? key : null;
}

/** Algorithm actually used for a given environment. Exposed for the UI to state. */
export function signatureAlgorithm(): "hmac-sha256" | "sha256" {
  return signingKeyMaterial() ? "hmac-sha256" : "sha256";
}

/**
 * Produces the string stored in `workflow_steps.digital_signature`.
 *
 * Format: `v1:<algorithm>:<hex digest>` — self-describing, so verification
 * never has to infer which algorithm was in force when the step was signed.
 */
export async function signPayload(payload: SignaturePayload): Promise<string> {
  const canonical = canonicalPayload(payload);
  const encoded = new TextEncoder().encode(canonical);
  const keyMaterial = signingKeyMaterial();

  if (keyMaterial === null) {
    const digest = await crypto.subtle.digest("SHA-256", encoded);
    return `${VERSION}:sha256:${toHex(digest)}`;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyMaterial),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoded);
  return `${VERSION}:hmac-sha256:${toHex(mac)}`;
}

/**
 * Checks a stored signature against a payload.
 *
 * Recomputes using the algorithm named in the stored string, not the one the
 * current environment would use. That way adding a signing key later does not
 * retroactively invalidate every signature captured before it existed — those
 * stay verifiable as the weaker unkeyed digests they always were, and
 * `signatureAlgorithm()` on the record tells an auditor which is which.
 */
export async function verifySignature(
  signature: string,
  payload: SignaturePayload
): Promise<boolean> {
  const parts = signature.split(":");
  if (parts.length !== 3) return false;
  const [version, algorithm, digest] = parts;
  if (version !== VERSION) return false;

  const encoded = new TextEncoder().encode(canonicalPayload(payload));

  let expected: string;
  if (algorithm === "sha256") {
    expected = toHex(await crypto.subtle.digest("SHA-256", encoded));
  } else if (algorithm === "hmac-sha256") {
    const keyMaterial = signingKeyMaterial();
    // Without the key the signature is unverifiable. Reporting "invalid" would
    // be a lie, so refuse loudly instead of silently failing an audit.
    if (keyMaterial === null) {
      throw new Error(
        "Cannot verify an HMAC signature: APPROVAL_SIGNING_KEY is not configured"
      );
    }
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(keyMaterial),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    expected = toHex(await crypto.subtle.sign("HMAC", key, encoded));
  } else {
    return false;
  }

  return constantTimeEquals(digest, expected);
}

/**
 * Length-independent, content-constant-time hex comparison.
 *
 * Digest comparison with `===` leaks how many leading characters matched via
 * timing. It is a small leak for a digest, but the fix is three lines.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

/**
 * Short form for display, e.g. `v1:sha256:1a2b3c4d…`.
 *
 * Full digests are 64 hex characters and wreck table layouts; the prefix is
 * enough for a human to eyeball two signatures as different.
 */
export function formatSignatureShort(signature: string, digits = 12): string {
  const parts = signature.split(":");
  if (parts.length !== 3) return signature;
  const [version, algorithm, digest] = parts;
  if (digest.length <= digits) return signature;
  return `${version}:${algorithm}:${digest.slice(0, digits)}…`;
}
