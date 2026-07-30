import { pgTable, uuid, varchar, decimal, text } from "drizzle-orm/pg-core";

export const unitConversions = pgTable("unit_conversions", {
  id: uuid("id").defaultRandom().primaryKey(),
  fromUnit: varchar("from_unit", { length: 50 }).notNull(),
  toUnit: varchar("to_unit", { length: 50 }).notNull(),
  conversionFactor: decimal("conversion_factor", { precision: 20, scale: 12 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  source: text("source"),
});
