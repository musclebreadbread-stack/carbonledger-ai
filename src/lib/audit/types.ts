/**
 * Audit Trail Type Definitions
 */

export enum AuditAction {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  APPROVE = "approve",
  REJECT = "reject",
  SUBMIT = "submit",
  ARCHIVE = "archive",
  RESTORE = "restore",
  LOGIN = "login",
  LOGOUT = "logout",
  EXPORT = "export",
  CALCULATE = "calculate",
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_id: string;
  user_email?: string;
  company_id: string;
  reason?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditReportEntry {
  timestamp: string;
  action: string;
  user: string;
  description: string;
  changes: {
    field: string;
    old_value: string;
    new_value: string;
  }[];
}

export interface AuditFilter {
  table_name?: string;
  record_id?: string;
  action?: AuditAction;
  user_id?: string;
  company_id?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}
