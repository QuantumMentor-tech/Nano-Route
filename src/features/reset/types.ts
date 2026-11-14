/**
 * Nano Route — Application Reset & Factory Defaults Domain Types
 * File: src/features/reset/types.ts
 *
 * Implements Step 69 typed reset taxonomy, safety classifications,
 * operation scopes, precondition contracts, and execution models.
 */

export const RESET_SCHEMA_VERSION = 1;

/**
 * Authoritative Step 69 Reset Taxonomy.
 * Strict boundaries: each operation has a deterministic, non-conflated scope.
 */
export type ResetOperationType =
  | "RESET_PREFERENCES"
  | "RESET_WORKSPACE"
  | "RESET_SESSION_STATE"
  | "REMOVE_PROVIDER_CREDENTIAL"
  | "RESET_APPLICATION_CONFIGURATION"
  | "CLEAR_SELECTED_USER_DATA"
  | "FULL_LOCAL_DATA_RESET"
  | "FACTORY_RESET";

/**
 * Reset Operation Safety Classification.
 * Determines required confirmations, warnings, and recovery requirements.
 */
export type ResetClassification =
  | "NON_DESTRUCTIVE_RESET"
  | "CONFIGURATION_RESET"
  | "DATA_DELETION"
  | "SECURITY_SENSITIVE"
  | "IRREVERSIBLE_OR_PRACTICALLY_IRREVERSIBLE";

/**
 * Lifecycle status of an active or completed reset operation.
 */
export type ResetOperationStatus =
  | "NOT_STARTED"
  | "VALIDATING"
  | "PREPARING"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "BLOCKED";

/**
 * Required confirmation token for Factory Reset.
 */
export const FACTORY_RESET_CONFIRMATION_TOKEN = "FACTORY RESET";

/**
 * Required confirmation token for Full Local Data Wipe (Step 45 parity).
 */
export const FULL_LOCAL_WIPE_TOKEN = "DELETE";

/**
 * Required confirmation token for Application Configuration Reset.
 */
export const CONFIG_RESET_TOKEN = "RESET CONFIG";

/**
 * Authoritative scope definition metadata for a reset operation.
 */
export interface ResetScopeDefinition {
  operation: ResetOperationType;
  displayName: string;
  shortDescription: string;
  classification: ResetClassification;
  willChange: string[];
  willBeDeleted: string[];
  willRemain: string[];
  cannotBeRecoveredAutomatically: string[];
  recoveryOption: string;
  requiresTypedToken: boolean;
  expectedToken: string | null;
  offersPreResetBackup: boolean;
  requiresApplicationRestart: boolean;
  requiresOnboardingReinitialization: boolean;
}

/**
 * Precondition verification result evaluated prior to any reset execution.
 */
export interface ResetPreconditionResult {
  canProceed: boolean;
  blockReason: string | null;
  activeExecutionsCount: number;
  activeDatabaseWrite: boolean;
  activePromptStreaming: boolean;
  isUpdateActive: boolean;
  isRestoreActive: boolean;
  isBackupActive: boolean;
}

/**
 * Request payload to initiate a controlled reset operation.
 */
export interface ResetExecutionRequest {
  operation: ResetOperationType;
  confirmed: boolean;
  typedToken?: string;
  providerId?: string; // Required for REMOVE_PROVIDER_CREDENTIAL
  userDataScope?: "history_only" | "telemetry_only" | "search_index_rebuild"; // For CLEAR_SELECTED_USER_DATA
  createBackupFirst?: boolean;
  backupScope?: "full_database" | "configuration_only" | "safety_snapshot";
}

/**
 * Result report generated upon completion or failure of a reset operation.
 */
export interface ResetExecutionResult {
  operation: ResetOperationType;
  status: ResetOperationStatus;
  startedAtMs: number;
  completedAtMs: number;
  durationMs: number;
  stagesCompleted: string[];
  backupCreatedId?: string;
  backupPath?: string;
  details: Record<string, unknown>;
  verified: boolean;
  verificationMessage: string;
  warnings: string[];
  error?: string;
  requiresRestart: boolean;
  requiresOnboarding: boolean;
}

