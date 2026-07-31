/**
 * Signed-cookie sessions for the demo (no-Supabase) sign-in path.
 *
 * Scope, plainly: this exists so that the five accounts in `./test-accounts` can
 * be signed in and out on a deployment that has no database. It is not an
 * authentication system and must never be consulted when one is available —
 * `getDemoSessionAccount()` returns null unless `isSupabaseConfigured()` is false,
 * so setting `NEXT_PUBLIC_SUPABASE_URL` disables this file entirely rather than
 * leaving a second way in.
 *
 * What the signature does and does not buy
 * ----------------------------------------
 * The cookie carries only a user id and an expiry, HMAC'd with a server secret.
 * That prevents the one attack that would otherwise make the demo actively
 * misleading: editing the cookie to claim a role you were not given, which would
 * make every role-gated control in the UI a lie. It does *not* prove who the
 * holder is — the password is published — so nothing here should be read as
 * authentication. Role, name and company are looked up from the catalogue by id
 * and never read out of the cookie, so a forged id at worst names an account that
 * does not exist.
 *
 * The signing and verification live in `./demo-token`, which has no `next/headers`
 * import and is therefore directly testable. This module is the cookie plumbing.
 */

// No `import "server-only"`: that package is not a dependency here, and the
// `next/headers` import below already makes this module unusable from a Client
// Component — Next.js fails the build rather than shipping it to the browser.
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "./index";
import {
  createDemoSessionToken,
  DEMO_SESSION_COOKIE,
  readDemoSessionToken,
  SESSION_TTL_SECONDS,
} from "./demo-token";
import { TEST_ACCOUNT_COMPANY_ID, type TestAccount } from "./test-accounts";
import type { Actor } from "./actor";

export { DEMO_SESSION_COOKIE } from "./demo-token";

/** Writes the session cookie. Called only from the sign-in Server Action. */
export async function startDemoSession(accountId: string): Promise<void> {
  const store = await cookies();
  store.set(DEMO_SESSION_COOKIE, await createDemoSessionToken(accountId), {
    httpOnly: true,
    // `secure` off in development so the cookie survives plain-HTTP localhost;
    // NODE_ENV is the only signal available at this point in the request.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/** Clears the session cookie. */
export async function endDemoSession(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_SESSION_COOKIE);
}

/**
 * The signed-in demo account for this request, or null.
 *
 * Returns null whenever Supabase is configured — the guard that keeps this from
 * being a parallel way in on a real deployment.
 */
export async function getDemoSessionAccount(): Promise<TestAccount | null> {
  if (isSupabaseConfigured()) return null;

  const store = await cookies();
  return readDemoSessionToken(store.get(DEMO_SESSION_COOKIE)?.value);
}

/** Projects a test account into the `Actor` shape the authorisation rules take. */
export function actorFromTestAccount(account: TestAccount): Actor {
  return {
    id: account.id,
    name: account.name,
    role: account.role,
    companyId: TEST_ACCOUNT_COMPANY_ID,
  };
}
