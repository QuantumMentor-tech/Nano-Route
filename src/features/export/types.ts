/**
 * Nano Route — User Data Export & Privacy Portability Domain Types
 * File: src/features/export/types.ts
 *
 * Implements Step 70 typed export categories, data classifications,
 * security allowlists, export manifest, and package contracts.
 */

export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_PACKAGE_FORMAT = "nano-route-export-package-v1";

/**
 * Authoritative Step 70 Export Categories Allowlist.
 * Only explicitly listed categories can ever be exported.
 */
export type ExportCategory =
  | "chat_history"
  | "user_preferences"
  | "workspace_profiles"
  | "telemetry_and_analytics"
  | "provider_registry_metadata";

/**
 * Data Sensitivity & Security Classification.
 */
export type DataClassification =
  | "USER_CONTENT"
  | "USER_CONFIGURATION"
  | "ANALYTICS_DATA"
  | "METADATA_ONLY"
  | "SECRET"
  | "SYSTEM_INTERNAL";

/**
 * Supported Export Serialization Formats.
 */
export type ExportFormat = "json" | "csv" | "json_and_csv";

/**
 * Lifecycle status of an active or completed export operation.
 */
export type ExportOperationStatus =
  | "IDLE"
  | "PREPARING"
  | "COLLECTING"
  | "SERIALIZING"
  | "VALIDATING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

/**
 * Descriptor defining the properties, sensitivity, and fields for an exportable category.
 */
export interface ExportCategoryDescriptor {
  category: ExportCategory;
  displayName: string;
  shortDescription: string;
  classification: DataClassification;
  sensitivityLabel: "Private Content" | "Configuration" | "Analytics" | "Public Metadata";
  includedFields: string[];
  excludedFields: string[];
  defaultSelected: boolean;
  hasUserContent: boolean;
  warningNotice?: string;
}

/**
 * Standardized manifest envelope generated for every export package.
 */
export interface ExportManifest {
  format: string;
  application: string;
  appVersion: string;
  exportSchemaVersion: number;
  exportedAtMs: number;
  exportedAtIso: string;
  categories: ExportCategory[];
  formatType: ExportFormat;
  recordCounts: {
    sessionsCount: number;
    messagesCount: number;
    telemetryCount: number;
    preferencesCount: number;
    profilesCount: number;
    providersCount: number;
  };
  totalEstimatedRecords: number;
  contentWarning?: string;
  checksum: string;
}

/**
 * Full export package payload.
 */
export interface ExportPackage {
  manifest: ExportManifest;
  chat?: {
    sessions: Array<{
      id: string;
      title: string;
      createdAt: number;
      updatedAt: number;
      pinned: boolean;
    }>;
    messages: Array<{
      id: string;
      sessionId: string;
      sender: string;
      content: string;
      createdAt: number;
      provider?: string;
      model?: string;
      tokens?: number;
      latencyMs?: number;
    }>;
  };
  preferences?: Record<string, string>;
  profiles?: Array<{
    id: string;
    name: string;
    description?: string;
    isBuiltin: boolean;
    createdAt: number;
    preferences: Record<string, string>;
  }>;
  telemetry?: Array<{
    id: string;
    occurredAt: number;
    eventType: string;
    providerId?: string;
    modelId?: string;
    totalTokens?: number;
    costUsd?: number;
    latencyMs?: number;
    outcome?: string;
  }>;
  providers?: Array<{
    providerId: string;
    displayName: string;
    defaultModelId?: string;
    credentialRequired: boolean;
    isConfigured: boolean;
  }>;
  csvData?: Record<string, string>;
}

/**
 * Request initiating a selective data export.
 */
export interface ExportExecutionRequest {
  categories: ExportCategory[];
  format: ExportFormat;
  includeTimestamps?: boolean;
}

/**
 * Result returned upon completion or validation of an export operation.
 */
export interface ExportExecutionResult {
  success: boolean;
  status: ExportOperationStatus;
  manifest: ExportManifest;
  packageData: ExportPackage;
  serializedJson?: string;
  csvFiles?: Record<string, string>;
  totalSizeBytes: number;
  durationMs: number;
  verificationPassed: boolean;
  verificationReport: string;
  warnings: string[];
  error?: string;
}

