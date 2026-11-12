/**
 * Step 44 — Latency, Execution Performance & Benchmark Analytics Tests
 *
 * Covers:
 * 1. Empty state, Unavailable honesty & formatLatencyMs display rules
 * 2. Known Latency Fixture ([100, 200, 300, 400, 500] ms), Odd/Even Median & Small-Sample P90/P95/P99 Gating
 * 3. Outlier Preservation Fixture ([100, 110, 120, 130, 5000] ms)
 * 4. Invalid & Missing Latency Rejection (negative, NaN, Infinity, >24h overflow never coerced to 0)
 * 5. Latency Distribution Histogram (8 bins & reconciliation invariant)
 * 6. Provider & Model Comparison Fixture (3+ providers/models, differing sample sizes, historical models)
 * 7. Retry/Failover Logical vs. Physical Latency & Routing Overhead Fixture
 * 8. Streaming, Cancellation, Failure, Timeout & Rate-Limit Outcome Populations
 * 9. Session Deletion Cascade, Security/Privacy & Zero Live Benchmarking Guarantees
 * 10. Large Synthetic Dataset Benchmarks (1,000 / 10,000 / 50,000 / 100,000 records)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  recordTelemetryEvent,
  getTelemetryDashboardSnapshot,
  getTelemetryPerformanceAnalyticsSnapshot,
  computePerformanceAnalyticsFromRecords,
  computeLatencyDistributionStats,
  formatLatencyMs,
  resetTelemetryMockStore,
  resetMockTelemetryTestHooks,
  __internalInsertMockTelemetryBatch,
} from "../../../services/ipc/telemetry.ts";
import {
  createChatSession,
  deleteChatSession,
  getMockExecutionCount,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import { deleteHistorySessionsBulk } from "../../../services/ipc/history.ts";
import type { TelemetryRecord } from "../../../services/ipc/types.ts";

describe("Step 44 — Latency, Execution Performance & Benchmark Analytics", () => {
  beforeEach(() => {
    resetTelemetryMockStore();
    resetMockTelemetryTestHooks();
    resetChatMockStore();
  });

  // =========================================================================
  // 1. EMPTY STATE, UNAVAILABLE HONESTY & FORMAT THRESHOLDS
  // =========================================================================
  describe("1. Empty State, Unavailable Honesty & Format Thresholds", () => {
    it("returns null for all latency statistics and 'empty' sampleSufficiency when no measurements exist", async () => {
      const perf = await getTelemetryPerformanceAnalyticsSnapshot({
        timeBucket: "day",
      });

      assert.equal(perf.summary.totalEligibleExecutions, 0);
      assert.equal(perf.summary.measuredExecutions, 0);
      assert.equal(perf.summary.missingLatencyCount, 0);
      assert.equal(perf.summary.invalidLatencyCount, 0);
      assert.equal(perf.summary.latencyCoveragePercent, null);
      assert.equal(perf.summary.sampleSufficiency, "empty");
      assert.equal(perf.summary.provenance, "unavailable");

      assert.equal(perf.summary.averageLatencyMs, null);
      assert.equal(perf.summary.medianLatencyMs, null);
      assert.equal(perf.summary.p25LatencyMs, null);
      assert.equal(perf.summary.p50LatencyMs, null);
      assert.equal(perf.summary.p75LatencyMs, null);
      assert.equal(perf.summary.p90LatencyMs, null);
      assert.equal(perf.summary.p95LatencyMs, null);
      assert.equal(perf.summary.p99LatencyMs, null);
      assert.equal(perf.summary.minLatencyMs, null);
      assert.equal(perf.summary.maxLatencyMs, null);

      assert.equal(perf.distribution.measuredSampleCount, 0);
      assert.equal(perf.distribution.buckets.length, 8);
      for (const b of perf.distribution.buckets) {
        assert.equal(b.count, 0);
        assert.equal(b.percentage, null);
      }
    });

    it("formats latency values using <1000 ms (ms) and >=1000 ms (s) conventions", () => {
      assert.equal(formatLatencyMs(null), "Unavailable");
      assert.equal(formatLatencyMs(undefined), "Unavailable");
      assert.equal(formatLatencyMs(-10), "Unavailable");
      assert.equal(formatLatencyMs(Number.NaN), "Unavailable");
      assert.equal(formatLatencyMs(0), "0 ms");
      assert.equal(formatLatencyMs(85), "85 ms");
      assert.equal(formatLatencyMs(12.7), "12.7 ms");
      assert.equal(formatLatencyMs(1_420), "1.42 s");
      assert.equal(formatLatencyMs(1_420, { exactMs: true }), "1,420 ms");
    });
  });

  // =========================================================================
  // 2. KNOWN LATENCY FIXTURE, ODD/EVEN MEDIAN & SMALL-SAMPLE GATING
  // =========================================================================
  describe("2. Known Latency Fixture, Odd/Even Median & Small-Sample Gating", () => {
    it("calculates exact median, mean, min, max, P25, P75, P90, P95 on [100, 200, 300, 400, 500] ms and withholds P99 when n < 10", async () => {
      const now = Date.now();
      const fixture = [100, 200, 300, 400, 500];

      for (let i = 0; i < fixture.length; i++) {
        await recordTelemetryEvent({
          eventType: "provider_execution",
          occurredAt: now + i * 100,
          sessionId: "sess-known",
          taskId: `task-known-${i}`,
          providerId: "openai",
          modelId: "gpt-4o-mini",
          latencyMs: fixture[i],
          outcome: "success",
        });
      }

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perf.summary.measuredExecutions, 5);
      assert.equal(perf.summary.sampleSufficiency, "sufficient");
      assert.equal(perf.summary.medianLatencyMs, 300);
      assert.equal(perf.summary.p50LatencyMs, 300);
      assert.equal(perf.summary.averageLatencyMs, 300);
      assert.equal(perf.summary.p25LatencyMs, 200);
      assert.equal(perf.summary.p75LatencyMs, 400);
      assert.equal(perf.summary.p90LatencyMs, 460);
      assert.equal(perf.summary.p95LatencyMs, 480);
      // n = 5 < 10 -> P99 must be null (Section 22 small-sample rule)
      assert.equal(perf.summary.p99LatencyMs, null);
      assert.equal(perf.summary.minLatencyMs, 100);
      assert.equal(perf.summary.maxLatencyMs, 500);
    });

    it("calculates exact midpoint median for even-sized samples and enforces n < 5 limited-sample gating", () => {
      // n = 4: [100, 200, 300, 400] -> median = (200 + 300) / 2 = 250
      const stats4 = computeLatencyDistributionStats([400, 100, 300, 200]);
      assert.equal(stats4.sampleSufficiency, "limited");
      assert.equal(stats4.medianMs, 250);
      assert.equal(stats4.averageMs, 250);
      assert.equal(stats4.p25Ms, 175);
      assert.equal(stats4.p75Ms, 325);
      assert.equal(stats4.p90Ms, null);
      assert.equal(stats4.p95Ms, null);
      assert.equal(stats4.p99Ms, null);

      // n = 10: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] -> P99 unlocked
      const stats10 = computeLatencyDistributionStats([
        100, 200, 300, 400, 500, 600, 700, 800, 900, 1000,
      ]);
      assert.equal(stats10.sampleSufficiency, "sufficient");
      assert.equal(stats10.medianMs, 550);
      assert.equal(stats10.p99Ms, 991);
    });
  });

  // =========================================================================
  // 3. OUTLIER PRESERVATION FIXTURE ([100, 110, 120, 130, 5000] ms)
  // =========================================================================
  describe("3. Outlier Preservation Fixture", () => {
    it("preserves outliers in max, mean, and tail percentiles while keeping median representative", async () => {
      const now = Date.now();
      const outlierFixture = [100, 110, 120, 130, 5_000];

      for (let i = 0; i < outlierFixture.length; i++) {
        await recordTelemetryEvent({
          eventType: "provider_execution",
          occurredAt: now + i * 100,
          sessionId: "sess-outlier",
          taskId: `task-outlier-${i}`,
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet-20241022",
          latencyMs: outlierFixture[i],
          outcome: "success",
        });
      }

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perf.summary.measuredExecutions, 5);
      assert.equal(perf.summary.medianLatencyMs, 120);
      assert.equal(perf.summary.averageLatencyMs, 1_092);
      assert.equal(perf.summary.minLatencyMs, 100);
      assert.equal(perf.summary.maxLatencyMs, 5_000);
      assert.equal(perf.summary.p95LatencyMs, 4_026);
    });
  });

  // =========================================================================
  // 4. INVALID & MISSING LATENCY REJECTION
  // =========================================================================
  describe("4. Invalid & Missing Latency Rejection", () => {
    it("classifies missing and invalid latency values safely without coercing them to zero", async () => {
      const now = Date.now();
      __internalInsertMockTelemetryBatch([
        {
          id: "valid-1",
          eventType: "provider_execution",
          occurredAt: now - 4_000,
          providerId: "openai",
          modelId: "gpt-4o",
          outcome: "success",
          latencyMs: 250,
        },
        {
          id: "missing-1",
          eventType: "provider_execution",
          occurredAt: now - 3_000,
          providerId: "openai",
          modelId: "gpt-4o",
          outcome: "success",
          latencyMs: undefined,
        },
        {
          id: "invalid-neg",
          eventType: "provider_execution",
          occurredAt: now - 2_000,
          providerId: "openai",
          modelId: "gpt-4o",
          outcome: "success",
          latencyMs: -500,
        },
        {
          id: "invalid-nan",
          eventType: "provider_execution",
          occurredAt: now - 1_000,
          providerId: "openai",
          modelId: "gpt-4o",
          outcome: "success",
          latencyMs: Number.NaN,
        },
        {
          id: "invalid-overflow",
          eventType: "provider_execution",
          occurredAt: now,
          providerId: "openai",
          modelId: "gpt-4o",
          outcome: "success",
          latencyMs: 999_999_999,
        },
      ]);

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perf.summary.totalEligibleExecutions, 5);
      assert.equal(perf.summary.measuredExecutions, 1);
      assert.equal(perf.summary.missingLatencyCount, 1);
      assert.equal(perf.summary.invalidLatencyCount, 3);
      assert.equal(perf.summary.latencyCoveragePercent, 20.0);
      assert.equal(perf.summary.medianLatencyMs, 250);
      assert.equal(perf.summary.minLatencyMs, 250);
    });
  });

  // =========================================================================
  // 5. LATENCY DISTRIBUTION HISTOGRAM
  // =========================================================================
  describe("5. Latency Distribution Histogram", () => {
    it("buckets latencies into the 8 canonical ranges and reconciles to measuredExecutions", async () => {
      const now = Date.now();
      const samples = [50, 150, 350, 750, 1_500, 3_500, 7_500, 12_500];

      for (let i = 0; i < samples.length; i++) {
        await recordTelemetryEvent({
          eventType: "provider_execution",
          occurredAt: now + i * 100,
          taskId: `task-hist-${i}`,
          providerId: "openai",
          modelId: "gpt-4o-mini",
          latencyMs: samples[i],
          outcome: "success",
        });
      }

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perf.distribution.measuredSampleCount, 8);
      for (const bucket of perf.distribution.buckets) {
        assert.equal(bucket.count, 1, `Expected 1 item in ${bucket.bucketKey}`);
        assert.equal(bucket.percentage, 12.5);
      }
    });
  });

  // =========================================================================
  // 6. PROVIDER & MODEL COMPARISON FIXTURE
  // =========================================================================
  describe("6. Provider & Model Comparison Fixture", () => {
    it("computes independent per-provider and per-model distributions and preserves historical models", async () => {
      const now = Date.now();

      // Provider 1: OpenAI (6 observations: 100..600 ms)
      for (let i = 1; i <= 6; i++) {
        await recordTelemetryEvent({
          eventType: "provider_execution",
          occurredAt: now + i * 10,
          taskId: `oa-${i}`,
          providerId: "openai",
          modelId: "gpt-4o-mini",
          latencyMs: i * 100,
          outcome: "success",
        });
      }

      // Provider 2: Anthropic (3 observations: 1000, 2000, 3000 ms)
      for (let i = 1; i <= 3; i++) {
        await recordTelemetryEvent({
          eventType: "provider_execution",
          occurredAt: now + 100 + i * 10,
          taskId: `an-${i}`,
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet-20241022",
          latencyMs: i * 1_000,
          outcome: "success",
        });
      }

      // Provider 3: Deprecated / Historical custom model (2 observations: 40, 60 ms)
      for (let i = 1; i <= 2; i++) {
        await recordTelemetryEvent({
          eventType: "provider_execution",
          occurredAt: now + 200 + i * 10,
          taskId: `hist-${i}`,
          providerId: "legacy_vendor",
          modelId: "legacy-model-2023",
          latencyMs: i * 20 + 20,
          outcome: "success",
        });
      }

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perf.providerBreakdown.length, 3);
      assert.equal(perf.modelBreakdown.length, 3);

      // Sorted by measuredCount DESC: openai (6), anthropic (3), legacy_vendor (2)
      assert.equal(perf.providerBreakdown[0].providerId, "openai");
      assert.equal(perf.providerBreakdown[0].measuredCount, 6);
      assert.equal(perf.providerBreakdown[0].medianLatencyMs, 350);
      assert.equal(perf.providerBreakdown[0].sampleSufficiency, "sufficient");

      assert.equal(perf.providerBreakdown[1].providerId, "anthropic");
      assert.equal(perf.providerBreakdown[1].measuredCount, 3);
      assert.equal(perf.providerBreakdown[1].medianLatencyMs, 2_000);
      assert.equal(perf.providerBreakdown[1].sampleSufficiency, "limited");
      assert.equal(perf.providerBreakdown[1].p95LatencyMs, null);

      assert.equal(perf.providerBreakdown[2].providerId, "legacy_vendor");
      assert.equal(perf.providerBreakdown[2].isHistoricalOrUnrecorded, true);
      assert.equal(perf.providerBreakdown[2].medianLatencyMs, 50);

      const sumProviderMeasured = perf.providerBreakdown.reduce(
        (acc, p) => acc + p.measuredCount,
        0
      );
      assert.equal(sumProviderMeasured, perf.summary.measuredExecutions);
    });
  });

  // =========================================================================
  // 7. RETRY / FAILOVER LOGICAL VS PHYSICAL LATENCY & ROUTING OVERHEAD
  // =========================================================================
  describe("7. Retry / Failover Logical vs. Physical Latency & Routing Overhead", () => {
    it("separates physical attempt latency from cumulative logical request latency and captures routing overhead", async () => {
      const now = Date.now();

      // Routing decision: 35 ms local routing overhead
      await recordTelemetryEvent({
        eventType: "routing_decision",
        occurredAt: now - 5_000,
        taskId: "logical-L1",
        providerId: "openai",
        modelId: "gpt-4o",
        latencyMs: 35,
        outcome: "success",
      });

      // Attempt A: 300 ms -> failed
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 4_000,
        taskId: "logical-L1",
        providerId: "openai",
        modelId: "gpt-4o",
        latencyMs: 300,
        outcome: "failure",
      });

      // Attempt B (Failover): 1200 ms -> fallback success
      await recordTelemetryEvent({
        eventType: "fallback_transition",
        occurredAt: now - 2_000,
        taskId: "logical-L1",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet-20241022",
        latencyMs: 1_200,
        outcome: "fallback",
      });

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});

      // Physical attempts: 2 (300 ms and 1200 ms) -> median 750 ms
      assert.equal(perf.summary.measuredExecutions, 2);
      assert.equal(perf.summary.medianLatencyMs, 750);

      // Logical request L1: 1 logical request with 2 attempts -> cumulative 300 + 1200 = 1500 ms
      assert.equal(perf.logicalVsPhysical.totalLogicalRequests, 1);
      assert.equal(perf.logicalVsPhysical.measuredLogicalRequests, 1);
      assert.equal(perf.logicalVsPhysical.multiAttemptLogicalRequests, 1);
      assert.equal(perf.logicalVsPhysical.initialAttemptMedianLatencyMs, 300);
      assert.equal(
        perf.logicalVsPhysical.retryOrFailoverAttemptMedianLatencyMs,
        1_200
      );
      assert.equal(
        perf.logicalVsPhysical.logicalCumulativeMedianLatencyMs,
        1_500
      );

      // Routing overhead: 35 ms
      assert.equal(perf.routingOverhead.measuredRoutingEvents, 1);
      assert.equal(perf.routingOverhead.medianRoutingLatencyMs, 35);
      assert.equal(perf.routingOverhead.provenance, "recorded");
    });
  });

  // =========================================================================
  // 8. STREAMING, CANCELLATION, FAILURE, TIMEOUT & RATE-LIMIT POPULATIONS
  // =========================================================================
  describe("8. Streaming, Cancellation, Failure, Timeout & Rate-Limit Populations", () => {
    it("tracks streaming completion latency, reports TTFT as unavailable when unrecorded, and separates outcome populations", async () => {
      const now = Date.now();

      // Intermediate stream event (must be deduplicated when terminal provider_execution exists)
      await recordTelemetryEvent({
        eventType: "stream_lifecycle",
        occurredAt: now - 3_000,
        taskId: "task-stream-1",
        streamId: "stream-abc",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 90,
        outcome: "success",
      });

      // Terminal streaming provider_execution (840 ms)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 2_000,
        taskId: "task-stream-1",
        streamId: "stream-abc",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 840,
        outcome: "success",
      });

      // Cancelled request (410 ms)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_500,
        taskId: "task-cancel-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 410,
        outcome: "cancelled",
      });

      // Timeout request (5000 ms)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 1_000,
        taskId: "task-timeout-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 5_000,
        outcome: "timeout",
      });

      // Rate-limited request (45 ms)
      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: now - 500,
        taskId: "task-rl-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 45,
        outcome: "rate_limited",
      });

      const perf = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(perf.summary.measuredExecutions, 4);
      assert.equal(perf.dataQuality.duplicateOrIntermediateEventsExcluded, 1);

      assert.equal(perf.streamingPerformance.totalStreamingExecutions, 1);
      assert.equal(
        perf.streamingPerformance.measuredStreamingCompletionCount,
        1
      );
      assert.equal(
        perf.streamingPerformance.medianStreamCompletionLatencyMs,
        840
      );
      assert.equal(perf.streamingPerformance.ttftProvenance, "unavailable");
      assert.equal(perf.streamingPerformance.averageTtftMs, null);

      assert.equal(perf.outcomeBreakdown.length, 4);

      // Filter by outcome = "timeout"
      const timeoutOnly = await getTelemetryPerformanceAnalyticsSnapshot({
        outcome: "timeout",
      });
      assert.equal(timeoutOnly.summary.measuredExecutions, 1);
      assert.equal(timeoutOnly.summary.medianLatencyMs, 5_000);
    });
  });

  // =========================================================================
  // 9. SESSION DELETION CASCADE, SECURITY & ZERO LIVE BENCHMARKING
  // =========================================================================
  describe("9. Session Deletion Cascade, Security & Zero Live Benchmarking", () => {
    it("removes latency measurements on session deletion and never leaks secrets or triggers live provider calls", async () => {
      const execBefore = getMockExecutionCount();
      const s1 = await createChatSession({ title: "Perf Session 1" });
      const s2 = await createChatSession({ title: "Perf Session 2" });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: Date.now() - 2_000,
        sessionId: s1.id,
        taskId: "t-del-1",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 200,
        outcome: "success",
      });

      await recordTelemetryEvent({
        eventType: "provider_execution",
        occurredAt: Date.now() - 1_000,
        sessionId: s2.id,
        taskId: "t-del-2",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        latencyMs: 400,
        outcome: "success",
      });

      const beforeDel = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(beforeDel.summary.measuredExecutions, 2);
      assert.equal(beforeDel.summary.medianLatencyMs, 300);

      await deleteChatSession(s1.id);
      const afterSingle = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(afterSingle.summary.measuredExecutions, 1);
      assert.equal(afterSingle.summary.medianLatencyMs, 400);

      await deleteHistorySessionsBulk([s2.id]);
      const afterBulk = await getTelemetryPerformanceAnalyticsSnapshot({});
      assert.equal(afterBulk.summary.measuredExecutions, 0);
      assert.equal(afterBulk.summary.medianLatencyMs, null);

      const dashSnap = await getTelemetryDashboardSnapshot({});
      const serialized = JSON.stringify(dashSnap.performanceAnalytics);
      assert.ok(!serialized.includes("sk-"));
      assert.ok(!serialized.includes("apiKey"));
      assert.equal(getMockExecutionCount(), execBefore);
    });
  });

  // =========================================================================
  // 10. LARGE SYNTHETIC DATASET BENCHMARKS (1K / 10K / 50K / 100K RECORDS)
  // =========================================================================
  describe("10. Large Synthetic Dataset Benchmarks (1K / 10K / 50K / 100K)", () => {
    function generateSyntheticPerfRecords(count: number): TelemetryRecord[] {
      const baseTime = 1_730_000_000_000;
      const providers = ["openai", "anthropic", "gemini", "local"];
      const models = [
        "gpt-4o-mini",
        "claude-3-5-haiku-20241022",
        "gemini-1.5-flash",
        "phi-3-mini-4k-instruct",
      ];
      const latencies = [80, 200, 450, 1_200];
      const records: TelemetryRecord[] = new Array(count);

      for (let i = 0; i < count; i++) {
        const idx = i % 4;
        records[i] = {
          id: `perf-rec-${i}`,
          eventType: "provider_execution",
          occurredAt: baseTime + i * 1_000,
          sessionId: `sess-${i % 100}`,
          taskId: `task-${i}`,
          messageId: `msg-${i}`,
          providerId: providers[idx],
          modelId: models[idx],
          latencyMs: latencies[idx],
          promptTokens: 500,
          completionTokens: 250,
          costUsd: idx === 3 ? 0 : 0.0003,
          outcome: "success",
        };
      }
      return records;
    }

    for (const size of [1_000, 10_000, 50_000, 100_000]) {
      it(`computes exact percentiles and distributions for ${size.toLocaleString()} records within performance budget`, () => {
        const records = generateSyntheticPerfRecords(size);
        const startMs = performance.now();
        const result = computePerformanceAnalyticsFromRecords(records, {
          timeBucket: "day",
        });
        const elapsedMs = performance.now() - startMs;

        assert.equal(result.summary.measuredExecutions, size);
        // Equal quarters of [80, 200, 450, 1200] -> median is (200 + 450) / 2 = 325 ms, mean is 482.5 ms
        assert.equal(result.summary.medianLatencyMs, 325);
        assert.equal(result.summary.averageLatencyMs, 482.5);
        assert.equal(result.summary.minLatencyMs, 80);
        assert.equal(result.summary.maxLatencyMs, 1_200);
        assert.equal(result.summary.p95LatencyMs, 1_200);
        assert.equal(result.summary.p99LatencyMs, 1_200);
        assert.equal(result.providerBreakdown.length, 4);
        assert.equal(result.modelBreakdown.length, 4);
        assert.ok(
          elapsedMs < 5_000,
          `Expected ${size} records to aggregate in < 5000ms, took ${elapsedMs.toFixed(1)}ms`
        );
      });
    }
  });
});

