"use server";

/**
 * Sign-in, sign-up and sign-out.
 *
 * These replace a `handleSubmit` that validated nothing, called nothing and set
 * `window.location.href` — the login form accepted any two strings and "logged
 * you in" as whoever the page happened to hard-code.
 *
 * Two paths, chosen by whether a Supabase project is configured, because both
 * deployments really exist:
 *
 *   * configured   — `signInWithPassword`, the real thing.
 *   * unconfigured — the published test-account credentials, held in a signed
 *                    cookie. See `src/lib/auth/demo-session.ts` for exactly what
 *                    that does and does not guarantee.
 *
 * The branch is decided on the server every time, never passed in from the
 * client. A Server Action is reachable by anyone who can POST to it, so a
 * `mode` argument would be an invitation to ask for the demo path on a
 * production deployment.
 */

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isSupabaseConfigured, signIn, signOut, signUp } from "@/lib/auth";
import { endDemoSession, startDemoSession } from "@/lib/auth/demo-session";
import { verifyTestCredentials } from "@/lib/auth/test-accounts";
import { DASHBOARD_ROUTE } from "@/lib/navigation";
import type { AuthFormState } from "./form-state";

const credentials = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

/**
 * Only same-origin absolute paths are honoured as a post-login destination.
 *
 * `proxy.ts` puts the requested path in `?redirect=`, and that parameter is
 * attacker-controllable: without this filter, a link to
 * `/login?redirect=https://evil.example` would turn our own login form into an
 * open redirect. `//` is rejected as well as `http://` because a protocol-relative
 * URL leaves the origin too.
 */
function safeRedirect(requested: unknown): string {
  return typeof requested === "string" &&
    requested.startsWith("/") &&
    !requested.startsWith("//")
    ? requested
    : DASHBOARD_ROUTE;
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations("auth");

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    // One message for both fields and for a malformed address. Distinguishing
    // "no such account" from "wrong password" tells an unauthenticated caller
    // which emails are registered.
    return { error: t("invalid_credentials"), notice: null };
  }

  const { email, password } = parsed.data;
  const destination = safeRedirect(formData.get("redirect"));

  if (isSupabaseConfigured()) {
    const { error } = await signIn(email, password);
    if (error) {
      return { error: t("invalid_credentials"), notice: null };
    }
  } else {
    const account = verifyTestCredentials(email, password);
    if (account === null) {
      return { error: t("invalid_credentials"), notice: null };
    }
    await startDemoSession(account.id);
  }

  // `redirect()` throws, so it has to be outside any try/catch above it.
  redirect(destination);
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    await signOut();
  } else {
    await endDemoSession();
  }
  redirect("/login");
}

const registration = z
  .object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    companyName: z.string().trim().min(1),
    email: z.string().trim().min(1).email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
  });

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const t = await getTranslations("auth");

  const raw = {
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    companyName: formData.get("companyName"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  };

  const parsed = registration.safeParse(raw);
  if (!parsed.success) {
    // The two failures a user can act on are reported specifically; everything
    // else is a required-field problem the browser already flags.
    const password = String(raw.password ?? "");
    if (password.length > 0 && password.length < 8) {
      return { error: t("password_too_short"), notice: null };
    }
    if (password.length > 0 && password !== String(raw.confirmPassword ?? "")) {
      return { error: t("password_mismatch"), notice: null };
    }
    return { error: t("register_failed"), notice: null };
  }

  if (!isSupabaseConfigured()) {
    /*
     * Deliberately refuses rather than pretending. Creating a company needs a
     * database; the previous implementation navigated away on submit, which read
     * as success and left the visitor looking for an account that was never
     * created.
     */
    return { error: t("register_demo_notice"), notice: null };
  }

  const { firstName, lastName, companyName, email, password } = parsed.data;
  const { error } = await signUp(email, password, {
    // Family name first: the seeded users are Korean, where that is the order.
    full_name: `${lastName}${firstName}`,
    company_name: companyName,
  });

  if (error) {
    return { error: t("register_failed"), notice: null };
  }

  // No redirect: Supabase may require email confirmation, so the honest outcome
  // is a message telling them to check their inbox.
  return { error: null, notice: t("register_success") };
}
