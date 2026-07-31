export type AuthDeploymentMode = "supabase" | "demo" | "disabled";

type Environment = Record<string, string | undefined>;

/**
 * Chooses one and only one authentication path.
 *
 * Demo mode is convenient locally, but published credentials must never become a
 * production fallback just because two environment variables were omitted. In a
 * production build it therefore requires both the explicit `ENABLE_DEMO_MODE=true`
 * opt-in and a 32-byte-or-longer signing secret. A partial Supabase
 * configuration is always disabled rather than silently dropping to demo,
 * because masking a misspelled key would be a security failure.
 */
export function resolveAuthDeploymentMode(env: Environment): AuthDeploymentMode {
  const hasUrl = Boolean(env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (hasUrl && hasAnonKey) return "supabase";
  if (hasUrl !== hasAnonKey) return "disabled";

  const explicitDemo = env.ENABLE_DEMO_MODE === "true";
  const localDemo = env.NODE_ENV !== "production" && env.ENABLE_DEMO_MODE !== "false";
  if (localDemo) return "demo";

  // Production previews need an explicit mode switch *and* a non-default cookie
  // key. Otherwise the published fallback key in demo-token.ts would let anyone
  // mint a role cookie without even using the published test password.
  const hasProductionSecret =
    new TextEncoder().encode(env.DEMO_SESSION_SECRET ?? "").byteLength >= 32;
  return explicitDemo && hasProductionSecret ? "demo" : "disabled";
}

export function getAuthDeploymentMode(): AuthDeploymentMode {
  return resolveAuthDeploymentMode(process.env);
}
