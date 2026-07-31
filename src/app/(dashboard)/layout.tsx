import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/features/dashboard-shell";
import { actorDisplayName } from "@/lib/auth/current-actor";
import { getSessionSummary } from "@/lib/auth/session";
import { visibleNavRoutes } from "@/lib/navigation";

/**
 * Dashboard layout — a Server Component.
 *
 * It was `"use client"`, which is why the chrome could not tell who was signed in:
 * the header hard-coded a name, an email and an avatar, and the sidebar offered
 * every page to every role. Resolving the session and the role-filtered nav here
 * and passing them down is the whole change; the interactive state lives in
 * `DashboardShell`.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionSummary();
  const tRoles = await getTranslations("user_roles");
  const tActor = await getTranslations("actor");

  const actor = session.actor;
  const displayName = actor === null ? "—" : actorDisplayName(actor, tActor("unauthenticated_operator"));

  return (
    <DashboardShell
      /*
       * Filter the nav by role only for a session someone deliberately started.
       * An anonymous visitor to a database-less deployment sees the whole product;
       * hiding two thirds of it behind a role they never chose would misrepresent
       * what exists. Signing in as the viewer applies the filter.
       */
      routes={visibleNavRoutes(session.isSignedIn && actor !== null ? actor.role : null)}
      user={{
        name: displayName,
        email: session.email,
        roleLabel: actor === null ? "—" : tRoles(actor.role),
        // Korean names have no useful initials in the Latin sense, so the first
        // character is used and padded — "김관리" gives "김", not "KG".
        initials: displayName.slice(0, 2),
        isSignedIn: session.isSignedIn,
      }}
    >
      {children}
    </DashboardShell>
  );
}
