import { pgTable, uuid, varchar, text, timestamp, jsonb, serial, pgEnum } from "drizzle-orm/pg-core";

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "submit",
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  tableName: varchar("table_name", { length: 100 }).notNull(),
  recordId: uuid("record_id").notNull(),
  action: auditActionEnum("action").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  changedBy: uuid("changed_by").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
  reason: text("reason"),
  ipAddress: varchar("ip_address", { length: 45 }),
});
