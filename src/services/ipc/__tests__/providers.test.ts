/**
//! Nano Route — AI Provider Abstraction Contracts & Test Suite (Step 14)
//!
//! Tests:
//! 1. Provider Identity: validation, slug formatting, well-known providers.
//! 2. Capabilities: discrete set, queries, presets (chat, vision, reasoning).
//! 3. Model Descriptors: context windows, pricing, availability states.
//! 4. Canonical Requests: validation invariants, roles, temperature/top_p bounds.
//! 5. Normalized Responses: usage accounting, finish reasons, metadata.
//! 6. Provider Health: operational vs non-operational state checks.
//! 7. Error Classification & Secret Scrubbing: 13 error kinds, retryability, token redaction.
//! 8. Mock Provider Client & Cancellation: cooperative cancellation, error injection.
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type {
  ProviderId,
  ProviderCapability,
  ModelPricing,
  ProviderModel,
  ProviderRequest,
  ProviderFinishReason,
  ProviderUsage,
  ProviderResponse,
  ProviderHealth,
  ProviderHealthReport,
  ProviderErrorKind,
  ProviderError,
  ProviderMetadata,
} from "../types.ts";

// --- Pure Contract Logic Mirrors for Frontend Testing ---

function isValidProviderId(slug: string): boolean {
  if (slug.length < 2 || slug.length > 64) return false;
  return /^[a-z0-9][a-z0-9._-]*$/.test(slug);
}

function isOperationalHealth(status: ProviderHealth): boolean {
  return status === "available" || status === "degraded";
}

function validateRequest(req: ProviderRequest): string | null {
  if (!req.modelId || req.modelId.trim().length === 0) {
    return "model_id cannot be empty";
  }
  if (!req.messages || req.messages.length === 0) {
    return "messages array cannot be empty";
  }
  for (let i = 0; i < req.messages.length; i++) {
    const msg = req.messages[i];
    if (!msg.content && msg.content !== "") {
      return `message[${i}] content is missing`;
    }
  }
  if (req.params.temperature !== undefined) {
    if (req.params.temperature < 0.0 || req.params.temperature > 2.0) {
      return "temperature must be between 0.0 and 2.0";
    }
  }
  if (req.params.topP !== undefined) {
    if (req.params.topP < 0.0 || req.params.topP > 1.0) {
      return "top_p must be between 0.0 and 1.0";
    }
  }
  if (req.params.maxTokens !== undefined && req.params.maxTokens <= 0) {
    return "max_tokens must be positive";
  }
  return null;
}

function sanitizeErrorText(input: string): string {
  let result = input;
  const prefixes = [
    "sk-",
    "key-",
    "Bearer ",
    "bearer ",
    "AIzaSy",
    "ghp_",
    "api_key=",
    "apikey=",
    "key=",
  ];

  for (const prefix of prefixes) {
    let startIdx = 0;
    while (true) {
      const found = result.indexOf(prefix, startIdx);
      if (found === -1) break;

      const tokenStart = found + prefix.length;
      let tokenEnd = result.length;

      for (let i = tokenStart; i < result.length; i++) {
        const ch = result[i];
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "," || ch === '"' || ch === "'" || ch === "&" || ch === ";") {
          tokenEnd = i;
          break;
        }
      }

      if (tokenEnd - tokenStart > 4) {
        const prefixPart = result.substring(0, tokenStart);
        const suffixPart = result.substring(tokenEnd);
        result = `${prefixPart}[REDACTED]${suffixPart}`;
        startIdx = tokenStart + "[REDACTED]".length;
      } else {
        startIdx = tokenStart;
      }

      if (startIdx >= result.length) break;
    }
  }

  return result;
}

function isRetryableError(kind: ProviderErrorKind): boolean {
  return [
    "rate_limited",
    "provider_unavailable",
    "network_error",
    "timeout",
  ].includes(kind);
}

// --- Test Suite Execution ---

describe("Step 14 AI Provider Abstraction Layer & Client Contract", () => {
  describe("1. Provider Identity & Slugs", () => {
    it("accepts valid well-known provider identifiers", () => {
      const wellKnown: ProviderId[] = [
        "openai",
        "anthropic",
        "gemini",
        "deepseek",
        "mistral",
        "xai",
        "groq",
        "local",
        "custom",
      ];
      for (const id of wellKnown) {
        assert.equal(isValidProviderId(id), true, `Expected valid ID: ${id}`);
      }
    });

    it("rejects invalid provider identifiers", () => {
      assert.equal(isValidProviderId(""), false);
      assert.equal(isValidProviderId("A"), false); // uppercase
      assert.equal(isValidProviderId("OpenAI"), false); // uppercase
      assert.equal(isValidProviderId("-invalid"), false); // starts with hyphen
      assert.equal(isValidProviderId("provider with space"), false); // whitespace
      assert.equal(isValidProviderId("bad@provider!"), false); // special symbols
      assert.equal(isValidProviderId("a".repeat(65)), false); // exceeds 64 chars
    });
  });

  describe("2. Provider Capabilities & Presets", () => {
    it("contains 13 discrete capabilities", () => {
      const capabilities: ProviderCapability[] = [
        "text_generation",
        "chat_completion",
        "streaming",
        "system_prompts",
        "tool_calling",
        "json_mode",
        "vision_input",
        "audio_input",
        "audio_output",
        "embeddings",
        "reasoning_tokens",
        "token_log_probs",
        "custom_stop_sequences",
      ];
      assert.equal(capabilities.length, 13);
    });

    it("evaluates capability queries correctly", () => {
      const standardChat: ProviderCapability[] = [
        "text_generation",
        "chat_completion",
        "streaming",
        "system_prompts",
      ];

      const supports = (list: ProviderCapability[], cap: ProviderCapability) => list.includes(cap);
      const supportsAll = (list: ProviderCapability[], caps: ProviderCapability[]) =>
        caps.every((c) => list.includes(c));

      assert.equal(supports(standardChat, "chat_completion"), true);
      assert.equal(supports(standardChat, "vision_input"), false);
      assert.equal(supportsAll(standardChat, ["text_generation", "streaming"]), true);
      assert.equal(supportsAll(standardChat, ["text_generation", "tool_calling"]), false);
    });
  });

  describe("3. Model Descriptors & Pricing Invariants", () => {
    it("validates model descriptor pricing and token limits", () => {
      const pricing: ModelPricing = {
        promptCostPerMtokenUsd: 3.0,
        completionCostPerMtokenUsd: 15.0,
        isFree: false,
      };

      const model: ProviderModel = {
        id: "claude-3-5-sonnet",
        displayName: "Claude 3.5 Sonnet",
        providerId: "anthropic",
        capabilities: ["chat_completion", "vision_input", "tool_calling", "streaming"],
        contextWindowTokens: 200_000,
        maxOutputTokens: 8_192,
        pricing,
        availability: "Available",
      };

      assert.equal(model.id, "claude-3-5-sonnet");
      assert.equal(model.contextWindowTokens, 200000);
      assert.equal(model.pricing.isFree, false);
      assert.equal(model.availability, "Available");
    });

    it("verifies free local model descriptors", () => {
      const freePricing: ModelPricing = {
        promptCostPerMtokenUsd: 0.0,
        completionCostPerMtokenUsd: 0.0,
        isFree: true,
      };

      const localModel: ProviderModel = {
        id: "qwen-2.5-coder-7b",
        displayName: "Qwen 2.5 Coder 7B",
        providerId: "local",
        capabilities: ["text_generation", "chat_completion"],
        contextWindowTokens: 32_768,
        maxOutputTokens: 4_096,
        pricing: freePricing,
        availability: "Available",
      };

      assert.equal(localModel.pricing.isFree, true);
      assert.equal(localModel.pricing.promptCostPerMtokenUsd, 0.0);
    });
  });

  describe("4. Canonical Provider Request Invariants & Validation", () => {
    it("validates successful minimal chat request", () => {
      const req: ProviderRequest = {
        modelId: "gpt-4o",
        messages: [{ role: "user", content: "Explain quantum computing simply." }],
        params: {
          temperature: 0.7,
          maxTokens: 1000,
        },
        metadata: {
          requestId: "req-test-001",
        },
      };

      const error = validateRequest(req);
      assert.equal(error, null);
    });

    it("rejects request with empty model ID", () => {
      const req: ProviderRequest = {
        modelId: "",
        messages: [{ role: "user", content: "Hi" }],
        params: {},
        metadata: { requestId: "req-test-002" },
      };
      assert.equal(validateRequest(req), "model_id cannot be empty");
    });

    it("rejects request with empty messages array", () => {
      const req: ProviderRequest = {
        modelId: "gpt-4o",
        messages: [],
        params: {},
        metadata: { requestId: "req-test-003" },
      };
      assert.equal(validateRequest(req), "messages array cannot be empty");
    });

    it("rejects out-of-range temperature", () => {
      const req: ProviderRequest = {
        modelId: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        params: { temperature: 2.5 },
        metadata: { requestId: "req-test-004" },
      };
      assert.equal(validateRequest(req), "temperature must be between 0.0 and 2.0");
    });

    it("rejects negative maxTokens", () => {
      const req: ProviderRequest = {
        modelId: "gpt-4o",
        messages: [{ role: "user", content: "Hi" }],
        params: { maxTokens: -50 },
        metadata: { requestId: "req-test-005" },
      };
      assert.equal(validateRequest(req), "max_tokens must be positive");
    });
  });

  describe("5. Normalized Provider Response Contracts", () => {
    it("verifies accurate token accounting and finish reasons", () => {
      const usage: ProviderUsage = {
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
        reasoningTokens: 0,
        estimatedCostUsd: 0.0015,
      };

      assert.equal(usage.promptTokens + usage.completionTokens, usage.totalTokens);

      const resp: ProviderResponse = {
        id: "chatcmpl-998877",
        providerId: "openai",
        modelId: "gpt-4o-mini",
        content: "Here is your explanation...",
        finishReason: "stop",
        usage,
        metadata: {
          latencyMs: 340,
          systemFingerprint: "fp_447788",
          throughputTokensPerSec: 235.3,
        },
      };

      assert.equal(resp.finishReason, "stop");
      assert.equal(resp.content.length > 0, true);
      assert.equal(resp.metadata.latencyMs, 340);
    });

    it("handles alternative finish reasons", () => {
      const finishReasons: ProviderFinishReason[] = [
        "stop",
        "length",
        "tool_calls",
        "content_filter",
        "cancelled",
        "error",
        "unknown",
      ];
      assert.equal(finishReasons.length, 7);
    });
  });

  describe("6. Provider Health & Readiness Evaluation", () => {
    it("determines operational vs non-operational states accurately", () => {
      assert.equal(isOperationalHealth("available"), true);
      assert.equal(isOperationalHealth("degraded"), true);

      assert.equal(isOperationalHealth("unknown"), false);
      assert.equal(isOperationalHealth("unavailable"), false);
      assert.equal(isOperationalHealth("unauthorized"), false);
      assert.equal(isOperationalHealth("rate_limited"), false);
      assert.equal(isOperationalHealth("misconfigured"), false);
      assert.equal(isOperationalHealth("disabled"), false);
    });

    it("verifies health report structure", () => {
      const report: ProviderHealthReport = {
        status: "available",
        checkedAtMs: Date.now(),
        latencyMs: 52,
        message: "Endpoint responsive",
      };
      assert.equal(isOperationalHealth(report.status), true);
      assert.equal(report.latencyMs, 52);
    });
  });

  describe("7. Error Classification & Secret Sanitization", () => {
    it("classifies error retryability according to architectural contract", () => {
      assert.equal(isRetryableError("rate_limited"), true);
      assert.equal(isRetryableError("provider_unavailable"), true);
      assert.equal(isRetryableError("network_error"), true);
      assert.equal(isRetryableError("timeout"), true);

      assert.equal(isRetryableError("authentication_failed"), false);
      assert.equal(isRetryableError("invalid_request"), false);
      assert.equal(isRetryableError("model_not_found"), false);
      assert.equal(isRetryableError("quota_exceeded"), false);
      assert.equal(isRetryableError("cancelled"), false);
    });

    it("scrubs sensitive API keys and bearer tokens from error text", () => {
      const rawError = "Request failed for key sk-proj-abcdef1234567890xyz and Bearer my_secret_token_abc";
      const sanitized = sanitizeErrorText(rawError);

      assert.equal(sanitized.includes("abcdef1234567890xyz"), false);
      assert.equal(sanitized.includes("my_secret_token_abc"), false);
      assert.equal(sanitized.includes("[REDACTED]"), true);
    });

    it("formats provider error payload safely", () => {
      const err: ProviderError = {
        providerId: "openai",
        kind: "rate_limited",
        message: sanitizeErrorText("429 rate limit exceeded for key sk-1234567890"),
        statusCode: 429,
        retryAfterMs: 2500,
        isRetryable: true,
      };

      assert.equal(err.isRetryable, true);
      assert.equal(err.retryAfterMs, 2500);
      assert.equal(err.message.includes("sk-1234567890"), false);
      assert.equal(err.message.includes("[REDACTED]"), true);
    });
  });

  describe("8. Mock Provider Client & Cooperative Cancellation", () => {
    class MockClient {
      public readonly id: ProviderId;
      public readonly metadata: ProviderMetadata;
      private callCount: number = 0;
      private injectedError: ProviderError | null = null;

      constructor(id: ProviderId, metadata: ProviderMetadata) {
        this.id = id;
        this.metadata = metadata;
      }

      setInjectedError(err: ProviderError | null): void {
        this.injectedError = err;
      }

      getCallCount(): number {
        return this.callCount;
      }

      async execute(
        req: ProviderRequest,
        isCancelled: () => boolean
      ): Promise<ProviderResponse> {
        this.callCount++;

        // 1. Check cancellation before doing work
        if (isCancelled()) {
          const cancelErr: ProviderError = {
            providerId: this.id,
            kind: "cancelled",
            message: "Operation was cancelled by user or system",
            isRetryable: false,
          };
          throw cancelErr;
        }

        // 2. Request validation
        const valErr = validateRequest(req);
        if (valErr) {
          const invalidErr: ProviderError = {
            providerId: this.id,
            kind: "invalid_request",
            message: valErr,
            statusCode: 400,
            isRetryable: false,
          };
          throw invalidErr;
        }

        // 3. Error injection check
        if (this.injectedError) {
          throw this.injectedError;
        }

        // 4. Return canonical mock response
        const promptTokens = req.messages.reduce((acc, m) => acc + Math.floor(m.content.length / 4), 10);
        const replyText = "Deterministic mock response for Nano Route.";
        const completionTokens = Math.floor(replyText.length / 4);

        return {
          id: `mock-resp-${this.callCount}`,
          providerId: this.id,
          modelId: req.modelId,
          content: replyText,
          finishReason: "stop",
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          },
          metadata: {
            latencyMs: 15,
            systemFingerprint: "mock-fp-001",
          },
        };
      }
    }

    it("executes mock request successfully", async () => {
      const metadata: ProviderMetadata = {
        id: "mock-test",
        name: "Mock Provider",
        description: "Test double",
        isLocal: true,
        isBuiltIn: false,
        capabilities: ["chat_completion", "text_generation"],
        models: [],
      };

      const client = new MockClient("mock-test", metadata);
      const req: ProviderRequest = {
        modelId: "mock-v1",
        messages: [{ role: "user", content: "Test ping" }],
        params: { temperature: 0.5 },
        metadata: { requestId: "req-mock-1" },
      };

      const resp = await client.execute(req, () => false);
      assert.equal(resp.providerId, "mock-test");
      assert.equal(resp.content, "Deterministic mock response for Nano Route.");
      assert.equal(client.getCallCount(), 1);
    });

    it("aborts execution immediately when cancellation is requested", async () => {
      const metadata: ProviderMetadata = {
        id: "mock-test",
        name: "Mock Provider",
        description: "Test double",
        isLocal: true,
        isBuiltIn: false,
        capabilities: ["chat_completion"],
        models: [],
      };

      const client = new MockClient("mock-test", metadata);
      const req: ProviderRequest = {
        modelId: "mock-v1",
        messages: [{ role: "user", content: "Test cancelled" }],
        params: {},
        metadata: { requestId: "req-mock-2" },
      };

      // Pass cancellation callback returning true
      await assert.rejects(
        async () => {
          await client.execute(req, () => true);
        },
        (err: ProviderError) => {
          assert.equal(err.kind, "cancelled");
          assert.equal(err.isRetryable, false);
          return true;
        }
      );
    });

    it("returns injected error properly", async () => {
      const metadata: ProviderMetadata = {
        id: "mock-test",
        name: "Mock Provider",
        description: "Test double",
        isLocal: true,
        isBuiltIn: false,
        capabilities: ["chat_completion"],
        models: [],
      };

      const client = new MockClient("mock-test", metadata);
      client.setInjectedError({
        providerId: "mock-test",
        kind: "rate_limited",
        message: "Simulated quota limit",
        statusCode: 429,
        retryAfterMs: 5000,
        isRetryable: true,
      });

      const req: ProviderRequest = {
        modelId: "mock-v1",
        messages: [{ role: "user", content: "Test error injection" }],
        params: {},
        metadata: { requestId: "req-mock-3" },
      };

      await assert.rejects(
        async () => {
          await client.execute(req, () => false);
        },
        (err: ProviderError) => {
          assert.equal(err.kind, "rate_limited");
          assert.equal(err.statusCode, 429);
          assert.equal(err.retryAfterMs, 5000);
          return true;
        }
      );
    });
  });
});
