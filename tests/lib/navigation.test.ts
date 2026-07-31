/**
 * The nav list is now the single source for the sidebar, the command palette and
 * the role filter. Two things have to hold for that to be safe: every entry names a
 * message key that exists in all four catalogues, and the role filter never hides a
 * page from someone whose job needs it.
 *
 * The second is the one worth guarding. The map this replaced (`RoleNavigationMap`
 * in `src/lib/auth/roles.ts`) had drifted to eight keys while the app grew to
 * twelve, so applying it would have hidden four working pages from the company
 * admin. Nothing caught that, because nothing read it.
 */

import { describe, expect, it } from "vitest";
import { NAV_ROUTES, ROLE_NAV_KEYS, visibleNavRoutes } from "@/lib/navigation";
import { Permission, Role, hasPermission } from "@/lib/auth/roles";
import ko from "@/messages/ko.json";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import zh from "@/messages/zh.json";

const CATALOGUES = { ko, en, ja, zh };

describe("nav routes", () => {
  it("names a translated title for every entry, in every locale", () => {
    for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
      for (const route of NAV_ROUTES) {
        expect(
          Object.keys(catalogue.nav),
          `${locale} is missing nav.${route.titleKey}`
        ).toContain(route.titleKey);
        for (const child of route.children ?? []) {
          expect(Object.keys(catalogue.nav)).toContain(child.titleKey);
        }
      }
    }
  });

  it("has unique hrefs", () => {
    const hrefs = NAV_ROUTES.map((route) => route.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("uses absolute in-app paths only", () => {
    for (const route of NAV_ROUTES) {
      expect(route.href.startsWith("/")).toBe(true);
      expect(route.href.startsWith("//")).toBe(false);
    }
  });

  it("points every child at its parent's route", () => {
    // The children are query-string variants (`?scope=1`); a child on a different
    // path would leave the parent highlighted for a page it does not own.
    for (const route of NAV_ROUTES) {
      for (const child of route.children ?? []) {
        expect(child.href.startsWith(route.href)).toBe(true);
      }
    }
  });
});

describe("role filtering", () => {
  const everyRole = Object.values(Role);

  it("covers every role in the enum", () => {
    for (const role of everyRole) {
      expect(ROLE_NAV_KEYS[role]).toBeDefined();
    }
  });

  it("lists only keys that exist in the nav", () => {
    const known = new Set(NAV_ROUTES.map((route) => route.titleKey));
    for (const role of everyRole) {
      for (const key of ROLE_NAV_KEYS[role]) {
        expect(known, `${role} references unknown nav key ${key}`).toContain(key);
      }
    }
  });

  it("shows the whole nav when nobody is signed in", () => {
    // A database-less deployment is a preview of the product; hiding two thirds of
    // it behind a role the visitor never chose would misrepresent what exists.
    expect(visibleNavRoutes(null)).toEqual(NAV_ROUTES);
  });

  it("shows the whole nav to the two admin roles", () => {
    expect(visibleNavRoutes(Role.SUPER_ADMIN)).toEqual(NAV_ROUTES);
    expect(visibleNavRoutes(Role.COMPANY_ADMIN)).toEqual(NAV_ROUTES);
  });

  it("always leaves the dashboard, emissions and reports reachable", () => {
    // Every role holds `read`, so removing the three read-only surfaces would
    // produce a session that can see nothing at all.
    for (const role of everyRole) {
      const keys = visibleNavRoutes(role).map((route) => route.titleKey);
      expect(keys, role).toContain("dashboard");
      expect(keys, role).toContain("emissions");
      expect(keys, role).toContain("reports");
    }
  });

  it("hides settings from everyone without admin permission", () => {
    for (const role of everyRole) {
      const keys = visibleNavRoutes(role).map((route) => route.titleKey);
      expect(keys.includes("settings"), role).toBe(hasPermission(role, Permission.ADMIN));
    }
  });

  it("hides approvals from roles that cannot approve", () => {
    for (const role of [Role.VIEWER, Role.AUDITOR, Role.CONSULTANT]) {
      expect(visibleNavRoutes(role).map((r) => r.titleKey)).not.toContain("approvals");
    }
    for (const role of [Role.SITE_ADMIN, Role.REVIEWER]) {
      expect(visibleNavRoutes(role).map((r) => r.titleKey)).toContain("approvals");
    }
  });

  it("keeps the audit log for the auditor and denies it to the viewer", () => {
    // The two roles that motivate the split: an auditor reads the log for a living
    // and holds no admin permission, so a purely permission-derived filter would
    // have taken it away.
    expect(visibleNavRoutes(Role.AUDITOR).map((r) => r.titleKey)).toContain("audit_log");
    expect(visibleNavRoutes(Role.VIEWER).map((r) => r.titleKey)).not.toContain("audit_log");
  });

  it("gives the viewer the smallest nav of any role", () => {
    const sizes = everyRole.map((role) => ({ role, size: visibleNavRoutes(role).length }));
    const viewer = sizes.find((entry) => entry.role === Role.VIEWER);

    expect(viewer).toBeDefined();
    for (const entry of sizes) {
      expect(entry.size, entry.role).toBeGreaterThanOrEqual(viewer!.size);
    }
  });

  it("returns routes in the same order as the source list", () => {
    // The sidebar renders whatever order this returns, so a filter that reordered
    // would silently reshuffle the nav per role.
    for (const role of everyRole) {
      const visible = visibleNavRoutes(role).map((route) => route.titleKey);
      const expected = NAV_ROUTES.map((route) => route.titleKey).filter((key) =>
        visible.includes(key)
      );
      expect(visible).toEqual(expected);
    }
  });
});
