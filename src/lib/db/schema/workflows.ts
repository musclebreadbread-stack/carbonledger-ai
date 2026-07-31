import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const workflowStatusEnum = pgEnum("workflow_status", [
  "pending",
  "in_progress",
  "approved",
  "rejected",
]);

export const workflowDefinitions = pgTable("workflow_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  steps: jsonb("steps").notNull(),
  companyId: uuid("company_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workflowInstances = pgTable(
  "workflow_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => workflowDefinitions.id, { onDelete: "cascade" }),
    recordType: varchar("record_type", { length: 100 }).notNull(),
    recordId: uuid("record_id").notNull(),
    currentStep: integer("current_step").default(0).notNull(),
    status: workflowStatusEnum("status").default("pending").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    definitionIdx: index("idx_workflow_instances_definition_id").on(table.definitionId),
  })
);

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    instanceId: uuid("instance_id")
      .notNull()
      .references(() => workflowInstances.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    assigneeId: uuid("assignee_id").references(() => users.id),
    action: varchar("action", { length: 50 }),
    comment: text("comment"),
    digitalSignature: text("digital_signature"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    instanceIdx: index("idx_workflow_steps_instance_id").on(table.instanceId),
  })
);

export const workflowDefinitionsRelations = relations(workflowDefinitions, ({ many }) => ({
  instances: many(workflowInstances),
}));

export const workflowInstancesRelations = relations(workflowInstances, ({ one, many }) => ({
  definition: one(workflowDefinitions, {
    fields: [workflowInstances.definitionId],
    references: [workflowDefinitions.id],
  }),
  steps: many(workflowSteps),
  creator: one(users, { fields: [workflowInstances.createdBy], references: [users.id] }),
}));

export const workflowStepsRelations = relations(workflowSteps, ({ one }) => ({
  instance: one(workflowInstances, {
    fields: [workflowSteps.instanceId],
    references: [workflowInstances.id],
  }),
  assignee: one(users, { fields: [workflowSteps.assigneeId], references: [users.id] }),
}));
