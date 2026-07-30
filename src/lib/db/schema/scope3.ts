import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./organizations";
import { suppliers } from "./suppliers";
import { emissionFactors } from "./emission-factors";

export const scope3Categories = pgTable("scope3_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryNumber: integer("category_number").notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  calculationMethods: jsonb("calculation_methods"),
});

export const supplierEmissions = pgTable("supplier_emissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  categoryNumber: integer("category_number").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  spendAmount: decimal("spend_amount", { precision: 18, scale: 2 }),
  spendCurrency: varchar("spend_currency", { length: 3 }).default("KRW"),
  emissionFactorId: uuid("emission_factor_id").references(() => emissionFactors.id),
  co2eKg: decimal("co2e_kg", { precision: 18, scale: 6 }).notNull(),
  dataQualityScore: integer("data_quality_score"),
  methodology: varchar("methodology", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scope3Records = pgTable("scope3_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  categoryNumber: integer("category_number").notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
  activityType: varchar("activity_type", { length: 100 }),
  activityData: decimal("activity_data", { precision: 18, scale: 6 }),
  activityUnit: varchar("activity_unit", { length: 50 }),
  co2eKg: decimal("co2e_kg", { precision: 18, scale: 6 }).notNull(),
  methodology: varchar("methodology", { length: 100 }),
  dataSource: text("data_source"),
  dataQualityScore: integer("data_quality_score"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scope3CategoriesRelations = relations(scope3Categories, ({ many }) => ({
  supplierEmissions: many(supplierEmissions),
}));

export const supplierEmissionsRelations = relations(supplierEmissions, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierEmissions.supplierId],
    references: [suppliers.id],
  }),
  company: one(companies, {
    fields: [supplierEmissions.companyId],
    references: [companies.id],
  }),
}));
