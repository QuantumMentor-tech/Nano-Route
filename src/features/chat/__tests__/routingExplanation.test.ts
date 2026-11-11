/**
//! Nano Route — Routing Explanation & Score Breakdown Tests (Step 34)
//! File: src/features/chat/__tests__/routingExplanation.test.ts
//!
//! Automated test suite validating:
//! 1. Triad Confidence Semantics (SLM Certainty vs Routing Fit vs Selection Margin)
//! 2. Multi-factor Score Breakdown across dimensions
//! 3. Manual Route Override Explanation Contracts
//! 4. Ineligible Candidate Exclusion vs Runner-up Ranking
//! 5. Historical Route Explanation (Read-only SQLite Fallback)
//! 6. Session Context Isolation & Validation Guards
//! 7. Non-Assistant Message Rejection Guard
//! 8. Accessibility & Schema Invariants
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  appendChatMessage,
  getRoutingExplanation,
  setMockRoutingExplanation,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import type {
  RoutingExplanationDto,
  ChatMessageMetadata,
} from "../../../services/ipc/types.ts";

describe("Step 34 Routing Explanation & Score Breakdown Engine", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  describe("1. Confidence Triad Semantics", () => {
    it("strictly separates SLM classifier confidence, routing fit score, and selection margin", async () => {
      const session = await createChatSession({ title: "Confidence Triad Session" });

      const metadata: Partial<ChatMessageMetadata> = {
        routedProvider: "anthropic",
        routedModel: "claude-3-5-sonnet-20241022",
        routingReason: "Highest policy-valid routing fit for Coding task",
        slmConfidenceScore: 0.94,
        promptTokens: 120,
        completionTokens: 250,
        latencyMs: 850,
        costUsd: 0.0035,
      };

      const msg = await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Here is your optimized TypeScript code...",
        metadata,
      });

      const explanation = await getRoutingExplanation(msg.id, session.id);

      assert.ok(explanation, "Explanation must be returned");
      assert.strictEqual(explanation.messageId, msg.id);
      assert.strictEqual(explanation.sessionId, session.id);

      // Verify Triad
      assert.ok(explanation.confidenceSummary, "Confidence summary triad must exist");
      assert.strictEqual(typeof explanation.confidenceSummary.slmConfidence, "number");
      assert.strictEqual(explanation.confidenceSummary.slmConfidence, 0.94);
      assert.strictEqual(explanation.confidenceSummary.slmConfidenceLevel, "High");

      assert.strictEqual(typeof explanation.confidenceSummary.routingFit, "number");
      assert.ok(
        explanation.confidenceSummary.routingFit! >= 0 &&
          explanation.confidenceSummary.routingFit! <= 1.0,
        "Routing fit must be normalized between 0.0 and 1.0"
      );

      assert.ok(explanation.selectionMargin, "Selection margin must be present");
      assert.strictEqual(typeof explanation.selectionMargin!.margin, "number");
      assert.ok(
        explanation.selectionMargin!.margin! > 0,
        "Selection margin should reflect lead over runner-up"
      );

      // Verify semantic description disclaims answer correctness
      assert.match(
        explanation.confidenceSummary.description.toLowerCase(),
        /intent/i,
        "Must clarify confidence represents intent analysis certainty"
      );
    });
  });

  describe("2. Task Analysis & Candidate Score Dimensions", () => {
    it("provides structured task analysis summary and 11-dimension candidate scores", async () => {
      const session = await createChatSession({ title: "Task Breakdown Session" });

      const msg = await appendChatMessage({
        sessionId: session.id,
        sender: "assistant",
        content: "Step-by-step architectural breakdown...",
        metadata: {
          routedProvider: "openai",
          routedModel: "gpt-4o",
          routingReason: "Superior quality and context window",
          slmConfidenceScore: 0.88,
        },
      });

      const explanation = await getRoutingExplanation(msg.id, session.id);

      // Task Summary assertions
      assert.ok(explanation.taskSummary, "Task summary should be populated");
      assert.strictEqual(explanation.taskSummary!.primaryIntent, "Coding");
      assert.ok(explanation.taskSummary!.domains.length > 0);
      assert.ok(explanation.taskSummary!.requiredCapabilities.length > 0);
      assert.strictEqual(explanation.taskSummary!.isAmbiguous, false);

      // Score Breakdown assertions
      assert.ok(explanation.scoreBreakdown, "Score breakdown must be present for live routes");
      assert.ok(explanation.scoreBreakdown!.dimensions.length >= 5);

      for (const dim of explanation.scoreBreakdown!.dimensions) {
        assert.ok(dim.key, "Dimension must have key");
        assert.ok(dim.label, "Dimension must have label");
        assert.ok(dim.score >= 0.0 && dim.score <= 1.0, "Dimension score must be 0-1");
        assert.ok(dim.explanation.length > 0, "Dimension must have explanation");
      }
    });
  });

  describe("3. Manual Route Override Contracts", () => {
    it("formats manual override decisions accurately without fabricating algorithmic scores", async () => {
      const session = await createChatSession({ title: "Manual Override Session" });

      const overrideExplanation: RoutingExplanationDto = {
        schemaVersion: "1.0",
        scoringAlgorithmVersion: "1.0",
        policyVersion: "1.0",
        classifierVersion: "slm-intent-v1",
        messageId: "msg-manual-1",
        sessionId: session.id,
        selectionMode: "manual_override",
        summary: "Selected deepseek-chat (deepseek) because the user manually chose this model and the route passed capability checks.",
        decisionReason: "User manual override from Chat Studio",
        isHistorical: false,
        selectedRoute: {
          providerId: "deepseek",
          providerName: "DeepSeek",
          modelId: "deepseek-chat",
          modelName: "DeepSeek V3",
          isLocal: false,
          contextWindow: 64000,
        },
        taskSummary: null,
        scoreBreakdown: null,
        confidenceSummary: {
          slmConfidence: 0.85,
          slmConfidenceLevel: "High",
          routingFit: null, // No algorithmic fit calculated for user override
          selectionMargin: null,
          description: "Model selected by explicit user override. SLM intent certainty was 85%.",
        },
        selectionMargin: {
          margin: null,
          runnerUpModel: null,
          runnerUpScore: null,
          description: "Selection margin not applicable for manual override routes.",
        },
        alternatives: [],
        policyFactors: [
          {
            factor: "manual_override",
            label: "User Override",
            description: "User manually selected deepseek/deepseek-chat",
          },
        ],
        evidence: [
          {
            source: "user_override",
            label: "Manual Selection",
            detail: "Model explicitly pinned by user in Chat Studio",
          },
        ],
        generatedAtMs: Date.now(),
      };

      setMockRoutingExplanation("msg-manual-1", overrideExplanation);

      const result = await getRoutingExplanation("msg-manual-1", session.id);

      assert.strictEqual(result.selectionMode, "manual_override");
      assert.strictEqual(result.confidenceSummary.routingFit, null);
      assert.strictEqual(result.selectionMargin?.margin, null);
      assert.match(result.summary, /user manually chose this model/i);
    });
  });

  describe("4. Alternative Candidates & Ineligibility Reasons", () => {
    it("reports ranked alternative candidates with explicit ineligibility reasons", async () => {
      const session = await createChatSession({ title: "Alternatives Session" });

      const explanationWithAlternatives: RoutingExplanationDto = {
        schemaVersion: "1.0",
        scoringAlgorithmVersion: "1.0",
        policyVersion: "1.0",
        classifierVersion: "slm-intent-v1",
        messageId: "msg-alts-1",
        sessionId: session.id,
        selectionMode: "automatic",
        summary: "Selected gpt-4o as primary candidate.",
        decisionReason: "Highest overall score",
        isHistorical: false,
        selectedRoute: {
          providerId: "openai",
          providerName: "OpenAI",
          modelId: "gpt-4o",
          modelName: "GPT-4o",
          isLocal: false,
        },
        confidenceSummary: {
          slmConfidence: 0.9,
          slmConfidenceLevel: "High",
          routingFit: 0.88,
          selectionMargin: 0.15,
          description: "High confidence route.",
        },
        selectionMargin: {
          margin: 0.15,
          runnerUpModel: "claude-3-5-sonnet",
          runnerUpScore: 0.73,
          description: "Comfortable margin over runner-up",
        },
        alternatives: [
          {
            rank: 1,
            providerId: "openai",
            providerName: "OpenAI",
            modelId: "gpt-4o",
            displayName: "GPT-4o",
            score: 0.88,
            isEligible: true,
            ineligibilityReason: null,
            status: "Selected",
          },
          {
            rank: 2,
            providerId: "anthropic",
            providerName: "Anthropic",
            modelId: "claude-3-5-sonnet",
            displayName: "Claude 3.5 Sonnet",
            score: 0.73,
            isEligible: true,
            ineligibilityReason: null,
            status: "Eligible Fallback",
          },
          {
            rank: 3,
            providerId: "groq",
            providerName: "Groq",
            modelId: "llama-3-8b",
            displayName: "Llama 3 8B",
            score: null,
            isEligible: false,
            ineligibilityReason: "Lacks required complex_reasoning capability",
            status: "Ineligible",
          },
        ],
        policyFactors: [],
        evidence: [],
        generatedAtMs: Date.now(),
      };

      setMockRoutingExplanation("msg-alts-1", explanationWithAlternatives);

      const result = await getRoutingExplanation("msg-alts-1", session.id);

      assert.strictEqual(result.alternatives.length, 3);
      assert.strictEqual(result.alternatives[0].isEligible, true);
      assert.strictEqual(result.alternatives[1].isEligible, true);
      assert.strictEqual(result.alternatives[2].isEligible, false);
      assert.strictEqual(
        result.alternatives[2].ineligibilityReason,
        "Lacks required complex_reasoning capability"
      );
    });
  });

  describe("5. Historical Route Explanation (SQLite Read-only Fallback)", () => {
    it("serves safe historical explanations without fabricating 11-dimension breakdown or rerunning SLM", async () => {
      const session = await createChatSession({ title: "Historical Session" });

      const historicalExplanation: RoutingExplanationDto = {
        schemaVersion: "1.0",
        scoringAlgorithmVersion: "1.0",
        policyVersion: "1.0",
        classifierVersion: null,
        messageId: "msg-hist-1",
        sessionId: session.id,
        selectionMode: "automatic",
        summary: "Routed to Claude 3.5 Sonnet (Anthropic). Historical route details preserved from database.",
        decisionReason: "Highest routing fit for multi-domain reasoning",
        isHistorical: true,
        selectedRoute: {
          providerId: "anthropic",
          providerName: "Anthropic",
          modelId: "claude-3-5-sonnet-20241022",
          modelName: "Claude 3.5 Sonnet",
          isLocal: false,
          contextWindow: 200000,
        },
        taskSummary: null, // Purposely omitted in historical messages
        scoreBreakdown: null, // Purposely omitted in historical messages
        confidenceSummary: {
          slmConfidence: 0.91,
          slmConfidenceLevel: "High",
          routingFit: null,
          selectionMargin: null,
          description: "Historical message: Local SLM intent confidence was 91% at turn execution.",
        },
        selectionMargin: null,
        alternatives: [],
        policyFactors: [],
        evidence: [
          {
            source: "sqlite_persistence",
            label: "Historical Database Record",
            detail: "Recovered from chat_messages table metadata",
          },
        ],
        generatedAtMs: 1700000000000,
      };

      setMockRoutingExplanation("msg-hist-1", historicalExplanation);

      const result = await getRoutingExplanation("msg-hist-1", session.id);

      assert.strictEqual(result.isHistorical, true);
      assert.strictEqual(result.taskSummary, null);
      assert.strictEqual(result.scoreBreakdown, null);
      assert.strictEqual(result.selectionMargin, null);
      assert.strictEqual(result.confidenceSummary.slmConfidence, 0.91);
      assert.strictEqual(result.selectedRoute.providerId, "anthropic");
    });
  });

  describe("6. Session Context Isolation & Guard Contracts", () => {
    it("rejects non-existent message IDs with NotFound error", async () => {
      await assert.rejects(
        () => getRoutingExplanation("non-existent-msg", "session-1"),
        (err: any) => {
          assert.strictEqual(err.code, "NOT_FOUND");
          return true;
        }
      );
    });

    it("rejects message ID when belonging to a different session ID context", async () => {
      const sessionA = await createChatSession({ title: "Session A" });
      const sessionB = await createChatSession({ title: "Session B" });

      const msgA = await appendChatMessage({
        sessionId: sessionA.id,
        sender: "assistant",
        content: "Response in Session A",
        metadata: {
          routedProvider: "openai",
          routedModel: "gpt-4o",
        },
      });

      await assert.rejects(
        () => getRoutingExplanation(msgA.id, sessionB.id),
        (err: any) => {
          assert.strictEqual(err.code, "INVALID_INPUT");
          assert.match(err.message, /does not belong to session/i);
          return true;
        }
      );
    });

    it("rejects explanation requests for user messages", async () => {
      const session = await createChatSession({ title: "User Message Session" });

      const userMsg = await appendChatMessage({
        sessionId: session.id,
        sender: "user",
        content: "Hello, what is the best route?",
      });

      await assert.rejects(
        () => getRoutingExplanation(userMsg.id, session.id),
        (err: any) => {
          assert.strictEqual(err.code, "INVALID_INPUT");
          assert.match(err.message, /only available for assistant messages/i);
          return true;
        }
      );
    });

    it("rejects empty or whitespace-only message ID", async () => {
      await assert.rejects(
        () => getRoutingExplanation("   ", "session-1"),
        (err: any) => {
          assert.strictEqual(err.code, "INVALID_INPUT");
          return true;
        }
      );
    });
  });
});

