import { pgTable, uuid, varchar, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { equipment } from "./organizations";

export const scopeEnum = pgEnum("emission_scope", ["1", "2", "3"]);

export const measurementMethodEnum = pgEnum("measurement_method", [
  "direct_measurement",
  "calculation",
  "estimation",
  "mass_balance",
]);

export const emissionSources = pgTable("emission_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  equipmentId: uuid("equipment_id").references(() => equipment.id, { onDelete: "set null" }),
  companyId: uuid("company_id").notNull(),
  scope: scopeEnum("scope").notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  subCategory: varchar("sub_category", { length: 100 }),
  fuelType: varchar("fuel_type", { length: 100 }),
  sourceDescription: text("source_description"),
  isActive: boolean("is_active").default(true).notNull(),
  measurementMethod: measurementMethodEnum("measurement_method").notNull().default("calculation"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const emissionSourcesRelations = relations(emissionSources, ({ one }) => ({
  equipment: one(equipment, {
    fields: [emissionSources.equipmentId],
    references: [equipment.id],
  }),
}));
