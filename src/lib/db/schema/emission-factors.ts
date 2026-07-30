import {
  pgTable,
  uuid,
  varchar,
  decimal,
  text,
  boolean,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const efProviderEnum = pgEnum("ef_provider", [
  "korea_moe",
  "ipcc",
  "defra",
  "epa",
  "iea",
  "ecoinvent",
  "custom",
]);

export const gwpVersionEnum = pgEnum("gwp_version", ["AR4", "AR5", "AR6"]);

export const emissionFactorSets = pgTable("emission_factor_sets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: efProviderEnum("provider").notNull(),
  version: varchar("version", { length: 50 }).notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  validTo: timestamp("valid_to", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emissionFactors = pgTable("emission_factors", {
  id: uuid("id").defaultRandom().primaryKey(),
  setId: uuid("set_id")
    .notNull()
    .references(() => emissionFactorSets.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  fuelType: varchar("fuel_type", { length: 100 }),
  unitNumerator: varchar("unit_numerator", { length: 50 }).notNull(),
  unitDenominator: varchar("unit_denominator", { length: 50 }).notNull(),
  co2Factor: decimal("co2_factor", { precision: 15, scale: 8 }),
  ch4Factor: decimal("ch4_factor", { precision: 15, scale: 8 }),
  n2oFactor: decimal("n2o_factor", { precision: 15, scale: 8 }),
  hfcFactor: decimal("hfc_factor", { precision: 15, scale: 8 }),
  pfcFactor: decimal("pfc_factor", { precision: 15, scale: 8 }),
  sf6Factor: decimal("sf6_factor", { precision: 15, scale: 8 }),
  gwpAr: gwpVersionEnum("gwp_ar").default("AR5").notNull(),
  uncertaintyPct: decimal("uncertainty_pct", { precision: 5, scale: 2 }),
  sourceReference: text("source_reference"),
  year: integer("year"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emissionFactorSetsRelations = relations(emissionFactorSets, ({ many }) => ({
  factors: many(emissionFactors),
}));

export const emissionFactorsRelations = relations(emissionFactors, ({ one }) => ({
  set: one(emissionFactorSets, {
    fields: [emissionFactors.setId],
    references: [emissionFactorSets.id],
  }),
}));
