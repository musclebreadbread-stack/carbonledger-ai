/**
 * The five accounts a reviewer signs in as to walk the product.
 *
 * Why this file exists at all: before it, `/login` accepted any input and
 * redirected — there was no session, no identity and no way to see the product
 * as anything other than the single hard-coded actor. Every role-dependent
 * behaviour the app already implements (the approval capability checks in
 * `./actor`, the RLS policies they mirror, the nav map in `./roles`) was
 * therefore unobservable.
 *
 * The identities are not invented here. They are the same five rows
 * `supabase/seed.sql` inserts into `public.users` — same ids, same emails, same
 * names, same roles — so that a walkthrough in demo mode and a walkthrough
 * against a seeded Supabase project show the same people. `supabase/seed-auth-users.sql`
 * creates the matching `auth.users` rows with this password.
 *
 * Deliberately pure data with no imports beyond the role enum and the tenant
 * constant: it is read by the login screen (client), the sign-in action (server)
 * and the docs generator alike, and a `next/headers` import here would break the
 * first of those.
 *
 * One divergence, and it is load-bearing. `companyId` is `SAMPLE_COMPANY_ID`, not
 * the seed file's company row, because in demo mode the data these accounts act
 * on comes from the in-memory sample providers and those attribute their rows to
 * `SAMPLE_COMPANY_ID`. A tenancy check against the wrong company would refuse
 * every action for reasons that look like a permissions bug. When Supabase is
 * configured the actor's company comes from the JWT instead and this value is
 * never consulted.
 */

import { SAMPLE_COMPANY_ID } from "./actor";
import { Role } from "./roles";

/**
 * Shared password for every test account.
 *
 * Printed in the UI and in `docs/test-accounts.md` on purpose: an account whose
 * password is a secret is not a test account. It is only ever accepted by the
 * demo credential check below, which is itself unreachable once
 * `NEXT_PUBLIC_SUPABASE_URL` is set.
 */
export const TEST_ACCOUNT_PASSWORD = "CarbonLedger!2024";

export interface TestAccount {
  /** Matches `public.users.id` in supabase/seed.sql, i.e. the auth.users id. */
  id: string;
  email: string;
  /** Korean display name, as seeded. */
  name: string;
  role: Role;
  /** Message key under `user_roles`, for rendering the role in any language. */
  roleKey: string;
}

/**
 * Ordered most privileged to least, which is also the order the login screen
 * lists them in — a reviewer reading top to bottom watches capability fall away.
 */
export const TEST_ACCOUNTS: readonly TestAccount[] = [
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001",
    email: "admin@hankook-mfg.co.kr",
    name: "김관리",
    role: Role.COMPANY_ADMIN,
    roleKey: "company_admin",
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002",
    email: "site-admin@hankook-mfg.co.kr",
    name: "이현장",
    role: Role.SITE_ADMIN,
    roleKey: "site_admin",
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003",
    email: "reviewer@hankook-mfg.co.kr",
    name: "박검토",
    role: Role.REVIEWER,
    roleKey: "reviewer",
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa004",
    email: "auditor@hankook-mfg.co.kr",
    name: "정감사",
    role: Role.AUDITOR,
    roleKey: "auditor",
  },
  {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa005",
    email: "viewer@hankook-mfg.co.kr",
    name: "최열람",
    role: Role.VIEWER,
    roleKey: "viewer",
  },
] as const;

/** Company the demo accounts act within. See the file header for why. */
export const TEST_ACCOUNT_COMPANY_ID = SAMPLE_COMPANY_ID;

/** Looks an account up by email, case- and whitespace-insensitively. */
export function findTestAccount(email: string): TestAccount | null {
  const normalised = email.trim().toLowerCase();
  return TEST_ACCOUNTS.find((account) => account.email === normalised) ?? null;
}

/** Looks an account up by id — how a session cookie is resolved back to a user. */
export function findTestAccountById(id: string): TestAccount | null {
  return TEST_ACCOUNTS.find((account) => account.id === id) ?? null;
}

/**
 * Whether these credentials name a test account.
 *
 * A plain string comparison. It is not a constant-time compare and does not need
 * to be: the password is published, so there is no secret for a timing side
 * channel to leak. Stated explicitly so nobody later mistakes this for a
 * credential check worth hardening rather than one worth deleting.
 */
export function verifyTestCredentials(email: string, password: string): TestAccount | null {
  const account = findTestAccount(email);
  if (account === null) return null;
  return password === TEST_ACCOUNT_PASSWORD ? account : null;
}
