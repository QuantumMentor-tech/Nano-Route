/**
//! Nano Route — Telemetry Persistence & Analytics Unit Tests (Step 18)
//!
//! Tests:
//! 1. Telemetry Record Creation: verified ID generation, timestamp, event types, outcomes, metrics.
//! 2. Validation Constraints: confidence score bounds [0.0, 1.0], non-negative cost, bounded reason.
//! 3. Time Range, Provider, and Model Filtering: isolated multi-dimensional querying.
//! 4. Aggregation Invariants: sum of tokens, sum of costs, success/failure counts, average/min/max latency.
//! 5. Distinguishing NULL vs ZERO: verifying that unmeasured latency/cost is distinct from zero.
//! 6. Privacy & Redaction Contracts: verifying zero prompt/response duplication and zero credential storage.
//! 7. Data Wipe / Clear Operations: verifying purge capability.
//! 8. IPC Boundary Round-Trip: simulated Tauri environment with mock command registry.
*/

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  recordTelemetryEvent,
  listTelemetryRecords,
  getTelemetryAggregates,
  clearTelemetry,
  resetTelemetryMockStore,
} from "../telemetry.ts";
import {
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
} from "../client.ts";
import { IPC_COMMANDS } from "../types.ts";
import type {
  TelemetryAggregateReport,
} from "../types.ts";

describe("Step 18 Telemetry Persistence & Analytics Data Foundation", () => {
  beforeEach(() => {
    resetTelemetryMockStore();
    clearMockCommandHandlers();
    setMockTauriContext(false);
  });

  afterEach(() => {
    resetTelemetryMockStore();
    clearMockCommandHandlers();
    setMockTauriContext(false);
  });

  describe("1. Record Creation & Round-Trip Persistence", () => {
    it("creates an operational telemetry record with generated ID and timestamp", async () => {
      const record = await recordTelemetryEvent({
        eventType: "routing_decision",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet",
        outcome: "success",
        confidence: 0.95,
        routing_reason: "High reasoning capability required",
        latencyMs: 342,
        promptTokens: 150,
        completionTokens: 280,
        costUsd: 0.0058,
      } as any);

      assert.ok(record.id.startsWith("mock_telem_"));
      assert.equal(record.eventType, "routing_decision");
      assert.equal(record.providerId, "anthropic");
      assert.equal(record.modelId, "claude-3-5-sonnet");
      assert.equal(record.outcome, "success");
      assert.equal(record.confidence, 0.95);
      assert.equal(record.latencyMs, 342);
      assert.equal(record.promptTokens, 150);
      assert.equal(record.completionTokens, 280);
      assert.equal(record.costUsd, 0.0058);
      assert.ok(record.occurredAt > 0);
    });

    it("persists optional correlation IDs (session, message, task, stream)", async () => {
      const record = await recordTelemetryEvent({
        eventType: "provider_execution",
        sessionId: "sess_test_100",
        messageId: "msg_test_200",
        taskId: "task_test_300",
        streamId: "strm_test_400",
        providerId: "openai",
        modelId: "gpt-4o",
        outcome: "success",
      });

      assert.equal(record.sessionId, "sess_test_100");
      assert.equal(record.messageId, "msg_test_200");
      assert.equal(record.taskId, "task_test_300");
      assert.equal(record.streamId, "strm_test_400");
    });
  });

  describe("2. Validation Constraints", () => {
    it("rejects confidence scores outside [0.0, 1.0]", async () => {
      await assert.rejects(
        async () => {
          await recordTelemetryEvent({
            confidence: 1.5,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );

      await assert.rejects(
        async () => {
          await recordTelemetryEvent({
            confidence: -0.1,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects negative cost values", async () => {
      await assert.rejects(
        async () => {
          await recordTelemetryEvent({
            costUsd: -0.01,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });

    it("rejects oversized routing reason strings exceeding 255 characters", async () => {
      const longReason = "R".repeat(256);
      await assert.rejects(
        async () => {
          await recordTelemetryEvent({
            routingReason: longReason,
          });
        },
        {
          name: "IpcError",
          code: "INVALID_INPUT",
        }
      );
    });
  });

  describe("3. Multi-Dimensional Filtering", () => {
    it("filters telemetry by providerId", async () => {
      await recordTelemetryEvent({ providerId: "anthropic", modelId: "claude-3-5-sonnet" });
      await recordTelemetryEvent({ providerId: "openai", modelId: "gpt-4o" });
      await recordTelemetryEvent({ providerId: "anthropic", modelId: "claude-3-haiku" });

      const anthropicRecords = await listTelemetryRecords({ providerId: "anthropic" });
      assert.equal(anthropicRecords.length, 2);
      assert.ok(anthropicRecords.every((r) => r.providerId === "anthropic"));

      const openaiRecords = await listTelemetryRecords({ providerId: "openai" });
      assert.equal(openaiRecords.length, 1);
      assert.equal(openaiRecords[0].providerId, "openai");
    });

    it("filters telemetry by modelId", async () => {
      await recordTelemetryEvent({ providerId: "local", modelId: "phi-3-mini" });
      await recordTelemetryEvent({ providerId: "local", modelId: "llama-3-8b" });

      const phiRecords = await listTelemetryRecords({ modelId: "phi-3-mini" });
      assert.equal(phiRecords.length, 1);
      assert.equal(phiRecords[0].modelId, "phi-3-mini");
    });

    it("filters telemetry by eventType and outcome", async () => {
      await recordTelemetryEvent({ eventType: "routing_decision", outcome: "success" });
      await recordTelemetryEvent({ eventType: "provider_execution", outcome: "failure", errorCode: "TIMEOUT" });
      await recordTelemetryEvent({ eventType: "stream_lifecycle", outcome: "cancelled" });

      const failures = await listTelemetryRecords({ outcome: "failure" });
      assert.equal(failures.length, 1);
      assert.equal(failures[0].errorCode, "TIMEOUT");

      const lifecycle = await listTelemetryRecords({ eventType: "stream_lifecycle" });
      assert.equal(lifecycle.length, 1);
      assert.equal(lifecycle[0].outcome, "cancelled");
    });
  });

  describe("4. Aggregation & Metrics Calculation", () => {
    it("accurately computes sums for tokens, cost, and event counts", async () => {
      await recordTelemetryEvent({
        providerId: "anthropic",
        outcome: "success",
        promptTokens: 1000,
        completionTokens: 500,
        costUsd: 0.10,
        latencyMs: 120,
      });

      await recordTelemetryEvent({
        providerId: "anthropic",
        outcome: "success",
        promptTokens: 800,
        completionTokens: 400,
        costUsd: 0.05,
        latencyMs: 180,
      });

      await recordTelemetryEvent({
        providerId: "anthropic",
        outcome: "failure",
        errorCode: "RATE_LIMITED",
        promptTokens: 200,
        completionTokens: 0,
        costUsd: 0.01,
        latencyMs: 300,
      });

      const report = await getTelemetryAggregates({ providerId: "anthropic" });

      assert.equal(report.totalEvents, 3);
      assert.equal(report.successfulEvents, 2);
      assert.equal(report.failedEvents, 1);
      assert.equal(report.totalPromptTokens, 2000);
      assert.equal(report.totalCompletionTokens, 900);
      assert.ok(Math.abs(report.totalCostUsd - 0.16) < 0.0001);
      assert.equal(report.avgLatencyMs, 200); // (120 + 180 + 300) / 3
      assert.equal(report.minLatencyMs, 120);
      assert.equal(report.maxLatencyMs, 300);
    });

    it("distinguishes unmeasured NULL values from 0.0 / 0 ms", async () => {
      // Record with unmeasured metrics (NULL)
      await recordTelemetryEvent({
        eventType: "system_event",
        outcome: "success",
        // latencyMs, tokens, and costUsd intentionally omitted
      });

      const report = await getTelemetryAggregates();
      assert.equal(report.totalEvents, 1);
      assert.equal(report.totalPromptTokens, 0);
      assert.equal(report.totalCompletionTokens, 0);
      assert.equal(report.totalCostUsd, 0.0);
      // Average latency should remain null/undefined when no records have latency
      assert.equal(report.avgLatencyMs, null);
      assert.equal(report.minLatencyMs, null);
      assert.equal(report.maxLatencyMs, null);
    });
  });

  describe("5. Privacy & Redaction Invariants", () => {
    it("guarantees telemetry schema does not store user prompt or assistant response text", async () => {
      const record = await recordTelemetryEvent({
        eventType: "provider_execution",
        providerId: "anthropic",
        modelId: "claude-3-5-sonnet",
        outcome: "success",
        routingReason: "Safe summary string",
      });

      const keys = Object.keys(record);
      assert.ok(!keys.includes("prompt"));
      assert.ok(!keys.includes("promptText"));
      assert.ok(!keys.includes("response"));
      assert.ok(!keys.includes("responseText"));
      assert.ok(!keys.includes("content"));
      assert.ok(!keys.includes("apiKey"));
      assert.ok(!keys.includes("authorization"));
    });
  });

  describe("6. Local Data Wipe / Clear Operations", () => {
    it("purges all telemetry records upon clearTelemetry call", async () => {
      await recordTelemetryEvent({ providerId: "provider_1" });
      await recordTelemetryEvent({ providerId: "provider_2" });

      const before = await listTelemetryRecords();
      assert.equal(before.length, 2);

      const clearedCount = await clearTelemetry();
      assert.equal(clearedCount, 2);

      const after = await listTelemetryRecords();
      assert.equal(after.length, 0);
    });
  });

  describe("7. IPC Boundary Round-Trip (Simulated Tauri Environment)", () => {
    it("executes getTelemetryAggregates through mock Tauri IPC registry", async () => {
      setMockTauriContext(true);

      const mockAggregates: TelemetryAggregateReport = {
        totalEvents: 42,
        successfulEvents: 40,
        failedEvents: 2,
        totalPromptTokens: 105000,
        totalCompletionTokens: 52000,
        totalCostUsd: 1.45,
        avgLatencyMs: 235.4,
        minLatencyMs: 45,
        maxLatencyMs: 1200,
      };

      registerMockCommandHandler(
        IPC_COMMANDS.GET_TELEMETRY_AGGREGATES,
        async (rawArgs) => {
          const args = rawArgs as { filter?: any } | undefined;
          assert.equal(args?.filter?.providerId, "anthropic");
          return mockAggregates;
        }
      );

      const aggregates = await getTelemetryAggregates({ providerId: "anthropic" });
      assert.deepEqual(aggregates, mockAggregates);
    });
  });
});
