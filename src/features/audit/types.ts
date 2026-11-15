/**
 * Nano Route — Local Audit Trail & Activity Review Domain Types
 * File: src/features/audit/types.ts
 *
 * Implements Step 89:
 * - Authoritative event taxonomy, categories, severities, and outcomes
 * - Structured audit record schema with strict non-content invariants
 * - Filter, query, metric aggregation, and export interfaces
 */

export const AUDIT_SCHEMA_VERSION = 1;

/**
 * Bounded Event Categories
 */
export type AuditEventCategory =
  | "SECURITY"
  | "CREDENTIAL"
  | "PROVIDER"
  | "ROUTING"
  | "BUDGET"
  | "DATA"
  | "PRIVACY"
  | "EXECUTION"
  | "CONNECTIVITY"
  | "RECOVERY"
  | "UPDATE"
  | "DIAGNOSTICS"
  | "MAINTENANCE"
  | "CONFIGURATION"
  | "SYSTEM";

/**
 * Event Severity Semantics
 */
export type AuditEventSeverity =
  | "INFO"
  | "NOTICE"
  | "WARNING"
  | "ERROR"
  | "SECURITY";

/**
 * Standard Operation Outcome
 */
export type AuditEventOutcome =
  | "SUCCESS"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED"
  | "REJECTED"
  | "UNKNOWN";

/**
 * Initiator Identity (No OS personal usernames)
 */
export type AuditEventActor =
  | "USER"
  | "SYSTEM"
  | "TASK"
  | "RECOVERY"
  | "UPDATE"
  | "MAINTENANCE";

/**
 * Authoritative Local Audit Event Record
 */
export interface AuditEvent {
  id: string;
  eventType: string;
  category: AuditEventCategory;
  severity: AuditEventSeverity;
  outcome: AuditEventOutcome;
  actor: AuditEventActor;
  timestamp: number;
  isoTimestamp: string;
  summary: string;
  correlationId?: string;
  sessionId?: string;
  providerId?: string;
  modelId?: string;
  details?: Record<string, string | number | boolean | null>;
  schemaVersion: number;
}

/**
 * Creation Input Parameters for Emitting an Audit Event
 */
export interface CreateAuditEventInput {
  eventType: string;
  category: AuditEventCategory;
  severity?: AuditEventSeverity;
  outcome?: AuditEventOutcome;
  actor?: AuditEventActor;
  summary: string;
  correlationId?: string;
  sessionId?: string;
  providerId?: string;
  modelId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Search and Filtering Parameters
 */
export interface AuditFilterCriteria {
  category?: AuditEventCategory | "ALL";
  severity?: AuditEventSeverity | "ALL";
  outcome?: AuditEventOutcome | "ALL";
  providerId?: string;
  searchQuery?: string;
  startDateMs?: number;
  endDateMs?: number;
  limit?: number;
  offset?: number;
}

/**
 * Aggregated Audit Metrics for the Explorer Dashboard
 */
export interface AuditSummaryMetrics {
  totalEvents: number;
  securityEventsCount: number;
  warningEventsCount: number;
  errorEventsCount: number;
  successRatePercent: number;
  oldestEventTimestampMs: number | null;
  newestEventTimestampMs: number | null;
}

/**
 * Export Package Contract for Audited Events
 */
export interface AuditExportBundle {
  schemaVersion: number;
  exportedAtMs: number;
  totalEvents: number;
  events: AuditEvent[];
  redactionNote: string;
}

