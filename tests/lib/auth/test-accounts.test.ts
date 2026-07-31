/**
 * The test-account catalogue is only useful if it agrees with the two other places
 * the same five people are defined: `supabase/seed.sql`, which creates the
 * `public.users` rows, and `supabase/seed-auth-users.sql`, which creates the
 * credentials. A drift in any one of them produces a walkthrough where signing in
 * works but the data belongs to someone else, or where the documented password is
 * not the one the code accepts — both of which look like application bugs.
 *
 * So these tests read the SQL files rather than restating their contents.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findTestAccount,
  findTestAccountById,
  TEST_ACCOUNTS,
  TEST_ACCOUNT_PASSWORD,
  verifyTestCredentials,
} from "@/lib/auth/test-accounts";
import { RolePermissionMap } from "@/lib/auth/roles";
import ko from "@/messages/ko.json";

const REPO_ROOT = path.join(import.meta.dirname, "../../..");

function sql(file: string): string {
  return readFileSync(path.join(REPO_ROOT, "supabase", file), "utf8");
}

describe("test accounts", () => {
  it("covers every role a reviewer needs to compare", () => {
    // Admin, writer, approver, read-only auditor and pure reader: the five
    // capability shapes the authorisation rules distinguish.
    expect(TEST_ACCOUNTS.map((account) => account.role)).toEqual([
      "company_admin",
      "site_admin",
      "reviewer",
      "auditor",
      "viewer",
    ]);
  });

  it("has unique ids and emails", () => {
    expect(new Set(TEST_ACCOUNTS.map((a) => a.id)).size).toBe(TEST_ACCOUNTS.length);
    expect(new Set(TEST_ACCOUNTS.map((a) => a.email)).size).toBe(TEST_ACCOUNTS.length);
  });

  it("stores emails already lower-cased, since lookup normalises to that", () => {
    for (const account of TEST_ACCOUNTS) {
      expect(account.email).toBe(account.email.toLowerCase());
    }
  });

  it("names a role key that exists in the message catalogue", () => {
    for (const account of TEST_ACCOUNTS) {
      expect(Object.keys(ko.user_roles)).toContain(account.roleKey);
      // The key must also be the role itself, or the label and the capability
      // could disagree.
      expect(account.roleKey).toBe(account.role);
    }
  });

  it("uses roles the permission map knows", () => {
    for (const account of TEST_ACCOUNTS) {
      expect(RolePermissionMap[account.role]).toBeDefined();
    }
  });

  describe("agreement with supabase/seed.sql", () => {
    const seed = sql("seed.sql");

    it.each(TEST_ACCOUNTS.map((a) => [a.email, a] as const))(
      "%s appears in the seed with the same id, name and role",
      (_email, account) => {
        // One row, all four fields on it, so a partial match cannot pass.
        const row = new RegExp(
          `'${account.id}'[^\\n]*'${account.email}'[^\\n]*'${account.name}'[^\\n]*'${account.role}'`
        );
        expect(seed).toMatch(row);
      }
    );
  });

  describe("agreement with supabase/seed-auth-users.sql", () => {
    const authSeed = sql("seed-auth-users.sql");

    it("creates credentials with the password the app accepts", () => {
      // If these diverge, the documented password signs in on a demo deployment
      // and is rejected on a Supabase one.
      expect(authSeed).toContain(`test_password text := '${TEST_ACCOUNT_PASSWORD}'`);
    });

    it.each(TEST_ACCOUNTS.map((a) => [a.email, a] as const))(
      "%s gets an auth row with the matching id and role claim",
      (_email, account) => {
        expect(authSeed).toMatch(
          new RegExp(`'${account.id}'::uuid, '${account.email}'[^\\n]*'${account.role}'`)
        );
      }
    );

    it("sets the three JWT claims the actor resolver reads", () => {
      // Without company_id the actor is null and every action is refused; without
      // role it silently degrades to viewer.
      expect(authSeed).toContain("'company_id'");
      expect(authSeed).toContain("'role'");
      expect(authSeed).toContain("'full_name'");
    });
  });

  describe("lookup", () => {
    const admin = TEST_ACCOUNTS[0];

    it("finds an account regardless of case or surrounding space", () => {
      expect(findTestAccount(`  ${admin.email.toUpperCase()} `)?.id).toBe(admin.id);
    });

    it("returns null for an unknown address", () => {
      expect(findTestAccount("nobody@example.com")).toBeNull();
    });

    it("finds an account by id, and only by an exact id", () => {
      expect(findTestAccountById(admin.id)?.email).toBe(admin.email);
      expect(findTestAccountById(admin.id.slice(0, -1))).toBeNull();
    });
  });

  describe("credential check", () => {
    const viewer = TEST_ACCOUNTS[4];

    it("accepts the published password", () => {
      expect(verifyTestCredentials(viewer.email, TEST_ACCOUNT_PASSWORD)?.role).toBe("viewer");
    });

    it("rejects a wrong password for a known account", () => {
      expect(verifyTestCredentials(viewer.email, "wrong")).toBeNull();
    });

    it("rejects an empty password, which a missing form field would produce", () => {
      expect(verifyTestCredentials(viewer.email, "")).toBeNull();
    });

    it("rejects the right password for an unknown account", () => {
      expect(verifyTestCredentials("nobody@example.com", TEST_ACCOUNT_PASSWORD)).toBeNull();
    });

    it("is case-insensitive on the address but not on the password", () => {
      expect(verifyTestCredentials(viewer.email.toUpperCase(), TEST_ACCOUNT_PASSWORD)).not.toBeNull();
      expect(
        verifyTestCredentials(viewer.email, TEST_ACCOUNT_PASSWORD.toLowerCase())
      ).toBeNull();
    });
  });
});
