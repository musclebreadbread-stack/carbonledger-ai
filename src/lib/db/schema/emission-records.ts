import {
  pgTable,
  uuid,
  varchar,
  decimal,
  text,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies, sites } from "./organizations";
import { emissionSources, scopeEnum } from "./emission-sources";
import { emissionFactors } from "./emission-factors";
import { users } from "./users";

export const recordStatusEnum = pgEnum("record_status", [
  "draft",
  "submitted",
  "reviewed",
  "approved",
  "rejected",
]);

export const emissionRecords = pgTable(
  "emission_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id").references(() => emissionSources.id, { onDelete: "set null" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    scope: scopeEnum("scope").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    activityDataValue: decimal("activity_data_value", { precision: 18, scale: 6 }).notNull(),
    activityDataUnit: varchar("activity_data_unit", { length: 50 }).notNull(),
    emissionFactorId: uuid("emission_factor_id").references(() => emissionFactors.id),
    emissionFactorValue: decimal("emission_factor_value", { precision: 15, scale: 8 }),
    co2eKg: decimal("co2e_kg", { precision: 18, scale: 6 }).notNull(),
    co2Kg: decimal("co2_kg", { precision: 18, scale: 6 }),
    ch4Kg: decimal("ch4_kg", { precision: 18, scale: 6 }),
    n2oKg: decimal("n2o_kg", { precision: 18, scale: 6 }),
    calculationFormula: text("calculation_formula"),
    calculationDetailJson: jsonb("calculation_detail_json"),
    evidenceUrl: text("evidence_url"),
    status: recordStatusEnum("status").default("draft").notNull(),
    submittedBy: uuid("submitted_by").references(() => users.id),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    approvedBy: uuid("approved_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("idx_emission_records_company").on(table.companyId),
    periodIdx: index("idx_emission_records_period").on(table.periodStart, table.periodEnd),
    scopeIdx: index("idx_emission_records_scope").on(table.scope),
    statusIdx: index("idx_emission_records_status").on(table.status),
  })
);

export const emissionRecordAttachments = pgTable(
  "emission_record_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recordId: uuid("record_id")
      .notNull()
      .references(() => emissionRecords.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    fileUrl: text("file_url").notNull(),
    fileType: varchar("file_type", { length: 50 }),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    recordIdx: index("idx_emission_record_attachments_record_id").on(table.recordId),
  })
);

export const emissionRecordsRelations = relations(emissionRecords, ({ one, many }) => ({
  source: one(emissionSources, {
    fields: [emissionRecords.sourceId],
    references: [emissionSources.id],
  }),
  company: one(companies, { fields: [emissionRecords.companyId], references: [companies.id] }),
  site: one(sites, { fields: [emissionRecords.siteId], references: [sites.id] }),
  emissionFactor: one(emissionFactors, {
    fields: [emissionRecords.emissionFactorId],
    references: [emissionFactors.id],
  }),
  attachments: many(emissionRecordAttachments),
}));

export const emissionRecordAttachmentsRelations = relations(
  emissionRecordAttachments,
  ({ one }) => ({
    record: one(emissionRecords, {
      fields: [emissionRecordAttachments.recordId],
      references: [emissionRecords.id],
    }),
  })
);
