// ============================================================================
// Nano Route - Step 26 Local SLM Runtime Contract Tests
// File: src/services/ipc/__tests__/local_slm.test.ts
// ============================================================================
// Verifies local SLM runtime status queries, model lifecycle, on-device
// inference execution, latency metrics, and zero-leak privacy invariants.
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  getLocalRuntimeStatus,
  getLocalModelStatus,
  initializeLocalRuntime,
  loadRouterModel,
  unloadRouterModel,
  getLocalRuntimeMetrics,
  runLocalInference,
  resetMockLocalSlm,
  setMockLocalSlmStatus,
} from "../local_slm.ts";

describe("Step 26 Local SLM Runtime & On-Device Inference Engine", () => {
  beforeEach(() => {
    resetMockLocalSlm();
  });

  // --------------------------------------------------------------------------
  // 1. Runtime Status & Initialization
  // --------------------------------------------------------------------------
  describe("1. Local SLM Runtime Status & Engine Baseline", () => {
    it("reports baseline runtime status with ONNX backend and CPU execution provider", async () => {
      const status = await getLocalRuntimeStatus();

      assert.equal(status.state, "ready");
      assert.equal(status.backend, "onnx");
      assert.equal(status.executionProvider, "cpu");
      assert.equal(status.modelId, "nano-route-router");
      assert.equal(status.modelVersion, "1.0.0");
      assert.equal(status.modelStatus, "loaded");
      assert.ok(status.runtimeVersion.includes("ort"));
      assert.equal(status.isBusy, false);
      assert.equal(status.queueDepth, 0);
    });

    it("retrieves model status directly", async () => {
      const modelStatus = await getLocalModelStatus();
      assert.equal(modelStatus, "loaded");
    });

    it("explicitly initializes the local runtime successfully", async () => {
      const initResult = await initializeLocalRuntime();
      assert.equal(initResult, true);
    });

    it("reports runtime busy state when queue is simulated full", async () => {
      setMockLocalSlmStatus({ isBusy: true, queueDepth: 32 });
      const status = await getLocalRuntimeStatus();
      assert.equal(status.isBusy, true);
      assert.equal(status.queueDepth, 32);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Model Lifecycle (Load / Unload)
  // --------------------------------------------------------------------------
  describe("2. Model Session Lifecycle Management", () => {
    it("unloads the active router model and transitions status to not_loaded", async () => {
      const unloadSuccess = await unloadRouterModel();
      assert.equal(unloadSuccess, true);

      const status = await getLocalRuntimeStatus();
      assert.equal(status.modelStatus, "not_loaded");
    });

    it("rejects inference attempts when no model is loaded", async () => {
      await unloadRouterModel();

      await assert.rejects(
        async () => {
          await runLocalInference("classify this text");
        },
        {
          message: /No local model is currently loaded/,
        }
      );
    });

    it("reloads the router model and restores loaded status", async () => {
      await unloadRouterModel();
      assert.equal(await getLocalModelStatus(), "not_loaded");

      const loadSuccess = await loadRouterModel();
      assert.equal(loadSuccess, true);
      assert.equal(await getLocalModelStatus(), "loaded");
    });
  });

  // --------------------------------------------------------------------------
  // 3. On-Device Local Inference Execution
  // --------------------------------------------------------------------------
  describe("3. On-Device Local Inference Execution", () => {
    it("executes local inference and returns typed logits output with latency", async () => {
      const result = await runLocalInference("summarize software architecture");

      assert.ok(result.requestId.startsWith("req_local_"));
      assert.equal(result.modelId, "nano-route-router");
      assert.deepEqual(result.outputShape, [1, 8]);
      assert.equal(result.logitsPreview.length, 8);
      assert.ok(result.latencyMs > 0);
      assert.ok(result.tokenCount > 0);
    });

    it("rejects empty or whitespace-only input prompt", async () => {
      await assert.rejects(
        async () => {
          await runLocalInference("   ");
        },
        {
          message: /Inference prompt text cannot be empty/,
        }
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. Performance Metrics Aggregation
  // --------------------------------------------------------------------------
  describe("4. Performance Metrics Aggregation", () => {
    it("records inference counts and latency metrics", async () => {
      await runLocalInference("test query one");
      await runLocalInference("test query two");

      const metrics = await getLocalRuntimeMetrics();
      assert.equal(metrics.totalInferences, 2);
      assert.equal(metrics.successfulInferences, 2);
      assert.equal(metrics.failedInferences, 0);
      assert.ok(metrics.lastInferenceMs > 0);
      assert.ok(metrics.lastTotalMs >= metrics.lastInferenceMs);
      assert.ok(metrics.lastInputTokens > 0);
      assert.ok(metrics.coldLoadMs !== null);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Zero-Secret Exposure & Local Privacy Invariants
  // --------------------------------------------------------------------------
  describe("5. Local-Only Privacy & Zero-Secret Exposure", () => {
    it("guarantees user prompt text is never embedded in runtime status or metrics", async () => {
      const sensitivePrompt = "SECRET_USER_PROMPT_DO_NOT_LEAK_42";
      await runLocalInference(sensitivePrompt);

      const status = await getLocalRuntimeStatus();
      const metrics = await getLocalRuntimeMetrics();

      const serializedStatus = JSON.stringify(status);
      const serializedMetrics = JSON.stringify(metrics);

      assert.ok(!serializedStatus.includes(sensitivePrompt));
      assert.ok(!serializedMetrics.includes(sensitivePrompt));
      assert.ok(!serializedStatus.includes("apiKey"));
      assert.ok(!serializedStatus.includes("Bearer"));
    });
  });
});
