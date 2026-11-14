/**
 * Nano Route — Data Health Monitoring & Preventive Maintenance Domain Types
 * File: src/features/maintenance/types.ts
 *
 * Implements Step 73 authoritative maintenance domains, health check descriptors,
 * health status states, thresholds, and safe housekeeping contracts.
 */

/**
 * Concrete maintenance domains present in Nano Route.
 */
export type MaintenanceDomain =
  | "DATABASE"
  | "SEARCH_INDEX"
  | "TELEMETRY"
  | "ANALYTICS_CACHE"
  | "NOTIFICATION_STATE"
  | "SESSION_STATE"
  | "IMPORT_STATE"
  | "TEMPORARY_FILES"
  | "DIAGNOSTIC_ARTIFACTS"
  | "LOG_RETENTION"
  | "PROFILE_METADATA";

/**
 * Objective health status classifications for preventive maintenance.
 */
export type MaintenanceHealthStatus =
  | "HEALTHY"
  | "HEALTHY_WITH_LIMITATIONS"
  | "ATTENTION_REQUIRED"
  | "MAINTENANCE_RECOMMENDED"
  | "MAINTENANCE_BLOCKED"
  | "CRITICAL"
  | "UNKNOWN";

/**
 * Scope modes for running maintenance checks.
 */
export type MaintenanceExecutionMode =
  | "QUICK"
  | "FULL"
  | "CONDITIONAL";

/**
 * Authoritative identifiers for registered safe maintenance actions.
 */
export type MaintenanceActionId =
  | "CLEANUP_STALE_TEMP_FILES"
  | "PRUNE_EXPIRED_NOTIFICATIONS"
  | "REBUILD_SEARCH_INDEX"
  | "REFRESH_ANALYTICS_CACHE"
  | "CLEAR_ABANDONED_IMPORT_MARKERS"
  | "PRUNE_STALE_SESSION_SNAPSHOTS"
  | "OPTIMIZE_DATABASE_PAGES";

/**
 * Classification of maintenance actions.
 */
export type MaintenanceActionClassification =
  | "SAFE_HOUSEKEEPING"
  | "REGENERATIVE"
  | "STORAGE_RECLAMATION"
  | "CONFIGURATION_PRUNING";

/**
 * Formal descriptor defining a preventive maintenance check invariant.
 */
export interface MaintenanceCheckDescriptor {
  id: string;
  domain: MaintenanceDomain;
  name: string;
  purpose: string;
  trigger: "manual" | "startup_lightweight" | "periodic_low_frequency";
  thresholdSummary: string;
  recommendedActionId?: MaintenanceActionId;
  automaticAllowed: boolean;
}

/**
 * Evaluation finding result for a specific maintenance check.
 */
export interface MaintenanceCheckFinding {
  checkId: string;
  domain: MaintenanceDomain;
  name: string;
  status: MaintenanceHealthStatus;
  summary: string;
  evidence: Record<string, unknown>;
  thresholdExceeded: boolean;
  recommendedActionId?: MaintenanceActionId;
  actionAvailable: boolean;
  automaticAllowed: boolean;
  dataPreservedSummary: string;
  durationMs: number;
}

/**
 * Action specification defining an approved housekeeping operation.
 */
export interface MaintenanceActionDescriptor {
  actionId: MaintenanceActionId;
  name: string;
  description: string;
  classification: MaintenanceActionClassification;
  preconditions: string[];
  affectedData: string;
  preservedData: string;
  automaticAllowed: boolean;
  backupRecommended: boolean;
  targetCheckId: string;
}

/**
 * Execution outcome of an individual maintenance operation.
 */
export interface MaintenanceActionResult {
  actionId: MaintenanceActionId;
  success: boolean;
  message: string;
  durationMs: number;
  itemsCleanedCount?: number;
  bytesReclaimed?: number;
  postVerificationPassed: boolean;
  followUpStatus: MaintenanceHealthStatus;
  backupCreated?: boolean;
  backupId?: string;
  error?: string;
}

/**
 * Overall summary report across a preventive maintenance evaluation run.
 */
export interface MaintenanceRunSummary {
  runId: string;
  mode: MaintenanceExecutionMode;
  executedAtMs: number;
  durationMs: number;
  overallHealth: MaintenanceHealthStatus;
  counts: {
    totalChecks: number;
    healthy: number;
    attentionRequired: number;
    maintenanceRecommended: number;
    blocked: number;
    critical: number;
  };
  findings: MaintenanceCheckFinding[];
  actionableRecommendations: MaintenanceActionId[];
  isMaintenanceRecommended: boolean;
}

/**
 * Record of a completed maintenance action.
 */
export interface MaintenanceHistoryEntry {
  operationId: string;
  actionId: MaintenanceActionId;
  timestamp: number;
  status: "COMPLETED" | "FAILED" | "CANCELLED";
  durationMs: number;
  safeSummary: string;
  itemsProcessed: number;
}

