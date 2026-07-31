/**
 * Who is acting, and what that entitles them to do.
 *
 * This is the server-side mirror of the capability helpers in
 * `supabase/migrations/0003_rls_policies_phase2.sql` — `auth.can_write()`,
 * `auth.can_approve()`, `auth.can_administer()` — plus the tenancy predicate
 * those policies express as `company_id = auth.user_company_id()`.
 *
 * Why it has to exist twice
 * -------------------------
 * RLS is enforced by Postgres against the caller's JWT. A Server Action does not
 * run as the caller: it runs on our server, with whatever credentials the server
 * holds, and it is reachable by anyone who can POST to the route whether or not
 * the UI ever rendered a button for them. So the policies cannot be the only
 * gate. Every rule below is a restatement of a policy in 0003, and the comments
 * name the policy so the two can be diffed when either changes.
 *
 * Deliberately pure: no Supabase import, no `next/headers`, no environment
 * reads. Resolving the *current* actor is impure and lives in `./current-actor`.
 * Keeping the rules pure is what makes them exhaustively unit-testable, and the
 * deny paths are the ones worth testing.
 */

import { Role } from "./roles";

/** The authenticated principal performing a mutation. */
export interface Actor {
  /** User id. Corresponds to `auth.current_user_id()` / the JWT `sub` claim. */
  id: string;
  /** Display name, recorded in the signature's human-readable trail. */
  name: string;
  role: Role;
  /** Tenant. Corresponds to `auth.user_company_id()`. */
  companyId: string;
}

/**
 * `auth.can_administer()` — destroys or reassigns data.
 *
 * Nothing in the approvals or suppliers flows uses it: neither has a delete
 * path, by design (see the "no DELETE policy" notes in 0003). It is here so the
 * three capabilities can be read side by side rather than one of them being
 * silently absent.
 */
export function canAdminister(role: Role): boolean {
  return role === Role.SUPER_ADMIN || role === Role.COMPANY_ADMIN;
}

/** `auth.can_write()` — create and edit inventory data. */
export function canWrite(role: Role): boolean {
  return canAdminister(role) || role === Role.SITE_ADMIN;
}

/** `auth.can_approve()` — approve, verify, reject: the review actions. */
export function canApprove(role: Role): boolean {
  return canWrite(role) || role === Role.REVIEWER;
}

/**
 * Tenancy check, i.e. `... = auth.user_company_id()`.
 *
 * A trivial comparison, named so that call sites read as the policy they mirror
 * and so a missing check is visible as an absent call rather than as an absent
 * `&&`.
 */
export function ownsCompany(actor: Actor, companyId: string): boolean {
  return actor.companyId === companyId;
}

/** Narrows an untrusted value (a JWT claim) to a known role. */
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (Object.values(Role) as string[]).includes(value);
}

/**
 * Tenant id the sample providers attribute their rows to.
 *
 * Shared by `src/lib/approvals/sample-data.ts`, `src/lib/suppliers/sample-data.ts`
 * and the fallback actor in `./current-actor`, because the tenancy check above is
 * only exercised if the sample rows and the sample actor agree on a company —
 * and only meaningful if a *different* company is denied, which the unit tests
 * check.
 */
export const SAMPLE_COMPANY_ID = "c0000000-0000-4000-8000-000000000001";
