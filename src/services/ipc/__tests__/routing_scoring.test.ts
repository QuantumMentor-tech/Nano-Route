// ============================================================================
// Nano Route - Routing Scoring Contract Tests
// File: src/services/ipc/__tests__/routing_scoring.test.ts
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  scoreRoutingCandidates,
  getRoutingScoringStatus,
  getScoringWeights,
  updateScoringWeights,
  resetRoutingScoringMocks,
  DEFAULT_SCORING_WEIGHTS,
} from "../routing_scoring.ts";
import type {
  RoutingScoreRequestDto,
  TaskAnalysisResultDto,
} from "../types.ts";

function createMockTaskAnalysis(
  domain: string = "software_engineering",
  complexity: string = "high"
): TaskAnalysisResultDto {
  return {
    requestId: "req_test_analysis",
    intent: {
      primaryIntent: "software_engineering",
      confidence: 0.95,
      ambiguity: "not_ambiguous",
      secondaryIntents: ["code_debugging"],
    },
    complexity: {
      level: complexity as any,
      confidence: 0.92,
      source: "model",
      score: 0.88,
      evidenceCodes: ["CODE_BLOCKS_PRESENT"],
    },
    primaryDomain: {
      domain: domain as any,
      confidence: 0.96,
      source: "model",
    },
    secondaryDomains: [],
    capabilities: [
      {
        capability: "text_generation",
        strength: "required",
        confidence: 0.99,
        source: "derived",
        reasonCode: "base_text",
      },
      {
        capability: "code_generation",
        strength: "required",
        confidence: 0.95,
        source: "model",
        reasonCode: "prompt_code",
      },
    ],
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

describe("Step 29: Routing Scoring Engine Contract Tests", () => {
  beforeEach(() => {
    resetRoutingScoringMocks();
  });

  describe("1. Candidate Evaluation & Score Structure", () => {
    it("evaluates candidates and returns normalized score results", async () => {
      const request: RoutingScoreRequestDto = {
        task_analysis: createMockTaskAnalysis("software_engineering", "high"),
        estimated_input_tokens: 500,
        estimated_output_tokens: 1500,
      };

      const result = await scoreRoutingCandidates(request);

      assert.ok(result.request_id.length > 0, "Request ID must be present");
      assert.ok(result.candidates.length > 0, "Candidates must not be empty");
      assert.equal(
        result.evaluated_candidates_count,
        result.candidates.length,
        "Evaluated count must match candidate array length"
      );
      assert.equal(
        result.eligible_count + result.ineligible_count,
        result.candidates.length,
        "Eligible + Ineligible must sum to total count"
      );
      assert.ok(result.scoring_latency_ms >= 0, "Latency must be non-negative");
      assert.ok(
        result.explanation_summary.length > 0,
        "Explanation summary must be generated"
      );
    });

    it("enforces normalized [0.0, 1.0] score breakdown for all eligible candidates", async () => {
      const request: RoutingScoreRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const result = await scoreRoutingCandidates(request);
      const eligible = result.candidates.filter((c) => c.is_eligible);

      assert.ok(eligible.length > 0, "Must have at least one eligible candidate");

      for (const candidate of eligible) {
        assert.ok(candidate.total_score !== null, "Eligible candidate must have total_score");
        assert.ok(
          candidate.total_score >= 0.0 && candidate.total_score <= 1.0,
          `Total score ${candidate.total_score} must be within [0.0, 1.0]`
        );
        assert.ok(candidate.breakdown !== null, "Eligible candidate must have breakdown");

        const b = candidate.breakdown;
        const dimensions = [
          b.intent_fit,
          b.complexity_fit,
          b.domain_fit,
          b.capability_fit,
          b.context_fit,
          b.modality_fit,
          b.preference_fit,
          b.cost_fit,
          b.latency_fit,
          b.reliability_fit,
          b.profile_fit,
        ];

        for (const dim of dimensions) {
          assert.ok(
            dim >= 0.0 && dim <= 1.0,
            `Dimension score ${dim} must be clamped to [0.0, 1.0]`
          );
        }
      }
    });
  });

  describe("2. Strict Eligibility vs Soft Scoring Decoupling", () => {
    it("guarantees ineligible candidates strictly have total_score: null and breakdown: null", async () => {
      const request: RoutingScoreRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const result = await scoreRoutingCandidates(request);
      const ineligible = result.candidates.filter((c) => !c.is_eligible);

      assert.ok(ineligible.length > 0, "Must have at least one ineligible candidate");

      for (const candidate of ineligible) {
        assert.equal(
          candidate.is_eligible,
          false,
          "Ineligible candidate flag must be false"
        );
        assert.equal(
          candidate.total_score,
          null,
          "Ineligible candidate MUST NOT have a total_score"
        );
        assert.equal(
          candidate.breakdown,
          null,
          "Ineligible candidate MUST NOT have a breakdown"
        );
        assert.ok(
          candidate.ineligibility_reasons.length > 0,
          "Ineligible candidate must supply explicit ineligibility reasons"
        );
        assert.ok(
          candidate.explanation.includes("Ineligible"),
          "Candidate explanation must state ineligibility"
        );
      }
    });
  });

  describe("3. Deterministic Sorting Invariant", () => {
    it("sorts candidates strictly by: eligible first -> score descending -> provider ascending -> model ascending", async () => {
      const request: RoutingScoreRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const result = await scoreRoutingCandidates(request);
      const candidates = result.candidates;

      let foundIneligible = false;
      for (let i = 0; i < candidates.length; i++) {
        const current = candidates[i];

        if (!current.is_eligible) {
          foundIneligible = true;
        } else if (foundIneligible) {
          assert.fail("Eligible candidate found after an ineligible candidate");
        }

        if (i > 0) {
          const prev = candidates[i - 1];

          // If both eligible, check score ordering
          if (prev.is_eligible && current.is_eligible) {
            const prevScore = prev.total_score ?? 0;
            const currScore = current.total_score ?? 0;

            if (prevScore === currScore) {
              // Tie-breaker: provider_id ascending
              if (prev.provider_id === current.provider_id) {
                assert.ok(
                  prev.model_id.localeCompare(current.model_id) <= 0,
                  "Tied candidates with same provider must be sorted by model_id ascending"
                );
              } else {
                assert.ok(
                  prev.provider_id.localeCompare(current.provider_id) <= 0,
                  "Tied candidates must be sorted by provider_id ascending"
                );
              }
            } else {
              assert.ok(
                prevScore >= currScore,
                `Candidates must be sorted descending by total_score: ${prevScore} >= ${currScore}`
              );
            }
          }
        }
      }
    });
  });

  describe("4. Scoring Weights Management & Validation", () => {
    it("retrieves default scoring weights and confirms sum equals 1.0", async () => {
      const weights = await getScoringWeights();

      const sum =
        weights.intent_weight +
        weights.complexity_weight +
        weights.domain_weight +
        weights.capability_weight +
        weights.context_weight +
        weights.modality_weight +
        weights.preference_weight +
        weights.cost_weight +
        weights.latency_weight +
        weights.reliability_weight +
        weights.profile_weight;

      assert.ok(
        Math.abs(sum - 1.0) < 1e-4,
        `Default scoring weights must sum to 1.0 (+/- 1e-4); got ${sum}`
      );
    });

    it("rejects invalid scoring weights that do not sum to 1.0", async () => {
      const invalidWeights = {
        ...DEFAULT_SCORING_WEIGHTS,
        intent_weight: 0.5, // sum becomes 1.35
      };

      await assert.rejects(
        async () => {
          await updateScoringWeights(invalidWeights);
        },
        /Scoring weights must sum to 1.0/
      );
    });

    it("updates valid scoring weights cleanly", async () => {
      const validCustomWeights = {
        intent_weight: 0.2,
        complexity_weight: 0.2,
        domain_weight: 0.1,
        capability_weight: 0.1,
        context_weight: 0.05,
        modality_weight: 0.05,
        preference_weight: 0.1,
        cost_weight: 0.05,
        latency_weight: 0.05,
        reliability_weight: 0.05,
        profile_weight: 0.05,
      };

      await updateScoringWeights(validCustomWeights);
      const active = await getScoringWeights();
      assert.equal(active.intent_weight, 0.2);
      assert.equal(active.complexity_weight, 0.2);
    });
  });

  describe("5. Diagnostic Status & Metrics", () => {
    it("returns operational status report for the scoring engine", async () => {
      const status = await getRoutingScoringStatus();

      assert.equal(status.is_available, true);
      assert.ok(status.registered_models_count > 0);
      assert.ok(status.configured_profiles_count > 0);
      assert.ok(status.active_weights !== undefined);
    });
  });

  describe("6. Security & Zero Secret Exposure Invariant", () => {
    it("guarantees candidate scoring output contains zero API keys or credentials", async () => {
      const request: RoutingScoreRequestDto = {
        task_analysis: createMockTaskAnalysis(),
      };

      const result = await scoreRoutingCandidates(request);
      const serialized = JSON.stringify(result);

      // Verify no sensitive tokens or secret patterns are leaked
      assert.ok(!serialized.includes("sk-"), "Must not contain OpenAI secret key prefix");
      assert.ok(!serialized.includes("xoxb-"), "Must not contain token patterns");
      assert.ok(!serialized.includes("gsk_"), "Must not contain Groq secret key prefix");
      assert.ok(!serialized.includes("AIza"), "Must not contain Google API key prefix");
    });
  });
});
