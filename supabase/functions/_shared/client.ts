/**
 * The service-role Supabase client, and the rule that comes with it.
 *
 * # Read this before writing a query
 *
 * `service_role` has `BYPASSRLS`. Every policy in
 * `supabase/migrations/0002_rls_policies.sql` and `0003_rls_policies_phase2.sql`
 * is inert for this client. The tenancy guarantee the whole platform rests on —
 * `company_id = auth.user_company_id()` — is **not applied** to anything that
 * goes through here.
 *
 * So the invariant is: **every query issued with this client filters on
 * `company_id` explicitly.** Not "usually", not "where it matters". A `select`
 * without a company filter returns every tenant's rows, and an `update` without
 * one will happily write across the tenant boundary. There is no second line of
 * defence behind this file.
 *
 * Two consequences worth stating:
 *
 *  * a row is looked up by `id` **and** `company_id`, never by `id` alone, even
 *    when the id came from a signed token. If the two disagree, the token is
 *    being replayed against a different tenant and the lookup must miss.
 *  * a scheduled job that legitimately spans tenants (the two cron functions do)
 *    keeps its results grouped per company and never merges them into one bucket,
 *    so a bug cannot leak one tenant's figures into another's digest.
 *
 * The anon key is deliberately not used: these functions run with no end-user
 * JWT to forward, so an anon client would be subject to policies with no
 * `auth.uid()` to satisfy them and every query would return nothing.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV, requireEnv } from "./env.ts";

export type { SupabaseClient };

export function serviceRoleClient(): SupabaseClient {
  return createClient(requireEnv(ENV.supabaseUrl), requireEnv(ENV.serviceRoleKey), {
    auth: {
      // No user session exists in a function invocation, and persisting one would
      // mean writing tokens to a filesystem that vanishes when the worker does.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-application-name": "carbonledger-edge-functions" },
    },
  });
}

/**
 * The actor recorded in `audit_logs` for work the platform did on its own.
 *
 * `audit_logs.changed_by` is `NOT NULL` and — deliberately, see
 * `0001_initial_schema.sql` — carries no foreign key to `users`, because not
 * every change originates with a logged-in person. A supplier submitting through
 * the portal is not a user of this system (`0003_rls_policies_phase2.sql` says so
 * explicitly and writes no supplier-side policy), and a cron job is nobody at
 * all. Both are attributed to the nil UUID, with `reason` naming the function
 * that acted, rather than to a real user id that would misattribute the change to
 * a person who was not involved.
 */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/** Values of the `audit_action` enum used by these functions. */
export type AuditAction = "create" | "update" | "delete" | "approve" | "reject" | "submit";

export interface AuditEntry {
  companyId: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
  reason: string;
  ipAddress?: string | null;
}

/**
 * Appends to the audit trail, and never fails the caller.
 *
 * The trade-off is explicit: a supplier's accepted submission is already
 * committed by the time this runs, so throwing here would return an error for
 * work that did happen and invite a duplicate submission. A failed audit write is
 * logged for the operator and swallowed. Returns whether it landed so the caller
 * can report it in the response.
 */
export async function recordAudit(
  client: SupabaseClient,
  entry: AuditEntry,
): Promise<boolean> {
  const { error } = await client.from("audit_logs").insert({
    company_id: entry.companyId,
    table_name: entry.tableName,
    record_id: entry.recordId,
    action: entry.action,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    changed_by: SYSTEM_ACTOR_ID,
    reason: entry.reason,
    ip_address: entry.ipAddress ?? null,
  });

  if (error) {
    console.error("audit_log insert failed", {
      table: entry.tableName,
      record: entry.recordId,
      code: error.code,
      message: error.message,
    });
    return false;
  }
  return true;
}
