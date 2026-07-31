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
import { actorFromTestAccount, getDemoSessionAccount } from "./demo-session";
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
  /*
   * A stable machine identifier, not display copy.
   *
   * This used to read "Unauthenticated operator (no session)" and was rendered
   * verbatim by the approvals and suppliers screens, so a Korean-default UI
   * showed one English sentence in the place that names who is about to sign. It
   * is also the string that lands in a signature payload, where a locale-
   * dependent value would make the same signature hash differently depending on
   * the reader's language. Both problems go away by keeping this invariant and
   * translating at the point of render — see `actorDisplayName`.
   */
  name: "unauthenticated-operator",
  role: Role.SITE_ADMIN,
  companyId: SAMPLE_COMPANY_ID,
};

/** True when the actor is the stub above rather than a real session. */
export function isFallbackActor(actor: Actor): boolean {
  return actor.id === FALLBACK_ACTOR.id;
}

/**
 * Display name for an actor, translating the fallback stub's placeholder.
 *
 * Takes the resolved string rather than a translator so it works from both Server
 * and Client Components, and so the two screens that show "who is signing" cannot
 * drift apart on this.
 */
export function actorDisplayName(actor: Actor, fallbackLabel: string): string {
  return isFallbackActor(actor) ? fallbackLabel : actor.name;
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
    /*
     * A demo session, if one has been started from /login, takes precedence over
     * the stub. That is the whole point of the test accounts: signing in as the
     * viewer has to actually cost you `can_write` and `can_approve`, or the
     * role-gated controls are decoration.
     *
     * With no session the stub still applies rather than returning null. An
     * unauthenticated deployment stays browsable — `src/proxy.ts` lets every
     * request through when Supabase is absent, so returning null here would
     * render the workflow screens permanently inert instead of merely
     * unattributed.
     */
    const account = await getDemoSessionAccount();
    return account === null ? FALLBACK_ACTOR : actorFromTestAccount(account);
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
