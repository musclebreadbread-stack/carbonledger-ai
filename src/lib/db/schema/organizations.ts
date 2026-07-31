import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  decimal,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const industryEnum = pgEnum("industry_type", [
  "manufacturing",
  "energy",
  "transportation",
  "construction",
  "agriculture",
  "services",
  "technology",
  "finance",
  "healthcare",
  "retail",
  "other",
]);

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  industry: industryEnum("industry").notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  registrationNumber: varchar("registration_number", { length: 100 }),
  fiscalYearStart: integer("fiscal_year_start").default(1).notNull(),
  logo_url: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const sites = pgTable("sites", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  gridRegion: varchar("grid_region", { length: 100 }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const facilities = pgTable("facilities", {
  id: uuid("id").defaultRandom().primaryKey(),
  siteId: uuid("site_id")
    .notNull()
    .references(() => sites.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

// The foreign-key indexes below are not optimisations: the RLS policies in
// 0003 reach company_id through these keys with an EXISTS on the parent, which
// without an index on the child's key degrades every filtered read into a
// sequential scan. They live in the schema so `db:generate` does not propose
// dropping the indexes 0003/0004 already created.
export const productionLines = pgTable(
  "production_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    facilityId: uuid("facility_id")
      .notNull()
      .references(() => facilities.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    facilityIdx: index("idx_production_lines_facility_id").on(table.facilityId),
  })
);

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lineId: uuid("line_id")
      .notNull()
      .references(() => productionLines.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 100 }).notNull(),
    capacity: decimal("capacity", { precision: 12, scale: 4 }),
    refrigerantType: varchar("refrigerant_type", { length: 50 }),
    refrigerantChargeKg: decimal("refrigerant_charge_kg", { precision: 10, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    lineIdx: index("idx_equipment_line_id").on(table.lineId),
  })
);

export const companiesRelations = relations(companies, ({ many }) => ({
  sites: many(sites),
}));

export const sitesRelations = relations(sites, ({ one, many }) => ({
  company: one(companies, { fields: [sites.companyId], references: [companies.id] }),
  facilities: many(facilities),
}));

export const facilitiesRelations = relations(facilities, ({ one, many }) => ({
  site: one(sites, { fields: [facilities.siteId], references: [sites.id] }),
  productionLines: many(productionLines),
}));

export const productionLinesRelations = relations(productionLines, ({ one, many }) => ({
  facility: one(facilities, {
    fields: [productionLines.facilityId],
    references: [facilities.id],
  }),
  equipment: many(equipment),
}));

export const equipmentRelations = relations(equipment, ({ one }) => ({
  productionLine: one(productionLines, {
    fields: [equipment.lineId],
    references: [productionLines.id],
  }),
}));
