import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  serial,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./organizations";

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "approve",
  "reject",
  "submit",
]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    // Company scope is required for multi-tenant isolation: the RLS policy in
    // 0002_rls_policies.sql filters audit_logs on company_id.
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
    tableName: varchar("table_name", { length: 100 }).notNull(),
    recordId: uuid("record_id").notNull(),
    action: auditActionEnum("action").notNull(),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    changedBy: uuid("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
    reason: text("reason"),
    ipAddress: varchar("ip_address", { length: 45 }),
  },
  (table) => ({
    companyIdx: index("idx_audit_logs_company").on(table.companyId),
    recordIdx: index("idx_audit_logs_record").on(table.tableName, table.recordId),
  })
);
