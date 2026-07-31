/**
 * The single list of navigable destinations.
 *
 * Previously the routes lived only inside `sidebar.tsx` as JSX, which meant
 * anything else that needed to know where the app can go — the command palette,
 * the role filter, the post-login redirect — had to restate them. Two lists of
 * routes is how you get a nav item that 404s, which this repository has already
 * had once (see the header of `tests/e2e/routing.spec.ts`).
 *
 * Icons stay in `sidebar.tsx`: they are presentation, and putting JSX here would
 * make this module unusable from the places that only want paths.
 */

import { Role } from "./auth/roles";

/** Where an authenticated user lands, and where post-login redirects default to. */
export const DASHBOARD_ROUTE = "/dashboard";

export interface NavRoute {
  /** Key under the `nav` message namespace. */
  titleKey: string;
  href: string;
  /** Sub-links shown when the parent is active. */
  children?: { titleKey: string; href: string }[];
}

export const NAV_ROUTES: readonly NavRoute[] = [
  { titleKey: "dashboard", href: "/dashboard" },
  {
    titleKey: "emissions",
    href: "/emissions",
    children: [
      { titleKey: "scope1", href: "/emissions?scope=1" },
      { titleKey: "scope2", href: "/emissions?scope=2" },
      { titleKey: "scope3", href: "/emissions?scope=3" },
    ],
  },
  { titleKey: "scope3_categories", href: "/scope3" },
  { titleKey: "emission_factors", href: "/emission-factors" },
  { titleKey: "approvals", href: "/approvals" },
  { titleKey: "reports", href: "/reports" },
  { titleKey: "suppliers", href: "/suppliers" },
  { titleKey: "targets", href: "/targets" },
  { titleKey: "sites", href: "/sites" },
  { titleKey: "ai_insights", href: "/ai-insights" },
  { titleKey: "settings", href: "/settings" },
  { titleKey: "audit_log", href: "/audit-log" },
];

/**
 * Destinations each role sees in the nav.
 *
 * This supersedes `RoleNavigationMap` in `./auth/roles`, which was never read by
 * any component and had drifted: it listed eight keys and the app has twelve, so
 * applying it would have hidden `/scope3`, `/sites`, `/ai-insights` and
 * `/approvals` from every role including the company admin.
 *
 * The cuts are by capability, mirroring `./auth/actor`:
 *   * `/settings` and `/audit-log` need `can_administer`, except that an auditor
 *     keeps the audit log — reading it is the job.
 *   * `/approvals` needs `can_approve`, so a viewer and an auditor lose it.
 *   * `/suppliers` is a write surface (verify, reject, re-request), so viewers
 *     lose it; auditors keep read access because supplier evidence is in scope for
 *     an audit.
 * Everything else is inventory a reader legitimately needs.
 *
 * Note this filters the *nav*, which is a convenience, not a control. The Server
 * Actions behind each screen re-check authorisation, because a hidden link is not
 * a closed door.
 */
const ALL_KEYS = NAV_ROUTES.map((route) => route.titleKey);

export const ROLE_NAV_KEYS: Record<Role, readonly string[]> = {
  [Role.SUPER_ADMIN]: ALL_KEYS,
  [Role.COMPANY_ADMIN]: ALL_KEYS,
  [Role.SITE_ADMIN]: ALL_KEYS.filter((key) => key !== "settings" && key !== "audit_log"),
  [Role.REVIEWER]: ALL_KEYS.filter(
    (key) => key !== "settings" && key !== "audit_log" && key !== "suppliers"
  ),
  [Role.AUDITOR]: ALL_KEYS.filter((key) => key !== "settings" && key !== "approvals"),
  [Role.VIEWER]: ALL_KEYS.filter(
    (key) =>
      key !== "settings" &&
      key !== "audit_log" &&
      key !== "approvals" &&
      key !== "suppliers" &&
      key !== "emission_factors"
  ),
  [Role.CONSULTANT]: ALL_KEYS.filter(
    (key) => key !== "settings" && key !== "audit_log" && key !== "approvals"
  ),
};

/**
 * Nav routes visible to a role, or all of them when nobody is signed in.
 *
 * `null` means "no deliberate session". An anonymous visitor sees the whole nav:
 * a deployment with no database is a preview of the product, and hiding two
 * thirds of it behind a role the visitor never chose would misrepresent what has
 * been built. Sign in as the viewer and the filter applies.
 */
export function visibleNavRoutes(role: Role | null): readonly NavRoute[] {
  if (role === null) return NAV_ROUTES;
  const allowed = new Set(ROLE_NAV_KEYS[role] ?? ALL_KEYS);
  return NAV_ROUTES.filter((route) => allowed.has(route.titleKey));
}
