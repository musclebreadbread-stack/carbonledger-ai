/**
 * Shared shape for the auth forms' `useActionState`.
 *
 * Separate from `./actions.ts` because a `"use server"` module may only export
 * async functions — exporting the initial-state constant from there fails the
 * build with `invalid-use-server-value`. Keeping it here also means the client
 * components import the constant without pulling the actions' server-only
 * dependencies into their module graph.
 */

export interface AuthFormState {
  /** Message to show on failure; null when there is nothing to report. */
  error: string | null;
  /** Message to show on a success that does not navigate, e.g. sign-up. */
  notice?: string | null;
}

export const EMPTY_AUTH_STATE: AuthFormState = { error: null, notice: null };
