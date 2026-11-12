import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  recordTelemetryEvent,
  getTelemetryDashboardSnapshot,
  resetTelemetryMockStore,
  setMockTelemetryTestHooks,
  resetMockTelemetryTestHooks,
  __internalInsertMockTelemetryBatch,
  resolveProviderDisplayName,
  formatOutcomeLabel,
} from "../../../services/ipc/telemetry.ts";
import {
  createChatSession,
  deleteChatSession,
  getMockExecutionCount,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import { deleteHistorySessionsBulk } from "../../../services/ipc/history.ts";
import {
  resolveTelemetryDateRangeBounds,
  formatTimeSeriesBucketLabel,
  resolveTelemetryFreshnessStatus,
} from "../timestamp.ts";
import type {
  TelemetryDashboardSnapshot,
  TelemetryOutcome,
  TelemetryRecord,
} from "../../../services/ipc/types.ts";

function assertSnapshotInvariants(snapshot: TelemetryDashboardSnapshot): void {
  const total = snapshot.summary.totalRoutedRequests;

  const providerSum = snapshot.providerDistribution.reduce((acc, p) => acc + p.requestCount, 0);
  assert.equal(
    providerSum,
    total,
    `Provider distribution sum (${providerSum}) must equal totalRoutedRequests (${total})`,
  );

  const modelSum = snapshot.modelDistribution.reduce((acc, m) => acc + m.requestCount, 0);
  assert.equal(
    modelSum,
    total,
    `Model distribution sum (${modelSum}) must equal totalRoutedRequests (${total})`,
  );

  const outcomeSum = snapshot.outcomeDistribution.reduce((acc, o) => acc + o.count, 0);
  assert.equal(
    outcomeSum,
    total,
    `Outcome distribution sum (${outcomeSum}) must equal totalRoutedRequests (${total})`,
  );

  const timeSeriesSum = snapshot.timeSeries.reduce((acc, pt) => acc + pt.requestCount, 0);
  assert.equal(
    timeSeriesSum,
    total,
    `Time-series requestCount sum (${timeSeriesSum}) must equal totalRoutedRequests (${total})`,
  );

  assert.equal(
    snapshot.confidenceDistribution.availableCount + snapshot.confidenceDistribution.missingCount,
    total,
    "Confidence available + missing must equal totalRoutedRequests",
  );

  const confidenceBucketSum = snapshot.confidenceDistribution.buckets.reduce(
    (acc, b) => acc + b.count,
    0,
  );
  assert.equal(
    confidenceBucketSum,
    snapshot.confidenceDistribution.availableCount,
    "Confidence bucket sum must equal availableCount",
  );

  assert.equal(
    snapshot.completeness.completeMetadataCount + snapshot.completeness.incompleteRecordsCount,
    total,
    "Completeness complete + incomplete must equal totalRoutedRequests",
  );
}

describe("Step 42 — Telemetry Dashboard, Operational Routing Insights & Local Analytics Workspace", () => {
  beforeEach(() => {
    resetTelemetryMockStore();
    resetMockTelemetryTestHooks();
    resetChatMockStore();
  });

  describe("1. Empty Database & Unknown-Data Honesty", () => {
    it("returns an honest empty snapshot with null ratios when no telemetry records exist", async () => {
      const snapshot = await getTelemetryDashboardSnapshot({});

      assert.equal(snapshot.summary.totalRoutedRequests, 0);
      assert.equal(snapshot.summary.successfulExecutions, 0);
      assert.equal(snapshot.summary.failedExecutions, 0);
      assert.equal(snapshot.summary.cancelledExecutions, 0);
      assert.equal(snapshot.summary.fallbackExecutions, 0);
      assert.equal(snapshot.summary.terminalExecutions, 0);
      assert.equal(snapshot.summary.successRatePercent, null);
      assert.equal(snapshot.completeness.completeMetadataPercent, null);

      assert.equal(snapshot.timeSeries.length, 0);
      assert.equal(snapshot.providerDistribution.length, 0);
      assert.equal(snapshot.modelDistribution.length, 0);
      assert.equal(snapshot.outcomeDistribution.length, 0);

      assert.equal(snapshot.retryFailover.retryDataAvailable, false);
      assert.equal(snapshot.retryFailover.retryExecutionCount, null);
      assert.equal(snapshot.retryFailover.failoverInvolvedCount, 0);

      assert.equal(snapshot.confidenceDistribution.availableCount, 0);
      assert.equal(snapshot.confidenceDistribution.missingCount, 0);
      assert.equal(snapshot.confidenceDistribution.buckets.length, 4);
      for (const bucket of snapshot.confidenceDistribution.buckets) {
        assert.equal(bucket.count, 0);
        assert.equal(bucket.percentageOfAvailable, null);
      }

      assertSnapshotInvariants(snapshot);
    });

    it("keeps successRatePercent null when terminalExecutions === 0 (e.g. only non-terminal fallback transition event recorded)", async () => {
      await recordTelemetryEvent({
        eventType: "fallback_transition",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "fallback",
        confidence: 0.85,
        routingReason: "Failover from primary",
      });

      const snapshot = await getTelemetryDashboardSnapshot({});
      assert.equal(snapshot.summary.totalRoutedRequests, 1);
      assert.equal(snapshot.summary.fallbackExecutions, 1);
      assert.equal(snapshot.summary.terminalExecutions, 0);
      assert.equal(snapshot.summary.successRatePercent, null);
      assertSnapshotInvariants(snapshot);
    });
  });

  describe("2. Summary Metrics, Outcomes, Failover Signals & Sum Invariants", () => {
    it("accurately aggregates mixed execution outcomes and preserves all chart sum invariants", async () => {
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet",
        outcome: "success",
        confidence: 0.91,
        routingReason: "High code reasoning score",
        occurredAt: Date.parse("2026-05-10T10:15:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "fallback",
        confidence: 0.78,
        routingReason: "Failover from anthropic/claude-3-7-sonnet -> openai/gpt-4o",
        occurredAt: Date.parse("2026-05-10T11:20:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "deepseek",
        modelId: "deepseek-chat",
        outcome: "failure",
        confidence: 0.62,
        routingReason: "Provider upstream error",
        occurredAt: Date.parse("2026-05-11T09:00:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "groq",
        modelId: "llama-3.3-70b-versatile",
        outcome: "rate_limited",
        confidence: 0.44,
        routingReason: "Rate limit hit on upstream",
        occurredAt: Date.parse("2026-05-11T14:30:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "google",
        modelId: "gemini-2.5-pro",
        outcome: "timeout",
        confidence: 0.19,
        routingReason: "First chunk deadline exceeded",
        occurredAt: Date.parse("2026-05-12T08:45:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "mistral",
        modelId: "mistral-large-latest",
        outcome: "cancelled",
        confidence: 0.88,
        routingReason: "Cancelled by user",
        occurredAt: Date.parse("2026-05-12T16:10:00Z"),
      });

      const snapshot = await getTelemetryDashboardSnapshot({});

      assert.equal(snapshot.summary.totalRoutedRequests, 6);
      assert.equal(snapshot.summary.successfulExecutions, 1);
      assert.equal(snapshot.summary.fallbackExecutions, 1);
      assert.equal(snapshot.summary.failedExecutions, 3); // 1 failure + 1 rate_limited + 1 timeout
      assert.equal(snapshot.summary.cancelledExecutions, 1);
      assert.equal(snapshot.summary.terminalExecutions, 5); // 1 success + 3 failed + 1 cancelled
      // Operational success = 1 / 5 = 20.0%
      assert.equal(snapshot.summary.successRatePercent, 20.0);
      assert.equal(snapshot.completeness.completeMetadataPercent, 100.0);

      assert.equal(snapshot.retryFailover.retryDataAvailable, false);
      assert.equal(snapshot.retryFailover.retryExecutionCount, null);
      assert.equal(snapshot.retryFailover.failoverInvolvedCount, 1);
      assert.equal(snapshot.retryFailover.fallbackSuccessCount, 1);
      assert.equal(snapshot.retryFailover.timeoutOutcomeCount, 1);
      assert.equal(snapshot.retryFailover.rateLimitedOutcomeCount, 1);

      assertSnapshotInvariants(snapshot);
    });
  });

  describe("3. Multi-Dimensional Filtering & Validation", () => {
    beforeEach(async () => {
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
        confidence: 0.92,
        routingReason: "Fast general reasoning",
        occurredAt: Date.parse("2026-03-01T10:00:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        outcome: "failure",
        confidence: 0.71,
        routingReason: "Lightweight tier",
        occurredAt: Date.parse("2026-03-05T12:00:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "routing_decision",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet",
        outcome: "success",
        confidence: 0.84,
        routingReason: "Complex architecture prompt",
        occurredAt: Date.parse("2026-03-10T15:30:00Z"),
      });
      await recordTelemetryEvent({
        eventType: "system_event",
        providerId: undefined,
        modelId: undefined,
        outcome: "cancelled",
        confidence: undefined,
        routingReason: undefined,
        occurredAt: Date.parse("2026-03-15T18:00:00Z"),
      });
    });

    it("filters accurately by providerId, modelId, outcome, eventType, and date range", async () => {
      const byProvider = await getTelemetryDashboardSnapshot({ providerId: "openai" });
      assert.equal(byProvider.summary.totalRoutedRequests, 2);
      assertSnapshotInvariants(byProvider);

      const byProviderAndModel = await getTelemetryDashboardSnapshot({
        providerId: "openai",
        modelId: "gpt-4o-mini",
      });
      assert.equal(byProviderAndModel.summary.totalRoutedRequests, 1);
      assert.equal(byProviderAndModel.summary.failedExecutions, 1);
      assertSnapshotInvariants(byProviderAndModel);

      const byOutcome = await getTelemetryDashboardSnapshot({ outcome: "success" });
      assert.equal(byOutcome.summary.totalRoutedRequests, 2);
      assertSnapshotInvariants(byOutcome);

      const byEventType = await getTelemetryDashboardSnapshot({ eventType: "routing_decision" });
      assert.equal(byEventType.summary.totalRoutedRequests, 1);
      assert.equal(byEventType.providerDistribution[0]?.providerId, "anthropic");
      assertSnapshotInvariants(byEventType);

      const byDateRange = await getTelemetryDashboardSnapshot({
        startTime: Date.parse("2026-03-04T00:00:00Z"),
        endTime: Date.parse("2026-03-12T23:59:59Z"),
      });
      assert.equal(byDateRange.summary.totalRoutedRequests, 2);
      assertSnapshotInvariants(byDateRange);

      const byUnrecorded = await getTelemetryDashboardSnapshot({ providerId: "unrecorded" });
      assert.equal(byUnrecorded.summary.totalRoutedRequests, 1);
      assert.equal(byUnrecorded.providerDistribution[0]?.displayName, "Not recorded");
      assertSnapshotInvariants(byUnrecorded);
    });

    it("rejects invalid filter payloads with structured errors", async () => {
      await assert.rejects(
        () =>
          getTelemetryDashboardSnapshot({
            startTime: Date.parse("2026-03-20T00:00:00Z"),
            endTime: Date.parse("2026-03-10T00:00:00Z"),
          }),
        /Telemetry date range start cannot be after date range end/i,
      );

      await assert.rejects(
        () => getTelemetryDashboardSnapshot({ providerId: "x".repeat(130) }),
        /exceeds maximum length/i,
      );
    });
  });

  describe("4. Deterministic Provider & Model Ordering + Confidence Bucket Boundaries", () => {
    it("orders providers by requestCount DESC, providerId ASC and models by requestCount DESC, providerId ASC, modelId ASC", async () => {
      // Create tie on requestCount = 2 between anthropic and openai
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        outcome: "success",
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet",
        outcome: "success",
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "anthropic",
        modelId: "claude-3-5-haiku",
        outcome: "success",
      });
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "groq",
        modelId: "llama-3.3-70b-versatile",
        outcome: "success",
      });

      const snapshot = await getTelemetryDashboardSnapshot({});
      assert.deepEqual(
        snapshot.providerDistribution.map((p) => p.providerId),
        ["anthropic", "openai", "groq"],
      );
      assert.deepEqual(
        snapshot.modelDistribution.map((m) => `${m.providerId}/${m.modelId}`),
        [
          "anthropic/claude-3-5-haiku",
          "anthropic/claude-3-7-sonnet",
          "groq/llama-3.3-70b-versatile",
          "openai/gpt-4o",
          "openai/gpt-4o-mini",
        ],
      );
    });

    it("places confidence scores at exact bucket boundaries and flags missing/out-of-range scores", async () => {
      const boundaryScores: Array<number | undefined> = [
        0.0,
        0.249,
        0.25,
        0.499,
        0.5,
        0.749,
        0.75,
        1.0,
        undefined,
      ];

      for (const score of boundaryScores) {
        await recordTelemetryEvent({
          eventType: "routing_decision",
          providerId: "openai",
          modelId: "gpt-4o",
          outcome: "success",
          confidence: score,
          routingReason: "Boundary test",
        });
      }

      const snapshot = await getTelemetryDashboardSnapshot({});
      assert.equal(snapshot.summary.totalRoutedRequests, 9);
      assert.equal(snapshot.confidenceDistribution.availableCount, 8);
      assert.equal(snapshot.confidenceDistribution.missingCount, 1);

      const countsByKey = Object.fromEntries(
        snapshot.confidenceDistribution.buckets.map((b) => [b.bucketKey, b.count]),
      );
      assert.deepEqual(countsByKey, {
        "0.00_0.25": 2,
        "0.25_0.50": 2,
        "0.50_0.75": 2,
        "0.75_1.00": 2,
      });
      assertSnapshotInvariants(snapshot);
    });
  });

  describe("5. Time, Date, Leap-Year & Freshness Edge Cases", () => {
    it("validates custom ranges including same-day, leap day (2024-02-29 vs 2026-02-29), month/year boundaries, and bucket selection", () => {
      const nowMs = Date.parse("2026-05-15T14:00:00Z");

      // Same start and end date -> valid, 1 day -> hour bucket
      const sameDay = resolveTelemetryDateRangeBounds("custom", "2026-03-15", "2026-03-15", nowMs);
      assert.equal(sameDay.validationError, null);
      assert.equal(sameDay.timeBucket, "hour");
      assert.ok(sameDay.startTime !== null && sameDay.endTime !== null);
      assert.ok(sameDay.startTime <= sameDay.endTime);

      // Valid leap day 2024-02-29
      const validLeap = resolveTelemetryDateRangeBounds("custom", "2024-02-29", "2024-03-01", nowMs);
      assert.equal(validLeap.validationError, null);
      assert.equal(validLeap.timeBucket, "hour");

      // Invalid non-leap day 2026-02-29
      const invalidLeap = resolveTelemetryDateRangeBounds("custom", "2026-02-29", "2026-03-01", nowMs);
      assert.ok(invalidLeap.validationError);

      // Start date after end date
      const inverted = resolveTelemetryDateRangeBounds("custom", "2026-04-10", "2026-04-01", nowMs);
      assert.match(inverted.validationError ?? "", /Start date must be on or before end date/);

      // Year boundary > 2 days -> day bucket
      const yearBoundary = resolveTelemetryDateRangeBounds("custom", "2025-12-28", "2026-01-04", nowMs);
      assert.equal(yearBoundary.validationError, null);
      assert.equal(yearBoundary.timeBucket, "day");

      // Presets
      assert.equal(resolveTelemetryDateRangeBounds("today", "", "", nowMs).timeBucket, "hour");
      assert.equal(resolveTelemetryDateRangeBounds("last_7_days", "", "", nowMs).timeBucket, "day");
      assert.equal(resolveTelemetryDateRangeBounds("last_30_days", "", "", nowMs).timeBucket, "day");
      assert.equal(resolveTelemetryDateRangeBounds("all", "", "", nowMs).startTime, null);
    });

    it("formats bucket labels and computes freshness transitions accurately", () => {
      const sampleMs = Date.parse("2026-05-10T14:00:00Z");
      assert.ok(formatTimeSeriesBucketLabel(sampleMs, "day").length > 0);
      assert.ok(formatTimeSeriesBucketLabel(sampleMs, "hour").length > 0);
      assert.equal(formatTimeSeriesBucketLabel(0, "day"), "Unknown");

      const nowMs = Date.parse("2026-05-10T12:00:00Z");
      assert.equal(resolveTelemetryFreshnessStatus(null, true, false, nowMs).status, "loading");
      assert.equal(resolveTelemetryFreshnessStatus(null, false, true, nowMs).status, "unavailable");
      assert.equal(resolveTelemetryFreshnessStatus(null, false, false, nowMs).status, "unknown");
      assert.equal(
        resolveTelemetryFreshnessStatus(Date.parse("2026-05-10T11:59:30Z"), false, false, nowMs).status,
        "up_to_date",
      );
      assert.equal(
        resolveTelemetryFreshnessStatus(Date.parse("2026-05-10T11:55:00Z"), false, false, nowMs).status,
        "updated_recently",
      );
    });

    it("returns zero records cleanly for future date ranges", async () => {
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
        occurredAt: Date.parse("2026-05-10T10:00:00Z"),
      });

      const futureSnapshot = await getTelemetryDashboardSnapshot({
        startTime: Date.parse("2099-01-01T00:00:00Z"),
        endTime: Date.parse("2099-01-31T23:59:59Z"),
      });
      assert.equal(futureSnapshot.summary.totalRoutedRequests, 0);
      assert.equal(futureSnapshot.timeSeries.length, 0);
      assertSnapshotInvariants(futureSnapshot);
    });
  });

  describe("6. Data Quality, Historical Preservation & Session Deletion Cascade", () => {
    it("preserves deprecated/historical providers and cascades session deletions to linked telemetry records", async () => {
      const s1 = await createChatSession({ title: "Session 1" });
      const s2 = await createChatSession({ title: "Session 2" });
      const s3 = await createChatSession({ title: "Session 3" });

      await recordTelemetryEvent({
        sessionId: s1.id,
        eventType: "provider_execution",
        providerId: "legacy_provider_v1",
        modelId: "retired-model-2024",
        outcome: "success",
        confidence: 0.81,
        routingReason: "Legacy route",
      });
      await recordTelemetryEvent({
        sessionId: s2.id,
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
        confidence: 0.9,
        routingReason: "Primary route",
      });
      await recordTelemetryEvent({
        sessionId: s3.id,
        eventType: "provider_execution",
        providerId: "anthropic",
        modelId: "claude-3-7-sonnet",
        outcome: "success",
        confidence: 0.88,
        routingReason: "Primary route",
      });

      const beforeDelete = await getTelemetryDashboardSnapshot({});
      assert.equal(beforeDelete.summary.totalRoutedRequests, 3);
      assert.ok(
        beforeDelete.filterOptions.providers.some((p) => p.providerId === "legacy_provider_v1"),
      );

      // Single session delete cascades to s1 telemetry
      await deleteChatSession(s1.id);
      const afterSingleDelete = await getTelemetryDashboardSnapshot({});
      assert.equal(afterSingleDelete.summary.totalRoutedRequests, 2);

      // Bulk history session delete cascades to s2 and s3 telemetry
      await deleteHistorySessionsBulk([s2.id, s3.id]);
      const afterBulkDelete = await getTelemetryDashboardSnapshot({});
      assert.equal(afterBulkDelete.summary.totalRoutedRequests, 0);
    });

    it("maps canonical provider names and outcome labels cleanly", () => {
      assert.equal(resolveProviderDisplayName("openai").displayName, "OpenAI");
      assert.equal(resolveProviderDisplayName("anthropic").displayName, "Anthropic");
      assert.equal(resolveProviderDisplayName("google").displayName, "Google Gemini");
      assert.equal(resolveProviderDisplayName("unrecorded").displayName, "Not recorded");
      assert.equal(formatOutcomeLabel("rate_limited"), "Rate Limited");
      assert.equal(formatOutcomeLabel("fallback"), "Fallback Transition");
    });
  });

  describe("7. Security, Privacy & Zero Live Routing/SLM Side Effects", () => {
    it("never exposes prompt/response content or credentials and triggers zero live SLM/routing/provider executions", async () => {
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
        confidence: 0.95,
        routingReason: "Selected via policy",
      });

      const execCountBefore = getMockExecutionCount();
      const snapshot = await getTelemetryDashboardSnapshot({});
      const execCountAfter = getMockExecutionCount();

      assert.equal(
        execCountAfter,
        execCountBefore,
        "Telemetry dashboard query must never trigger live SLM, routing, or provider execution",
      );

      const serialized = JSON.stringify(snapshot);
      assert.ok(!serialized.includes("sk-"), "Snapshot must never contain API keys");
      assert.ok(!serialized.includes("promptContent"), "Snapshot must never contain prompt content");
      assert.ok(!serialized.includes("assistantContent"), "Snapshot must never contain assistant content");
    });

    it("propagates simulated query failures cleanly via test hooks without corrupting stored records", async () => {
      await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
      });

      setMockTelemetryTestHooks({ errorTarget: "snapshot" });
      await assert.rejects(
        () => getTelemetryDashboardSnapshot({}),
        /Unable to load local telemetry snapshot/i,
      );

      resetMockTelemetryTestHooks();
      const recovered = await getTelemetryDashboardSnapshot({});
      assert.equal(recovered.summary.totalRoutedRequests, 1);
    });
  });

  describe("8. Large Dataset Performance & Accuracy Benchmarks (1,000 / 10,000 / 50,000 Records)", () => {
    function generateSyntheticBatch(count: number): TelemetryRecord[] {
      const providers = ["openai", "anthropic", "google", "deepseek", "groq", "mistral"];
      const modelsByProvider: Record<string, string[]> = {
        openai: ["gpt-4o", "gpt-4o-mini"],
        anthropic: ["claude-3-7-sonnet", "claude-3-5-haiku"],
        google: ["gemini-2.5-pro", "gemini-2.5-flash"],
        deepseek: ["deepseek-chat", "deepseek-reasoner"],
        groq: ["llama-3.3-70b-versatile"],
        mistral: ["mistral-large-latest"],
      };
      const outcomes: TelemetryOutcome[] = [
        "success",
        "success",
        "success",
        "fallback",
        "failure",
        "cancelled",
      ];
      const baseTimeMs = Date.parse("2026-04-01T00:15:00Z");
      const batch: TelemetryRecord[] = new Array(count);

      for (let i = 0; i < count; i++) {
        const providerId = providers[i % providers.length]!;
        const models = modelsByProvider[providerId]!;
        const modelId = models[i % models.length]!;
        const outcome = outcomes[i % outcomes.length]!;
        const dayOffset = i % 28;
        const hourOffset = i % 24;
        batch[i] = {
          id: `bench-tel-${count}-${i}`,
          sessionId: null,
          eventType: i % 5 === 0 ? "routing_decision" : "provider_execution",
          providerId,
          modelId,
          routingReason: outcome === "fallback" ? "Failover from primary" : "Policy score winner",
          confidence: (i % 100) / 100,
          outcome,
          occurredAt: baseTimeMs + dayOffset * 86_400_000 + hourOffset * 3_600_000,
        };
      }
      return batch;
    }

    it("aggregates 1,000, 10,000, and 50,000 telemetry records accurately within bounded latency", async () => {
      for (const size of [1_000, 10_000, 50_000]) {
        resetTelemetryMockStore();
        const batch = generateSyntheticBatch(size);
        __internalInsertMockTelemetryBatch(batch);

        const t0 = performance.now();
        const snapshot = await getTelemetryDashboardSnapshot({ timeBucket: "day" });
        const elapsedMs = performance.now() - t0;

        assert.equal(snapshot.summary.totalRoutedRequests, size);
        assert.equal(snapshot.providerDistribution.length, 6);
        assert.equal(snapshot.timeSeries.length, 28);
        assertSnapshotInvariants(snapshot);
        assert.ok(
          elapsedMs < 2500,
          `Aggregation of ${size} records took ${elapsedMs.toFixed(1)}ms (expected < 2500ms)`,
        );
      }
    });
  });
});
