/**
 * Nano Route — Post-Import Reconciliation & Data Integrity Domain Types
 * File: src/features/integrity/types.ts
 *
 * Implements Step 72 authoritative integrity domains, test results,
 * severity classifications, status models, and repair contracts.
 */

/**
 * Concrete integrity verification domains present in Nano Route.
 */
export type IntegrityDomain =
  | "DATABASE"
  | "HISTORY"
  | "SEARCH_INDEX"
  | "PREFERENCES"
  | "PROFILES"
  | "SESSION_STATE"
  | "TELEMETRY"
  | "TOKEN_USAGE"
  | "COST"
  | "SAVINGS"
  | "LATENCY"
  | "PROVIDER_METADATA"
  | "MODEL_METADATA"
  | "IMPORT_STATE";

/**
 * Strict result states for integrity evaluations.
 */
export type IntegrityResultStatus =
  | "PASS"
  | "PASS_WITH_WARNING"
  | "NOT_CHECKED"
  | "NOT_APPLICABLE"
  | "INCONSISTENT"
  | "CORRUPT"
  | "BLOCKED";

/**
 * Objective severity rating for any identified finding.
 */
export type IntegritySeverity =
  | "INFORMATIONAL"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

/**
 * Classification of safe repair operations.
 */
export type RepairClassification =
  | "NON_DESTRUCTIVE"
  | "REGENERATIVE"
  | "CONFIGURATION_CHANGING"
  | "DATA_MUTATING";

/**
 * Supported execution scopes for the reconciliation engine.
 */
export type IntegrityExecutionMode =
  | "QUICK"
  | "FULL"
  | "TARGETED";

/**
 * Authoritative identifiers for registered safe repairs.
 */
export type RepairId =
  | "REBUILD_SEARCH_INDEX"
  | "REMOVE_ORPHANED_MESSAGES"
  | "REPAIR_INVALID_SESSION_ROUTE"
  | "PRUNE_CORRUPT_PROFILES"
  | "RESET_INVALID_PREFERENCES"
  | "CLEAR_STALE_IMPORT_MARKER";

/**
 * Descriptor defining a concrete check invariant.
 */
export interface IntegrityCheckDescriptor {
  id: string;
  domain: IntegrityDomain;
  name: string;
  purpose: string;
  expectedInvariant: string;
  severity: IntegritySeverity;
  dependencies: string[];
  supportedRepairId?: RepairId;
  recoveryRecommendedOnFail?: boolean;
}

/**
 * The evaluation result of an individual integrity check.
 */
export interface IntegrityCheckResult {
  checkId: string;
  domain: IntegrityDomain;
  name: string;
  status: IntegrityResultStatus;
  severity: IntegritySeverity;
  summary: string;
  evidence: Record<string, unknown>;
  suggestedAction?: string;
  repairAvailable?: boolean;
  supportedRepairId?: RepairId;
  recoveryRequired?: boolean;
  executedAtMs: number;
  durationMs: number;
}

/**
 * Descriptor defining an approved safe repair action.
 */
export interface RepairActionDescriptor {
  repairId: RepairId;
  name: string;
  description: string;
  classification: RepairClassification;
  preconditions: string[];
  affectedData: string;
  preservedData: string;
  backupRecommended: boolean;
  targetCheckId: string;
}

/**
 * Detailed preview shown to the user before repair execution.
 */
export interface RepairPreview {
  repairId: RepairId;
  name: string;
  classification: RepairClassification;
  issueSummary: string;
  affectedDataDescription: string;
  preservedDataDescription: string;
  backupRecommended: boolean;
}

/**
 * Execution outcome of an applied repair.
 */
export interface RepairExecutionResult {
  repairId: RepairId;
  success: boolean;
  message: string;
  durationMs: number;
  postVerificationPassed: boolean;
  followUpStatus: IntegrityResultStatus;
  backupCreated?: boolean;
  backupId?: string;
  error?: string;
}

/**
 * Overall summary report across an entire integrity verification run.
 */
export interface IntegrityRunReport {
  runId: string;
  mode: IntegrityExecutionMode;
  startedAtMs: number;
  completedAtMs: number;
  totalDurationMs: number;
  domainsChecked: IntegrityDomain[];
  overallStatus: IntegrityResultStatus;
  counts: {
    totalChecks: number;
    passed: number;
    warnings: number;
    inconsistent: number;
    corrupt: number;
    blocked: number;
  };
  results: IntegrityCheckResult[];
  availableRepairs: RepairId[];
  recoveryRecommended: boolean;
  recoveryReason?: string;
}

