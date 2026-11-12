/**
//! Nano Route — Step 45 Telemetry Audit, Data Cleanup, Retention & Privacy IPC Service
//! File: src/services/ipc/privacy.ts
//!
//! Responsibility:
//! - Strongly-typed frontend IPC client for local data inventory, integrity auditing,
//!   safe repair, retention policy configuration, dry-run cleanup previews,
//!   controlled cleanup execution, and explicit Full Local Data Wipe.
//! - Deterministic in-memory store coordination across Chat, History, Telemetry,
//!   Settings, and Credential stores for browser dev mode and automated test suites.
//! - Zero exposure of plaintext API keys, encrypted DPAPI blobs, or raw conversation
//!   content in audit/cleanup reports.
*/

import { safeInvoke, isTauriContext, generateRequestId } from "./client.ts";
import { IpcError } from "./errors.ts";
import {
  __internalGetMockChatStore,
  __internalGetActiveMockSessionIds,
  getActiveMockExecutionCount,
} from "./chat.ts";
import {
  __internalGetMockTelemetryStore,
  __internalDeleteMockTelemetryBySession,
} from "./telemetry.ts";
import { __internalGetMockSettingsStore, clearMockSettings } from "./settings.ts";
import {
  __internalGetMockCredentialStore,
  resetCredentialMockStore,
} from "./credentials.ts";
import {
  IPC_COMMANDS,
  type AuditCheckMode,
  type AuditHealthState,
  type ChatMessage,
  type CleanupExecutionRequest,
  type CleanupOperationResult,
  type CleanupPreviewRequest,
  type CleanupPreviewResult,
  type CleanupVerificationStatus,
  type DataAuditFinding,
  type DataAuditReport,
  type DataInventoryItem,
  type DataInventorySnapshot,
  type FullWipePreviewResult,
  type FullWipeReport,
  type FullWipeRequest,
  type OrphanAuditSummary,
  type RetentionPolicyConfig,
  type SafeCredentialInventoryItem,
  type SafeRepairAction,
  type SafeRepairResult,
  type TelemetryConsistencyAuditSummary,
} from "./types.ts";

export const MIN_RETENTION_DAYS = 1;
export const MAX_RETENTION_DAYS = 3650;
export const FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS = 300_000; // 5 minutes
export const FULL_WIPE_CONFIRMATION_TOKEN = "DELETE";

export const STORAGE_SEMANTICS_DISCLOSURE =
  "Removed records are logically deleted from the local SQLite application database. " +
  "SQLite free-page reuse and WAL checkpointing do not constitute cryptographic disk-sector erasure.";

export const PROVIDER_BOUNDARY_DISCLOSURE =
  "Local cleanup and wipe operations remove data stored by Nano Route on this device only. " +
  "Prompts or responses previously transmitted to external AI providers are governed by those providers' own retention policies.";

const KEY_HISTORY_RETENTION_ENABLED = "privacy.history_retention_enabled";
const KEY_HISTORY_RETENTION_DAYS = "privacy.history_retention_days";
const KEY_EXCLUDE_PINNED_SESSIONS = "privacy.exclude_pinned_sessions";
const KEY_TELEMETRY_RETENTION_ENABLED = "privacy.telemetry_retention_enabled";
const KEY_TELEMETRY_RETENTION_DAYS = "privacy.telemetry_retention_days";
const KEY_CLEANUP_CONFIRMATION_REQUIRED = "privacy.cleanup_confirmation_required";
const KEY_LEGACY_HISTORY_RETENTION_DAYS = "history.retention_days";

export const DEFAULT_RETENTION_POLICY: Readonly<RetentionPolicyConfig> = {
  historyRetentionEnabled: false,
  historyRetentionDays: 30,
  excludePinnedSessions: true,
  telemetryRetentionEnabled: false,
  telemetryRetentionDays: 30,
  cleanupConfirmationRequired: true,
};

// ============================================================================
// Mock Store State & Test Hooks (Browser / Node Automated Test Mode Only)
// ============================================================================

export type MockPrivacyFailureTarget =
  | "audit"
  | "repair"
  | "cleanup"
  | "full_wipe"
  | "sqlite_corrupt"
  | null;

let mockOperationInProgress = false;
let mockOrphanedMessages: ChatMessage[] = [];
let mockSearchIndexDriftOffset = 0; // Simulates stale/missing FTS5 entries before rebuild
let mockPrivacyFailureTarget: MockPrivacyFailureTarget = null;

export function setMockPrivacyTestHooks(options: {
  orphanedMessages?: ChatMessage[];
  searchIndexDriftOffset?: number;
  failureTarget?: MockPrivacyFailureTarget;
  operationInProgress?: boolean;
}): void {
  if (options.orphanedMessages !== undefined) {
    mockOrphanedMessages = [...options.orphanedMessages];
  }
  if (options.searchIndexDriftOffset !== undefined) {
    mockSearchIndexDriftOffset = options.searchIndexDriftOffset;
  }
  if (options.failureTarget !== undefined) {
    mockPrivacyFailureTarget = options.failureTarget;
  }
  if (options.operationInProgress !== undefined) {
    mockOperationInProgress = options.operationInProgress;
  }
}

export function resetPrivacyMockState(): void {
  mockOperationInProgress = false;
  mockOrphanedMessages = [];
  mockSearchIndexDriftOffset = 0;
  mockPrivacyFailureTarget = null;
}

// ============================================================================
// Validation Helpers
// ============================================================================

function invalidInputError(message: string): IpcError {
  return new IpcError({
    code: "INVALID_INPUT",
    category: "InvalidInput",
    message,
    retryable: false,
    userActionRequired: true,
  });
}

export function validateRetentionDays(days: number, label = "Retention days"): number {
  if (
    typeof days !== "number" ||
    Number.isNaN(days) ||
    !Number.isFinite(days) ||
    !Number.isInteger(days) ||
    days < MIN_RETENTION_DAYS ||
    days > MAX_RETENTION_DAYS
  ) {
    throw invalidInputError(
      `${label} must be an integer between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days; got ${String(days)}`
    );
  }
  return days;
}

export function validateRetentionPolicyConfig(
  policy: RetentionPolicyConfig
): RetentionPolicyConfig {
  if (!policy || typeof policy !== "object") {
    throw invalidInputError("Retention policy configuration object is required");
  }
  const historyDays = validateRetentionDays(
    policy.historyRetentionDays,
    "History retention days"
  );
  const telemetryDays = validateRetentionDays(
    policy.telemetryRetentionDays,
    "Telemetry retention days"
  );

  return {
    historyRetentionEnabled: Boolean(policy.historyRetentionEnabled),
    historyRetentionDays: historyDays,
    excludePinnedSessions: Boolean(policy.excludePinnedSessions),
    telemetryRetentionEnabled: Boolean(policy.telemetryRetentionEnabled),
    telemetryRetentionDays: telemetryDays,
    cleanupConfirmationRequired: Boolean(policy.cleanupConfirmationRequired),
  };
}

function computeMockCounts(): {
  sessionsCount: number;
  messagesCount: number;
  expectedFtsCount: number;
  actualFtsCount: number;
  telemetryCount: number;
  settingsCount: number;
  credentialsCount: number;
} {
  const chatStore = __internalGetMockChatStore();
  const sessionsCount = chatStore.sessions.size;
  let validMessagesCount = 0;
  for (const msgs of chatStore.messages.values()) {
    validMessagesCount += msgs.length;
  }
  const messagesCount = validMessagesCount + mockOrphanedMessages.length;
  const expectedFtsCount = sessionsCount + validMessagesCount;
  const actualFtsCount = Math.max(0, expectedFtsCount + mockSearchIndexDriftOffset);
  const telemetryCount = __internalGetMockTelemetryStore().length;
  const settingsCount = __internalGetMockSettingsStore().size;
  const credentialsCount = __internalGetMockCredentialStore().size;

  return {
    sessionsCount,
    messagesCount,
    expectedFtsCount,
    actualFtsCount,
    telemetryCount,
    settingsCount,
    credentialsCount,
  };
}

// ============================================================================
// Public Typed IPC Functions
// ============================================================================

/**
 * Retrieves the complete local data inventory and classification snapshot (Sections 4–7).
 */
export async function getDataInventory(): Promise<DataInventorySnapshot> {
  if (!isTauriContext()) {
    const nowMs = Date.now();
    const counts = computeMockCounts();
    const credStore = __internalGetMockCredentialStore();
    const credentials: SafeCredentialInventoryItem[] = Array.from(credStore.values())
      .sort((a, b) => a.providerId.localeCompare(b.providerId))
      .map((c) => ({
        providerId: c.providerId,
        isActive: c.isActive,
        hasCredential: c.isConfigured,
        updatedAt: c.updatedAt,
      }));

    const items: DataInventoryItem[] = [
      {
        storeId: "chat_sessions",
        displayName: "Conversation Sessions",
        tableOrLocation: "chat_sessions",
        category: "user_content",
        deletionPolicy: "retention_eligible",
        recordCount: counts.sessionsCount,
        containsSensitiveData: true,
        includedInRetentionCleanup: true,
        includedInFullWipe: true,
        description:
          "Conversation thread titles, pin flags, and session creation/update timestamps.",
      },
      {
        storeId: "chat_messages",
        displayName: "Conversation Messages",
        tableOrLocation: "chat_messages",
        category: "user_content",
        deletionPolicy: "retention_eligible",
        recordCount: counts.messagesCount,
        containsSensitiveData: true,
        includedInRetentionCleanup: true,
        includedInFullWipe: true,
        description:
          "User prompts, assistant responses, and message-level routing metadata.",
      },
      {
        storeId: "history_search_fts",
        displayName: "Local Search Index (FTS5)",
        tableOrLocation: "history_search_fts",
        category: "search_index",
        deletionPolicy: "rebuildable",
        recordCount: counts.actualFtsCount,
        containsSensitiveData: true,
        includedInRetentionCleanup: true,
        includedInFullWipe: true,
        description:
          "Derived SQLite FTS5 lexical index over local session titles and messages; deterministically rebuildable.",
      },
      {
        storeId: "telemetry_records",
        displayName: "Operational Telemetry Ledger",
        tableOrLocation: "telemetry_records",
        category: "operational_telemetry",
        deletionPolicy: "retention_eligible",
        recordCount: counts.telemetryCount,
        containsSensitiveData: false,
        includedInRetentionCleanup: true,
        includedInFullWipe: true,
        description:
          "Structured routing decisions, execution outcomes, token counts, costs, and latencies (no prompt text).",
      },
      {
        storeId: "app_settings",
        displayName: "Application Preferences & Policies",
        tableOrLocation: "app_settings",
        category: "configuration",
        deletionPolicy: "selectively_deletable",
        recordCount: counts.settingsCount,
        containsSensitiveData: false,
        includedInRetentionCleanup: false,
        includedInFullWipe: true,
        description:
          "User preferences for routing mode, telemetry capture, and local data retention policies.",
      },
      {
        storeId: "api_credentials",
        displayName: "Encrypted Provider Credentials (DPAPI)",
        tableOrLocation: "api_credentials",
        category: "secret",
        deletionPolicy: "credential_sensitive",
        recordCount: counts.credentialsCount,
        containsSensitiveData: true,
        includedInRetentionCleanup: false,
        includedInFullWipe: true,
        description:
          "Windows DPAPI-encrypted provider API keys, custom endpoints, priority weights, and monthly budgets.",
      },
      {
        storeId: "schema_migrations",
        displayName: "Database Schema Metadata",
        tableOrLocation: "schema_migrations / database_metadata",
        category: "application_metadata",
        deletionPolicy: "system_owned",
        recordCount: 6,
        containsSensitiveData: false,
        includedInRetentionCleanup: false,
        includedInFullWipe: false,
        description:
          "System-owned SQLite schema version and migration integrity ledger.",
      },
    ];

    return {
      generatedAtMs: nowMs,
      databasePath: ":memory: (local SQLite simulation)",
      storageSemanticsNote: STORAGE_SEMANTICS_DISCLOSURE,
      providerBoundaryNote: PROVIDER_BOUNDARY_DISCLOSURE,
      items,
      credentials,
      totalUserSessions: counts.sessionsCount,
      totalUserMessages: counts.messagesCount,
      totalTelemetryRecords: counts.telemetryCount,
      totalSearchIndexEntries: counts.actualFtsCount,
      totalConfiguredCredentials: counts.credentialsCount,
      totalAppSettings: counts.settingsCount,
      activeExecutionsCount: getActiveMockExecutionCount(),
    };
  }

  return await safeInvoke<DataInventorySnapshot>(
    IPC_COMMANDS.GET_DATA_INVENTORY,
    {},
    { requestId: generateRequestId() }
  );
}

/**
 * Executes a 100% read-only Quick or Full Integrity & Privacy Audit (Sections 21–26).
 */
export async function runDataAudit(
  mode: AuditCheckMode = "quick"
): Promise<DataAuditReport> {
  if (mode !== "quick" && mode !== "full") {
    throw invalidInputError(`Invalid audit check mode '${String(mode)}'. Allowed: [quick, full]`);
  }

  if (!isTauriContext()) {
    const startMs = Date.now();
    if (mockPrivacyFailureTarget === "audit") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Failed to run SQLite integrity audit",
        retryable: true,
      });
    }

    const nowMs = Date.now();
    const futureLimitMs = nowMs + FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS;
    const chatStore = __internalGetMockChatStore();
    const telemetryRecords = __internalGetMockTelemetryStore();
    const counts = computeMockCounts();

    const findings: DataAuditFinding[] = [];
    const sqliteIntegrityOk = mockPrivacyFailureTarget !== "sqlite_corrupt";
    const sqliteIntegrityMessage = sqliteIntegrityOk
      ? "ok"
      : "database disk image is malformed";

    if (!sqliteIntegrityOk) {
      findings.push({
        code: "SQLITE_INTEGRITY_FAILED",
        severity: "error",
        category: "database_integrity",
        message: `SQLite integrity check reported: ${sqliteIntegrityMessage}`,
        affectedCount: 1,
        safeRepairAvailable: false,
      });
    }

    // Check orphaned messages
    const orphanedMessagesCount = mockOrphanedMessages.length;
    const foreignKeysOk = orphanedMessagesCount === 0;
    if (orphanedMessagesCount > 0) {
      findings.push({
        code: "ORPHANED_MESSAGES_DETECTED",
        severity: "warning",
        category: "orphan_detection",
        message: `Found ${orphanedMessagesCount} message(s) referencing non-existent parent sessions.`,
        affectedCount: orphanedMessagesCount,
        safeRepairAvailable: true,
      });
    }

    // Check empty sessions
    let emptySessionsCount = 0;
    for (const sid of chatStore.sessions.keys()) {
      const msgs = chatStore.messages.get(sid) || [];
      if (msgs.length === 0) {
        emptySessionsCount++;
      }
    }

    // Check FTS search index consistency
    const searchIndexMismatchCount = Math.abs(
      counts.expectedFtsCount - counts.actualFtsCount
    );
    const searchIndexInSync = searchIndexMismatchCount === 0;
    if (!searchIndexInSync) {
      findings.push({
        code: "SEARCH_INDEX_OUT_OF_SYNC",
        severity: "warning",
        category: "search_index",
        message: `Local FTS5 search index has ${searchIndexMismatchCount} out-of-sync entry(ies) (expected ${counts.expectedFtsCount}, found ${counts.actualFtsCount}). Safe rebuild is available.`,
        affectedCount: searchIndexMismatchCount,
        safeRepairAvailable: true,
      });
    }

    // Check telemetry consistency & anomalies
    let unlinkedSessionTelemetryCount = 0;
    let missingTimestampCount = 0;
    let futureTimestampAnomalyCount = 0;
    let negativeLatencyCount = 0;
    let negativeTokenCount = 0;
    let negativeCostCount = 0;
    let invalidConfidenceCount = 0;
    let missingProviderOrModelCount = 0;

    for (const r of telemetryRecords) {
      if (r.sessionId && r.sessionId.trim() !== "" && !chatStore.sessions.has(r.sessionId)) {
        unlinkedSessionTelemetryCount++;
      }
      if (!r.occurredAt || r.occurredAt <= 0) {
        missingTimestampCount++;
      } else if (r.occurredAt > futureLimitMs) {
        futureTimestampAnomalyCount++;
      }
      if (r.latencyMs !== null && r.latencyMs !== undefined && r.latencyMs < 0) {
        negativeLatencyCount++;
      }
      if (
        (r.promptTokens !== null && r.promptTokens !== undefined && r.promptTokens < 0) ||
        (r.completionTokens !== null &&
          r.completionTokens !== undefined &&
          r.completionTokens < 0)
      ) {
        negativeTokenCount++;
      }
      if (r.costUsd !== null && r.costUsd !== undefined && r.costUsd < 0) {
        negativeCostCount++;
      }
      if (
        r.confidence !== null &&
        r.confidence !== undefined &&
        (r.confidence < 0 || r.confidence > 1 || Number.isNaN(r.confidence))
      ) {
        invalidConfidenceCount++;
      }
      if (
        !r.providerId ||
        r.providerId.trim() === "" ||
        !r.modelId ||
        r.modelId.trim() === ""
      ) {
        missingProviderOrModelCount++;
      }
    }

    if (futureTimestampAnomalyCount > 0) {
      findings.push({
        code: "TIMESTAMP_ANOMALY_FUTURE_RECORDS",
        severity: "warning",
        category: "telemetry_consistency",
        message: `Timestamp anomaly: ${futureTimestampAnomalyCount} telemetry record(s) have timestamps in the future and are protected from automatic age-based deletion.`,
        affectedCount: futureTimestampAnomalyCount,
        safeRepairAvailable: false,
      });
    }

    const telemetryValueAnomalies =
      missingTimestampCount +
      negativeLatencyCount +
      negativeTokenCount +
      negativeCostCount +
      invalidConfidenceCount;

    if (telemetryValueAnomalies > 0) {
      findings.push({
        code: "TELEMETRY_METRIC_ANOMALY",
        severity: "warning",
        category: "telemetry_consistency",
        message: `Detected ${telemetryValueAnomalies} telemetry record(s) with invalid negative or out-of-range numeric fields.`,
        affectedCount: telemetryValueAnomalies,
        safeRepairAvailable: false,
      });
    }

    const orphanSummary: OrphanAuditSummary = {
      orphanedMessagesCount,
      emptySessionsCount,
      expectedSearchIndexEntries: counts.expectedFtsCount,
      actualSearchIndexEntries: counts.actualFtsCount,
      searchIndexMismatchCount,
      searchIndexInSync,
      unlinkedSessionTelemetryCount,
    };

    const telemetryConsistency: TelemetryConsistencyAuditSummary = {
      totalRecordsChecked: telemetryRecords.length,
      missingTimestampCount,
      futureTimestampAnomalyCount,
      negativeLatencyCount,
      negativeTokenCount,
      negativeCostCount,
      invalidConfidenceCount,
      missingProviderOrModelCount,
    };

    let healthState: AuditHealthState = "healthy";
    if (!sqliteIntegrityOk) {
      healthState = "corrupted";
    } else if (!foreignKeysOk || orphanedMessagesCount > 0) {
      healthState = "needs_attention";
    } else if (
      !searchIndexInSync ||
      futureTimestampAnomalyCount > 0 ||
      telemetryValueAnomalies > 0
    ) {
      healthState = "healthy_with_warnings";
    }

    return {
      auditedAtMs: nowMs,
      mode,
      durationMs: Math.max(0, Date.now() - startMs),
      healthState,
      sqliteIntegrityOk,
      sqliteIntegrityMessage,
      foreignKeysOk,
      foreignKeyViolationsCount: orphanedMessagesCount,
      schemaVersion: 6,
      expectedSchemaVersion: 6,
      walEnabled: true,
      orphanSummary,
      telemetryConsistency,
      invalidSettingsCount: 0,
      credentialRecordsValid: true,
      privacyIsolationVerified: true,
      findings,
    };
  }

  return await safeInvoke<DataAuditReport>(
    IPC_COMMANDS.RUN_DATA_AUDIT,
    { mode },
    { requestId: generateRequestId() }
  );
}

/**
 * Executes an explicit, deterministic, non-destructive safe repair operation (Section 27).
 */
export async function runSafeDataRepair(
  action: SafeRepairAction = "rebuild_search_index"
): Promise<SafeRepairResult> {
  if (!isTauriContext()) {
    if (mockOperationInProgress) {
      throw invalidInputError(
        "A data cleanup, repair, or wipe operation is already in progress"
      );
    }
    if (mockPrivacyFailureTarget === "repair") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Safe repair failed to rebuild search index",
        retryable: true,
      });
    }

    mockOperationInProgress = true;
    try {
      const startMs = Date.now();
      let orphanedRemoved = 0;
      if (action === "remove_orphaned_records_and_rebuild_index") {
        orphanedRemoved = mockOrphanedMessages.length;
        mockOrphanedMessages = [];
      }
      mockSearchIndexDriftOffset = 0;
      const counts = computeMockCounts();

      return {
        executedAtMs: startMs,
        durationMs: Math.max(0, Date.now() - startMs),
        action,
        searchIndexEntriesRebuilt: counts.expectedFtsCount,
        orphanedMessagesRemoved: orphanedRemoved,
        verificationPassed: counts.actualFtsCount === counts.expectedFtsCount,
        message: `Search index rebuilt with ${counts.expectedFtsCount} verified entries (${orphanedRemoved} orphaned message rows removed).`,
      };
    } finally {
      mockOperationInProgress = false;
    }
  }

  return await safeInvoke<SafeRepairResult>(
    IPC_COMMANDS.RUN_SAFE_DATA_REPAIR,
    { action },
    { requestId: generateRequestId() }
  );
}

/**
 * Retrieves the configured local retention policy (Disabled by default).
 */
export async function getRetentionPolicy(): Promise<RetentionPolicyConfig> {
  if (!isTauriContext()) {
    const store = __internalGetMockSettingsStore();
    const policy: RetentionPolicyConfig = { ...DEFAULT_RETENTION_POLICY };

    const histEnabled = store.get(KEY_HISTORY_RETENTION_ENABLED);
    if (histEnabled !== undefined) {
      policy.historyRetentionEnabled = histEnabled.toLowerCase() === "true";
    }
    const histDays = store.get(KEY_HISTORY_RETENTION_DAYS);
    if (histDays !== undefined) {
      const parsed = parseInt(histDays, 10);
      if (
        !Number.isNaN(parsed) &&
        parsed >= MIN_RETENTION_DAYS &&
        parsed <= MAX_RETENTION_DAYS
      ) {
        policy.historyRetentionDays = parsed;
      }
    }
    const exclPinned = store.get(KEY_EXCLUDE_PINNED_SESSIONS);
    if (exclPinned !== undefined) {
      policy.excludePinnedSessions = exclPinned.toLowerCase() !== "false";
    }
    const telEnabled = store.get(KEY_TELEMETRY_RETENTION_ENABLED);
    if (telEnabled !== undefined) {
      policy.telemetryRetentionEnabled = telEnabled.toLowerCase() === "true";
    }
    const telDays = store.get(KEY_TELEMETRY_RETENTION_DAYS);
    if (telDays !== undefined) {
      const parsed = parseInt(telDays, 10);
      if (
        !Number.isNaN(parsed) &&
        parsed >= MIN_RETENTION_DAYS &&
        parsed <= MAX_RETENTION_DAYS
      ) {
        policy.telemetryRetentionDays = parsed;
      }
    }
    const confirmReq = store.get(KEY_CLEANUP_CONFIRMATION_REQUIRED);
    if (confirmReq !== undefined) {
      policy.cleanupConfirmationRequired = confirmReq.toLowerCase() !== "false";
    }

    return policy;
  }

  return await safeInvoke<RetentionPolicyConfig>(
    IPC_COMMANDS.GET_RETENTION_POLICY,
    {},
    { requestId: generateRequestId() }
  );
}

/**
 * Validates and persists the local retention policy.
 */
export async function updateRetentionPolicy(
  policy: RetentionPolicyConfig
): Promise<RetentionPolicyConfig> {
  const validated = validateRetentionPolicyConfig(policy);

  if (!isTauriContext()) {
    const store = __internalGetMockSettingsStore();
    store.set(
      KEY_HISTORY_RETENTION_ENABLED,
      String(validated.historyRetentionEnabled)
    );
    store.set(KEY_HISTORY_RETENTION_DAYS, String(validated.historyRetentionDays));
    store.set(KEY_EXCLUDE_PINNED_SESSIONS, String(validated.excludePinnedSessions));
    store.set(
      KEY_TELEMETRY_RETENTION_ENABLED,
      String(validated.telemetryRetentionEnabled)
    );
    store.set(
      KEY_TELEMETRY_RETENTION_DAYS,
      String(validated.telemetryRetentionDays)
    );
    store.set(
      KEY_CLEANUP_CONFIRMATION_REQUIRED,
      String(validated.cleanupConfirmationRequired)
    );
    store.set(
      KEY_LEGACY_HISTORY_RETENTION_DAYS,
      validated.historyRetentionEnabled
        ? String(Math.min(365, validated.historyRetentionDays))
        : "0"
    );
    return { ...validated };
  }

  return await safeInvoke<RetentionPolicyConfig>(
    IPC_COMMANDS.UPDATE_RETENTION_POLICY,
    { policy: validated },
    { requestId: generateRequestId() }
  );
}

/**
 * Computes a 100% read-only dry-run preview of what a cleanup operation will remove (Sections 50–52).
 */
export async function previewDataCleanup(
  request: CleanupPreviewRequest
): Promise<CleanupPreviewResult> {
  if (request.olderThanDays !== undefined && request.olderThanDays !== null) {
    validateRetentionDays(request.olderThanDays, "Cleanup retention days");
  }

  if (!isTauriContext()) {
    const nowMs = Date.now();
    const futureLimitMs = nowMs + FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS;
    const policy = await getRetentionPolicy();
    const activeSessionIds = new Set(__internalGetActiveMockSessionIds());
    const chatStore = __internalGetMockChatStore();
    const telemetryRecords = __internalGetMockTelemetryStore();

    const deleteAll = Boolean(request.deleteAllInScope);
    const excludePinned =
      request.excludePinnedSessions !== undefined &&
        request.excludePinnedSessions !== null
        ? Boolean(request.excludePinnedSessions)
        : policy.excludePinnedSessions;

    let eligibleSessionsCount = 0;
    let eligibleMessagesCount = 0;
    let eligibleTelemetryRecordsCount = 0;
    let excludedPinnedSessionsCount = 0;
    let skippedActiveSessionsCount = 0;
    let skippedFutureTimestampCount = 0;
    let primaryCutoffMs: number | null = null;

    const evalHistory =
      request.scope === "history_only" || request.scope === "retention_policy";
    const historyEnabledForRun =
      request.scope === "history_only" ||
      (request.scope === "retention_policy" &&
        (policy.historyRetentionEnabled ||
          (request.olderThanDays !== undefined && request.olderThanDays !== null)));

    if (evalHistory && historyEnabledForRun) {
      const days = request.olderThanDays ?? policy.historyRetentionDays;
      const cutoffMs = deleteAll ? null : nowMs - days * 86_400_000;
      if (primaryCutoffMs === null) {
        primaryCutoffMs = cutoffMs;
      }

      for (const session of chatStore.sessions.values()) {
        if (activeSessionIds.has(session.id)) {
          skippedActiveSessionsCount++;
          continue;
        }
        if (!deleteAll && session.updatedAt > futureLimitMs) {
          skippedFutureTimestampCount++;
          continue;
        }
        if (cutoffMs !== null && session.updatedAt >= cutoffMs) {
          continue;
        }
        if (excludePinned && session.pinned) {
          excludedPinnedSessionsCount++;
          continue;
        }
        eligibleSessionsCount++;
        const msgs = chatStore.messages.get(session.id) || [];
        eligibleMessagesCount += msgs.length;
      }
    }

    const evalTelemetry =
      request.scope === "telemetry_only" || request.scope === "retention_policy";
    const telemetryEnabledForRun =
      request.scope === "telemetry_only" ||
      (request.scope === "retention_policy" &&
        (policy.telemetryRetentionEnabled ||
          (request.olderThanDays !== undefined && request.olderThanDays !== null)));

    if (evalTelemetry && telemetryEnabledForRun) {
      const days = request.olderThanDays ?? policy.telemetryRetentionDays;
      const cutoffMs = deleteAll ? null : nowMs - days * 86_400_000;
      if (primaryCutoffMs === null) {
        primaryCutoffMs = cutoffMs;
      }

      if (cutoffMs !== null) {
        for (const r of telemetryRecords) {
          if (r.occurredAt > futureLimitMs) {
            skippedFutureTimestampCount++;
          } else if (r.occurredAt < cutoffMs) {
            eligibleTelemetryRecordsCount++;
          }
        }
      } else {
        eligibleTelemetryRecordsCount = telemetryRecords.length;
      }
    }

    const counts = computeMockCounts();
    const affectedSearchIndexEntriesCount =
      request.scope === "search_index_rebuild"
        ? counts.expectedFtsCount
        : eligibleSessionsCount + eligibleMessagesCount;

    return {
      generatedAtMs: nowMs,
      scope: request.scope,
      cutoffTimestampMs: primaryCutoffMs,
      olderThanDays: request.olderThanDays ?? null,
      excludePinnedSessions: excludePinned,
      eligibleSessionsCount,
      eligibleMessagesCount,
      eligibleTelemetryRecordsCount,
      affectedSearchIndexEntriesCount,
      excludedPinnedSessionsCount,
      skippedActiveSessionsCount,
      skippedFutureTimestampCount,
      preservesCredentials: true,
      preservesSettings: true,
      summaryMessage: `Dry-run preview: ${eligibleSessionsCount} session(s), ${eligibleMessagesCount} message(s), and ${eligibleTelemetryRecordsCount} telemetry record(s) eligible for removal (${excludedPinnedSessionsCount} pinned excluded, ${skippedActiveSessionsCount} active protected).`,
    };
  }

  return await safeInvoke<CleanupPreviewResult>(
    IPC_COMMANDS.PREVIEW_DATA_CLEANUP,
    { request },
    { requestId: generateRequestId() }
  );
}

/**
 * Executes a controlled, transactional cleanup operation with post-cleanup verification (Sections 53–64).
 */
export async function executeDataCleanup(
  request: CleanupExecutionRequest
): Promise<CleanupOperationResult> {
  if (!request.confirmed) {
    throw invalidInputError(
      "Cleanup execution requires explicit confirmation (confirmed: true)"
    );
  }
  if (request.olderThanDays !== undefined && request.olderThanDays !== null) {
    validateRetentionDays(request.olderThanDays, "Cleanup retention days");
  }

  if (!isTauriContext()) {
    if (mockOperationInProgress) {
      throw invalidInputError(
        "A data cleanup, repair, or wipe operation is already in progress"
      );
    }
    if (mockPrivacyFailureTarget === "cleanup") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Cleanup transaction rolled back due to simulated database error",
        retryable: true,
      });
    }

    mockOperationInProgress = true;
    try {
      const startedAtMs = Date.now();
      const futureLimitMs = startedAtMs + FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS;
      const policy = await getRetentionPolicy();
      const activeSessionIds = new Set(__internalGetActiveMockSessionIds());
      const chatStore = __internalGetMockChatStore();
      const telemetryRecords = __internalGetMockTelemetryStore();

      const deleteAll = Boolean(request.deleteAllInScope);
      const excludePinned =
        request.excludePinnedSessions !== undefined &&
          request.excludePinnedSessions !== null
          ? Boolean(request.excludePinnedSessions)
          : policy.excludePinnedSessions;

      let deletedSessionsCount = 0;
      let deletedMessagesCount = 0;
      let deletedTelemetryRecordsCount = 0;
      let excludedPinnedSessionsCount = 0;
      let skippedActiveSessionsCount = 0;
      let skippedFutureTimestampCount = 0;
      const warnings: string[] = [];

      // 1. History Cleanup
      const evalHistory =
        request.scope === "history_only" || request.scope === "retention_policy";
      const historyEnabledForRun =
        request.scope === "history_only" ||
        (request.scope === "retention_policy" &&
          (policy.historyRetentionEnabled ||
            (request.olderThanDays !== undefined && request.olderThanDays !== null)));

      if (evalHistory && historyEnabledForRun) {
        const days = request.olderThanDays ?? policy.historyRetentionDays;
        const cutoffMs = deleteAll ? null : startedAtMs - days * 86_400_000;
        const sessionsToDelete: string[] = [];

        for (const session of chatStore.sessions.values()) {
          if (activeSessionIds.has(session.id)) {
            skippedActiveSessionsCount++;
            continue;
          }
          if (!deleteAll && session.updatedAt > futureLimitMs) {
            skippedFutureTimestampCount++;
            continue;
          }
          if (cutoffMs !== null && session.updatedAt >= cutoffMs) {
            continue;
          }
          if (excludePinned && session.pinned) {
            excludedPinnedSessionsCount++;
            continue;
          }
          sessionsToDelete.push(session.id);
        }

        for (const sid of sessionsToDelete) {
          const msgs = chatStore.messages.get(sid) || [];
          if (chatStore.sessions.delete(sid)) {
            chatStore.messages.delete(sid);
            const cascadedTel = __internalDeleteMockTelemetryBySession(sid);
            deletedSessionsCount++;
            deletedMessagesCount += msgs.length;
            deletedTelemetryRecordsCount += cascadedTel;
          }
        }
      }

      // 2. Telemetry Cleanup
      const evalTelemetry =
        request.scope === "telemetry_only" || request.scope === "retention_policy";
      const telemetryEnabledForRun =
        request.scope === "telemetry_only" ||
        (request.scope === "retention_policy" &&
          (policy.telemetryRetentionEnabled ||
            (request.olderThanDays !== undefined && request.olderThanDays !== null)));

      if (evalTelemetry && telemetryEnabledForRun) {
        const days = request.olderThanDays ?? policy.telemetryRetentionDays;
        const cutoffMs = deleteAll ? null : startedAtMs - days * 86_400_000;

        if (cutoffMs !== null) {
          let writeIndex = 0;
          for (let i = 0; i < telemetryRecords.length; i++) {
            const rec = telemetryRecords[i];
            if (rec.occurredAt > futureLimitMs) {
              skippedFutureTimestampCount++;
              telemetryRecords[writeIndex++] = rec;
            } else if (rec.occurredAt < cutoffMs) {
              deletedTelemetryRecordsCount++;
            } else {
              telemetryRecords[writeIndex++] = rec;
            }
          }
          telemetryRecords.length = writeIndex;
        } else {
          deletedTelemetryRecordsCount += telemetryRecords.length;
          telemetryRecords.length = 0;
        }
      }

      // 3. Synchronize / Rebuild Search Index
      mockSearchIndexDriftOffset = 0;
      const postCounts = computeMockCounts();

      if (skippedActiveSessionsCount > 0) {
        warnings.push(
          `Protected ${skippedActiveSessionsCount} active session(s) currently executing or streaming.`
        );
      }
      if (skippedFutureTimestampCount > 0) {
        warnings.push(
          `Skipped ${skippedFutureTimestampCount} future-dated record(s) due to timestamp anomaly protection.`
        );
      }

      const ftsMatches =
        postCounts.actualFtsCount === postCounts.expectedFtsCount;
      const verificationStatus: CleanupVerificationStatus = !ftsMatches
        ? "verification_failed"
        : warnings.length > 0
          ? "verified_with_warnings"
          : "verified";

      const completedAtMs = Date.now();
      return {
        operationId: `cleanup_${startedAtMs}`,
        scope: request.scope,
        startedAtMs,
        completedAtMs,
        durationMs: Math.max(0, completedAtMs - startedAtMs),
        deletedSessionsCount,
        deletedMessagesCount,
        deletedTelemetryRecordsCount,
        rebuiltSearchIndexEntriesCount: postCounts.expectedFtsCount,
        excludedPinnedSessionsCount,
        skippedActiveSessionsCount,
        skippedFutureTimestampCount,
        remainingSessionsCount: postCounts.sessionsCount,
        remainingMessagesCount: postCounts.messagesCount,
        remainingTelemetryRecordsCount: postCounts.telemetryCount,
        remainingSearchIndexEntriesCount: postCounts.actualFtsCount,
        verificationStatus,
        storageNote: STORAGE_SEMANTICS_DISCLOSURE,
        warnings,
      };
    } finally {
      mockOperationInProgress = false;
    }
  }

  return await safeInvoke<CleanupOperationResult>(
    IPC_COMMANDS.RUN_DATA_CLEANUP,
    { request },
    { requestId: generateRequestId() }
  );
}

/**
 * Computes a read-only preview of a Full Local Data Wipe (Section 33).
 */
export async function previewFullDataWipe(): Promise<FullWipePreviewResult> {
  if (!isTauriContext()) {
    const nowMs = Date.now();
    const counts = computeMockCounts();
    const activeExecutionsCount = getActiveMockExecutionCount();
    const credStore = __internalGetMockCredentialStore();
    const configuredProviderIds = Array.from(credStore.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    const canProceed = activeExecutionsCount === 0;
    const blockReason = canProceed
      ? null
      : `Cannot execute Full Local Data Wipe while ${activeExecutionsCount} active chat/stream execution(s) are running. Cancel active requests first.`;

    return {
      generatedAtMs: nowMs,
      sessionsToDelete: counts.sessionsCount,
      messagesToDelete: counts.messagesCount,
      telemetryRecordsToDelete: counts.telemetryCount,
      searchIndexEntriesToDelete: counts.actualFtsCount,
      appSettingsToReset: counts.settingsCount,
      providerCredentialsToDelete: counts.credentialsCount,
      configuredProviderIds,
      activeExecutionsCount,
      canProceed,
      blockReason,
      requiredConfirmationToken: FULL_WIPE_CONFIRMATION_TOKEN,
      providerBoundaryWarning: PROVIDER_BOUNDARY_DISCLOSURE,
    };
  }

  return await safeInvoke<FullWipePreviewResult>(
    IPC_COMMANDS.PREVIEW_FULL_DATA_WIPE,
    {},
    { requestId: generateRequestId() }
  );
}

/**
 * Executes an explicit, high-security Full Local Data Wipe requiring confirmationToken === "DELETE" (Sections 30–36).
 */
export async function executeFullDataWipe(
  request: FullWipeRequest
): Promise<FullWipeReport> {
  if (
    !request ||
    !request.confirmed ||
    request.confirmationToken !== FULL_WIPE_CONFIRMATION_TOKEN
  ) {
    throw invalidInputError(
      `Full Local Data Wipe requires explicit confirmation token '${FULL_WIPE_CONFIRMATION_TOKEN}'`
    );
  }

  if (!isTauriContext()) {
    if (mockOperationInProgress) {
      throw invalidInputError(
        "A data cleanup, repair, or wipe operation is already in progress"
      );
    }

    const activeCount = getActiveMockExecutionCount();
    if (activeCount > 0) {
      throw invalidInputError(
        `ACTIVE_EXECUTION_IN_PROGRESS: Cannot execute Full Local Data Wipe while ${activeCount} request(s) are actively executing. Cancel active executions first.`
      );
    }

    if (mockPrivacyFailureTarget === "full_wipe") {
      throw new IpcError({
        code: "DATABASE_FAILURE",
        category: "Internal",
        message: "Full Local Data Wipe rolled back due to simulated transaction failure",
        retryable: true,
      });
    }

    mockOperationInProgress = true;
    try {
      const startedAtMs = Date.now();
      const preCounts = computeMockCounts();
      const includeCredentials = request.includeCredentials ?? true;
      const includeSettings = request.includeSettings ?? true;

      const chatStore = __internalGetMockChatStore();
      chatStore.sessions.clear();
      chatStore.messages.clear();
      mockOrphanedMessages = [];
      mockSearchIndexDriftOffset = 0;

      const telemetryRecords = __internalGetMockTelemetryStore();
      telemetryRecords.length = 0;

      let resetSettingsCount = 0;
      if (includeSettings) {
        resetSettingsCount = preCounts.settingsCount;
        clearMockSettings();
      }

      let deletedCredentialsCount = 0;
      if (includeCredentials) {
        deletedCredentialsCount = preCounts.credentialsCount;
        resetCredentialMockStore();
      }

      const postCounts = computeMockCounts();
      const verified =
        postCounts.sessionsCount === 0 &&
        postCounts.messagesCount === 0 &&
        postCounts.telemetryCount === 0 &&
        postCounts.actualFtsCount === 0 &&
        (!includeCredentials || postCounts.credentialsCount === 0);

      const completedAtMs = Date.now();
      return {
        operationId: `full_wipe_${startedAtMs}`,
        startedAtMs,
        completedAtMs,
        durationMs: Math.max(0, completedAtMs - startedAtMs),
        deletedSessionsCount: preCounts.sessionsCount,
        deletedMessagesCount: preCounts.messagesCount,
        deletedTelemetryRecordsCount: preCounts.telemetryCount,
        clearedSearchIndexEntriesCount: preCounts.actualFtsCount,
        resetSettingsCount,
        deletedCredentialsCount,
        remainingSessionsCount: postCounts.sessionsCount,
        remainingMessagesCount: postCounts.messagesCount,
        remainingTelemetryRecordsCount: postCounts.telemetryCount,
        remainingSearchIndexEntriesCount: postCounts.actualFtsCount,
        remainingCredentialsCount: postCounts.credentialsCount,
        verificationStatus: verified ? "verified" : "verification_failed",
        storageNote: STORAGE_SEMANTICS_DISCLOSURE,
      };
    } finally {
      mockOperationInProgress = false;
    }
  }

  return await safeInvoke<FullWipeReport>(
    IPC_COMMANDS.RUN_FULL_DATA_WIPE,
    { request },
    { requestId: generateRequestId() }
  );
}

