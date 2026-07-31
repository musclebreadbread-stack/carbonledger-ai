/**
 * Resolves the actor for the current request.
 *
 * Split from `./actor` because this half is unavoidably impure — it reads
 * cookies and the environment — while the authorisation rules must stay pure to
 * be testable. Server Actions import both.
 *
 * The identity comes from the Supabase session, never from the request body. A
 * Server Action that let the client name the signer would produce an approval
 * trail attributing decisions to whoever the caller claimed to be, which is
 * precisely the misattribution `writer_create_workflow_instances` guards against
 * in 0003 with `created_by = auth.current_user_id()`.
 */

import { getUser, isSupabaseConfigured } from "./index";
import { Role } from "./roles";
import { isRole, SAMPLE_COMPANY_ID, type Actor } from "./actor";

/**
 * Stand-in identity used when Supabase is not configured.
 *
 * Stated plainly because it is a real weakening: with no `NEXT_PUBLIC_SUPABASE_URL`
 * there is no session, no JWT and no authentication anywhere in this app —
 * `src/proxy.ts` already lets every request through unauthenticated in that case.
 * Rather than making the pages silently un-actionable, an unauthenticated
 * deployment acts as this single named operator so the workflow can be exercised.
 *
 * Two consequences worth being explicit about:
 *   * every signature captured in that mode is attributed to this stub, and the
 *     UI says so;
 *   * authorisation is still *enforced* against it — the capability and tenancy
 *     checks all run — but the *identity* is asserted by the server, not proven
 *     by a credential. Configure Supabase and this branch is never taken.
 *
 * `site_admin` rather than `company_admin`: it is the least privileged role that
 * holds both `can_write` (to submit) and `can_approve` (to review), which is what
 * the four-stage chain needs. Nothing here should hold `can_administer`.
 */
export const FALLBACK_ACTOR: Actor = {
  id: "00000000-0000-4000-8000-0000000000ff",
  name: "Unauthenticated operator (no session)",
  role: Role.SITE_ADMIN,
  companyId: SAMPLE_COMPANY_ID,
};

/** True when the actor is the stub above rather than a real session. */
export function isFallbackActor(actor: Actor): boolean {
  return actor.id === FALLBACK_ACTOR.id;
}

/**
 * The current actor, or null when a session is required and absent.
 *
 * An unknown or missing `role` claim resolves to `viewer`, the least privileged
 * role, so a malformed JWT loses capability instead of gaining it. A missing
 * `company_id` claim yields null outright: without a tenant there is nothing to
 * compare a row's `company_id` against, and defaulting it would put the caller in
 * someone else's company.
 */
export async function getCurrentActor(): Promise<Actor | null> {
  if (!isSupabaseConfigured()) {
    return FALLBACK_ACTOR;
  }

  const user = await getUser();
  if (!user) return null;

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const companyId = metadata.company_id;
  if (typeof companyId !== "string" || companyId.length === 0) return null;

  const name =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    user.email ||
    user.id;

  return {
    id: user.id,
    name,
    role: isRole(metadata.role) ? metadata.role : Role.VIEWER,
    companyId,
  };
}
