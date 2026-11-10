// ============================================================================
// Nano Route - Step 28 Task Analysis IPC Contract Tests
// File: src/services/ipc/__tests__/task_analysis.test.ts
// ============================================================================
// Contract verification for local multidimensional task analysis, complexity levels,
// domain taxonomy, capability requirements, and strict provider neutrality.
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  analyzeTask,
  getTaskAnalyzerStatus,
  resetMockTaskAnalyzerState,
  setMockTaskAnalyzerStatus,
  setMockTaskAnalysisResult,
} from "../task_analysis.ts";
import type { TaskAnalysisRequestDto } from "../types.ts";

describe("Step 28 Task Analysis Contract Tests", () => {
  beforeEach(() => {
    resetMockTaskAnalyzerState();
  });

  describe("1. Task Analyzer Status & Taxonomy Contracts", () => {
    it("reports available status with supported domains and capabilities", async () => {
      const status = await getTaskAnalyzerStatus();
      assert.strictEqual(status.isAvailable, true);
      assert.strictEqual(status.modelId, "nano-route-router");
      assert.strictEqual(status.schemaVersion, "nano-route-analysis-schema-v1");
      assert.ok(status.supportedDomains.includes("software_engineering"));
      assert.ok(status.supportedDomains.includes("mathematics"));
      assert.ok(status.supportedDomains.includes("research"));
      assert.ok(status.supportedCapabilities.includes("code_understanding"));
      assert.ok(status.supportedCapabilities.includes("structured_output"));
      assert.ok(status.supportedCapabilities.includes("web_retrieval"));
    });

    it("handles overridden unavailable status", async () => {
      setMockTaskAnalyzerStatus({ isAvailable: false });
      const status = await getTaskAnalyzerStatus();
      assert.strictEqual(status.isAvailable, false);

      await assert.rejects(
        async () => {
          await analyzeTask({ text: "Hello" });
        },
        {
          message: "Task analyzer is unavailable",
        }
      );
    });
  });

  describe("2. Task Analysis Execution & Dimension Contracts", () => {
    it("rejects empty text prompts locally", async () => {
      const req: TaskAnalysisRequestDto = {
        text: "    \t\n   ",
      };

      await assert.rejects(
        async () => {
          await analyzeTask(req);
        },
        {
          message: "Task prompt cannot be empty or whitespace only",
        }
      );
    });

    it("analyzes software engineering tasks with high complexity", async () => {
      const req: TaskAnalysisRequestDto = {
        text: "Refactor these Rust modules to implement an async LRU cache",
      };

      const result = await analyzeTask(req);
      assert.ok(result.requestId.startsWith("req_an_"));
      assert.strictEqual(result.primaryDomain.domain, "software_engineering");
      assert.strictEqual(result.complexity.level, "high");
      assert.ok(result.capabilities.some((c) => c.capability === "text_generation"));
      assert.strictEqual(result.completeness, "complete");
      assert.strictEqual(result.analysisSchemaVersion, "nano-route-analysis-schema-v1");
    });

    it("analyzes mathematics tasks with high complexity", async () => {
      const req: TaskAnalysisRequestDto = {
        text: "Prove this theorem and calculate matrix eigenvalues",
      };

      const result = await analyzeTask(req);
      assert.strictEqual(result.primaryDomain.domain, "mathematics");
      assert.strictEqual(result.complexity.level, "high");
    });

    it("analyzes simple translation tasks with low complexity", async () => {
      const req: TaskAnalysisRequestDto = {
        text: "Translate this sentence into Urdu",
      };

      const result = await analyzeTask(req);
      assert.strictEqual(result.primaryDomain.domain, "translation");
      assert.strictEqual(result.complexity.level, "low");
    });
  });

  describe("3. Mock Overrides & Provider Neutrality Contracts", () => {
    it("permits mock result overrides for testing specific capabilities", async () => {
      setMockTaskAnalysisResult({
        primaryDomain: { domain: "data_analysis", confidence: 0.92, source: "model" },
        capabilities: [
          {
            capability: "structured_output",
            strength: "required",
            confidence: 0.95,
            source: "explicit_user_requirement",
            reasonCode: "json_mandate",
          },
        ],
        conflicts: [
          {
            dimension: "capability:structured_output",
            modelSignal: "intent:general",
            explicitSignal: "json_mandate",
            resolution: "Explicit requirement overrides general format",
          },
        ],
        ambiguity: "medium",
      });

      const res = await analyzeTask({ text: "Hello return JSON" });
      assert.strictEqual(res.primaryDomain.domain, "data_analysis");
      assert.strictEqual(res.capabilities.length, 1);
      assert.strictEqual(res.capabilities[0].capability, "structured_output");
      assert.strictEqual(res.conflicts.length, 1);
      assert.strictEqual(res.ambiguity, "medium");
    });

    it("guarantees result contains zero provider brand names or pricing", async () => {
      const res = await analyzeTask({ text: "Implement LRU cache in Rust" });
      const serialized = JSON.stringify(res).toLowerCase();

      for (const forbidden of [
        "anthropic",
        "openai",
        "claude",
        "gemini",
        "deepseek",
        "groq",
        "mistral",
        "provider_score",
        "selected_provider",
        "cost_usd",
      ]) {
        assert.ok(
          !serialized.includes(forbidden),
          `TaskAnalysisResult must not contain provider assignment '${forbidden}'`
        );
      }
    });
  });
});

