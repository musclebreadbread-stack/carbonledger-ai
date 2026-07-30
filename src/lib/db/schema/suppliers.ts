import { pgTable, uuid, varchar, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { companies } from "./organizations";

export const supplierStatusEnum = pgEnum("supplier_status", ["active", "pending", "inactive"]);

export const dataRequestStatusEnum = pgEnum("data_request_status", [
  "pending",
  "sent",
  "in_progress",
  "submitted",
  "verified",
  "rejected",
]);

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactName: varchar("contact_name", { length: 255 }),
  industry: varchar("industry", { length: 100 }),
  country: varchar("country", { length: 100 }),
  status: supplierStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const supplierDataRequests = pgTable("supplier_data_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }),
  status: dataRequestStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  data: jsonb("data"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  company: one(companies, { fields: [suppliers.companyId], references: [companies.id] }),
  dataRequests: many(supplierDataRequests),
}));

export const supplierDataRequestsRelations = relations(supplierDataRequests, ({ one }) => ({
  supplier: one(suppliers, {
    fields: [supplierDataRequests.supplierId],
    references: [suppliers.id],
  }),
  company: one(companies, {
    fields: [supplierDataRequests.companyId],
    references: [companies.id],
  }),
}));
