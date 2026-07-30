import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./organizations";
import { users } from "./users";

export const reportTypeEnum = pgEnum("report_type", [
  "iso14064",
  "cdp",
  "sbti",
  "issb",
  "gri",
  "tcfd",
  "csrd",
  "esg",
  "sustainability",
]);

export const reportStatusEnum = pgEnum("report_status", [
  "draft",
  "generating",
  "completed",
  "published",
  "archived",
]);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  type: reportTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  status: reportStatusEnum("status").default("draft").notNull(),
  generatedBy: uuid("generated_by").references(() => users.id),
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  fileUrl: text("file_url"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reportsRelations = relations(reports, ({ one }) => ({
  company: one(companies, { fields: [reports.companyId], references: [companies.id] }),
  generator: one(users, { fields: [reports.generatedBy], references: [users.id] }),
}));
