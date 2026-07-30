import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type {
  companies,
  sites,
  facilities,
  productionLines,
  equipment,
} from "@/lib/db/schema/organizations";
import type { users, userSiteAccess } from "@/lib/db/schema/users";
import type { emissionSources } from "@/lib/db/schema/emission-sources";
import type { emissionFactorSets, emissionFactors } from "@/lib/db/schema/emission-factors";
import type {
  emissionRecords,
  emissionRecordAttachments,
} from "@/lib/db/schema/emission-records";
import type { scope3Categories, supplierEmissions, scope3Records } from "@/lib/db/schema/scope3";
import type { auditLogs } from "@/lib/db/schema/audit-trail";
import type {
  workflowDefinitions,
  workflowInstances,
  workflowSteps,
} from "@/lib/db/schema/workflows";
import type { reports } from "@/lib/db/schema/reports";
import type { suppliers, supplierDataRequests } from "@/lib/db/schema/suppliers";
import type { reductionTargets, targetProgress } from "@/lib/db/schema/targets";
import type { unitConversions } from "@/lib/db/schema/unit-conversions";

// Companies & Organizations
export type Company = InferSelectModel<typeof companies>;
export type NewCompany = InferInsertModel<typeof companies>;
export type Site = InferSelectModel<typeof sites>;
export type NewSite = InferInsertModel<typeof sites>;
export type Facility = InferSelectModel<typeof facilities>;
export type NewFacility = InferInsertModel<typeof facilities>;
export type ProductionLine = InferSelectModel<typeof productionLines>;
export type NewProductionLine = InferInsertModel<typeof productionLines>;
export type Equipment = InferSelectModel<typeof equipment>;
export type NewEquipment = InferInsertModel<typeof equipment>;

// Users
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type UserSiteAccess = InferSelectModel<typeof userSiteAccess>;
export type NewUserSiteAccess = InferInsertModel<typeof userSiteAccess>;

// Emission Sources
export type EmissionSource = InferSelectModel<typeof emissionSources>;
export type NewEmissionSource = InferInsertModel<typeof emissionSources>;

// Emission Factors
export type EmissionFactorSet = InferSelectModel<typeof emissionFactorSets>;
export type NewEmissionFactorSet = InferInsertModel<typeof emissionFactorSets>;
export type EmissionFactor = InferSelectModel<typeof emissionFactors>;
export type NewEmissionFactor = InferInsertModel<typeof emissionFactors>;

// Emission Records
export type EmissionRecord = InferSelectModel<typeof emissionRecords>;
export type NewEmissionRecord = InferInsertModel<typeof emissionRecords>;
export type EmissionRecordAttachment = InferSelectModel<typeof emissionRecordAttachments>;
export type NewEmissionRecordAttachment = InferInsertModel<typeof emissionRecordAttachments>;

// Scope 3
export type Scope3Category = InferSelectModel<typeof scope3Categories>;
export type SupplierEmission = InferSelectModel<typeof supplierEmissions>;
export type NewSupplierEmission = InferInsertModel<typeof supplierEmissions>;
export type Scope3Record = InferSelectModel<typeof scope3Records>;
export type NewScope3Record = InferInsertModel<typeof scope3Records>;

// Audit Trail
export type AuditLog = InferSelectModel<typeof auditLogs>;

// Workflows
export type WorkflowDefinition = InferSelectModel<typeof workflowDefinitions>;
export type NewWorkflowDefinition = InferInsertModel<typeof workflowDefinitions>;
export type WorkflowInstance = InferSelectModel<typeof workflowInstances>;
export type NewWorkflowInstance = InferInsertModel<typeof workflowInstances>;
export type WorkflowStep = InferSelectModel<typeof workflowSteps>;
export type NewWorkflowStep = InferInsertModel<typeof workflowSteps>;

// Reports
export type Report = InferSelectModel<typeof reports>;
export type NewReport = InferInsertModel<typeof reports>;

// Suppliers
export type Supplier = InferSelectModel<typeof suppliers>;
export type NewSupplier = InferInsertModel<typeof suppliers>;
export type SupplierDataRequest = InferSelectModel<typeof supplierDataRequests>;
export type NewSupplierDataRequest = InferInsertModel<typeof supplierDataRequests>;

// Targets
export type ReductionTarget = InferSelectModel<typeof reductionTargets>;
export type NewReductionTarget = InferInsertModel<typeof reductionTargets>;
export type TargetProgress = InferSelectModel<typeof targetProgress>;
export type NewTargetProgress = InferInsertModel<typeof targetProgress>;

// Unit Conversions
export type UnitConversion = InferSelectModel<typeof unitConversions>;
export type NewUnitConversion = InferInsertModel<typeof unitConversions>;
