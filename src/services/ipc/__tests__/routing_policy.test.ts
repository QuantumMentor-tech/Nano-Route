// ============================================================================
// Nano Route - Routing Policy Contract Tests
// File: src/services/ipc/__tests__/routing_policy.test.ts
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRoutingPolicy,
  getRoutingPolicyConfig,
  updateRoutingPolicyConfig,
  validateManualOverride,
  resetRoutingPolicyMocks,
  DEFAULT_ROUTING_POLICY_CONFIG,
} from "../routing_policy.ts";
import type {
  RoutingPolicyRequestDto,
  TaskAnalysisResultDto,
  ManualRouteOverrideDto,
  TaskCapabilityAssessmentDto,
} from "../types.ts";

function createMockTaskAnalysis(requiresImage: boolean = false): TaskAnalysisResultDto {
  const capabilities: TaskCapabilityAssessmentDto[] = [
    {
      capability: "text_generation",
      strength: "required",
      confidence: 0.99,
      source: "derived",
      reasonCode: "base_text",
    },
  ];

  if (requiresImage) {
    capabilities.push({
      capability: "image_input",
      strength: "required",
      confidence: 0.98,
      source: "model",
      reasonCode: "image_demanded",
    });
  }

  return {
    requestId: "req_test_analysis",
    intent: {
      primaryIntent: "software_engineering",
      confidence: 0.95,
      ambiguity: "not_ambiguous",
      secondaryIntents: ["code_debugging"],
    },
    complexity: {
      level: "high",
      confidence: 0.92,
      source: "model",
      score: 0.88,
      evidenceCodes: ["CODE_BLOCKS_PRESENT"],
    },
    primaryDomain: {
      domain: "software_engineering",
      confidence: 0.96,
      source: "model",
    },
    secondaryDomains: [],
    capabilities,
    evidence: [],
    conflicts: [],
    ambiguity: "low",
    completeness: "complete",
    analyzerModelId: "nano-route-router",
    analyzerModelVersion: "1.0.0",
    analysisSchemaVersion: "nano-route-analysis-schema-v1",
    inferenceLatencyMs: 10,
    totalLatencyMs: 15,
    explanation: "Analysis test fixture",
  };
}

describe("Step 30: Routing Policy & Manual Override Contract Tests", () => {
  beforeEach(() => {
    resetRoutingPolicyMocks();
  });

  describe("1. Automatic Route Selection", () => {
    it("evaluates candidate scores and automatically selects the primary route", async () => {
      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(),
        estimated_input_tokens: 500,
        estimated_output_tokens: 1500,
      };

      const decision = await evaluateRoutingPolicy(request);

      assert.equal(decision.selection_mode, "automatic");
      assert.ok(decision.decision_id.length > 0, "Decision ID must be present");
      assert.ok(decision.selected_candidate !== null, "Primary candidate must be selected");

      const primary = decision.selected_candidate!;
      assert.ok(primary.provider_id.length > 0);
      assert.ok(primary.model_id.length > 0);
      assert.ok(primary.score !== null && primary.score >= 0.0);
      assert.ok(decision.decision_reason.includes("Automatically selected"));
      assert.equal(decision.structured_explanation.mode, "automatic");
    });

    it("prepares ordered fallback candidates excluding the primary candidate", async () => {
      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const decision = await evaluateRoutingPolicy(request);
      const primary = decision.selected_candidate!;
      const fallbacks = decision.fallback_candidates;

      assert.ok(fallbacks.length > 0, "Fallback candidates must be prepared");

      // Verify primary candidate is not in fallback list
      for (const fb of fallbacks) {
        assert.notEqual(
          `${fb.provider_id}/${fb.model_id}`,
          `${primary.provider_id}/${primary.model_id}`,
          "Fallback candidate must not be the primary selected candidate"
        );
        assert.ok(fb.rank > 0, "Fallback rank must be 1-indexed");
        assert.ok(fb.score > 0, "Fallback candidate must have positive score");
      }
    });

    it("provides full candidate ranking audit trail", async () => {
      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const decision = await evaluateRoutingPolicy(request);
      const ranking = decision.candidate_ranking;

      assert.ok(ranking.length > 0);
      assert.equal(ranking[0].status, "selected_primary");
      assert.equal(ranking[0].rank, 1);
    });
  });

  describe("2. Manual Route Override Lifecycle", () => {
    it("accepts and honors a valid manual route override", async () => {
      const override: ManualRouteOverrideDto = {
        provider_id: "anthropic",
        model_id: "claude-3-5-sonnet-20241022",
        enabled: true,
        reason: "User specifically selected Claude 3.5 Sonnet",
      };

      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(),
        manual_override: override,
      };

      const decision = await evaluateRoutingPolicy(request);

      assert.equal(decision.selection_mode, "manual_override");
      assert.ok(decision.selected_candidate !== null);
      assert.equal(decision.selected_candidate!.provider_id, "anthropic");
      assert.equal(decision.selected_candidate!.model_id, "claude-3-5-sonnet-20241022");
      assert.ok(decision.override_metadata !== null);
      assert.equal(decision.override_metadata!.state, "accepted");
    });

    it("rejects manual override when provider is unknown", async () => {
      const override: ManualRouteOverrideDto = {
        provider_id: "nonexistent_cloud",
        model_id: "some_model",
        enabled: true,
        reason: "Testing unknown provider",
      };

      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(),
        manual_override: override,
      };

      const decision = await evaluateRoutingPolicy(request);

      assert.equal(decision.selection_mode, "override_rejected");
      assert.equal(decision.selected_candidate, null);
      assert.ok(decision.override_metadata !== null);
      assert.equal(decision.override_metadata!.state, "rejected");
      assert.ok(decision.decision_reason.includes("rejected"));
    });

    it("rejects manual override when model lacks required task capability", async () => {
      // Task requires ImageInput; DeepSeek Chat does not support vision
      const override: ManualRouteOverrideDto = {
        provider_id: "deepseek",
        model_id: "deepseek-chat",
        enabled: true,
        reason: "Trying to force text model for image task",
      };

      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(true), // requires image
        manual_override: override,
      };

      const decision = await evaluateRoutingPolicy(request);

      assert.equal(decision.selection_mode, "override_rejected");
      assert.equal(decision.selected_candidate, null);
      assert.ok(decision.override_metadata!.reason.includes("image_input"));
    });
  });

  describe("3. Direct Override Validation API", () => {
    it("validates a legitimate override candidate", async () => {
      const override: ManualRouteOverrideDto = {
        provider_id: "openai",
        model_id: "gpt-4o",
        enabled: true,
      };

      const result = await validateManualOverride(override);
      assert.equal(result.is_valid, true);
    });

    it("flags an override that lacks required capability", async () => {
      const override: ManualRouteOverrideDto = {
        provider_id: "deepseek",
        model_id: "deepseek-chat",
        enabled: true,
      };

      const taskWithImage = createMockTaskAnalysis(true);
      const result = await validateManualOverride(override, taskWithImage);

      assert.equal(result.is_valid, false);
      assert.ok(result.message.includes("image_input"));
    });
  });

  describe("4. Policy Configuration Invariants", () => {
    it("retrieves default policy configuration", async () => {
      const config = await getRoutingPolicyConfig();

      assert.equal(config.policy_version, "nano-route-policy-v1");
      assert.equal(config.minimum_accepted_score, 0.35);
      assert.equal(config.tie_tolerance, 0.015);
      assert.equal(config.max_fallback_candidates, 5);
      assert.equal(config.preference_profile, "balanced");
    });

    it("rejects invalid policy configuration updates", async () => {
      const invalidConfig = {
        ...DEFAULT_ROUTING_POLICY_CONFIG,
        minimum_accepted_score: 1.5, // out of [0, 1]
      };

      await assert.rejects(
        async () => {
          await updateRoutingPolicyConfig(invalidConfig);
        },
        /minimum_accepted_score must be between 0 and 1/
      );
    });

    it("updates policy configuration successfully", async () => {
      const validConfig = {
        ...DEFAULT_ROUTING_POLICY_CONFIG,
        preference_profile: "cost_saving" as const,
        minimum_accepted_score: 0.4,
      };

      await updateRoutingPolicyConfig(validConfig);
      const updated = await getRoutingPolicyConfig();
      assert.equal(updated.preference_profile, "cost_saving");
      assert.equal(updated.minimum_accepted_score, 0.4);
    });
  });

  describe("5. Security & Zero Secret Exposure Invariant", () => {
    it("guarantees routing decisions contain zero API keys, auth headers, or credentials", async () => {
      const request: RoutingPolicyRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const decision = await evaluateRoutingPolicy(request);
      const serialized = JSON.stringify(decision);

      // Verify no credential tokens or secret patterns are serialized
      assert.ok(!serialized.includes("sk-"), "Decision must not contain OpenAI key prefix");
      assert.ok(!serialized.includes("xoxb-"), "Decision must not contain secret tokens");
      assert.ok(!serialized.includes("gsk_"), "Decision must not contain Groq key prefix");
      assert.ok(!serialized.includes("AIza"), "Decision must not contain Google key prefix");
      assert.ok(!serialized.includes("Bearer"), "Decision must not contain auth headers");
    });
  });
});
