/**
//! Nano Route — Step 36 Error Classification & Failure Handling Tests
//! File: src/features/chat/__tests__/errorClassification.test.ts
//!
//! Authoritative unit & contract tests for Step 36:
//! - Canonical taxonomy normalization across categories
//! - Cross-provider error mapping consistency
//! - Sanitization guarantees (API keys, Bearer tokens, Windows filesystem paths)
//! - Cooperative cancellation precedence over transport aborts
//! - Stream failure normalization & ErrorEnvelope delivery
//! - Persistence failure isolation
//! - Strict adherence to classification-only scope (no retries, no automatic failovers)
*/

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyError,
  createMockErrorEnvelope,
  streamChatPrompt,
  createChatSession,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import type {
  ChatStreamEvent,
  ChatStreamFailedEvent,
} from "../../../services/ipc/types.ts";

describe("Step 36 Error Classification & Normalized Failure Handling", () => {
  describe("1. Canonical Taxonomy & Category Normalization", () => {
    it("normalizes HTTP 401 unauthorized to authentication_failed", async () => {
      const envelope = await classifyError({
        errorMessage: "Unauthorized: Invalid API key",
        httpStatus: 401,
        providerId: "openai",
      });

      assert.equal(envelope.category, "authentication_failed");
      assert.equal(envelope.errorCode, "AUTHENTICATION_FAILED");
      assert.equal(envelope.severity, "error");
      assert.equal(envelope.retryabilityHint, "user_action_required");
      assert.equal(envelope.userAction, "update_credential");
      assert.equal(envelope.isTerminal, true);
    });

    it("normalizes HTTP 403 forbidden to authorization_failed", async () => {
      const envelope = await classifyError({
        errorMessage: "Forbidden: User does not have access to model",
        httpStatus: 403,
        providerId: "anthropic",
      });

      assert.equal(envelope.category, "authorization_failed");
      assert.equal(envelope.errorCode, "AUTHORIZATION_FAILED");
      assert.equal(envelope.retryabilityHint, "user_action_required");
      assert.equal(envelope.userAction, "check_provider_access");
    });

    it("normalizes HTTP 429 rate limit to rate_limited with wait_and_retry_later", async () => {
      const envelope = await classifyError({
        errorMessage: "Rate limit reached for requests per minute",
        httpStatus: 429,
        providerId: "deepseek",
      });

      assert.equal(envelope.category, "rate_limited");
      assert.equal(envelope.errorCode, "RATE_LIMITED");
      assert.equal(envelope.severity, "warning");
      assert.equal(envelope.retryabilityHint, "likely_transient");
      assert.equal(envelope.failoverHint, "potentially_eligible");
      assert.equal(envelope.userAction, "wait_and_retry_later");
    });

    it("normalizes token limit overflows to context_limit_exceeded with reduce_input", async () => {
      const envelope = await classifyError({
        errorMessage: "This model's maximum context length is 8192 tokens. Your prompt resulted in 9500 tokens.",
        httpStatus: 400,
        providerId: "openai",
      });

      assert.equal(envelope.category, "context_limit_exceeded");
      assert.equal(envelope.errorCode, "CONTEXT_LIMIT_EXCEEDED");
      assert.equal(envelope.retryabilityHint, "user_action_required");
      assert.equal(envelope.failoverHint, "usually_not_eligible");
      assert.equal(envelope.userAction, "reduce_input");
    });

    it("normalizes HTTP 408 / request timeout to timeout", async () => {
      const envelope = await classifyError({
        errorMessage: "Upstream request timed out after 30000ms",
        httpStatus: 408,
      });

      assert.equal(envelope.category, "timeout");
      assert.equal(envelope.errorCode, "TIMEOUT");
      assert.equal(envelope.severity, "warning");
      assert.equal(envelope.retryabilityHint, "likely_transient");
      assert.equal(envelope.failoverHint, "potentially_eligible");
    });

    it("normalizes HTTP 503 service unavailable to provider_unavailable", async () => {
      const envelope = await classifyError({
        errorMessage: "The server is currently overloaded. Please try again later.",
        httpStatus: 503,
        providerId: "gemini",
      });

      assert.equal(envelope.category, "provider_unavailable");
      assert.equal(envelope.errorCode, "PROVIDER_UNAVAILABLE");
      assert.equal(envelope.retryabilityHint, "likely_transient");
      assert.equal(envelope.failoverHint, "potentially_eligible");
      assert.equal(envelope.userAction, "contact_provider");
    });

    it("normalizes model not found errors to model_unavailable", async () => {
      const envelope = await classifyError({
        errorMessage: "The model 'gpt-5-turbo' does not exist or you do not have access to it",
        httpStatus: 404,
        providerId: "openai",
      });

      assert.equal(envelope.category, "model_unavailable");
      assert.equal(envelope.errorCode, "MODEL_UNAVAILABLE");
      assert.equal(envelope.retryabilityHint, "likely_permanent");
      assert.equal(envelope.failoverHint, "potentially_eligible");
    });
  });

  describe("2. Cross-Provider Mapping Consistency", () => {
    it("maps OpenAI, Anthropic, and Gemini authentication failures to identical category", async () => {
      const openaiAuth = await classifyError({
        errorMessage: "Incorrect API key provided: sk-proj-1234567890",
        httpStatus: 401,
        providerId: "openai",
      });

      const anthropicAuth = await classifyError({
        errorMessage: "invalid x-api-key header provided",
        httpStatus: 401,
        providerId: "anthropic",
      });

      const geminiAuth = await classifyError({
        errorMessage: "API key not valid. Please pass a valid API key.",
        httpStatus: 400,
        providerId: "gemini",
      });

      assert.equal(openaiAuth.category, "authentication_failed");
      assert.equal(anthropicAuth.category, "authentication_failed");
      assert.equal(geminiAuth.category, "authentication_failed");

      assert.equal(openaiAuth.errorCode, "AUTHENTICATION_FAILED");
      assert.equal(anthropicAuth.errorCode, "AUTHENTICATION_FAILED");
      assert.equal(geminiAuth.errorCode, "AUTHENTICATION_FAILED");
    });

    it("maps OpenAI, DeepSeek, and Groq rate limit errors to identical category", async () => {
      const openaiRate = await classifyError({
        errorMessage: "Rate limit reached for requests",
        httpStatus: 429,
        providerId: "openai",
      });

      const deepseekRate = await classifyError({
        errorMessage: "Resource exhausted: rate_limited",
        httpStatus: 429,
        providerId: "deepseek",
      });

      const groqRate = await classifyError({
        errorMessage: "Too many requests",
        httpStatus: 429,
        providerId: "groq",
      });

      assert.equal(openaiRate.category, "rate_limited");
      assert.equal(deepseekRate.category, "rate_limited");
      assert.equal(groqRate.category, "rate_limited");
    });
  });

  describe("3. Security & Sanitization Guarantees", () => {
    it("scrubs OpenAI sk- API keys from error messages", async () => {
      const raw = "Authentication failed with key sk-proj-abcdef1234567890xyz and secret sk-112233445566778899";
      const envelope = await classifyError({ errorMessage: raw });

      assert.ok(!envelope.userMessage.includes("sk-proj-abcdef1234567890xyz"));
      assert.ok(!envelope.userMessage.includes("sk-112233445566778899"));
      assert.ok(envelope.userMessage.includes("[REDACTED_API_KEY]"));
    });

    it("scrubs Gemini AIzaSy API keys from error messages", async () => {
      const raw = "Request rejected for key AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6";
      const envelope = await classifyError({ errorMessage: raw });

      assert.ok(!envelope.userMessage.includes("AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6"));
      assert.ok(envelope.userMessage.includes("[REDACTED_API_KEY]"));
    });

    it("scrubs Bearer authorization tokens from error messages", async () => {
      const raw = "Failed to authenticate Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
      const envelope = await classifyError({ errorMessage: raw });

      assert.ok(!envelope.userMessage.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"));
      assert.ok(envelope.userMessage.includes("[REDACTED]"));
    });

    it("scrubs Windows filesystem paths from error messages", async () => {
      const raw = "Failed to load model cache at C:\\Users\\Administrator\\AppData\\Roaming\\NanoRoute\\cache";
      const envelope = await classifyError({ errorMessage: raw });

      assert.ok(!envelope.userMessage.includes("Administrator"));
      assert.ok(envelope.userMessage.includes("[REDACTED_LOCAL_PATH]"));
    });
  });

  describe("4. Cancellation Precedence Over Aborts", () => {
    it("treats cancelled execution as Cancelled category rather than transport error", async () => {
      const envelope = await classifyError({
        errorMessage: "Execution cancelled by user cooperative abort signal",
      });

      assert.equal(envelope.category, "cancelled");
      assert.equal(envelope.errorCode, "CANCELLED");
      assert.equal(envelope.severity, "info");
      assert.equal(envelope.retryabilityHint, "not_applicable");
      assert.equal(envelope.failoverHint, "not_applicable");
      assert.equal(envelope.userAction, "none");
    });
  });

  describe("5. Stream Failure Normalization & ErrorEnvelope Attachment", () => {
    it("attaches rich ErrorEnvelope to stream Failed event during stream disruption", async () => {
      resetChatMockStore();
      const session = await createChatSession({ title: "Stream Failure Test" });
      const events: ChatStreamEvent[] = [];

      await assert.rejects(
        async () => {
          await streamChatPrompt(
            {
              sessionId: session.id,
              prompt: "Hello __FAIL_STREAM__",
            },
            (ev) => {
              events.push(ev);
            }
          );
        },
        /Injected stream provider failure/
      );

      const failedEvent = events.find((e) => e.type === "failed") as ChatStreamFailedEvent | undefined;
      assert.ok(failedEvent, "Failed event must be emitted");
      assert.equal(failedEvent.type, "failed");
      assert.ok(failedEvent.error, "Stream failed event must include normalized ErrorEnvelope");
      assert.equal(failedEvent.error?.category, "stream_interrupted");
      assert.equal(failedEvent.error?.errorCode, "STREAM_INTERRUPTED");
      assert.equal(failedEvent.error?.severity, "warning");
    });

    it("normalizes __FAIL_AUTH__ stream to authentication_failed envelope", async () => {
      resetChatMockStore();
      const session = await createChatSession({ title: "Stream Auth Failure" });
      const events: ChatStreamEvent[] = [];

      await assert.rejects(async () => {
        await streamChatPrompt(
          {
            sessionId: session.id,
            prompt: "Testing __FAIL_AUTH__",
          },
          (ev) => {
            events.push(ev);
          }
        );
      });

      const failed = events.find((e) => e.type === "failed") as ChatStreamFailedEvent | undefined;
      assert.ok(failed?.error);
      assert.equal(failed.error.category, "authentication_failed");
      assert.equal(failed.error.userAction, "update_credential");
      assert.ok(!failed.error.userMessage.includes("sk-proj-1234567890abcdef"));
      assert.ok(failed.error.userMessage.includes("[REDACTED_API_KEY]"));
    });

    it("normalizes __FAIL_RATELIMIT__ stream to rate_limited envelope", async () => {
      resetChatMockStore();
      const session = await createChatSession({ title: "Stream Rate Failure" });
      const events: ChatStreamEvent[] = [];

      await assert.rejects(async () => {
        await streamChatPrompt(
          {
            sessionId: session.id,
            prompt: "Testing __FAIL_RATELIMIT__",
          },
          (ev) => {
            events.push(ev);
          }
        );
      });

      const failed = events.find((e) => e.type === "failed") as ChatStreamFailedEvent | undefined;
      assert.ok(failed?.error);
      assert.equal(failed.error.category, "rate_limited");
      assert.equal(failed.error.userAction, "wait_and_retry_later");
      assert.equal(failed.error.retryabilityHint, "likely_transient");
    });
  });

  describe("6. Persistence Failure Isolation", () => {
    it("classifies SQLite write failures as database_failure without routing failover", async () => {
      const envelope = await classifyError({
        errorMessage: "SQLite database disk image is malformed or write failed",
      });

      assert.equal(envelope.category, "database_failure");
      assert.equal(envelope.errorCode, "DATABASE_FAILURE");
      assert.equal(envelope.severity, "error");
      assert.equal(envelope.retryabilityHint, "likely_permanent");
      assert.equal(envelope.failoverHint, "usually_not_eligible");
    });
  });

  describe("7. Unknown Condition Preservation & Fallback", () => {
    it("preserves unrecognized error conditions as unknown with fallback_unknown provenance", async () => {
      const envelope = await classifyError({
        errorMessage: "A completely novel upstream message with no known patterns",
      });

      assert.equal(envelope.category, "unknown");
      assert.equal(envelope.errorCode, "UNKNOWN_ERROR");
      assert.equal(envelope.provenance, "fallback_unknown");
      assert.equal(envelope.retryabilityHint, "unknown");
      assert.equal(envelope.failoverHint, "unknown");
      assert.equal(envelope.schemaVersion, 1);
      assert.ok(envelope.occurredAtMs > 0);
    });
  });

  describe("8. Strict Step 36 Classification Scope Invariant", () => {
    it("provides hints without triggering automatic retries or failover execution", () => {
      const envelope = createMockErrorEnvelope({
        errorMessage: "Provider rate limit reached: 429",
        httpStatus: 429,
        providerId: "openai",
        modelId: "gpt-4o",
        executionId: "exec_test_123",
      });

      // Verification: Envelope provides classification metadata ONLY
      assert.equal(envelope.category, "rate_limited");
      assert.equal(envelope.retryabilityHint, "likely_transient");
      assert.equal(envelope.failoverHint, "potentially_eligible");
      // Must NOT contain retry counts, next retry timestamp, or alternative target model
      assert.equal((envelope as unknown as { retryCount?: number }).retryCount, undefined);
      assert.equal((envelope as unknown as { nextRetryDelayMs?: number }).nextRetryDelayMs, undefined);
      assert.equal((envelope as unknown as { fallbackTargetModel?: string }).fallbackTargetModel, undefined);
    });
  });
});
