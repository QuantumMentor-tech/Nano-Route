/**
 * Nano Route — Privacy & Data Governance Center Types
 * File: src/features/privacy-center/types.ts
 *
 * Implements Step 88:
 * - Data classification taxonomy (PUBLIC, INTERNAL, USER_CONTENT, SENSITIVE, SECRET, OPERATIONAL)
 * - Data flow boundaries (LOCAL_ONLY, REMOTE_ON_SUBMIT, OPERATIONAL_METADATA)
 * - Overall privacy posture (LOCAL_FIRST, PROTECTED, ATTENTION_REQUIRED, UNKNOWN)
 * - Normalized inventory, data lifecycle disclosures, retention summaries, and diagnostic contracts
 */

import type { DataCategory } from "../../services/ipc/types.ts";

/**
 * Strict Step 88 Data Sensitivity Classifications
 */
export type PrivacyClassification =
  | "PUBLIC"
  | "INTERNAL"
  | "USER_CONTENT"
  | "SENSITIVE"
  | "SECRET"
  | "OPERATIONAL";

/**
 * Transmission Boundary Classification
 */
export type DataFlowBoundary =
  | "LOCAL_ONLY"
  | "REMOTE_ON_SUBMIT"
  | "OPERATIONAL_METADATA";

/**
 * High-Level Privacy Posture
 */
export type PrivacyPosture =
  | "LOCAL_FIRST"
  | "PROTECTED"
  | "ATTENTION_REQUIRED"
  | "UNKNOWN";

/**
 * Normalized Category Record for the Data Inventory Table
 */
export interface DataInventoryCategoryRecord {
  id: string;
  name: string;
  dataCategory: DataCategory;
  classification: PrivacyClassification;
  dataFlow: DataFlowBoundary;
  storageLocationDescription: string;
  retentionDescription: string;
  recordCount: number;
  isDeletable: boolean;
  isExportable: boolean;
  isUserSelectableInRequest: boolean;
  description: string;
}

/**
 * Transparent Feature-by-Feature Data Flow Disclosure
 */
export interface DataFlowDisclosure {
  featureId: string;
  featureName: string;
  localBehavior: string;
  transmissionTrigger: string;
  remoteDestination: string;
  userControlAdvice: string;
  neverTransmittedNote: string;
}

/**
 * Privacy Diagnostics and Invariant Health Check
 */
export interface PrivacyDiagnosticsSummary {
  credentialProtectionOk: boolean;
  secretIsolationOk: boolean;
  telemetryContentExcluded: boolean;
  diagnosticsSanitized: boolean;
  retentionConfigured: boolean;
  localFirstIntegrityOk: boolean;
  unresolvedWarningsCount: number;
  unresolvedCriticalCount: number;
  posture: PrivacyPosture;
  findings: string[];
}

/**
 * Retention and Housekeeping Summary
 */
export interface PrivacyRetentionSummary {
  historyRetentionEnabled: boolean;
  historyRetentionDays: number;
  telemetryRetentionEnabled: boolean;
  telemetryRetentionDays: number;
  pinnedSessionsExcluded: boolean;
  cleanupConfirmationRequired: boolean;
  storageSemanticsDisclosure: string;
  providerBoundaryDisclosure: string;
}

/**
 * Export and Reset Capability Disclosures
 */
export interface PrivacyExportResetDisclosure {
  exportableCategories: string[];
  strictlyExcludedFromExport: string[];
  availableResetScopes: Array<{
    id: string;
    title: string;
    description: string;
    confirmationRequired: boolean;
    reversible: boolean;
  }>;
  fullWipeSupported: boolean;
}

/**
 * Unified Snapshot for the Privacy & Data Governance Center UI
 */
export interface PrivacyCenterSnapshot {
  generatedAtMs: number;
  posture: PrivacyPosture;
  inventory: DataInventoryCategoryRecord[];
  flows: DataFlowDisclosure[];
  diagnostics: PrivacyDiagnosticsSummary;
  retention: PrivacyRetentionSummary;
  exportReset: PrivacyExportResetDisclosure;
  storageSemanticsNote: string;
  providerBoundaryNote: string;
  totalRecordsCount: number;
  sensitiveCategoriesCount: number;
  secretsProtectedCount: number;
}
