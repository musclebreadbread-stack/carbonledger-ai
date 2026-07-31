/**
 * Supabase Authentication Helpers
 * Server-side and browser-side auth client creation
 */

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthDeploymentMode } from "./deployment-mode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Whether a Supabase project is configured at all.
 *
 * Both clients above are constructed from these two variables, and
 * `createServerClient` with an empty URL fails at the point of use rather than
 * returning "no session". Callers that need to distinguish "nobody is signed in"
 * from "there is no authentication system here" have to ask first — see
 * `./current-actor`, and the matching early return in `src/proxy.ts`.
 */
export function isSupabaseConfigured(): boolean {
  return getAuthDeploymentMode() === "supabase";
}

/**
 * Create Supabase client for browser (Client Components)
 */
export function createBrowserClient(): SupabaseClient {
  return createSupabaseBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Create Supabase client for server (Server Components, API Routes)
 */
export async function createClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();

  return createSupabaseServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as never)
          );
        } catch {
          // This can be called from Server Components where cookies cannot be set
        }
      },
    },
  });
}

/**
 * Get current session from server
 */
export async function getSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
}

/**
 * Get current user from server
 */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  const supabase = await createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string, metadata?: Record<string, unknown>) {
  const supabase = await createClient();
  return supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
}

/**
 * Sign out current user
 */
export async function signOut() {
  const supabase = await createClient();
  return supabase.auth.signOut();
}
