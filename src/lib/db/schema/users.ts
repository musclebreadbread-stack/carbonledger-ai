import { pgTable, uuid, varchar, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, sites } from "./organizations";

export const roleEnum = pgEnum("user_role", [
  "super_admin",
  "company_admin",
  "site_admin",
  "reviewer",
  "auditor",
  "viewer",
  "consultant",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("viewer"),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
  active: boolean("active").default(true).notNull(),
  mfaEnabled: boolean("mfa_enabled").default(false).notNull(),
  avatarUrl: varchar("avatar_url", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const userSiteAccess = pgTable(
  "user_site_access",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    canWrite: boolean("can_write").default(false).notNull(),
    canApprove: boolean("can_approve").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("idx_user_site_access_user_id").on(table.userId),
    siteIdx: index("idx_user_site_access_site_id").on(table.siteId),
  })
);

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, { fields: [users.companyId], references: [companies.id] }),
  siteAccess: many(userSiteAccess),
}));

export const userSiteAccessRelations = relations(userSiteAccess, ({ one }) => ({
  user: one(users, { fields: [userSiteAccess.userId], references: [users.id] }),
  site: one(sites, { fields: [userSiteAccess.siteId], references: [sites.id] }),
}));
