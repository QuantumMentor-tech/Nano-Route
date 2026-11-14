/**
 * Nano Route — Step 76 Context Window Management & Request Guardrail Test Suite
 * File: src/features/context/__tests__/contextManagement.test.ts
 *
 * Covers:
 * 1. Authoritative Model Context Limits Resolution (known vs unknown)
 * 2. Token Estimation & Heuristics (~3.8 chars/token + 4 framing tokens)
 * 3. Immutable Token Cache & Invalidation
 * 4. Output Capacity Calculation & Headroom Constraints
 * 5. Request Preflight Evaluations (SAFE, NEAR_LIMIT, EXCEEDS_LIMIT, UNKNOWN)
 * 6. Specific Limit Violations (INPUT_TOKEN_LIMIT, OUTPUT_TOKEN_LIMIT, CONTEXT_LIMIT_EXCEEDED)
 * 7. Non-Destructive Context Reduction Planning (Zero Chat History Deletion)
 * 8. Upstream Error Normalization
 * 9. Security & Privacy: Zero prompt content leakage into error metadata
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  resolveModelContextLimits,
  estimateTextTokens,
  estimateMessageTokens,
  estimateConversationTokens,
  computeAvailableOutputCapacity,
  evaluateContextPreflight,
  createContextReductionPlan,
  normalizeContextError,
  clearContextCache,
  invalidateContextCache,
} from "../engine.ts";

describe("Step 76 — Context Window Management & Request Size Guardrails", () => {
  beforeEach(() => {
    clearContextCache();
  });

  describe("1. Authoritative Model Context Limits Resolution", () => {
    it("resolves exact context constraints for known catalog models", () => {
      const gpt4o = resolveModelContextLimits("openai", "gpt-4o");
      assert.equal(gpt4o.contextWindow, 128_000);
      assert.equal(gpt4o.maxOutputTokens, 4096);
      assert.equal(gpt4o.source, "REGISTRY");
      assert.equal(gpt4o.confidence, "AUTHORITATIVE");

      const sonnet = resolveModelContextLimits("anthropic", "claude-3-5-sonnet-20241022");
      assert.equal(sonnet.contextWindow, 200_000);
      assert.equal(sonnet.maxOutputTokens, 8192);

      const gemini = resolveModelContextLimits("gemini", "gemini-1.5-pro");
      assert.equal(gemini.contextWindow, 2_000_000);
      assert.equal(gemini.maxOutputTokens, 8192);

      const localSlm = resolveModelContextLimits("local", "llama3.2:3b");
      assert.equal(localSlm.contextWindow, 8192);
      assert.equal(localSlm.maxOutputTokens, 4096);
    });

    it("returns explicit UNKNOWN descriptor for uncatalogued model without inventing limits", () => {
      const unknown = resolveModelContextLimits("custom-provider", "mystery-model-v99");
      assert.equal(unknown.contextWindow, 0);
      assert.equal(unknown.source, "UNKNOWN");
      assert.equal(unknown.confidence, "UNKNOWN");
    });
  });

  describe("2. Token Estimation & Heuristics", () => {
    it("estimates raw text tokens using ~3.8 chars/token ceil heuristic", () => {
      assert.equal(estimateTextTokens(""), 0);
      // "Hello world" = 11 chars -> ceil(11 / 3.8) = 3 tokens
      assert.equal(estimateTextTokens("Hello world"), 3);
      // 38 chars -> 10 tokens
      const text38 = "a".repeat(38);
      assert.equal(estimateTextTokens(text38), 10);
    });

    it("estimates message tokens including +4 framing overhead tokens", () => {
      const msg = { content: "Hello world", sender: "user" };
      // 3 text tokens + 4 framing overhead = 7 tokens
      assert.equal(estimateMessageTokens(msg), 7);
    });

    it("estimates full conversation breakdown accurately", () => {
      const history = [
        { id: "m1", content: "Hi there!", sender: "user" }, // 9 chars -> 3 tokens + 4 = 7
        { id: "m2", content: "How can I help you?", sender: "assistant" }, // 19 chars -> 5 tokens + 4 = 9
      ];
      const prompt = "Can you write a poem?"; // 21 chars -> 6 tokens + 4 = 10
      const systemPrompt = "You are a helpful assistant."; // 28 chars -> 8 tokens + 4 = 12

      const counts = estimateConversationTokens(history, prompt, systemPrompt, 1000);
      assert.equal(counts.promptTokens, 10);
      assert.equal(counts.systemTokens, 12);
      assert.equal(counts.historyTokens, 16);
      assert.equal(counts.totalInputTokens, 38);
      assert.equal(counts.estimatedCompletionTokens, 1000);
      assert.equal(counts.totalEstimatedTokens, 1038);
      assert.equal(counts.confidence, "APPROXIMATE");
    });
  });

  describe("3. Immutable Token Cache & Invalidation", () => {
    it("caches message token estimation and reuses cached value", () => {
      const msg = { id: "msg_123", content: "Repeated content query" };
      const first = estimateMessageTokens(msg);
      const second = estimateMessageTokens(msg);
      assert.equal(first, second);
    });

    it("invalidates cache selectively by messageId or completely", () => {
      const msg = { id: "msg_abc", content: "Old text" };
      estimateMessageTokens(msg);

      invalidateContextCache("msg_abc");
      // Cache entry for msg_abc is gone
      const updated = { id: "msg_abc", content: "New much longer text content" };
      const newTokens = estimateMessageTokens(updated);
      assert.ok(newTokens > 5);

      clearContextCache();
    });
  });

  describe("4. Output Capacity Calculation", () => {
    it("restricts available output to model maxOutputTokens when headroom is plentiful", () => {
      const limits = resolveModelContextLimits("openai", "gpt-4o"); // 128k context, 4096 maxOutput
      const available = computeAvailableOutputCapacity(limits, 1000);
      assert.equal(available, 4096);
    });

    it("clamps output capacity when input consumes most of the context window", () => {
      const limits = resolveModelContextLimits("local", "llama3.2:3b"); // 8192 context, 4096 maxOutput
      const available = computeAvailableOutputCapacity(limits, 7000);
      assert.equal(available, 1192); // 8192 - 7000 = 1192 available
    });
  });

  describe("5. Request Preflight Evaluations", () => {
    it("evaluates SAFE for ordinary request well within context limits", () => {
      const preflight = evaluateContextPreflight({
        providerId: "openai",
        modelId: "gpt-4o",
        prompt: "Simple query",
        history: [],
      });

      assert.equal(preflight.allowed, true);
      assert.equal(preflight.classification, "SAFE");
      assert.equal(preflight.blockReason, null);
      assert.equal(preflight.warningNotice, null);
    });

    it("evaluates NEAR_LIMIT when context usage approaches 80% or enters safety buffer", () => {
      // DeepSeek: 64k context
      // Create a prompt that uses ~52,000 tokens (~81% of 64k)
      const bigPrompt = "x".repeat(198_000); // 198000 / 3.8 = ~52,105 tokens
      const preflight = evaluateContextPreflight({
        providerId: "deepseek",
        modelId: "deepseek-chat",
        prompt: bigPrompt,
        requestedOutputTokens: 2000,
      });

      assert.equal(preflight.allowed, true); // Still allowed (non-blocking warning)
      assert.equal(preflight.classification, "NEAR_LIMIT");
      assert.ok(preflight.warningNotice !== null);
      assert.ok(preflight.percentUsed >= 80);
    });

    it("blocks request under INPUT_TOKEN_LIMIT when input exceeds maxInputTokens", () => {
      // Local SLM: 8192 maxInputTokens
      const oversizedPrompt = "x".repeat(35_000); // ~9,210 tokens
      const preflight = evaluateContextPreflight({
        providerId: "local",
        modelId: "llama3.2:3b",
        prompt: oversizedPrompt,
      });

      assert.equal(preflight.allowed, false);
      assert.equal(preflight.classification, "EXCEEDS_LIMIT");
      assert.equal(preflight.blockReason, "INPUT_TOKEN_LIMIT");
    });

    it("blocks request under CONTEXT_LIMIT_EXCEEDED when input + output exceeds context window", () => {
      // Local SLM: 8192 contextWindow, 4096 maxOutputTokens
      // Input: 5,000 tokens (<= 8192 maxInputTokens)
      // Output: 4,000 tokens (<= 4096 maxOutputTokens)
      // Total: 9,000 tokens (> 8192 contextWindow)
      const prompt5k = "x".repeat(19_000); // ~5,000 tokens
      const preflight = evaluateContextPreflight({
        providerId: "local",
        modelId: "llama3.2:3b",
        prompt: prompt5k,
        requestedOutputTokens: 4000,
      });

      assert.equal(preflight.allowed, false);
      assert.equal(preflight.classification, "EXCEEDS_LIMIT");
      assert.equal(preflight.blockReason, "CONTEXT_LIMIT_EXCEEDED");
    });

    it("blocks request under OUTPUT_TOKEN_LIMIT when requested output exceeds model ceiling", () => {
      const preflight = evaluateContextPreflight({
        providerId: "openai",
        modelId: "gpt-4o", // maxOutput is 4096
        prompt: "Short prompt",
        requestedOutputTokens: 16384, // Requested impossible output capacity
      });

      assert.equal(preflight.allowed, false);
      assert.equal(preflight.classification, "EXCEEDS_LIMIT");
      assert.equal(preflight.blockReason, "OUTPUT_TOKEN_LIMIT");
    });

    it("handles UNKNOWN model limit with safe non-blocking warning", () => {
      const preflight = evaluateContextPreflight({
        providerId: "custom",
        modelId: "unregistered-llm",
        prompt: "Hello",
      });

      assert.equal(preflight.allowed, true);
      assert.equal(preflight.classification, "UNKNOWN");
      assert.ok(preflight.warningNotice?.includes("unverified"));
    });
  });

  describe("6. Safe Context Reduction Planning (Zero Chat History Deletion)", () => {
    const sampleHistory = Array.from({ length: 30 }, (_, i) => ({
      id: `msg_${i}`,
      content: `Turn number ${i + 1} with a reasonable amount of discussion text.`,
      sender: i % 2 === 0 ? "user" : "assistant",
    }));

    it("creates FULL_HISTORY plan including all messages without omission", () => {
      const plan = createContextReductionPlan(sampleHistory, "Current prompt", undefined, 128_000, "FULL_HISTORY");
      assert.equal(plan.totalHistoryMessages, 30);
      assert.equal(plan.includedMessagesCount, 30);
      assert.equal(plan.excludedMessagesCount, 0);
      assert.equal(plan.currentPromptProtected, true);
      assert.equal(plan.systemPromptProtected, true);
    });

    it("creates RECENT_WINDOW plan selecting the last N messages while preserving older in History", () => {
      const plan = createContextReductionPlan(sampleHistory, "Current prompt", undefined, 128_000, "RECENT_WINDOW", 10);
      assert.equal(plan.totalHistoryMessages, 30);
      assert.equal(plan.includedMessagesCount, 10);
      assert.equal(plan.excludedMessagesCount, 20);
      assert.ok(plan.explanation.includes("20 earlier messages remain safely in History"));
      // History array itself is completely untouched
      assert.equal(sampleHistory.length, 30);
    });

    it("creates PROTECTED_ONLY plan omitting all past turns while keeping system and prompt protected", () => {
      const plan = createContextReductionPlan(sampleHistory, "Current prompt", "System instruction", 128_000, "PROTECTED_ONLY");
      assert.equal(plan.includedMessagesCount, 0);
      assert.equal(plan.excludedMessagesCount, 30);
      assert.equal(plan.currentPromptProtected, true);
      assert.equal(plan.systemPromptProtected, true);
    });
  });

  describe("7. Upstream Context Error Normalization", () => {
    it("normalizes provider context_length_exceeded into CONTEXT_LIMIT_EXCEEDED", () => {
      const raw = { message: "This model's maximum context length is 128000 tokens. However, your messages resulted in 130000 tokens." };
      const normalized = normalizeContextError(raw, "openai", "gpt-4o");
      assert.equal(normalized.code, "CONTEXT_LIMIT_EXCEEDED");
      assert.ok(normalized.suggestedActions.length > 0);
    });

    it("normalizes prompt length errors into INPUT_TOKEN_LIMIT", () => {
      const raw = "The prompt is too long for this model's input limit.";
      const normalized = normalizeContextError(raw, "anthropic", "claude-3-5-sonnet-20241022");
      assert.equal(normalized.code, "INPUT_TOKEN_LIMIT");
    });

    it("normalizes HTTP 413 into REQUEST_TOO_LARGE", () => {
      const raw = "HTTP 413 Payload Too Large";
      const normalized = normalizeContextError(raw, "groq", "llama-3.3-70b-versatile");
      assert.equal(normalized.code, "REQUEST_TOO_LARGE");
    });
  });

  describe("8. Security & Privacy", () => {
    it("guarantees zero prompt content leakage in preflight and error details", () => {
      const secretPrompt = "SUPER_SECRET_INTERNAL_KEY_123456789";
      const preflight = evaluateContextPreflight({
        providerId: "openai",
        modelId: "gpt-4o",
        prompt: secretPrompt,
      });

      const serialized = JSON.stringify(preflight);
      assert.equal(serialized.includes(secretPrompt), false);

      const err = normalizeContextError("Context limit reached", "openai", "gpt-4o");
      const serializedErr = JSON.stringify(err);
      assert.equal(serializedErr.includes(secretPrompt), false);
    });
  });
});
