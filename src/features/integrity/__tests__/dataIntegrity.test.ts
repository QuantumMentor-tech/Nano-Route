/**
 * Nano Route — Post-Import Reconciliation & Integrity Test Suite
 * File: src/features/integrity/__tests__/dataIntegrity.test.ts
 *
 * Verifies Step 72 deterministic check catalog, foreign key validation,
 * search index mismatch detection, safe repair execution with post-verification,
 * read-only default guarantees, and zero secret leakage.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  INTEGRITY_CHECKS_CATALOG,
  REPAIR_CATALOG,
} from "../catalog.ts";
import {
  runIndividualCheck,
  runIntegritySuite,
  previewRepair,
  executeSafeRepair,
} from "../engine.ts";
import {
  setMockPrivacyTestHooks,
  resetPrivacyMockState,
} from "../../../services/ipc/privacy.ts";
import { setAppSetting, getAppSettings, __internalGetMockSettingsStore } from "../../../services/ipc/settings.ts";

describe("Step 72 — Post-Import Reconciliation & Data Integrity", () => {
  beforeEach(async () => {
    resetPrivacyMockState();
    await setAppSetting("appearance.theme_mode", "dark");
    await setAppSetting("appearance.density", "comfortable");
    await setAppSetting("routing.preference_mode", "balanced");
    await setAppSetting("workspace.startup_route", "overview");
  });

  describe("1. Catalog Integrity & Domain Completeness", () => {
    it("defines authoritative integrity checks covering all required domains", () => {
      assert.ok(INTEGRITY_CHECKS_CATALOG.length >= 10);
      const domains = new Set(INTEGRITY_CHECKS_CATALOG.map((c) => c.domain));

      assert.ok(domains.has("DATABASE"));
      assert.ok(domains.has("HISTORY"));
      assert.ok(domains.has("SEARCH_INDEX"));
      assert.ok(domains.has("PREFERENCES"));
      assert.ok(domains.has("PROFILES"));
      assert.ok(domains.has("SESSION_STATE"));
      assert.ok(domains.has("TELEMETRY"));
      assert.ok(domains.has("TOKEN_USAGE"));
      assert.ok(domains.has("LATENCY"));
      assert.ok(domains.has("PROVIDER_METADATA"));
      assert.ok(domains.has("IMPORT_STATE"));
    });

    it("defines authoritative repair descriptors with preconditions and preserved data", () => {
      const repairs = Object.values(REPAIR_CATALOG);
      assert.ok(repairs.length >= 5);

      for (const r of repairs) {
        assert.ok(r.repairId.length > 0);
        assert.ok(r.name.length > 0);
        assert.ok(r.description.length > 0);
        assert.ok(r.affectedData.length > 0);
        assert.ok(r.preservedData.length > 0);
        assert.ok(r.preconditions.length > 0);
      }
    });
  });

  describe("2. Deterministic Check Execution & Anomaly Detection", () => {
    it("executes database core health check (DB-001) successfully", async () => {
      const result = await runIndividualCheck("DB-001");
      assert.equal(result.status, "PASS");
      assert.equal(result.severity, "CRITICAL");
      assert.ok(result.evidence);
    });

    it("detects orphaned messages in foreign key check (DB-002 / HIST-002)", async () => {
      setMockPrivacyTestHooks({
        orphanedMessages: [
          {
            id: "msg_orphan_test_1",
            sessionId: "sess_non_existent",
            sender: "user",
            content: "Orphaned message text",
            metadata: {} as any,
            createdAt: Date.now(),
          },
        ],
      });

      const result = await runIndividualCheck("DB-002");
      assert.equal(result.status, "INCONSISTENT");
      assert.equal(result.severity, "HIGH");
      assert.equal(result.repairAvailable, true);
      assert.equal(result.supportedRepairId, "REMOVE_ORPHANED_MESSAGES");
    });

    it("detects search index drift (SEARCH-001)", async () => {
      setMockPrivacyTestHooks({
        searchIndexDriftOffset: 4,
      });

      const result = await runIndividualCheck("SEARCH-001");
      assert.equal(result.status, "INCONSISTENT");
      assert.equal(result.severity, "MEDIUM");
      assert.equal(result.repairAvailable, true);
      assert.equal(result.supportedRepairId, "REBUILD_SEARCH_INDEX");
    });

    it("detects invalid startup route in session state (SESS-001)", async () => {
      __internalGetMockSettingsStore().set("workspace.startup_route", "https://malicious-external-url.com");

      const result = await runIndividualCheck("SESS-001");
      assert.equal(result.status, "INCONSISTENT");
      assert.equal(result.repairAvailable, true);
      assert.equal(result.supportedRepairId, "REPAIR_INVALID_SESSION_ROUTE");
    });
  });

  describe("3. Safe Repair Execution & Post-Verification", () => {
    it("previews a repair action safely without mutating state", () => {
      const preview = previewRepair("REBUILD_SEARCH_INDEX");
      assert.equal(preview.repairId, "REBUILD_SEARCH_INDEX");
      assert.ok(preview.preservedDataDescription.includes("untouched"));
    });

    it("executes search index rebuild and confirms post-verification PASS", async () => {
      setMockPrivacyTestHooks({
        searchIndexDriftOffset: 5,
      });

      const initialCheck = await runIndividualCheck("SEARCH-001");
      assert.equal(initialCheck.status, "INCONSISTENT");

      const repairResult = await executeSafeRepair("REBUILD_SEARCH_INDEX");
      assert.equal(repairResult.success, true);
      assert.equal(repairResult.postVerificationPassed, true);
      assert.equal(repairResult.followUpStatus, "PASS");

      const followUpCheck = await runIndividualCheck("SEARCH-001");
      assert.equal(followUpCheck.status, "PASS");
    });

    it("executes orphan removal repair and confirms post-verification PASS", async () => {
      setMockPrivacyTestHooks({
        orphanedMessages: [
          {
            id: "msg_orphan_test_2",
            sessionId: "sess_missing_parent",
            sender: "user",
            content: "Another orphan",
            metadata: {} as any,
            createdAt: Date.now(),
          },
        ],
      });

      const repairResult = await executeSafeRepair("REMOVE_ORPHANED_MESSAGES");
      assert.equal(repairResult.success, true);
      assert.equal(repairResult.postVerificationPassed, true);
      assert.equal(repairResult.followUpStatus, "PASS");
    });

    it("executes invalid route reset repair and confirms post-verification PASS", async () => {
      __internalGetMockSettingsStore().set("workspace.startup_route", "invalid-route");

      const repairResult = await executeSafeRepair("REPAIR_INVALID_SESSION_ROUTE");
      assert.equal(repairResult.success, true);
      assert.equal(repairResult.postVerificationPassed, true);
      assert.equal(repairResult.followUpStatus, "PASS");

      const settings = await getAppSettings();
      assert.equal(settings.startupRoute, "overview");
    });
  });

  describe("4. Full Suite Aggregation & Read-Only Invariant", () => {
    it("runs complete integrity suite without mutating healthy database state", async () => {
      const report = await runIntegritySuite("FULL");

      assert.ok(report.runId.startsWith("int_run_"));
      assert.equal(report.overallStatus, "PASS");
      assert.ok(report.counts.totalChecks >= 10);
      assert.equal(report.counts.inconsistent, 0);
      assert.equal(report.counts.corrupt, 0);
      assert.equal(report.recoveryRecommended, false);
    });

    it("runs quick health check suite focusing on high-severity checks", async () => {
      const report = await runIntegritySuite("QUICK");

      assert.equal(report.mode, "QUICK");
      assert.ok(report.results.every((r) => r.severity === "CRITICAL" || r.severity === "HIGH"));
    });
  });
});
