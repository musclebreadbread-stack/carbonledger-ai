import { redirect } from "next/navigation";
import { getSessionSummary } from "@/lib/auth/session";
import { getAuthDeploymentMode } from "@/lib/auth/deployment-mode";
import { DASHBOARD_ROUTE } from "@/lib/navigation";
import { TEST_ACCOUNTS, TEST_ACCOUNT_PASSWORD } from "@/lib/auth/test-accounts";
import { LoginForm } from "./login-form";

/**
 * Server half of the sign-in screen.
 *
 * It exists to answer two questions the form cannot: whether a session already
 * exists (in demo mode `proxy.ts` cannot tell, because verifying the demo cookie
 * needs `next/headers`), and which of the two sign-in paths is live, so the form
 * can say so instead of leaving the visitor to guess why the published test
 * password is rejected.
 *
 * `searchParams` is awaited — it is a Promise in this version of Next.js.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const session = await getSessionSummary();
  if (session.isSignedIn) {
    redirect(DASHBOARD_ROUTE);
  }

  const requested = (await searchParams).redirect;
  const redirectTo = Array.isArray(requested) ? requested[0] : requested;
  const authMode = getAuthDeploymentMode();

  return (
    <LoginForm
      authMode={authMode}
      redirectTo={typeof redirectTo === "string" ? redirectTo : null}
      // Passed as data rather than imported by the client component so the shared
      // password is not compiled into the browser bundle of a deployment that has
      // Supabase configured and therefore no test accounts.
      testAccounts={
        authMode !== "demo"
          ? []
          : TEST_ACCOUNTS.map(({ email, name, roleKey }) => ({ email, name, roleKey }))
      }
      testPassword={authMode === "demo" ? TEST_ACCOUNT_PASSWORD : null}
    />
  );
}
