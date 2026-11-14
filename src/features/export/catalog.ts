/**
 * Nano Route — User Data Export Catalog & Privacy Classification
 * File: src/features/export/catalog.ts
 *
 * Implements Step 70 authoritative export category descriptors,
 * strict field allowlists, excluded secret properties, and privacy warnings.
 */

import {
  type ExportCategory,
  type ExportCategoryDescriptor,
  type DataClassification,
} from "./types.ts";

export const EXPORT_CATEGORIES_CATALOG: Readonly<Record<ExportCategory, ExportCategoryDescriptor>> = Object.freeze({
  chat_history: {
    category: "chat_history",
    displayName: "Chat Conversations & Messages",
    shortDescription: "Export user-submitted prompts, assistant responses, session titles, timestamps, and model attribution.",
    classification: "USER_CONTENT",
    sensitivityLabel: "Private Content",
    includedFields: [
      "session.id",
      "session.title",
      "session.createdAt",
      "session.updatedAt",
      "session.pinned",
      "message.id",
      "message.sessionId",
      "message.role",
      "message.content",
      "message.createdAt",
      "message.metadata.provider",
      "message.metadata.model",
      "message.metadata.totalTokens",
      "message.metadata.latencyMs",
    ],
    excludedFields: [
      "rawSqlitePagePointers",
      "inFlightTaskHandles",
      "streamCancellationTokens",
      "unsentDraftBuffers",
    ],
    defaultSelected: true,
    hasUserContent: true,
    warningNotice: "Chat history contains your personal prompt submissions and AI assistant replies. Store exported files securely.",
  },

  user_preferences: {
    category: "user_preferences",
    displayName: "User Interface Preferences",
    shortDescription: "Export visual theme, font scaling, density, animations, and non-sensitive UI options.",
    classification: "USER_CONFIGURATION",
    sensitivityLabel: "Configuration",
    includedFields: [
      "appearance.theme_mode",
      "appearance.density",
      "appearance.reduced_motion",
      "appearance.text_scale",
      "appearance.enhanced_focus",
      "workspace.startup_route",
      "workspace.sidebar_collapsed",
      "workspace.confirm_chat_clear",
      "chat.show_timestamps",
      "chat.compact_spacing",
      "chat.enter_to_send",
      "chat.auto_scroll_to_bottom",
      "notifications.enable_non_critical_toasts",
      "notifications.toast_duration_ms",
      "palette.show_descriptions",
      "palette.show_shortcuts",
      "routing.preference_mode",
      "telemetry.enabled",
      "window.start_maximized",
    ],
    excludedFields: [
      "provider_api_keys",
      "dpapi_credentials",
      "master_encryption_keys",
      "system_machine_guid",
    ],
    defaultSelected: true,
    hasUserContent: false,
  },

  workspace_profiles: {
    category: "workspace_profiles",
    displayName: "Custom Workspace Profiles",
    shortDescription: "Export user-created layout presets, focus profiles, and accessibility workspace definitions.",
    classification: "USER_CONFIGURATION",
    sensitivityLabel: "Configuration",
    includedFields: [
      "profile.id",
      "profile.name",
      "profile.description",
      "profile.isBuiltin",
      "profile.createdAt",
      "profile.preferences",
    ],
    excludedFields: [
      "credentials",
      "bearer_tokens",
      "user_conversation_text",
    ],
    defaultSelected: true,
    hasUserContent: false,
  },

  telemetry_and_analytics: {
    category: "telemetry_and_analytics",
    displayName: "Telemetry & Cost Analytics",
    shortDescription: "Export aggregated token consumption, estimated monetary savings, request durations, and provider metrics.",
    classification: "ANALYTICS_DATA",
    sensitivityLabel: "Analytics",
    includedFields: [
      "record.id",
      "record.occurredAt",
      "record.eventType",
      "record.providerId",
      "record.modelId",
      "record.totalTokens",
      "record.promptTokens",
      "record.completionTokens",
      "record.estimatedCostUsd",
      "record.durationMs",
      "record.outcome",
      "record.routingConfidence",
    ],
    excludedFields: [
      "prompt_text",
      "completion_text",
      "session_name",
      "client_ip_address",
      "mac_address",
      "device_identifiers",
    ],
    defaultSelected: true,
    hasUserContent: false,
    warningNotice: "Usage analytics reflect provider call frequencies, token numbers, and cost calculations.",
  },

  provider_registry_metadata: {
    category: "provider_registry_metadata",
    displayName: "Provider Catalog & Capabilities",
    shortDescription: "Export non-sensitive provider specifications, supported model IDs, context windows, and availability status.",
    classification: "METADATA_ONLY",
    sensitivityLabel: "Public Metadata",
    includedFields: [
      "provider.id",
      "provider.displayName",
      "provider.defaultModelId",
      "provider.isConfigured",
      "provider.isActive",
      "model.id",
      "model.displayName",
      "model.contextWindow",
    ],
    excludedFields: [
      "apiKey",
      "dpapiCiphertext",
      "authorizationHeader",
      "privateWebhookSecret",
      "customBaseUrlWithEmbeddedCredentials",
    ],
    defaultSelected: false,
    hasUserContent: false,
  },
});

/**
 * Universal Data Inventory Classification Map.
 * Documents every local data artifact in Nano Route and whether it may be exported.
 */
export interface LocalDataEntityClassification {
  entityName: string;
  storageTarget: "SQLite" | "DPAPI Vault" | "LocalStorage" | "Memory" | "Disk Files";
  classification: DataClassification;
  isExportable: boolean;
  notes: string;
}

export const LOCAL_DATA_INVENTORY_MAP: readonly LocalDataEntityClassification[] = Object.freeze([
  {
    entityName: "Chat Sessions & Messages",
    storageTarget: "SQLite",
    classification: "USER_CONTENT",
    isExportable: true,
    notes: "Exportable under category 'chat_history'. Contains prompt and response texts.",
  },
  {
    entityName: "FTS5 Search Index",
    storageTarget: "SQLite",
    classification: "SYSTEM_INTERNAL",
    isExportable: false,
    notes: "Internal derivative index of messages; omitted from export to avoid duplication.",
  },
  {
    entityName: "Telemetry & Event Logs",
    storageTarget: "SQLite",
    classification: "ANALYTICS_DATA",
    isExportable: true,
    notes: "Exportable under category 'telemetry_and_analytics'. Zero user prompt content stored.",
  },
  {
    entityName: "UI & Presentation Preferences",
    storageTarget: "SQLite",
    classification: "USER_CONFIGURATION",
    isExportable: true,
    notes: "Exportable under category 'user_preferences'. Only safe allowlisted keys included.",
  },
  {
    entityName: "Workspace Profiles",
    storageTarget: "SQLite",
    classification: "USER_CONFIGURATION",
    isExportable: true,
    notes: "Exportable under category 'workspace_profiles'.",
  },
  {
    entityName: "Provider Catalog Metadata",
    storageTarget: "SQLite",
    classification: "METADATA_ONLY",
    isExportable: true,
    notes: "Exportable under category 'provider_registry_metadata'.",
  },
  {
    entityName: "Provider API Keys & DPAPI Ciphertexts",
    storageTarget: "DPAPI Vault",
    classification: "SECRET",
    isExportable: false,
    notes: "STRICTLY FORBIDDEN. Credentials and ciphertexts are never exported under any condition.",
  },
  {
    entityName: "Session Continuity Snapshots",
    storageTarget: "SQLite",
    classification: "SYSTEM_INTERNAL",
    isExportable: false,
    notes: "Ephemeral UI route/window restoration state; omitted from data portability exports.",
  },
  {
    entityName: "Onboarding Progress Markers",
    storageTarget: "LocalStorage",
    classification: "SYSTEM_INTERNAL",
    isExportable: false,
    notes: "Internal setup wizard state; omitted from data portability exports.",
  },
  {
    entityName: "SQLite WAL & Journal Files",
    storageTarget: "Disk Files",
    classification: "SYSTEM_INTERNAL",
    isExportable: false,
    notes: "Low-level database transaction engine internals.",
  },
  {
    entityName: "Backup DB Archives (*.db)",
    storageTarget: "Disk Files",
    classification: "SYSTEM_INTERNAL",
    isExportable: false,
    notes: "Managed separately via Step 53 Disaster Recovery. Not part of user data export packages.",
  },
]);

/**
 * List of forbidden field names that must never be present in an exported package.
 */
export const FORBIDDEN_SECRET_KEYS: readonly string[] = Object.freeze([
  "api_key",
  "apikey",
  "apiKey",
  "password",
  "secret",
  "token",
  "authorization",
  "dpapi",
  "credential",
  "private_key",
  "ciphertext",
]);

