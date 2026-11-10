// ============================================================================
// Nano Route - Step 27 Intent Classifier IPC Contract Tests
// File: src/services/ipc/__tests__/intent_classifier.test.ts
// ============================================================================
// Contract verification for local semantic intent classification, availability states,
// input validation, candidate sorting, and gold benchmark evaluation.
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  classifyIntent,
  getClassifierStatus,
  evaluateClassifier,
  resetMockClassifierState,
  setMockClassifierStatus,
  setMockClassificationResult,
} from "../intent_classifier.ts";
import type { IntentClassificationRequestDto } from "../types.ts";

describe("Step 27 Intent Classifier Contract Tests", () => {
  beforeEach(() => {
    resetMockClassifierState();
  });

  describe("1. Classifier Status & Availability Contracts", () => {
    it("reports default available status with supported intents", async () => {
      const status = await getClassifierStatus();
      assert.strictEqual(status.availability, "available");
      assert.strictEqual(status.modelId, "nano-route-router");
      assert.strictEqual(status.schemaVersion, "nano-route-intent-schema-v1");
      assert.strictEqual(status.supportedIntents.length, 12);
      assert.ok(status.supportedIntents.includes("software_engineering"));
      assert.ok(status.supportedIntents.includes("reasoning_math"));
      assert.ok(status.supportedIntents.includes("unknown"));
    });

    it("reflects overridden unavailable state", async () => {
      setMockClassifierStatus({ availability: "model_incompatible" });
      const status = await getClassifierStatus();
      assert.strictEqual(status.availability, "model_incompatible");
    });
  });

  describe("2. Intent Classification Requests & Validation", () => {
    it("rejects empty text prompts locally", async () => {
      const req: IntentClassificationRequestDto = {
        text: "   \t\n   ",
      };

      await assert.rejects(
        async () => {
          await classifyIntent(req);
        },
        {
          message: "Input text prompt cannot be empty or whitespace only",
        }
      );
    });

    it("correctly classifies software engineering tasks", async () => {
      const req: IntentClassificationRequestDto = {
        text: "Implement a thread-safe LRU cache in Rust with O(1) lookups",
      };

      const result = await classifyIntent(req);
      assert.ok(result.requestId.startsWith("req_cls_"));
      assert.strictEqual(result.primaryIntent, "software_engineering");
      assert.ok(result.confidence > 0.5);
      assert.strictEqual(result.ambiguity, "not_ambiguous");
      assert.strictEqual(result.classifierModelId, "nano-route-router");
      assert.strictEqual(result.classifierSchemaVersion, "nano-route-intent-schema-v1");
      assert.ok(result.explanation.includes("software_engineering"));
    });

    it("correctly classifies reasoning & math tasks", async () => {
      const req: IntentClassificationRequestDto = {
        text: "Prove that square root of 2 is irrational and calculate matrix eigenvalues",
      };

      const result = await classifyIntent(req);
      assert.strictEqual(result.primaryIntent, "reasoning_math");
      assert.ok(result.confidence > 0.5);
    });

    it("falls back to unknown for under-specified ambiguous prompts", async () => {
      const req: IntentClassificationRequestDto = {
        text: "Can you help with this?",
      };

      const result = await classifyIntent(req);
      assert.strictEqual(result.primaryIntent, "unknown");
      assert.strictEqual(result.ambiguity, "unknown");
      assert.ok(result.confidence < 0.35);
    });
  });

  describe("3. Mock Overrides & Multi-Intent Simulation", () => {
    it("permits mock result overrides for multi-intent simulation", async () => {
      setMockClassificationResult({
        primaryIntent: "data_analysis",
        ambiguity: "multi_intent",
        confidence: 0.65,
        alternatives: [
          {
            intent: "writing",
            normalizedScore: 0.28,
            rawScore: 1.1,
          },
        ],
        explanation: "Multi-intent request detected: primary 'data_analysis' with secondary 'writing'",
      });

      const res = await classifyIntent({ text: "Analyze data and draft email" });
      assert.strictEqual(res.primaryIntent, "data_analysis");
      assert.strictEqual(res.ambiguity, "multi_intent");
      assert.strictEqual(res.alternatives.length, 1);
      assert.strictEqual(res.alternatives[0].intent, "writing");
    });
  });

  describe("4. Gold Benchmark Evaluation IPC Contract", () => {
    it("runs gold benchmark and returns summary report", async () => {
      const report = await evaluateClassifier();
      assert.strictEqual(report.datasetVersion, "1.0.0");
      assert.ok(report.totalSamples >= 20);
      assert.ok(report.accuracyPercentage >= 90.0);
      assert.ok(report.averageLatencyMs > 0);
      assert.ok(report.p95LatencyMs > 0);
    });
  });
});

