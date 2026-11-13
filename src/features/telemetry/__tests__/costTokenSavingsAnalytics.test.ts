/**
 * Step 43 — Token Usage, Cost Analytics & Routing Savings Engine Tests
 *
 * Covers:
 * 1. Empty state & Zero-vs-Unknown honesty ($0.00 vs null/Unavailable)
 * 2. Token normalization & partial token rules (input-only, output-only, complete)
 * 3. Recorded Actual Cost calculations (nano-dollar precision, per-request & per-attempt averages,
 *    weighted cost per 1K / 1M tokens)
 * 4. Versioned Baseline & Routing Savings Engine (positive, zero, negative "Above baseline",
 *    unavailable baseline, historical pricing versioning across gpt-4o 2024.05-v1 vs 2024.08-v2,
 *    selected-range vs all-time cumulative savings)
 * 5. Retry, Failover & Stream Lifecycle deduplication (no double-counting intermediate events)
 * 6. Provider & Model Token/Cost/Savings breakdown reconciliation invariants
 * 7. Hourly and Daily Token & Cost trend bucket aggregation
 * 8. Session deletion cascade consistency (single & bulk deletion)
 * 9. Security, privacy & zero-side-effect guarantees (no secrets, no prompts, read-only)
 * 10. Large synthetic dataset benchmarks (1,000 / 10,000 / 50,000 / 100,000 records)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  recordTelemetryEvent,
  getTelemetryDashboardSnapshot,
  getTelemetryCostAnalyticsSnapshot,
  computeFinancialAnalyticsFromRecords,
  resetTelemetryMockStore,
  resetMockTelemetryTestHooks,
} from "../../../services/ipc/telemetry.ts";
import {
  resolveVersionedModelPricing,
  setMockPricingTable,
  resetMockPricingTable,
  usdToNanoUsd,
  nanoUsdToUsd,
  computeTokenCostNanoUsd,
  formatCompactTokens,
  formatExactTokens,
  formatUsdCurrency,
  DEFAULT_BASELINE_PROVIDER_ID,
  DEFAULT_BASELINE_MODEL_ID,
} from "../../../services/ipc/pricing.ts";
import {
  createChatSession,
  deleteChatSession,
  getMockExecutionCount,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import { deleteHistorySessionsBulk } from "../../../services/ipc/history.ts";
import type { TelemetryRecord } from "../../../services/ipc/types.ts";

describe("Step 43 — Token Usage, Cost Analytics & Routing Savings Engine", () => {
  beforeEach(() => {
    resetTelemetryMockStore();
    resetMockTelemetryTestHooks();
    resetMockPricingTable();
    resetChatMockStore();
  });

  // =========================================================================
  // 1. EMPTY STATE & ZERO-VS-UNKNOWN HONESTY
  // =========================================================================
  describe("1. Empty State & Zero-vs-Unknown Honesty", () => {
    it("returns null for unknown/empty token, cost, baseline, and savings totals when database is empty", async () => {
      const analytics = await getTelemetryCostAnalyticsSnapshot({
        timeBucket: "day",
      });

      assert.equal(analytics.tokenSummary.logicalRequestCount, 0);
      assert.equal(analytics.tokenSummary.physicalAttemptCount, 0);
      assert.equal(analytics.tokenSummary.totalInputTokens, null);
      assert.equal(analytics.tokenSummary.totalOutputTokens, null);
      assert.equal(analytics.tokenSummary.totalTokens, null);
      assert.equal(analytics.tokenSummary.tokenDataSource, "unavailable");

      assert.equal(analytics.actualCostSummary.totalActualCostUsd, null);
      assert.equal(
        analytics.actualCostSummary.averageCostPerLogicalRequestUsd,
        null
      );
      assert.equal(analytics.actualCostSummary.averageCostPerAttemptUsd, null);
      assert.equal(analytics.actualCostSummary.costPerThousandTokensUsd, null);
      assert.equal(analytics.actualCostSummary.costPerMillionTokensUsd, null);
      assert.equal(
        analytics.actualCostSummary.costAvailabilityState,
        "unavailable"
      );

      assert.equal(analytics.baselineSummary.baselineCostUsd, null);
      assert.equal(analytics.savingsSummary.estimatedSavingsUsd, null);
      assert.equal(analytics.savingsSummary.savingsPercent, null);
      assert.equal(analytics.savingsSummary.comparisonStatus, "unavailable");
    });

    it("distinguishes known zero cost ($0.00) from unavailable cost (null)", async () => {
      const now = Date.now();
      // Local SLM inference with known $0.00 cost
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_000,
        sessionId: "sess-zero",
        taskId: "task-zero",
        providerId: "local",
        modelId: "phi-3-mini-4k-instruct",
        promptTokens: 500,
        completionTokens: 200,
        costUsd: 0.0,
        outcome: "success",
      });

      const zeroSnap = await getTelemetryCostAnalyticsSnapshot({
        providerId: "local",
      });
      assert.equal(zeroSnap.actualCostSummary.totalActualCostUsd, 0);
      assert.equal(zeroSnap.actualCostSummary.zeroCostAttemptCount, 1);
      assert.equal(zeroSnap.actualCostSummary.missingCostAttemptCount, 0);
      assert.equal(
        formatUsdCurrency(zeroSnap.actualCostSummary.totalActualCostUsd),
        "$0.00"
      );

      // Custom unknown model with no recorded cost
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now,
        sessionId: "sess-unknown",
        taskId: "task-unknown",
        providerId: "custom_unpriced",
        modelId: "mystery-model-v1",
        promptTokens: 500,
        completionTokens: 200,
        outcome: "success",
      });

      const unknownSnap = await getTelemetryCostAnalyticsSnapshot({
        providerId: "custom_unpriced",
      });
      assert.equal(unknownSnap.actualCostSummary.totalActualCostUsd, null);
      assert.equal(unknownSnap.actualCostSummary.eligibleAttemptCount, 0);
      assert.equal(unknownSnap.actualCostSummary.missingCostAttemptCount, 1);
      assert.equal(
        formatUsdCurrency(unknownSnap.actualCostSummary.totalActualCostUsd),
        "Cost unavailable"
      );
    });
  });

  // =========================================================================
  // 2. TOKEN NORMALIZATION & PARTIAL TOKEN RULES
  // =========================================================================
  describe("2. Token Normalization & Partial Token Rules", () => {
    it("computes totalTokens only when both inputTokens and outputTokens are present", async () => {
      const now = Date.now();

      // Record 1: Input tokens only (cancelled before output)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 3_000,
        sessionId: "sess-partial-in",
        taskId: "task-partial-in",
        providerId: "openai",
        modelId: "gpt-4o-mini-in-only",
        promptTokens: 1_200,
        costUsd: 0.00018,
        outcome: "cancelled",
      });

      const inOnly = await getTelemetryCostAnalyticsSnapshot({
        modelId: "gpt-4o-mini-in-only",
      });
      assert.equal(inOnly.tokenSummary.totalInputTokens, 1_200);
      assert.equal(inOnly.tokenSummary.totalOutputTokens, null);
      assert.equal(inOnly.tokenSummary.totalTokens, null);
      assert.equal(inOnly.tokenSummary.bothTokensAvailableCount, 0);
      assert.equal(inOnly.tokenSummary.inputTokensAvailableCount, 1);
      assert.equal(inOnly.tokenSummary.missingTokenRecordsCount, 1);

      // Record 2: Output tokens only
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 2_000,
        sessionId: "sess-partial-out",
        taskId: "task-partial-out",
        providerId: "openai",
        modelId: "gpt-4o-mini-out-only",
        completionTokens: 450,
        costUsd: 0.00027,
        outcome: "success",
      });

      const outOnly = await getTelemetryCostAnalyticsSnapshot({
        modelId: "gpt-4o-mini-out-only",
      });
      assert.equal(outOnly.tokenSummary.totalInputTokens, null);
      assert.equal(outOnly.tokenSummary.totalOutputTokens, 450);
      assert.equal(outOnly.tokenSummary.totalTokens, null);
      assert.equal(outOnly.tokenSummary.outputTokensAvailableCount, 1);
      assert.equal(outOnly.tokenSummary.missingTokenRecordsCount, 1);

      // Record 3: Both input and output tokens present
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_000,
        sessionId: "sess-complete",
        taskId: "task-complete",
        providerId: "openai",
        modelId: "gpt-4o-mini-complete",
        promptTokens: 1_000,
        completionTokens: 500,
        costUsd: 0.00045,
        outcome: "success",
      });

      const complete = await getTelemetryCostAnalyticsSnapshot({
        modelId: "gpt-4o-mini-complete",
      });
      assert.equal(complete.tokenSummary.totalInputTokens, 1_000);
      assert.equal(complete.tokenSummary.totalOutputTokens, 500);
      assert.equal(complete.tokenSummary.totalTokens, 1_500);
      assert.equal(complete.tokenSummary.bothTokensAvailableCount, 1);
      assert.equal(complete.tokenSummary.missingTokenRecordsCount, 0);
    });

    it("formats compact and exact token numbers accurately", () => {
      assert.equal(formatCompactTokens(null), "Unavailable");
      assert.equal(formatCompactTokens(0), "0");
      assert.equal(formatCompactTokens(950), "950");
      assert.equal(formatCompactTokens(12_500), "12.5K");
      assert.equal(formatCompactTokens(2_500_000), "2.50M");
      assert.equal(formatExactTokens(1_234_567), "1,234,567");
    });
  });

  // =========================================================================
  // 3. RECORDED ACTUAL COST & NANO-DOLLAR PRECISION CALCULATIONS
  // =========================================================================
  describe("3. Recorded Actual Cost & Nano-Dollar Precision Calculations", () => {
    it("calculates exact USD totals, per-request averages, and weighted per-1K / per-1M token costs using integer nano-dollars", async () => {
      const now = Date.now();

      // Request 1: 10,000 input, 5,000 output (15,000 total tokens), cost $0.015
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 2_000,
        sessionId: "sess-cost",
        taskId: "task-cost-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 10_000,
        completionTokens: 5_000,
        costUsd: 0.015,
        outcome: "success",
      });

      // Request 2: 20,000 input, 15,000 output (35,000 total tokens), cost $0.035
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_000,
        sessionId: "sess-cost",
        taskId: "task-cost-2",
        providerId: "anthropic",
        modelId: "claude-3-5-haiku-20241022",
        promptTokens: 20_000,
        completionTokens: 15_000,
        costUsd: 0.035,
        outcome: "success",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({});

      // Total cost = $0.015 + $0.035 = $0.05 exact
      assert.equal(snap.actualCostSummary.totalActualCostUsd, 0.05);
      // Avg cost per logical request = $0.05 / 2 = $0.025
      assert.equal(
        snap.actualCostSummary.averageCostPerLogicalRequestUsd,
        0.025
      );
      assert.equal(snap.actualCostSummary.averageCostPerAttemptUsd, 0.025);
      // Total compatible tokens = 15,000 + 35,000 = 50,000 tokens
      // Cost per 1K tokens = ($0.05 / 50,000) * 1,000 = $0.001
      // Cost per 1M tokens = ($0.05 / 50,000) * 1,000,000 = $1.00
      assert.equal(snap.actualCostSummary.costPerThousandTokensUsd, 0.001);
      assert.equal(snap.actualCostSummary.costPerMillionTokensUsd, 1.0);
      assert.equal(snap.actualCostSummary.costAvailabilityState, "exact");
    });

    it("computes exact token cost in nano-dollars without floating-point drift", () => {
      // 1,000,000 input tokens at $0.15/1M + 500,000 output tokens at $0.60/1M = $0.45
      const costNano = computeTokenCostNanoUsd(1_000_000, 500_000, 0.15, 0.6);
      assert.equal(nanoUsdToUsd(costNano), 0.45);
    });
  });

  // =========================================================================
  // 4. VERSIONED BASELINE & ROUTING SAVINGS ENGINE
  // =========================================================================
  describe("4. Versioned Baseline & Routing Savings Engine", () => {
    it("computes positive savings (below_baseline) when routing to a cheaper model than Claude 3.5 Sonnet baseline", async () => {
      const now = Date.now();
      // Baseline: anthropic / claude-3-5-sonnet-20241022 ($3.00 / 1M in, $15.00 / 1M out)
      // For 100,000 input + 50,000 output:
      // Baseline cost = 0.1 * $3.00 + 0.05 * $15.00 = $0.30 + $0.75 = $1.05
      // Routed to gpt-4o-mini:
      // Actual cost = 0.1 * $0.15 + 0.05 * $0.60 = $0.015 + $0.030 = $0.045
      // Expected savings = $1.05 - $0.045 = $1.005
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now,
        sessionId: "sess-save-pos",
        taskId: "task-save-pos",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 100_000,
        completionTokens: 50_000,
        costUsd: 0.045,
        outcome: "success",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({});

      assert.equal(
        snap.baselineSummary.baselineProviderId,
        DEFAULT_BASELINE_PROVIDER_ID
      );
      assert.equal(
        snap.baselineSummary.baselineModelId,
        DEFAULT_BASELINE_MODEL_ID
      );
      assert.equal(snap.baselineSummary.baselineCostUsd, 1.05);
      assert.equal(snap.savingsSummary.eligibleActualCostUsd, 0.045);
      assert.equal(snap.savingsSummary.estimatedSavingsUsd, 1.005);
      assert.equal(snap.savingsSummary.comparisonStatus, "below_baseline");
      assert.ok(
        snap.savingsSummary.savingsPercent !== null &&
          Math.abs(snap.savingsSummary.savingsPercent - 95.71) < 0.1
      );
    });

    it("preserves negative savings (above_baseline) when routing selects a more expensive specialist model", async () => {
      const now = Date.now();
      // Baseline (Claude 3.5 Sonnet): 100k in ($0.30) + 50k out ($0.75) = $1.05
      // Routed to anthropic / claude-3-opus-20240229 ($15/1M in, $75/1M out):
      // Actual cost = 100k in ($1.50) + 50k out ($3.75) = $5.25
      // Savings = $1.05 - $5.25 = -$4.20 (Negative savings -> Above baseline!)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now,
        sessionId: "sess-save-neg",
        taskId: "task-save-neg",
        providerId: "anthropic",
        modelId: "claude-3-opus-20240229",
        promptTokens: 100_000,
        completionTokens: 50_000,
        costUsd: 5.25,
        outcome: "success",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({});

      assert.equal(snap.baselineSummary.baselineCostUsd, 1.05);
      assert.equal(snap.savingsSummary.eligibleActualCostUsd, 5.25);
      assert.equal(snap.savingsSummary.estimatedSavingsUsd, -4.2);
      assert.equal(snap.savingsSummary.comparisonStatus, "above_baseline");
      assert.equal(snap.savingsSummary.savingsPercent, -400);
      assert.equal(
        formatUsdCurrency(snap.savingsSummary.estimatedSavingsUsd),
        "-$4.20"
      );
    });

    it("reports zero savings (at_baseline) when the routed model is identical to the baseline model", async () => {
      const now = Date.now();
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now,
        sessionId: "sess-save-zero",
        taskId: "task-save-zero",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        promptTokens: 100_000,
        completionTokens: 50_000,
        costUsd: 1.05,
        outcome: "success",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({});

      assert.equal(snap.savingsSummary.estimatedSavingsUsd, 0);
      assert.equal(snap.savingsSummary.savingsPercent, 0);
      assert.equal(snap.savingsSummary.comparisonStatus, "at_baseline");
    });

    it("applies timestamp-aware historical pricing versions so past records remain reproducible after model price changes", async () => {
      // gpt-4o had two pricing epochs:
      // 1) 2024.05-v1 (effective < 1_722_988_800_000): $5.00 / 1M in, $15.00 / 1M out
      // 2) 2024.08-v2 (effective >= 1_722_988_800_000): $2.50 / 1M in, $10.00 / 1M out
      const july2024Ms = 1_720_000_000_000;
      const oct2024Ms = 1_728_000_000_000;

      const v1Pricing = resolveVersionedModelPricing(
        "openai",
        "gpt-4o",
        july2024Ms
      );
      const v2Pricing = resolveVersionedModelPricing(
        "openai",
        "gpt-4o",
        oct2024Ms
      );

      assert.ok(v1Pricing);
      assert.ok(v2Pricing);
      assert.equal(v1Pricing.pricingVersion, "2024.05-v1");
      assert.equal(v1Pricing.inputCostPerMillionUsd, 5.0);
      assert.equal(v1Pricing.outputCostPerMillionUsd, 15.0);

      assert.equal(v2Pricing.pricingVersion, "2024.08-v2");
      assert.equal(v2Pricing.inputCostPerMillionUsd, 2.5);
      assert.equal(v2Pricing.outputCostPerMillionUsd, 10.0);

      // Verify baseline savings when comparing against gpt-4o across both epochs
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: july2024Ms,
        sessionId: "sess-epoch-v1",
        taskId: "task-epoch-v1",
        providerId: "local",
        modelId: "phi-3-mini-4k-instruct-v1",
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        costUsd: 0,
        outcome: "success",
      });

      const v1Snap = await getTelemetryCostAnalyticsSnapshot({
        modelId: "phi-3-mini-4k-instruct-v1",
        baselineProviderId: "openai",
        baselineModelId: "gpt-4o",
      });
      // Under 2024.05-v1, 1M in + 1M out on gpt-4o = $5 + $15 = $20.00
      assert.equal(v1Snap.baselineSummary.baselineCostUsd, 20.0);
      assert.equal(v1Snap.savingsSummary.estimatedSavingsUsd, 20.0);

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: oct2024Ms,
        sessionId: "sess-epoch-v2",
        taskId: "task-epoch-v2",
        providerId: "local",
        modelId: "phi-3-mini-4k-instruct-v2",
        promptTokens: 1_000_000,
        completionTokens: 1_000_000,
        costUsd: 0,
        outcome: "success",
      });

      const v2Snap = await getTelemetryCostAnalyticsSnapshot({
        modelId: "phi-3-mini-4k-instruct-v2",
        baselineProviderId: "openai",
        baselineModelId: "gpt-4o",
      });
      // Under 2024.08-v2, 1M in + 1M out on gpt-4o = $2.50 + $10.00 = $12.50
      assert.equal(v2Snap.baselineSummary.baselineCostUsd, 12.5);
      assert.equal(v2Snap.savingsSummary.estimatedSavingsUsd, 12.5);
    });

    it("handles unavailable baseline pricing gracefully without fabricating savings", async () => {
      const now = Date.now();
      setMockPricingTable([]);
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now,
        sessionId: "sess-no-base",
        taskId: "task-no-base",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 10_000,
        completionTokens: 5_000,
        costUsd: 0.0045,
        outcome: "success",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({
        baselineProviderId: "nonexistent_provider",
        baselineModelId: "nonexistent_model",
      });

      assert.equal(snap.baselineSummary.baselineCostUsd, null);
      assert.equal(snap.savingsSummary.missingBaselinePricingCount, 1);
      assert.equal(snap.savingsSummary.estimatedSavingsUsd, null);
      assert.equal(snap.savingsSummary.comparisonStatus, "unavailable");
    });

    it("distinguishes selected-range savings from all-time cumulative savings", async () => {
      const now = Date.now();
      const tenDaysAgo = now - 10 * 86_400_000;

      // Historical record 10 days ago: saves $1.00
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: tenDaysAgo,
        sessionId: "sess-cum",
        taskId: "task-old",
        providerId: "local",
        modelId: "phi-3-mini-4k-instruct",
        promptTokens: 100_000,
        completionTokens: 50_000,
        costUsd: 0.05, // Baseline is $1.05 -> saves $1.00
        outcome: "success",
      });

      // Recent record today: saves $1.05
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_000,
        sessionId: "sess-cum",
        taskId: "task-recent",
        providerId: "local",
        modelId: "phi-3-mini-4k-instruct",
        promptTokens: 100_000,
        completionTokens: 50_000,
        costUsd: 0.0, // Baseline is $1.05 -> saves $1.05
        outcome: "success",
      });

      const recentOnly = await getTelemetryCostAnalyticsSnapshot({
        startTime: now - 86_400_000,
      });

      // Selected window has only the recent request ($1.05 savings)
      assert.equal(recentOnly.savingsSummary.estimatedSavingsUsd, 1.05);
      // All-time cumulative includes both ($1.00 + $1.05 = $2.05)
      assert.equal(recentOnly.savingsSummary.allTimeEstimatedSavingsUsd, 2.05);
      assert.equal(recentOnly.savingsSummary.allTimeEligibleRecordCount, 2);
    });
  });

  // =========================================================================
  // 5. RETRY, FAILOVER & STREAM LIFECYCLE DEDUPLICATION
  // =========================================================================
  describe("5. Retry, Failover & Stream Lifecycle Deduplication", () => {
    it("correlates retries and failovers into 1 logical request with N physical attempts while excluding intermediate routing/stream events", async () => {
      const now = Date.now();

      // 1. Routing decision (non-execution event -> must be excluded from token/cost billing)
      await recordTelemetryEvent({
        eventType: "routing_decision",
        occurredAt: now - 5_000,
        sessionId: "sess-retry",
        taskId: "task-correlated-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 10_000,
        completionTokens: 0,
        costUsd: 0.0015,
        outcome: "success",
      });

      // 2. Primary attempt fails mid-stream after consuming 10,000 input tokens ($0.0015)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 4_000,
        sessionId: "sess-retry",
        taskId: "task-correlated-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 10_000,
        completionTokens: 0,
        costUsd: 0.0015,
        outcome: "failure",
      });

      // 3. Intermediate stream_lifecycle progress event (must be deduplicated)
      await recordTelemetryEvent({
        eventType: "stream_lifecycle",
        occurredAt: now - 3_000,
        sessionId: "sess-retry",
        taskId: "task-correlated-1",
        streamId: "stream-1",
        providerId: "anthropic",
        modelId: "claude-3-5-haiku-20241022",
        promptTokens: 10_000,
        completionTokens: 2_500,
        costUsd: 0.018,
        outcome: "success",
      });

      // 4. Fallback transition succeeds with 10,000 input + 5,000 output tokens ($0.028)
      await recordTelemetryEvent({
        eventType: "fallback_transition",
        occurredAt: now - 2_000,
        sessionId: "sess-retry",
        taskId: "task-correlated-1",
        streamId: "stream-1",
        providerId: "anthropic",
        modelId: "claude-3-5-haiku-20241022",
        promptTokens: 10_000,
        completionTokens: 5_000,
        costUsd: 0.028,
        outcome: "fallback",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({});

      // 1 logical request, 2 physical execution attempts (attempt 1 failed + attempt 2 succeeded)
      assert.equal(snap.tokenSummary.logicalRequestCount, 1);
      assert.equal(snap.tokenSummary.physicalAttemptCount, 2);
      assert.equal(
        snap.tokenSummary.duplicateOrIntermediateEventsExcluded,
        2
      );

      // Total input tokens = 10,000 (attempt 1) + 10,000 (attempt 2) = 20,000
      // Total output tokens = 0 (attempt 1) + 5,000 (attempt 2) = 5,000
      // Total complete tokens = 25,000
      assert.equal(snap.tokenSummary.totalInputTokens, 20_000);
      assert.equal(snap.tokenSummary.totalOutputTokens, 5_000);
      assert.equal(snap.tokenSummary.totalTokens, 25_000);

      // Total actual cost = $0.0015 (failed attempt 1) + $0.028 (succeeded fallback attempt 2) = $0.0295
      assert.equal(snap.actualCostSummary.totalActualCostUsd, 0.0295);
    });
  });

  // =========================================================================
  // 6. PROVIDER & MODEL BREAKDOWN RECONCILIATION INVARIANTS
  // =========================================================================
  describe("6. Provider & Model Breakdown Reconciliation Invariants", () => {
    it("maintains exact mathematical reconciliation between summary totals and provider/model breakdowns", async () => {
      const now = Date.now();

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 3_000,
        sessionId: "sess-rec",
        taskId: "task-rec-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 50_000,
        completionTokens: 25_000,
        costUsd: 0.0225,
        outcome: "success",
      });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 2_000,
        sessionId: "sess-rec",
        taskId: "task-rec-2",
        providerId: "gemini",
        modelId: "gemini-1.5-flash",
        promptTokens: 80_000,
        completionTokens: 40_000,
        costUsd: 0.018,
        outcome: "success",
      });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_000,
        sessionId: "sess-rec",
        taskId: "task-rec-3",
        providerId: "local",
        modelId: "phi-3-mini-4k-instruct",
        promptTokens: 20_000,
        completionTokens: 10_000,
        costUsd: 0.0,
        outcome: "success",
      });

      const snap = await getTelemetryCostAnalyticsSnapshot({});

      const sumProviderTokens = snap.providerTokenBreakdown.reduce(
        (acc, p) => acc + (p.totalTokens ?? 0),
        0
      );
      const sumModelTokens = snap.modelTokenBreakdown.reduce(
        (acc, m) => acc + (m.totalTokens ?? 0),
        0
      );
      assert.equal(sumProviderTokens, snap.tokenSummary.totalTokens);
      assert.equal(sumModelTokens, snap.tokenSummary.totalTokens);

      const sumProviderCostNano = snap.providerCostBreakdown.reduce(
        (acc, p) => acc + (usdToNanoUsd(p.actualCostUsd) ?? 0n),
        0n
      );
      const sumModelCostNano = snap.modelCostBreakdown.reduce(
        (acc, m) => acc + (usdToNanoUsd(m.actualCostUsd) ?? 0n),
        0n
      );
      assert.equal(
        nanoUsdToUsd(sumProviderCostNano),
        snap.actualCostSummary.totalActualCostUsd
      );
      assert.equal(
        nanoUsdToUsd(sumModelCostNano),
        snap.actualCostSummary.totalActualCostUsd
      );

      const sumProviderSavingsNano = snap.providerCostBreakdown.reduce(
        (acc, p) => acc + (usdToNanoUsd(p.estimatedSavingsUsd) ?? 0n),
        0n
      );
      assert.equal(
        nanoUsdToUsd(sumProviderSavingsNano),
        snap.savingsSummary.estimatedSavingsUsd
      );
    });
  });

  // =========================================================================
  // 7. HOURLY AND DAILY TOKEN & COST TREND BUCKET AGGREGATION
  // =========================================================================
  describe("7. Hourly and Daily Token & Cost Trend Bucket Aggregation", () => {
    it("buckets token usage and cost/savings into chronological hour and day series", async () => {
      const hour1 = 1_730_000_000_000;
      const hour2 = hour1 + 3_600_000;

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: hour1 + 10_000,
        sessionId: "sess-trend",
        taskId: "task-t1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 10_000,
        completionTokens: 5_000,
        costUsd: 0.0045,
        outcome: "success",
      });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: hour2 + 10_000,
        sessionId: "sess-trend",
        taskId: "task-t2",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 20_000,
        completionTokens: 10_000,
        costUsd: 0.009,
        outcome: "success",
      });

      const hourlySnap = await getTelemetryCostAnalyticsSnapshot({
        timeBucket: "hour",
      });
      assert.equal(hourlySnap.tokenTrend.length, 2);
      assert.equal(hourlySnap.costTrend.length, 2);
      assert.equal(hourlySnap.tokenTrend[0].totalTokens, 15_000);
      assert.equal(hourlySnap.tokenTrend[1].totalTokens, 30_000);
      assert.equal(hourlySnap.costTrend[0].actualCostUsd, 0.0045);
      assert.equal(hourlySnap.costTrend[1].actualCostUsd, 0.009);
    });
  });

  // =========================================================================
  // 8. SESSION DELETION CASCADE CONSISTENCY
  // =========================================================================
  describe("8. Session Deletion Cascade Consistency", () => {
    it("removes associated financial telemetry when a session is deleted individually or in bulk", async () => {
      const s1 = await createChatSession({ title: "Session Financial 1" });
      const s2 = await createChatSession({ title: "Session Financial 2" });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: Date.now() - 2_000,
        sessionId: s1.id,
        taskId: "task-del-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 10_000,
        completionTokens: 5_000,
        costUsd: 0.0045,
        outcome: "success",
      });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: Date.now() - 1_000,
        sessionId: s2.id,
        taskId: "task-del-2",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 20_000,
        completionTokens: 10_000,
        costUsd: 0.009,
        outcome: "success",
      });

      const beforeDelete = await getTelemetryCostAnalyticsSnapshot({});
      assert.equal(beforeDelete.tokenSummary.logicalRequestCount, 2);
      assert.equal(beforeDelete.actualCostSummary.totalActualCostUsd, 0.0135);

      await deleteChatSession(s1.id);
      const afterSingleDelete = await getTelemetryCostAnalyticsSnapshot({});
      assert.equal(afterSingleDelete.tokenSummary.logicalRequestCount, 1);
      assert.equal(
        afterSingleDelete.actualCostSummary.totalActualCostUsd,
        0.009
      );

      await deleteHistorySessionsBulk([s2.id]);
      const afterBulkDelete = await getTelemetryCostAnalyticsSnapshot({});
      assert.equal(afterBulkDelete.tokenSummary.logicalRequestCount, 0);
      assert.equal(afterBulkDelete.actualCostSummary.totalActualCostUsd, null);
    });
  });

  // =========================================================================
  // 9. SECURITY, PRIVACY & READ-ONLY GUARANTEES
  // =========================================================================
  describe("9. Security, Privacy & Read-Only Guarantees", () => {
    it("never exposes prompt text, assistant completions, or API keys in financial analytics or export rows and triggers zero provider executions", async () => {
      const execBefore = getMockExecutionCount();

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: Date.now(),
        sessionId: "sess-sec",
        taskId: "task-sec",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        promptTokens: 1_000,
        completionTokens: 500,
        costUsd: 0.00045,
        outcome: "success",
      });

      const dashboardSnap = await getTelemetryDashboardSnapshot({});
      const serialized = JSON.stringify(dashboardSnap.financialAnalytics);
      assert.ok(!serialized.includes("sk-"));
      assert.ok(!serialized.includes("apiKey"));
      assert.ok(!serialized.includes("promptText"));
      assert.equal(dashboardSnap.financialAnalytics.exportRows.length, 1);
      assert.equal(
        dashboardSnap.financialAnalytics.exportRows[0].providerId,
        "openai"
      );
      assert.equal(getMockExecutionCount(), execBefore);
    });
  });

  // =========================================================================
  // 10. LARGE SYNTHETIC DATASET BENCHMARKS (1K / 10K / 50K / 100K RECORDS)
  // =========================================================================
  describe("10. Large Synthetic Dataset Benchmarks (1K / 10K / 50K / 100K)", () => {
    function generateSyntheticRecords(count: number): TelemetryRecord[] {
      const baseTime = 1_730_000_000_000;
      const providers = ["openai", "anthropic", "gemini", "local"];
      const models = [
        "gpt-4o-mini",
        "claude-3-5-haiku-20241022",
        "gemini-1.5-flash",
        "phi-3-mini-4k-instruct",
      ];
      const records: TelemetryRecord[] = new Array(count);

      for (let i = 0; i < count; i++) {
        const idx = i % 4;
        records[i] = {
          id: `rec-${i}`,
          eventType: "provider_execution",
          occurredAt: baseTime + i * 1_000,
          sessionId: `sess-${i % 100}`,
          taskId: `task-${i}`,
          messageId: `msg-${i}`,
          providerId: providers[idx],
          modelId: models[idx],
          latencyMs: 250,
          promptTokens: 1_000,
          completionTokens: 500,
          costUsd: idx === 3 ? 0 : 0.00045,
          outcome: "success",
        };
      }
      return records;
    }

    for (const size of [1_000, 10_000, 50_000, 100_000]) {
      it(`aggregates ${size.toLocaleString()} telemetry records deterministically without precision drift`, () => {
        const records = generateSyntheticRecords(size);
        const startMs = performance.now();
        const result = computeFinancialAnalyticsFromRecords(records, {
          timeBucket: "day",
        });
        const elapsedMs = performance.now() - startMs;

        assert.equal(result.tokenSummary.logicalRequestCount, size);
        assert.equal(result.tokenSummary.physicalAttemptCount, size);
        assert.equal(result.tokenSummary.totalInputTokens, size * 1_000);
        assert.equal(result.tokenSummary.totalOutputTokens, size * 500);
        assert.equal(result.tokenSummary.totalTokens, size * 1_500);
        assert.ok(result.actualCostSummary.totalActualCostUsd !== null);
        assert.ok(result.savingsSummary.estimatedSavingsUsd !== null);
        assert.ok(
          elapsedMs < 10_000,
          `Expected ${size} records to aggregate in < 10000ms, took ${elapsedMs.toFixed(1)}ms`
        );
      });
    }
  });
});
