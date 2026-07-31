/**
 * Reading configuration, and failing loudly when it is missing.
 *
 * Edge Functions get their configuration entirely from the environment. Two
 * variables are injected by the platform (`SUPABASE_URL`,
 * `SUPABASE_SERVICE_ROLE_KEY`); the rest are set with
 * `supabase secrets set` — see `docs/edge-functions.md`.
 *
 * The one rule this module exists to enforce: a missing secret must surface as a
 * named 500, never as a silent fallback. A function that quietly treats an absent
 * `SUPPLIER_PORTAL_TOKEN_SECRET` as an empty string would accept every forged
 * token, so an unset secret has to be a hard failure. `MissingEnvError` carries
 * only the variable *name*, which is safe to log; values never leave this module.
 */

export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable: ${variable}`);
    this.name = "MissingEnvError";
  }
}

/** The value of `name`, or `MissingEnvError` when unset or blank. */
export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (value === undefined || value.trim() === "") {
    throw new MissingEnvError(name);
  }
  return value;
}

/** The value of `name`, or null when unset or blank. */
export function optionalEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (value === undefined || value.trim() === "") return null;
  return value;
}

/** Environment variable names used across the functions, in one place. */
export const ENV = {
  /** Injected by the platform. */
  supabaseUrl: "SUPABASE_URL",
  /** Injected by the platform. Bypasses RLS — see `client.ts`. */
  serviceRoleKey: "SUPABASE_SERVICE_ROLE_KEY",
  /** HMAC key for supplier portal submission tokens. */
  supplierTokenSecret: "SUPPLIER_PORTAL_TOKEN_SECRET",
  /** Shared secret the scheduler presents to the two cron-driven functions. */
  cronSecret: "EDGE_CRON_SECRET",
  /** Optional outbound endpoint for supplier reminder digests. */
  notificationWebhookUrl: "SUPPLIER_NOTIFICATION_WEBHOOK_URL",
} as const;
