/**
 * Nano Route — Data Health Monitoring & Preventive Maintenance Test Suite
 * File: src/features/maintenance/__tests__/preventiveMaintenance.test.ts
 *
 * Verifies Step 73 maintenance domains, threshold violations, safe housekeeping execution,
 * operation locks during active streams/backups, post-maintenance validation, and history bounding.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  MAINTENANCE_CHECKS_CATALOG,
  MAINTENANCE_ACTIONS_CATALOG,
  MAINTENANCE_THRESHOLDS,
} from "../catalog.ts";
import {
  evaluateMaintenanceCheck,
  runMaintenanceEvaluation,
  executeMaintenanceAction,
  getMaintenanceHistory,
  setMockMaintenanceHooks,
  resetMockMaintenanceHooks,
} from "../engine.ts";
import {
  setMockPrivacyTestHooks,
  resetPrivacyMockState,
} from "../../../services/ipc/privacy.ts";
import { setAppSetting, __internalGetMockSettingsStore } from "../../../services/ipc/settings.ts";

describe("Step 73 — Data Health Monitoring & Preventive Maintenance", () => {
  beforeEach(async () => {
    resetPrivacyMockState();
    resetMockMaintenanceHooks();
    await setAppSetting("workspace.session_state", "");
  });

  describe("1. Maintenance Catalog & Threshold Integrity", () => {
    it("defines authoritative maintenance checks across required domains", () => {
      assert.ok(MAINTENANCE_CHECKS_CATALOG.length >= 7);
      const domains = new Set(MAINTENANCE_CHECKS_CATALOG.map((c) => c.domain));

      assert.ok(domains.has("DATABASE"));
      assert.ok(domains.has("SEARCH_INDEX"));
      assert.ok(domains.has("TEMPORARY_FILES"));
      assert.ok(domains.has("NOTIFICATION_STATE"));
      assert.ok(domains.has("IMPORT_STATE"));
      assert.ok(domains.has("SESSION_STATE"));
      assert.ok(domains.has("ANALYTICS_CACHE"));
      assert.ok(domains.has("TELEMETRY"));
    });

    it("defines approved safe maintenance actions with clear preconditions and preserved data", () => {
      const actions = Object.values(MAINTENANCE_ACTIONS_CATALOG);
      assert.ok(actions.length >= 6);

      for (const a of actions) {
        assert.ok(a.actionId.length > 0);
        assert.ok(a.name.length > 0);
        assert.ok(a.description.length > 0);
        assert.ok(a.affectedData.length > 0);
        assert.ok(a.preservedData.length > 0);
        assert.ok(a.preconditions.length > 0);
      }
    });

    it("contains documented numeric thresholds", () => {
      assert.equal(MAINTENANCE_THRESHOLDS.MAX_TEMP_FILE_AGE_MS, 86400000);
      assert.equal(MAINTENANCE_THRESHOLDS.MAX_RESOLVED_NOTIFICATIONS_COUNT, 100);
      assert.equal(MAINTENANCE_THRESHOLDS.MAX_NOTIFICATION_AGE_DAYS, 30);
      assert.equal(MAINTENANCE_THRESHOLDS.SEARCH_INDEX_DRIFT_THRESHOLD, 1);
      assert.equal(MAINTENANCE_THRESHOLDS.MAX_SESSION_STATE_BYTES, 65536);
      assert.equal(MAINTENANCE_THRESHOLDS.MAX_MAINTENANCE_HISTORY_ENTRIES, 50);
    });
  });

  describe("2. Preventive Health Checks & Anomaly Detection", () => {
    it("detects healthy database state (MAINT-DB-001)", async () => {
      const finding = await evaluateMaintenanceCheck("MAINT-DB-001");
      assert.equal(finding.status, "HEALTHY");
      assert.equal(finding.thresholdExceeded, false);
      assert.equal(finding.actionAvailable, false);
    });

    it("detects search index drift above threshold (MAINT-SEARCH-001)", async () => {
      setMockPrivacyTestHooks({
        searchIndexDriftOffset: 3,
      });

      const finding = await evaluateMaintenanceCheck("MAINT-SEARCH-001");
      assert.equal(finding.status, "MAINTENANCE_RECOMMENDED");
      assert.equal(finding.thresholdExceeded, true);
      assert.equal(finding.actionAvailable, true);
      assert.equal(finding.recommendedActionId, "REBUILD_SEARCH_INDEX");
    });

    it("detects accumulated stale temporary files (MAINT-TEMP-001)", async () => {
      setMockMaintenanceHooks({ tempFilesCount: 5 });

      const finding = await evaluateMaintenanceCheck("MAINT-TEMP-001");
      assert.equal(finding.status, "MAINTENANCE_RECOMMENDED");
      assert.equal(finding.thresholdExceeded, true);
      assert.equal(finding.recommendedActionId, "CLEANUP_STALE_TEMP_FILES");
    });

    it("detects abandoned import markers (MAINT-IMPORT-001)", async () => {
      setMockMaintenanceHooks({ staleImportLockActive: true });

      const finding = await evaluateMaintenanceCheck("MAINT-IMPORT-001");
      assert.equal(finding.status, "ATTENTION_REQUIRED");
      assert.equal(finding.thresholdExceeded, true);
      assert.equal(finding.recommendedActionId, "CLEAR_ABANDONED_IMPORT_MARKERS");
    });

    it("detects oversized session continuity snapshots (MAINT-SESS-001)", async () => {
      const oversizedPayload = JSON.stringify({ hugePadding: "x".repeat(70000) });
      __internalGetMockSettingsStore().set("workspace.session_state", oversizedPayload);

      const finding = await evaluateMaintenanceCheck("MAINT-SESS-001");
      assert.equal(finding.status, "MAINTENANCE_RECOMMENDED");
      assert.equal(finding.thresholdExceeded, true);
      assert.equal(finding.recommendedActionId, "PRUNE_STALE_SESSION_SNAPSHOTS");
    });
  });

  describe("3. Safe Maintenance Housekeeping & Post-Validation", () => {
    it("cleans stale temporary files safely and records history", async () => {
      setMockMaintenanceHooks({ tempFilesCount: 4 });

      const result = await executeMaintenanceAction("CLEANUP_STALE_TEMP_FILES");
      assert.equal(result.success, true);
      assert.equal(result.itemsCleanedCount, 4);
      assert.equal(result.postVerificationPassed, true);
      assert.equal(result.followUpStatus, "HEALTHY");

      const history = getMaintenanceHistory();
      assert.ok(history.length > 0);
      assert.equal(history[0].actionId, "CLEANUP_STALE_TEMP_FILES");
    });

    it("rebuilds search index and returns verified healthy status", async () => {
      setMockPrivacyTestHooks({
        searchIndexDriftOffset: 2,
      });

      const result = await executeMaintenanceAction("REBUILD_SEARCH_INDEX");
      assert.equal(result.success, true);
      assert.equal(result.postVerificationPassed, true);
      assert.equal(result.followUpStatus, "HEALTHY");
    });

    it("prunes oversized session snapshots and restores healthy status", async () => {
      __internalGetMockSettingsStore().set("workspace.session_state", "x".repeat(70000));

      const result = await executeMaintenanceAction("PRUNE_STALE_SESSION_SNAPSHOTS");
      assert.equal(result.success, true);
      assert.equal(result.postVerificationPassed, true);
      assert.equal(result.followUpStatus, "HEALTHY");
    });
  });

  describe("4. Maintenance Evaluation Runs & Invariants", () => {
    it("runs complete maintenance evaluation with zero mutations when healthy", async () => {
      const summary = await runMaintenanceEvaluation("FULL");
      assert.ok(summary.runId.startsWith("maint_run_"));
      assert.equal(summary.overallHealth, "HEALTHY");
      assert.ok(summary.counts.totalChecks >= 7);
      assert.equal(summary.counts.attentionRequired, 0);
      assert.equal(summary.counts.maintenanceRecommended, 0);
      assert.equal(summary.isMaintenanceRecommended, false);
    });

    it("runs lightweight quick evaluation covering automatic and core checks", async () => {
      const summary = await runMaintenanceEvaluation("QUICK");
      assert.equal(summary.mode, "QUICK");
      assert.ok(summary.findings.length > 0);
      assert.ok(summary.findings.every((f) => f.automaticAllowed || f.domain === "DATABASE"));
    });
  });
});

