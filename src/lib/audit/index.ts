/**
 * Audit Trail Service
 * Implements immutable, append-only audit logging
 */

import { AuditAction, type AuditEntry, type AuditFilter, type AuditReportEntry } from "./types";

export { AuditAction } from "./types";
export type { AuditEntry, AuditFilter, AuditReportEntry } from "./types";

// In-memory store for audit entries (in production, this would be persisted to DB)
const auditStore: AuditEntry[] = [];

/**
 * Create a new audit entry (append-only, immutable)
 */
export function createAuditEntry(
  table: string,
  recordId: string,
  action: AuditAction,
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  userId: string,
  reason?: string,
  metadata?: { company_id?: string; ip_address?: string; user_agent?: string; user_email?: string }
): AuditEntry {
  const entry: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    table_name: table,
    record_id: recordId,
    action,
    old_value: oldValue,
    new_value: newValue,
    user_id: userId,
    user_email: metadata?.user_email,
    company_id: metadata?.company_id || "",
    reason,
    ip_address: metadata?.ip_address,
    user_agent: metadata?.user_agent,
  };

  // Append-only: entries are never modified or deleted
  auditStore.push(Object.freeze(entry) as AuditEntry);
  return entry;
}

/**
 * Get audit history for a specific record
 */
export function getAuditHistory(table: string, recordId: string): AuditEntry[] {
  return auditStore
    .filter((entry) => entry.table_name === table && entry.record_id === recordId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Query audit entries with filters
 */
export function queryAuditEntries(filter: AuditFilter): AuditEntry[] {
  let results = [...auditStore];

  if (filter.table_name) {
    results = results.filter((e) => e.table_name === filter.table_name);
  }
  if (filter.record_id) {
    results = results.filter((e) => e.record_id === filter.record_id);
  }
  if (filter.action) {
    results = results.filter((e) => e.action === filter.action);
  }
  if (filter.user_id) {
    results = results.filter((e) => e.user_id === filter.user_id);
  }
  if (filter.company_id) {
    results = results.filter((e) => e.company_id === filter.company_id);
  }
  if (filter.from_date) {
    results = results.filter((e) => e.timestamp >= filter.from_date!);
  }
  if (filter.to_date) {
    results = results.filter((e) => e.timestamp <= filter.to_date!);
  }

  // Sort by timestamp descending
  results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply pagination
  const offset = filter.offset || 0;
  const limit = filter.limit || 50;
  return results.slice(offset, offset + limit);
}

/**
 * Format audit entries into a readable report
 */
export function formatAuditReport(entries: AuditEntry[]): AuditReportEntry[] {
  return entries.map((entry) => {
    const changes: { field: string; old_value: string; new_value: string }[] = [];

    if (entry.old_value && entry.new_value) {
      const allKeys = new Set([
        ...Object.keys(entry.old_value),
        ...Object.keys(entry.new_value),
      ]);

      for (const key of allKeys) {
        const oldVal = entry.old_value[key];
        const newVal = entry.new_value[key];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push({
            field: key,
            old_value: oldVal !== undefined ? String(oldVal) : "(empty)",
            new_value: newVal !== undefined ? String(newVal) : "(empty)",
          });
        }
      }
    }

    return {
      timestamp: entry.timestamp,
      action: entry.action,
      user: entry.user_email || entry.user_id,
      description: `${entry.action} on ${entry.table_name} (${entry.record_id})`,
      changes,
    };
  });
}

/**
 * Get audit entry count for statistics
 */
export function getAuditCount(filter?: AuditFilter): number {
  if (!filter) return auditStore.length;
  return queryAuditEntries({ ...filter, limit: Number.MAX_SAFE_INTEGER }).length;
}
