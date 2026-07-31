/**
 * Request and response plumbing shared by every function.
 *
 * Two things are deliberate here.
 *
 * **Error bodies are codes, not prose.** Every failure is
 * `{ error: { code, message } }` where `code` is a stable identifier. The
 * supplier portal renders it through the same message catalogues as the rest of
 * the app (`src/messages/*.json`), so a human-readable English sentence from an
 * Edge Function would be an untranslated string in a Korean UI. `message` exists
 * for logs and for `curl`, not for the screen.
 *
 * **Nothing that identifies another tenant's data goes in an error.** A supplier
 * presenting a token for a request that does not exist, and one presenting a
 * token for a request belonging to a different company, get the identical
 * `invalid_token` — otherwise the difference between the two responses is an
 * oracle for probing which request ids exist.
 */

/**
 * CORS for the supplier-facing function.
 *
 * `*` is correct for `supplier-intake` specifically: a supplier submits from
 * whatever origin their own procurement system runs on, and the request carries
 * no cookie and no Supabase session — authority comes from a signed token in the
 * body, so there is no ambient credential for a hostile origin to ride on.
 * The cron functions are not browser-reachable and do not use these.
 */
export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
};

const JSON_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  // These responses are decisions about a single row; a cache anywhere between
  // here and the client would serve one supplier's outcome to the next request.
  "cache-control": "no-store",
};

export interface JsonResponseOptions {
  status?: number;
  cors?: boolean;
}

export function jsonResponse(body: unknown, options: JsonResponseOptions = {}): Response {
  const { status = 200, cors = false } = options;
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...(cors ? CORS_HEADERS : {}) },
  });
}

export function errorResponse(
  code: string,
  status: number,
  options: { message?: string; cors?: boolean } = {},
): Response {
  return jsonResponse(
    { error: { code, message: options.message ?? code } },
    { status, cors: options.cors },
  );
}

/** Answers a CORS preflight, or null when this is not one. */
export function preflightResponse(request: Request): Response | null {
  if (request.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** Rejects anything but `method`, or null when the method is acceptable. */
export function methodNotAllowed(
  request: Request,
  method: string,
  cors = false,
): Response | null {
  if (request.method === method) return null;
  return errorResponse("method_not_allowed", 405, { cors });
}

/**
 * Parses a JSON body, with a cap.
 *
 * The cap is the point: `request.json()` on an unbounded body lets one caller
 * hold a function's memory for as long as they keep writing. 64 KiB is far more
 * than any payload these functions accept (a submission is a handful of scalars)
 * and far less than a problem.
 */
export const MAX_BODY_BYTES = 64 * 1024;

export type BodyResult =
  | { ok: true; value: unknown }
  | { ok: false; code: "body_too_large" | "invalid_json" };

export async function readJsonBody(request: Request): Promise<BodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    return { ok: false, code: "body_too_large" };
  }

  const raw = await request.text();
  // `content-length` is a claim, not a fact, so the real length is checked too.
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return { ok: false, code: "body_too_large" };
  }
  // An empty body is a valid "no options" for the cron functions.
  if (raw.trim() === "") return { ok: true, value: {} };

  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, code: "invalid_json" };
  }
}

/**
 * The client's address, for the audit trail.
 *
 * `x-forwarded-for` may be a list; the left-most entry is the original client.
 * Trimmed to 45 characters because `audit_logs.ip_address` is `varchar(45)` — the
 * length of the longest IPv6 form — and an oversized value would fail the insert
 * and take the whole submission down with it.
 */
export function clientAddress(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded === null) return null;
  const first = forwarded.split(",")[0]?.trim();
  if (first === undefined || first === "") return null;
  return first.slice(0, 45);
}
