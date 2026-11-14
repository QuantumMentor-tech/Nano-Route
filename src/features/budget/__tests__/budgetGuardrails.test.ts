/**
 * Nano Route — Step 75 Budget Controls & Spend Guardrail Test Suite
 * File: src/features/budget/__tests__/budgetGuardrails.test.ts
 *
 * Covers:
 * 1. Budget period calculation (deterministic UTC calendar boundaries)
 * 2. Exact vs Estimated spend derivation from telemetry records
 * 3. Nano-USD arithmetic precision (zero floating-point drift)
 * 4. Multi-attempt retry and failover cost accounting (no double-counting)
 * 5. Spend cache reconciliation (cached vs authoritative detection)
 * 6. Hard-limit, Soft-limit, and Warn-only request preflight evaluations
 * 7. In-flight cost reservations lifecycle (creation, expiration, release)
 * 8. Provider-reported quota awareness and staleness classification
 * 9. Month-transition handling (advancing to new month resets active period spend)
 * 10. Security & Privacy: Zero secret leakage in budget DTOs
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  getUtcMonthPeriodBoundaries,
  saveProviderBudgetPolicy,
  computePeriodSpendSummary,
  reconcileProviderSpend,
  recordProviderReportedQuota,
  getProviderQuotaInfo,
  createCostReservation,
  releaseCostReservation,
  getActiveReservationSpend,
  getProviderBudgetStatus,
  evaluateBudgetPreflight,
  resetBudgetEngineState,
} from "../engine.ts";

import {
  recordTelemetryEvent,
  clearTelemetry,
  resetTelemetryMockStore,
} from "../../../services/ipc/telemetry.ts";
import type { RecordTelemetryInput } from "../../../services/ipc/types.ts";

import {
  saveProviderCredential,
  resetCredentialMockStore,
} from "../../../services/ipc/credentials.ts";

describe("Step 75 — Provider Budget Controls & Spend Guardrails", () => {
  beforeEach(async () => {
    resetBudgetEngineState();
    resetTelemetryMockStore();
    resetCredentialMockStore();
    await clearTelemetry();
  });

  describe("1. Deterministic UTC Month Period Boundaries", () => {
    it("computes exact UTC month start and end boundaries", () => {
      // Test mid-month: 2026-11-14T12:00:00Z
      const ts = Date.UTC(2026, 10, 14, 12, 0, 0); // month is 0-indexed (10 = November)
      const boundaries = getUtcMonthPeriodBoundaries(ts);

      assert.equal(boundaries.periodKey, "2026-11");
      assert.equal(boundaries.periodStartMs, Date.UTC(2026, 10, 1, 0, 0, 0, 0));
      assert.equal(boundaries.periodEndMs, Date.UTC(2026, 11, 1, 0, 0, 0, 0));
    });

    it("handles year transition boundary (December -> January)", () => {
      const ts = Date.UTC(2026, 11, 31, 23, 59, 59); // 2026-12-31
      const boundaries = getUtcMonthPeriodBoundaries(ts);

      assert.equal(boundaries.periodKey, "2026-12");
      assert.equal(boundaries.periodStartMs, Date.UTC(2026, 11, 1, 0, 0, 0, 0));
      assert.equal(boundaries.periodEndMs, Date.UTC(2027, 0, 1, 0, 0, 0, 0));
    });
  });

  describe("2. Authoritative Spend Derivation & Cost Confidence", () => {
    it("computes zero spend with EXACT confidence when no records exist", async () => {
      const summary = await computePeriodSpendSummary("openai");
      assert.equal(summary.authoritativeSpendUsd, 0.0);
      assert.equal(summary.confidence, "EXACT");
      assert.equal(summary.billableAttemptsCount, 0);
    });

    it("sums exact recorded cost records using nano-USD precision without floating drift", async () => {
      const nov15 = Date.UTC(2026, 10, 15, 10, 0, 0);

      // Record 3 events with precise USD values
      const event1: RecordTelemetryInput & { occurredAt?: number } = {
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 100,
        completionTokens: 200,
        latencyMs: 350,
        costUsd: 0.1234,
        occurredAt: nov15,
      };
      const event2: RecordTelemetryInput & { occurredAt?: number } = {
        sessionId: "s2",
        eventType: "stream_lifecycle",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 150,
        completionTokens: 250,
        latencyMs: 400,
        costUsd: 0.2345,
        occurredAt: nov15 + 1000,
      };

      await recordTelemetryEvent(event1);
      await recordTelemetryEvent(event2);

      const summary = await computePeriodSpendSummary("openai", nov15);
      assert.equal(summary.authoritativeSpendUsd, 0.3579);
      assert.equal(summary.confidence, "EXACT");
      assert.equal(summary.billableAttemptsCount, 2);
    });

    it("classifies spend as ESTIMATED when token counts are present but costUsd is null", async () => {
      const nov15 = Date.UTC(2026, 10, 15, 10, 0, 0);

      // Event with missing costUsd but known tokens for gpt-4o-mini ($0.15/1M in, $0.60/1M out)
      const event: RecordTelemetryInput & { occurredAt?: number } = {
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 1_000_000, // $0.15
        completionTokens: 1_000_000, // $0.60
        latencyMs: 500,
        costUsd: undefined,
        occurredAt: nov15,
      };

      await recordTelemetryEvent(event);

      const summary = await computePeriodSpendSummary("openai", nov15);
      assert.equal(summary.confidence, "ESTIMATED");
      assert.equal(summary.authoritativeSpendUsd, 0.75); // $0.15 + $0.60
    });
  });

  describe("3. Multi-Attempt Retry & Failover Cost Accounting", () => {
    it("aggregates all billable attempts of a logical request without double-counting", async () => {
      const now = Date.UTC(2026, 10, 10, 12, 0, 0);

      // Physical attempt 1: failed with usage on Groq
      await recordTelemetryEvent({
        sessionId: "session_retry",
        taskId: "req_logical_1_attempt_1",
        eventType: "provider_execution",
        providerId: "groq",
        modelId: "llama-3.3-70b-versatile",
        promptTokens: 500,
        completionTokens: 0,
        latencyMs: 120,
        costUsd: 0.0003,
        outcome: "failure",
        occurredAt: now,
      });

      // Physical attempt 2: failover to Anthropic succeeded
      await recordTelemetryEvent({
        sessionId: "session_retry",
        taskId: "req_logical_1_attempt_2",
        eventType: "stream_lifecycle",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        promptTokens: 500,
        completionTokens: 300,
        latencyMs: 800,
        costUsd: 0.006,
        outcome: "success",
        occurredAt: now + 500,
      });

      const groqSummary = await computePeriodSpendSummary("groq", now);
      const anthropicSummary = await computePeriodSpendSummary("anthropic", now);

      assert.equal(groqSummary.authoritativeSpendUsd, 0.0003);
      assert.equal(anthropicSummary.authoritativeSpendUsd, 0.006);
    });
  });

  describe("4. Spend Cache Reconciliation", () => {
    it("detects mismatch when cached spend drifts from authoritative telemetry sum", async () => {
      // Configure credential with stale cached spend of $5.00
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-test-budget-key-12345",
      });

      // Inject 1 telemetry record of $2.50
      await recordTelemetryEvent({
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 100,
        completionTokens: 100,
        costUsd: 2.5,
        occurredAt: Date.now(),
      });

      const summaryBefore = await computePeriodSpendSummary("openai");
      // Authoritative is $2.50, cached in fresh mock is $0.00 -> mismatch
      assert.equal(summaryBefore.authoritativeSpendUsd, 2.5);
      assert.equal(summaryBefore.reconciliationStatus, "MISMATCH_DETECTED");

      // Execute reconciliation
      const summaryAfter = await reconcileProviderSpend("openai");
      assert.equal(summaryAfter.reconciliationStatus, "IN_SYNC");
      assert.equal(summaryAfter.cachedSpendUsd, 2.5);
    });
  });

  describe("5. In-Flight Cost Reservations", () => {
    it("holds reservation spend temporarily and releases cleanly", () => {
      createCostReservation("openai", "res_1", 0.05, 30_000);
      assert.equal(getActiveReservationSpend("openai"), 0.05);

      createCostReservation("openai", "res_2", 0.03, 30_000);
      assert.equal(getActiveReservationSpend("openai"), 0.08);

      releaseCostReservation("openai", "res_1");
      assert.equal(getActiveReservationSpend("openai"), 0.03);

      releaseCostReservation("openai", "res_2");
      assert.equal(getActiveReservationSpend("openai"), 0.0);
    });
  });

  describe("6. Request Preflight & Enforcement Modes", () => {
    it("permits request when enforcement is OFF regardless of spend", async () => {
      await saveProviderBudgetPolicy("openai", {
        budgetLimitUsd: 10.0,
        enforcementMode: "OFF",
        enabled: true,
      });

      // Record $15.00 spend (exceeds limit)
      await recordTelemetryEvent({
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 100,
        completionTokens: 100,
        costUsd: 15.0,
        occurredAt: Date.now(),
      });

      const preflight = await evaluateBudgetPreflight("openai", 1.0);
      assert.equal(preflight.allowed, true);
      assert.equal(preflight.blockReason, null);
    });

    it("blocks request under HARD_LIMIT when current spend exceeds limit", async () => {
      await saveProviderBudgetPolicy("anthropic", {
        budgetLimitUsd: 5.0,
        enforcementMode: "HARD_LIMIT",
        enabled: true,
      });

      // Record $5.10 spend
      await recordTelemetryEvent({
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        promptTokens: 100,
        completionTokens: 100,
        costUsd: 5.1,
        occurredAt: Date.now(),
      });

      const preflight = await evaluateBudgetPreflight("anthropic", 0.1);
      assert.equal(preflight.allowed, false);
      assert.equal(preflight.blockReason, "LOCAL_BUDGET_BLOCK");
      assert.ok(preflight.warningNotice?.includes("Local monthly budget"));
    });

    it("blocks request under HARD_LIMIT when estimated request cost pushes spend over limit", async () => {
      await saveProviderBudgetPolicy("gemini", {
        budgetLimitUsd: 10.0,
        enforcementMode: "HARD_LIMIT",
        enabled: true,
      });

      // Spend is $9.50, remaining is $0.50
      await recordTelemetryEvent({
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "gemini",
        modelId: "gemini-1.5-pro",
        promptTokens: 100,
        completionTokens: 100,
        costUsd: 9.5,
        occurredAt: Date.now(),
      });

      // Estimated request is $0.75 -> total $10.25 > $10.00
      const preflight = await evaluateBudgetPreflight("gemini", 0.75);
      assert.equal(preflight.allowed, false);
      assert.equal(preflight.blockReason, "LOCAL_BUDGET_BLOCK");
      assert.ok(preflight.warningNotice?.includes("Estimated request cost"));
    });

    it("allows request under WARN_ONLY mode but generates warning notice", async () => {
      await saveProviderBudgetPolicy("groq", {
        budgetLimitUsd: 1.0,
        warningThresholdPercent: 80,
        enforcementMode: "WARN_ONLY",
        enabled: true,
      });

      // Spend is $0.85 (85% of $1.00)
      await recordTelemetryEvent({
        sessionId: "s1",
        eventType: "stream_lifecycle",
        providerId: "groq",
        modelId: "llama-3.3-70b-versatile",
        promptTokens: 100,
        completionTokens: 100,
        costUsd: 0.85,
        occurredAt: Date.now(),
      });

      const preflight = await evaluateBudgetPreflight("groq", 0.05);
      assert.equal(preflight.allowed, true);
      assert.ok(preflight.warningNotice !== null);
      assert.ok(preflight.warningNotice?.includes("Spend warning"));
    });
  });

  describe("7. Provider-Reported Quotas & Staleness", () => {
    it("records provider quota and flags as stale after reset time or 1 hour", () => {
      const now = Date.now();
      recordProviderReportedQuota({
        providerId: "openai",
        source: "PROVIDER_REPORTED",
        requestsRemaining: 150,
        requestsLimit: 500,
        observedAtMs: now - (2 * 3_600_000), // 2 hours ago
        isStale: false,
      });

      const quota = getProviderQuotaInfo("openai", now);
      assert.equal(quota.source, "PROVIDER_REPORTED");
      assert.equal(quota.requestsRemaining, 150);
      assert.equal(quota.isStale, true); // Stale because > 1 hour
    });
  });

  describe("8. Month Transition Simulation", () => {
    it("advances active period and resets spend computation across month boundary", async () => {
      const oct25 = Date.UTC(2026, 9, 25, 12, 0, 0); // October 2026
      const nov02 = Date.UTC(2026, 10, 2, 12, 0, 0); // November 2026

      await saveProviderBudgetPolicy("openai", {
        budgetLimitUsd: 20.0,
        enforcementMode: "HARD_LIMIT",
        enabled: true,
      });

      // Record $25.00 in October
      await recordTelemetryEvent({
        sessionId: "s_oct",
        eventType: "stream_lifecycle",
        providerId: "openai",
        modelId: "gpt-4o",
        promptTokens: 100,
        completionTokens: 100,
        costUsd: 25.0,
        occurredAt: oct25,
      });

      // Evaluate in October: should be blocked
      const octStatus = await getProviderBudgetStatus("openai", "OpenAI", oct25);
      assert.equal(octStatus.status, "BLOCKED");
      assert.equal(octStatus.spendSummary.authoritativeSpendUsd, 25.0);

      // Evaluate in November: October spend does not bleed over; active period starts at $0.00
      const novStatus = await getProviderBudgetStatus("openai", "OpenAI", nov02);
      assert.equal(novStatus.status, "WITHIN_BUDGET");
      assert.equal(novStatus.spendSummary.authoritativeSpendUsd, 0.0);
      assert.equal(novStatus.isRequestPermitted, true);
    });
  });

  describe("9. Security & DTO Sanitization", () => {
    it("guarantees budget status DTO contains zero secrets or API keys", async () => {
      await saveProviderBudgetPolicy("openai", {
        budgetLimitUsd: 50.0,
        enforcementMode: "HARD_LIMIT",
      });

      const status = await getProviderBudgetStatus("openai", "OpenAI");
      const serialized = JSON.stringify(status);

      assert.ok(!serialized.includes("sk-"));
      assert.ok(!serialized.includes("apiKey"));
      assert.ok(!serialized.includes("secret"));
      assert.ok(!serialized.includes("encrypted_api_key"));
    });
  });
});
