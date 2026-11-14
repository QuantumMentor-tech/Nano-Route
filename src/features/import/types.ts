/**
 * Nano Route — User Data Import & Migration Assistant Domain Types
 * File: src/features/import/types.ts
 *
 * Implements Step 71 typed import contracts, schema definitions, validation
 * statuses, conflict strategies, import plan, and execution telemetry.
 */

import {
  EXPORT_PACKAGE_FORMAT,
  EXPORT_SCHEMA_VERSION,
  type ExportManifest,
} from "../export/types.ts";

export { EXPORT_PACKAGE_FORMAT, EXPORT_SCHEMA_VERSION };

/**
 * Maximum import payload size: 20MB.
 * Prevents memory exhaustion attacks (DoS) from oversized untrusted files.
 */
export const MAX_IMPORT_PAYLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Authoritative Step 71 Import Categories.
 * Matches exportable entities from Step 70 that can be ingested locally.
 */
export type ImportCategory =
  | "chat_history"
  | "user_preferences"
  | "workspace_profiles"
  | "telemetry_and_analytics";

/**
 * Validation status of an untrusted file during pre-flight analysis.
 */
export type ImportValidationStatus =
  | "VALID"
  | "COMPATIBLE_WITH_WARNINGS"
  | "INCOMPATIBLE"
  | "MALFORMED";

/**
 * Conflict resolution strategies for handling existing entities.
 */
export type ConflictStrategy =
  | "SKIP_DUPLICATES"
  | "IMPORT_AS_NEW"
  | "KEEP_EXISTING";

/**
 * Detailed conflict statistics per category.
 */
export interface CategoryConflictSummary {
  category: ImportCategory;
  totalRecordsInPackage: number;
  conflictingCount: number;
  identicalCount: number;
  newCount: number;
  conflictDetails: string[];
}

/**
 * Category-level execution plan generated during the preview phase.
 */
export interface CategoryImportPlan {
  category: ImportCategory;
  selected: boolean;
  totalInPackage: number;
  toImportCount: number;
  toSkipCount: number;
  conflictsCount: number;
  strategy: ConflictStrategy;
  requiresReindex?: boolean;
}

/**
 * Full import preview provided to the user before any mutations occur.
 */
export interface ImportPreview {
  isValid: boolean;
  validationStatus: ImportValidationStatus;
  format: string;
  sourceApp: string;
  sourceAppVersion: string;
  exportedAtIso?: string;
  sourceManifest?: ExportManifest;
  availableCategories: ImportCategory[];
  plans: Record<ImportCategory, CategoryImportPlan>;
  conflicts: Record<ImportCategory, CategoryConflictSummary>;
  preflightErrors: string[];
  preflightWarnings: string[];
  payloadSizeBytes: number;
  secretsDetectedCount: number;
  strippedSecretsCount: number;
}

/**
 * User configuration options for the execution phase.
 */
export interface ImportExecutionConfig {
  selectedCategories: ImportCategory[];
  conflictStrategies: Record<ImportCategory, ConflictStrategy>;
  createSafetyBackup: boolean;
  rebuildSearchIndex: boolean;
}

/**
 * Post-import category result.
 */
export interface CategoryImportResult {
  category: ImportCategory;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Final execution report for an import operation.
 */
export interface ImportExecutionResult {
  success: boolean;
  backupCreated: boolean;
  backupId?: string;
  categories: Record<ImportCategory, CategoryImportResult>;
  totalImported: number;
  totalSkipped: number;
  durationMs: number;
  reindexSuccess?: boolean;
  verificationPassed: boolean;
  verificationReport: string;
  errors: string[];
  warnings: string[];
}
