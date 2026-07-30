import {
  pgTable,
  uuid,
  varchar,
  integer,
  decimal,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./organizations";
import { scopeEnum } from "./emission-sources";

export const targetTypeEnum = pgEnum("target_type", ["absolute", "intensity", "sbti"]);

export const targetStatusEnum = pgEnum("target_status", [
  "draft",
  "active",
  "achieved",
  "missed",
  "expired",
]);

export const reductionTargets = pgTable("reduction_targets", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  targetType: targetTypeEnum("target_type").notNull(),
  baseYear: integer("base_year").notNull(),
  targetYear: integer("target_year").notNull(),
  baseEmissions: decimal("base_emissions", { precision: 18, scale: 6 }).notNull(),
  targetEmissions: decimal("target_emissions", { precision: 18, scale: 6 }).notNull(),
  targetReductionPct: decimal("target_reduction_pct", { precision: 5, scale: 2 }).notNull(),
  scope: scopeEnum("scope"),
  status: targetStatusEnum("status").default("draft").notNull(),
  methodology: varchar("methodology", { length: 255 }),
  description: varchar("description", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const targetProgress = pgTable("target_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  targetId: uuid("target_id")
    .notNull()
    .references(() => reductionTargets.id, { onDelete: "cascade" }),
  year: integer("year").notNull(),
  actualEmissions: decimal("actual_emissions", { precision: 18, scale: 6 }).notNull(),
  progressPct: decimal("progress_pct", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reductionTargetsRelations = relations(reductionTargets, ({ one, many }) => ({
  company: one(companies, { fields: [reductionTargets.companyId], references: [companies.id] }),
  progress: many(targetProgress),
}));

export const targetProgressRelations = relations(targetProgress, ({ one }) => ({
  target: one(reductionTargets, {
    fields: [targetProgress.targetId],
    references: [reductionTargets.id],
  }),
}));
