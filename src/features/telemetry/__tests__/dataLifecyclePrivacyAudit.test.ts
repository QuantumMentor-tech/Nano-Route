/**
 * Nano Route — Step 45 Automated Test Suite
 * Telemetry Audit, Data Cleanup, Retention & Privacy Control System
 * File: src/features/telemetry/__tests__/dataLifecyclePrivacyAudit.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  appendChatMessage,
  clearMockSettings,
  createChatSession,
  DEFAULT_RETENTION_POLICY,
  executeDataCleanup,
  executeFullDataWipe,
  FULL_WIPE_CONFIRMATION_TOKEN,
  getAppSettings,
  getDataInventory,
  getRetentionPolicy,
  getTelemetryCostAnalyticsSnapshot,
  getTelemetryDashboardSnapshot,
  getTelemetryPerformanceAnalyticsSnapshot,
  listProviderCredentialStatuses,
  previewDataCleanup,
  previewFullDataWipe,
  resetChatMockStore,
  resetCredentialMockStore,
  resetPrivacyMockState,
  resetTelemetryMockStore,
  runDataAudit,
  runSafeDataRepair,
  saveProviderCredential,
  searchHistory,
  setAppSetting,
  setChatSessionPinned,
  setMockPrivacyTestHooks,
  updateRetentionPolicy,
  __internalGetMockChatStore,
  __internalInsertMockTelemetryBatch,
  __internalSetSimulatedActiveSession,
  type ChatMessage,
  type TelemetryRecord,
} from "../../../services/ipc/index.ts";
import {
  formatCategoryBadge,
  formatDeletionPolicyBadge,
  formatHealthStateBadge,
} from "../../settings/privacyFormatters.ts";

const DAY_MS = 86_400_000;

function resetAllStores(): void {
  resetChatMockStore();
  resetTelemetryMockStore();
  clearMockSettings();
  resetCredentialMockStore();
  resetPrivacyMockState();
}

function makeTelemetryRecord(
  id: string,
  occurredAt: number,
  overrides: Partial<TelemetryRecord> = {}
): TelemetryRecord {
  return {
    id,
    eventType: "provider_execution",
    occurredAt,
    sessionId: null,
    messageId: null,
    taskId: `task_${id}`,
    streamId: null,
    providerId: "openai",
    modelId: "gpt-4o-mini",
    outcome: "success",
    errorCode: null,
    latencyMs: 320,
    promptTokens: 200,
    completionTokens: 100,
    costUsd: 0.00009,
    confidence: 0.91,
    routingReason: "Automatic route selected",
    ...overrides,
  };
}

describe("Step 45 — Telemetry Audit, Data Cleanup, Retention & Privacy Control System", () => {
  beforeEach(() => {
    resetAllStores();
  });

  // ==========================================================================
  // 1. Local Data Inventory & Classification Model
  // ==========================================================================
  describe("1. Local Data Inventory & Safe Credential Metadata", () => {
    it("returns all 7 canonical local datasets with accurate classifications and live counts", async () => {
      const s1 = await createChatSession({ title: "Inventory Session" });
      await appendChatMessage({
        sessionId: s1.id,
        sender: "user",
        content: "Check local data inventory",
      });
      __internalInsertMockTelemetryBatch([
        makeTelemetryRecord("tel_inv_1", Date.now() - 1000, { sessionId: s1.id }),
        makeTelemetryRecord("tel_inv_2", Date.now() - 500),
      ]);
      await setAppSetting("routing.preference_mode", "quality");
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-super-secret-never-expose-99999",
        isActive: true,
      });

      const inv = await getDataInventory();
      assert.equal(inv.items.length, 7);
      assert.equal(inv.totalUserSessions, 1);
      assert.equal(inv.totalUserMessages, 1);
      assert.equal(inv.totalSearchIndexEntries, 2); // 1 session + 1 message
      assert.equal(inv.totalTelemetryRecords, 2);
      assert.equal(inv.totalConfiguredCredentials, 1);
      assert.equal(inv.totalAppSettings, 1);

      const byId = new Map(inv.items.map((i) => [i.storeId, i]));
      assert.equal(byId.get("chat_sessions")?.category, "user_content");
      assert.equal(
        byId.get("chat_sessions")?.deletionPolicy,
        "retention_eligible"
      );
      assert.equal(byId.get("history_search_fts")?.category, "search_index");
      assert.equal(byId.get("history_search_fts")?.deletionPolicy, "rebuildable");
      assert.equal(
        byId.get("telemetry_records")?.category,
        "operational_telemetry"
      );
      assert.equal(byId.get("api_credentials")?.category, "secret");
      assert.equal(
        byId.get("api_credentials")?.deletionPolicy,
        "credential_sensitive"
      );
      assert.equal(
        byId.get("schema_migrations")?.deletionPolicy,
        "system_owned"
      );

      // Verify secret isolation: API key never appears anywhere in serialized inventory
      const serialized = JSON.stringify(inv);
      assert.equal(serialized.includes("sk-super-secret-never-expose-99999"), false);
      assert.equal(inv.credentials.length, 1);
      assert.equal(inv.credentials[0].providerId, "openai");
      assert.equal(inv.credentials[0].hasCredential, true);
      assert.equal(inv.credentials[0].isActive, true);

      // Verify required disclosures
      assert.ok(inv.storageSemanticsNote.includes("logically deleted"));
      assert.ok(inv.providerBoundaryNote.includes("external AI providers"));
    });
  });

  // ==========================================================================
  // 2. Database Health, Integrity Audit & Orphan / Anomaly Detection
  // ==========================================================================
  describe("2. Read-Only Database Integrity, Orphan & Telemetry Consistency Audit", () => {
    it("reports Healthy state when all tables, foreign keys, FTS index, and telemetry are consistent", async () => {
      const s = await createChatSession({ title: "Healthy Thread" });
      await appendChatMessage({
        sessionId: s.id,
        sender: "user",
        content: "Everything is in sync",
      });
      __internalInsertMockTelemetryBatch([
        makeTelemetryRecord("tel_ok_1", Date.now() - 10_000, { sessionId: s.id }),
      ]);

      const quickReport = await runDataAudit("quick");
      assert.equal(quickReport.healthState, "healthy");
      assert.equal(quickReport.sqliteIntegrityOk, true);
      assert.equal(quickReport.foreignKeysOk, true);
      assert.equal(quickReport.orphanSummary.orphanedMessagesCount, 0);
      assert.equal(quickReport.orphanSummary.searchIndexInSync, true);
      assert.equal(quickReport.findings.length, 0);

      const fullReport = await runDataAudit("full");
      assert.equal(fullReport.mode, "full");
      assert.equal(fullReport.healthState, "healthy");
      assert.equal(fullReport.privacyIsolationVerified, true);
    });

    it("detects FTS5 search index drift, orphaned messages, future timestamps, and negative metrics without mutating data", async () => {
      const now = Date.now();
      const s = await createChatSession({ title: "Audit Target" });
      await appendChatMessage({
        sessionId: s.id,
        sender: "user",
        content: "Normal message",
      });

      const orphanMsg: ChatMessage = {
        id: "orphan_msg_1",
        sessionId: "deleted_parent_sess",
        sender: "assistant",
        content: "Orphaned message row",
        metadata: {
          routedProvider: "openai",
          routedModel: "gpt-4o-mini",
          routingReason: null,
          slmConfidenceScore: null,
          promptTokens: 10,
          completionTokens: 20,
          latencyMs: 100,
          costUsd: 0.0001,
        },
        createdAt: now - 5000,
      };

      setMockPrivacyTestHooks({
        orphanedMessages: [orphanMsg],
        searchIndexDriftOffset: 3,
      });

      // Insert future-dated and negative-metric telemetry anomalies
      __internalInsertMockTelemetryBatch([
        makeTelemetryRecord("tel_future", now + 2 * DAY_MS),
        makeTelemetryRecord("tel_neg", now - 5000, {
          latencyMs: -50,
          costUsd: -0.05,
        }),
      ]);

      const invBefore = await getDataInventory();
      const report = await runDataAudit("full");
      const invAfter = await getDataInventory();

      // Audit must be 100% read-only
      assert.equal(invAfter.totalUserMessages, invBefore.totalUserMessages);
      assert.equal(invAfter.totalTelemetryRecords, invBefore.totalTelemetryRecords);

      assert.equal(report.healthState, "needs_attention");
      assert.equal(report.orphanSummary.orphanedMessagesCount, 1);
      assert.equal(report.orphanSummary.searchIndexInSync, false);
      assert.equal(report.orphanSummary.searchIndexMismatchCount, 3);
      assert.equal(report.telemetryConsistency.futureTimestampAnomalyCount, 1);
      assert.equal(report.telemetryConsistency.negativeLatencyCount, 1);
      assert.equal(report.telemetryConsistency.negativeCostCount, 1);

      const codes = new Set(report.findings.map((f) => f.code));
      assert.ok(codes.has("ORPHANED_MESSAGES_DETECTED"));
      assert.ok(codes.has("SEARCH_INDEX_OUT_OF_SYNC"));
      assert.ok(codes.has("TIMESTAMP_ANOMALY_FUTURE_RECORDS"));
      assert.ok(codes.has("TELEMETRY_METRIC_ANOMALY"));
    });

    it("reports Corrupted state when SQLite integrity check fails", async () => {
      setMockPrivacyTestHooks({ failureTarget: "sqlite_corrupt" });
      const report = await runDataAudit("full");
      assert.equal(report.healthState, "corrupted");
      assert.equal(report.sqliteIntegrityOk, false);
      assert.ok(
        report.findings.some((f) => f.code === "SQLITE_INTEGRITY_FAILED")
      );
    });
  });

  // ==========================================================================
  // 3. Safe Non-Destructive Repair
  // ==========================================================================
  describe("3. Safe Non-Destructive Repair (Search Index Rebuild & Orphan Cleanup)", () => {
    it("repairs FTS5 search index drift and removes orphaned message rows while preserving valid user messages", async () => {
      const s = await createChatSession({ title: "Preserved Thread" });
      const validMsg = await appendChatMessage({
        sessionId: s.id,
        sender: "user",
        content: "Important user architecture notes",
      });

      setMockPrivacyTestHooks({
        orphanedMessages: [
          {
            id: "orphan_99",
            sessionId: "missing_sess",
            sender: "user",
            content: "Stale orphan",
            metadata: {
              routedProvider: null,
              routedModel: null,
              routingReason: null,
              slmConfidenceScore: null,
              promptTokens: 0,
              completionTokens: 0,
              latencyMs: 0,
              costUsd: 0,
            },
            createdAt: Date.now() - 10_000,
          },
        ],
        searchIndexDriftOffset: -2,
      });

      const beforeAudit = await runDataAudit("quick");
      assert.equal(beforeAudit.healthState, "needs_attention");

      const repair = await runSafeDataRepair(
        "remove_orphaned_records_and_rebuild_index"
      );
      assert.equal(repair.verificationPassed, true);
      assert.equal(repair.orphanedMessagesRemoved, 1);
      assert.equal(repair.searchIndexEntriesRebuilt, 2); // 1 session + 1 valid message

      const afterAudit = await runDataAudit("full");
      assert.equal(afterAudit.healthState, "healthy");
      assert.equal(afterAudit.orphanSummary.orphanedMessagesCount, 0);
      assert.equal(afterAudit.orphanSummary.searchIndexInSync, true);

      // Valid message content is untouched and searchable
      const searchRes = await searchHistory({ query: "architecture notes" });
      assert.equal(searchRes.items.length, 1);
      assert.equal(searchRes.items[0].matchedMessageIds[0], validMsg.id);
    });
  });

  // ==========================================================================
  // 4. Retention Policy Model & Validation
  // ==========================================================================
  describe("4. Retention Policy Defaults, Persistence & Strict Validation", () => {
    it("defaults to Disabled so user data is never deleted automatically without consent", async () => {
      const policy = await getRetentionPolicy();
      assert.deepEqual(policy, DEFAULT_RETENTION_POLICY);
      assert.equal(policy.historyRetentionEnabled, false);
      assert.equal(policy.telemetryRetentionEnabled, false);
      assert.equal(policy.excludePinnedSessions, true);
    });

    it("persists valid retention policies and rejects invalid retention day bounds", async () => {
      const updated = await updateRetentionPolicy({
        historyRetentionEnabled: true,
        historyRetentionDays: 90,
        excludePinnedSessions: true,
        telemetryRetentionEnabled: true,
        telemetryRetentionDays: 14,
        cleanupConfirmationRequired: true,
      });
      assert.equal(updated.historyRetentionEnabled, true);
      assert.equal(updated.historyRetentionDays, 90);
      assert.equal(updated.telemetryRetentionDays, 14);

      const reloaded = await getRetentionPolicy();
      assert.deepEqual(reloaded, updated);

      // Legacy setting is synchronized
      const appSettings = await getAppSettings();
      assert.equal(appSettings.historyRetentionDays, 90);

      // Reject 0, negative, > 3650, NaN, and fractional days
      for (const badDays of [0, -1, -30, 3651, 99999, Number.NaN, 12.5]) {
        await assert.rejects(
          () =>
            updateRetentionPolicy({
              ...updated,
              historyRetentionDays: badDays,
            }),
          /must be an integer between 1 and 3650/
        );
      }
    });
  });

  // ==========================================================================
  // 5. Dry-Run Preview, Targeted/Retention Cleanup, Protections & Idempotency
  // ==========================================================================
  describe("5. Dry-Run Preview, Targeted/Retention Cleanup, Active/Future Protections & Analytics Sync", () => {
    it("computes accurate read-only dry-run previews and executes idempotent cleanup respecting pinned, active, and future-timestamp protections", async () => {
      const now = Date.now();
      const chatStore = __internalGetMockChatStore();

      // 1. Old unpinned session (45 days old) -> ELIGIBLE
      const oldUnpinned = await createChatSession({ title: "Old Unpinned Chat" });
      await appendChatMessage({
        sessionId: oldUnpinned.id,
        sender: "user",
        content: "Legacy unpinned prompt",
      });
      chatStore.sessions.get(oldUnpinned.id)!.updatedAt = now - 45 * DAY_MS;

      // 2. Old pinned session (60 days old, pinned) -> PROTECTED by excludePinnedSessions
      const oldPinned = await createChatSession({
        title: "Old Pinned Chat",
        pinned: true,
      });
      await setChatSessionPinned(oldPinned.id, true);
      await appendChatMessage({
        sessionId: oldPinned.id,
        sender: "user",
        content: "Pinned reference prompt",
      });
      chatStore.sessions.get(oldPinned.id)!.updatedAt = now - 60 * DAY_MS;

      // 3. Old session with active streaming execution -> PROTECTED by active session guard
      const oldActive = await createChatSession({ title: "Active Streaming Chat" });
      await appendChatMessage({
        sessionId: oldActive.id,
        sender: "user",
        content: "Streaming right now",
      });
      chatStore.sessions.get(oldActive.id)!.updatedAt = now - 50 * DAY_MS;
      __internalSetSimulatedActiveSession(oldActive.id, true);

      // 4. Recent session (2 days old) -> KEPT
      const recentSess = await createChatSession({ title: "Recent Chat" });
      await appendChatMessage({
        sessionId: recentSess.id,
        sender: "user",
        content: "Recent conversation",
      });

      // 5. Telemetry: 2 old (40 days ago), 1 recent (1 day ago), 1 future-dated (+3 days)
      __internalInsertMockTelemetryBatch([
        makeTelemetryRecord("tel_old_1", now - 40 * DAY_MS, {
          sessionId: oldUnpinned.id,
          costUsd: 0.01,
          latencyMs: 500,
        }),
        makeTelemetryRecord("tel_old_2", now - 35 * DAY_MS, {
          costUsd: 0.02,
          latencyMs: 600,
        }),
        makeTelemetryRecord("tel_recent_1", now - 1 * DAY_MS, {
          sessionId: recentSess.id,
          costUsd: 0.005,
          latencyMs: 250,
        }),
        makeTelemetryRecord("tel_future_1", now + 3 * DAY_MS, {
          costUsd: 0.001,
          latencyMs: 200,
        }),
      ]);

      await updateRetentionPolicy({
        historyRetentionEnabled: true,
        historyRetentionDays: 30,
        excludePinnedSessions: true,
        telemetryRetentionEnabled: true,
        telemetryRetentionDays: 30,
        cleanupConfirmationRequired: true,
      });

      // Dry-Run Preview must not delete anything
      const preview = await previewDataCleanup({
        scope: "retention_policy",
      });
      assert.equal(preview.eligibleSessionsCount, 1); // only oldUnpinned
      assert.equal(preview.eligibleMessagesCount, 1);
      assert.equal(preview.eligibleTelemetryRecordsCount, 2); // tel_old_1 & tel_old_2
      assert.equal(preview.excludedPinnedSessionsCount, 1); // oldPinned
      assert.equal(preview.skippedActiveSessionsCount, 1); // oldActive
      assert.equal(preview.skippedFutureTimestampCount, 1); // tel_future_1
      assert.equal(preview.preservesCredentials, true);
      assert.equal(preview.preservesSettings, true);

      const invAfterPreview = await getDataInventory();
      assert.equal(invAfterPreview.totalUserSessions, 4);
      assert.equal(invAfterPreview.totalTelemetryRecords, 4);

      // Execute Retention Cleanup
      const result = await executeDataCleanup({
        scope: "retention_policy",
        confirmed: true,
      });
      assert.equal(result.deletedSessionsCount, 1);
      assert.equal(result.deletedMessagesCount, 1);
      assert.equal(result.deletedTelemetryRecordsCount, 2);
      assert.equal(result.excludedPinnedSessionsCount, 1);
      assert.equal(result.skippedActiveSessionsCount, 1);
      assert.equal(result.skippedFutureTimestampCount, 1);
      assert.equal(result.remainingSessionsCount, 3);
      assert.equal(result.remainingTelemetryRecordsCount, 2);
      assert.equal(result.verificationStatus, "verified_with_warnings");

      // Idempotency: running cleanup a second time deletes 0 sessions and 0 telemetry records
      const secondRun = await executeDataCleanup({
        scope: "retention_policy",
        confirmed: true,
      });
      assert.equal(secondRun.deletedSessionsCount, 0);
      assert.equal(secondRun.deletedMessagesCount, 0);
      assert.equal(secondRun.deletedTelemetryRecordsCount, 0);
      assert.equal(secondRun.remainingSessionsCount, 3);

      // Verify Step 41 Search Index and Steps 42, 43, 44 Analytics reflect cleanup immediately
      const deletedSearch = await searchHistory({ query: "Legacy unpinned" });
      assert.equal(deletedSearch.items.length, 0);

      const pinnedSearch = await searchHistory({ query: "Pinned reference" });
      assert.equal(pinnedSearch.items.length, 1);

      const dashSnap = await getTelemetryDashboardSnapshot({});
      assert.equal(dashSnap.summary.totalRoutedRequests, 2);

      const costSnap = await getTelemetryCostAnalyticsSnapshot({});
      assert.equal(costSnap.actualCostSummary.eligibleAttemptCount, 2);

      const perfSnap = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perfSnap.summary.measuredExecutions, 2);

      __internalSetSimulatedActiveSession(oldActive.id, false);
    });
  });

  // ==========================================================================
  // 6. Full Local Data Wipe & High-Security Confirmation Token Enforcement
  // ==========================================================================
  describe("6. Full Local Data Wipe & Confirmation Token Enforcement", () => {
    it("rejects wrong confirmation tokens, blocks during active execution, and wipes all categories when confirmed with DELETE", async () => {
      const s = await createChatSession({ title: "Wipe Target Session" });
      await appendChatMessage({
        sessionId: s.id,
        sender: "user",
        content: "Delete me during full wipe",
      });
      __internalInsertMockTelemetryBatch([
        makeTelemetryRecord("tel_wipe_1", Date.now() - 1000),
      ]);
      await setAppSetting("routing.preference_mode", "cost_saving");
      await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-secret-key-to-wipe",
      });

      // 1. Reject invalid confirmation tokens
      for (const badToken of ["", "delete", "CONFIRM", "WIPE", "DELETE "]) {
        await assert.rejects(
          () =>
            executeFullDataWipe({
              confirmationToken: badToken,
              confirmed: true,
            }),
          /requires explicit confirmation token 'DELETE'/
        );
      }

      // 2. Block Full Local Data Wipe while a session execution is active
      __internalSetSimulatedActiveSession(s.id, true);
      const blockedPreview = await previewFullDataWipe();
      assert.equal(blockedPreview.canProceed, false);
      assert.equal(blockedPreview.activeExecutionsCount, 1);
      assert.ok(blockedPreview.blockReason?.includes("Cancel active requests"));

      await assert.rejects(
        () =>
          executeFullDataWipe({
            confirmationToken: FULL_WIPE_CONFIRMATION_TOKEN,
            confirmed: true,
          }),
        /ACTIVE_EXECUTION_IN_PROGRESS/
      );

      // Clear active execution and execute Full Local Data Wipe
      __internalSetSimulatedActiveSession(s.id, false);
      const readyPreview = await previewFullDataWipe();
      assert.equal(readyPreview.canProceed, true);
      assert.equal(readyPreview.sessionsToDelete, 1);
      assert.equal(readyPreview.messagesToDelete, 1);
      assert.equal(readyPreview.telemetryRecordsToDelete, 1);
      assert.equal(readyPreview.providerCredentialsToDelete, 1);

      const wipeReport = await executeFullDataWipe({
        confirmationToken: FULL_WIPE_CONFIRMATION_TOKEN,
        confirmed: true,
        includeCredentials: true,
        includeSettings: true,
      });

      assert.equal(wipeReport.verificationStatus, "verified");
      assert.equal(wipeReport.deletedSessionsCount, 1);
      assert.equal(wipeReport.deletedMessagesCount, 1);
      assert.equal(wipeReport.deletedTelemetryRecordsCount, 1);
      assert.equal(wipeReport.deletedCredentialsCount, 1);
      assert.equal(wipeReport.remainingSessionsCount, 0);
      assert.equal(wipeReport.remainingMessagesCount, 0);
      assert.equal(wipeReport.remainingTelemetryRecordsCount, 0);
      assert.equal(wipeReport.remainingSearchIndexEntriesCount, 0);
      assert.equal(wipeReport.remainingCredentialsCount, 0);

      // Verify credentials and settings were reset
      const credsAfter = await listProviderCredentialStatuses();
      assert.equal(credsAfter.length, 0);
      const settingsAfter = await getAppSettings();
      assert.equal(settingsAfter.routingPreferenceMode, "balanced");
    });
  });

  // ==========================================================================
  // 7. Concurrency Lock, Failure Injection & Large-Dataset Performance (10k / 50k)
  // ==========================================================================
  describe("7. Concurrency Lock, Failure Injection & Large-Dataset Cleanup (10k / 50k)", () => {
    it("blocks concurrent cleanup/wipe operations when an operation lock is held and preserves state on failure injection", async () => {
      const s = await createChatSession({ title: "Rollback Safety" });
      await appendChatMessage({
        sessionId: s.id,
        sender: "user",
        content: "Must survive failed cleanup",
      });

      // Concurrent lock check
      setMockPrivacyTestHooks({ operationInProgress: true });
      await assert.rejects(
        () =>
          executeDataCleanup({
            scope: "telemetry_only",
            deleteAllInScope: true,
            confirmed: true,
          }),
        /already in progress/
      );
      setMockPrivacyTestHooks({ operationInProgress: false });

      // Simulated DB failure during cleanup preserves existing sessions
      setMockPrivacyTestHooks({ failureTarget: "cleanup" });
      await assert.rejects(
        () =>
          executeDataCleanup({
            scope: "history_only",
            deleteAllInScope: true,
            confirmed: true,
          }),
        /simulated database error/
      );
      setMockPrivacyTestHooks({ failureTarget: null });

      const inv = await getDataInventory();
      assert.equal(inv.totalUserSessions, 1);
      assert.equal(inv.totalUserMessages, 1);
    });

    it("previews and cleans 50,000 telemetry records deterministically within performance budget", async () => {
      const now = Date.now();
      const batch: TelemetryRecord[] = [];
      for (let i = 0; i < 50_000; i++) {
        const isOld = i < 40_000;
        batch.push(
          makeTelemetryRecord(
            `perf_tel_${i}`,
            isOld ? now - 45 * DAY_MS - i : now - 2 * DAY_MS - i
          )
        );
      }
      __internalInsertMockTelemetryBatch(batch);

      const startMs = Date.now();
      const preview = await previewDataCleanup({
        scope: "telemetry_only",
        olderThanDays: 30,
      });
      assert.equal(preview.eligibleTelemetryRecordsCount, 40_000);

      const cleanup = await executeDataCleanup({
        scope: "telemetry_only",
        olderThanDays: 30,
        confirmed: true,
      });
      const elapsedMs = Date.now() - startMs;

      assert.equal(cleanup.deletedTelemetryRecordsCount, 40_000);
      assert.equal(cleanup.remainingTelemetryRecordsCount, 10_000);
      assert.equal(cleanup.verificationStatus, "verified");
      assert.ok(
        elapsedMs < 3000,
        `Expected 50k preview+cleanup in <3000ms, took ${elapsedMs}ms`
      );
    });

    it("formats UI badges deterministically across all DataCategory, DeletionPolicy, and AuditHealthState variants", () => {
      assert.equal(formatCategoryBadge("user_content").label, "User Content");
      assert.equal(formatCategoryBadge("secret").label, "Secret (DPAPI)");
      assert.equal(
        formatDeletionPolicyBadge("retention_eligible").label,
        "Retention Eligible"
      );
      assert.equal(
        formatDeletionPolicyBadge("rebuildable").label,
        "Rebuildable"
      );
      assert.equal(formatHealthStateBadge("healthy").label, "Healthy");
      assert.equal(
        formatHealthStateBadge("healthy_with_warnings").label,
        "Healthy with Warnings"
      );
      assert.equal(
        formatHealthStateBadge("needs_attention").label,
        "Needs Attention"
      );
      assert.equal(formatHealthStateBadge("corrupted").label, "Corrupted");
    });
  });
});

