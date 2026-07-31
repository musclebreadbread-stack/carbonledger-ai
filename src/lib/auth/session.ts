/**
 * What the UI needs to know about the current session, in one shape.
 *
 * `getCurrentActor()` answers "who is authorised to do what", which is the
 * question the Server Actions ask. The header, the account card in /settings and
 * the nav need three further things it deliberately does not carry: the email to
 * display, whether the identity was actually proved or merely assumed, and which
 * of the two sign-in paths is live. Bundling those into the actor would have put
 * presentation concerns into the value the authorisation rules take.
 *
 * `mode` is the honest distinction:
 *   * `supabase` — a real session, identity proved by a credential.
 *   * `demo`     — a test account signed in through the signed-cookie path. Role
 *                  is enforced, identity is not proved.
 *   * `anonymous`— nobody signed in; the stub actor from `./current-actor` is in
 *                  force so the screens stay usable.
 *   * `none`     — Supabase is configured and there is no session. `proxy.ts`
 *                  redirects these to /login, so the UI only sees it in the gap
 *                  between a session expiring and the next navigation.
 */

import { getUser } from "./index";
import { getAuthDeploymentMode } from "./deployment-mode";
import { actorFromTestAccount, getDemoSessionAccount } from "./demo-session";
import { FALLBACK_ACTOR, isFallbackActor } from "./current-actor";
import { isRole, type Actor } from "./actor";
import { Role } from "./roles";

export type SessionMode = "supabase" | "demo" | "anonymous" | "none";

export interface SessionSummary {
  mode: SessionMode;
  /** null only when `mode` is `none`. */
  actor: Actor | null;
  /** Present for a signed-in session; null otherwise. */
  email: string | null;
  /** True when someone deliberately signed in, by either path. */
  isSignedIn: boolean;
}

export async function getSessionSummary(): Promise<SessionSummary> {
  const deploymentMode = getAuthDeploymentMode();
  if (deploymentMode === "demo") {
    const account = await getDemoSessionAccount();
    if (account !== null) {
      return {
        mode: "demo",
        actor: actorFromTestAccount(account),
        email: account.email,
        isSignedIn: true,
      };
    }
    return { mode: "anonymous", actor: FALLBACK_ACTOR, email: null, isSignedIn: false };
  }

  if (deploymentMode === "disabled") {
    return { mode: "none", actor: null, email: null, isSignedIn: false };
  }

  const user = await getUser();
  if (user === null) {
    return { mode: "none", actor: null, email: null, isSignedIn: false };
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const companyId = metadata.company_id;
  if (typeof companyId !== "string" || companyId.length === 0) {
    // Mirrors `getCurrentActor()`: without a tenant there is no row to compare a
    // `company_id` against, and defaulting it would place the caller in someone
    // else's company.
    return { mode: "none", actor: null, email: user.email ?? null, isSignedIn: false };
  }

  const name =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    user.email ||
    user.id;

  return {
    mode: "supabase",
    actor: {
      id: user.id,
      name,
      role: isRole(metadata.role) ? metadata.role : Role.VIEWER,
      companyId,
    },
    email: user.email ?? null,
    isSignedIn: true,
  };
}

/** True when the summary describes the browsable-but-unattributed stub. */
export function isAnonymousSession(summary: SessionSummary): boolean {
  return summary.actor !== null && isFallbackActor(summary.actor);
}
