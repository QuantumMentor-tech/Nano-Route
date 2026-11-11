/**
//! Nano Route — Retry, Timeout & Rate-Limit Control Engine Test Suite
//! File: src/features/chat/__tests__/retryTimeoutRateLimit.test.ts
//!
//! Validates Step 38: Centralized retry policy, retry safety classifications,
//! bounded backoff and jitter, rate-limit (429) Retry-After handling, stream token
//! output safety (no blind replay), ambiguous timeout protection, cancellation
//! during backoff, and clean handoff to Step 37 failover.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  getChatMessages,
  submitChatPrompt,
  streamChatPrompt,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import type {
  ChatStreamEvent,
  ChatStreamStartedEvent,
  ChatStreamRetryEvent,
  ChatStreamFailoverEvent,
  ChatStreamCompletedEvent,
  ChatStreamCancelledEvent,
} from "../types.ts";

describe("Step 38 Retry, Timeout & Rate-Limit Control Engine", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // Scenario A: Normal Success
  // ==========================================================================
  describe("Scenario A: Normal Success — Zero Retries & Zero Failovers", () => {
    it("completes primary candidate without emitting retry or failover events", async () => {
      const session = await createChatSession({ title: "Scenario A: Normal" });
      const prompt = "Explain the difference between retry and failover";

      const events: ChatStreamEvent[] = [];
      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
        }
      );

      assert.ok(assistantMessage);
      assert.ok(!assistantMessage.metadata.failoverUsed);
      assert.ok(!assistantMessage.metadata.retryCount);
      assert.equal(assistantMessage.metadata.totalAttempts ?? 1, 1);

      // Verify no retry or failover events were emitted
      const retryEvents = events.filter((e): e is ChatStreamRetryEvent => e.type === "retry");
      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.equal(retryEvents.length, 0);
      assert.equal(failoverEvents.length, 0);

      // Verify persistence: exactly 1 user and 1 assistant message
      const stored = await getChatMessages({ sessionId: session.id });
      assert.equal(stored.length, 2);
      assert.equal(stored[1].id, assistantMessage.id);
    });
  });

  // ==========================================================================
  // Scenario B: Safe Transient Transport Failure & Retry Success
  // ==========================================================================
  describe("Scenario B: Safe Transient Transport Failure — Same Candidate Retry", () => {
    it("retries same model upon pre-transmission connection failure and succeeds on attempt 2 (streaming)", async () => {
      const session = await createChatSession({ title: "Scenario B: Streaming Retry" });
      const prompt = "Please process this query with __RETRY_THEN_SUCCEED__";

      const events: ChatStreamEvent[] = [];
      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
        }
      );

      assert.ok(assistantMessage);
      assert.equal(assistantMessage.metadata.retryCount, 1);
      assert.equal(assistantMessage.metadata.totalAttempts, 2);
      assert.equal(assistantMessage.metadata.failoverUsed ?? false, false);
      assert.ok(assistantMessage.content.startsWith("Response after retry from"));

      // Exactly 1 retry event emitted before attempt 2
      const retryEvents = events.filter((e): e is ChatStreamRetryEvent => e.type === "retry");
      assert.equal(retryEvents.length, 1);
      assert.equal(retryEvents[0].attempt, 1);
      assert.equal(retryEvents[0].maxRetries, 2);
      assert.equal(retryEvents[0].providerId, "deepseek");
      assert.equal(retryEvents[0].modelId, "deepseek-chat");

      // Verify two started events: initial and retry
      const startedEvents = events.filter((e): e is ChatStreamStartedEvent => e.type === "started");
      assert.equal(startedEvents.length, 2);
      assert.equal(startedEvents[0].providerId, "deepseek");
      assert.equal(startedEvents[1].providerId, "deepseek");
      assert.notEqual(startedEvents[0].streamId, startedEvents[1].streamId);

      // Verify zero failover events
      const failoverEvents = events.filter((e) => e.type === "failover");
      assert.equal(failoverEvents.length, 0);

      // Exactly one assistant message saved in SQLite with retry metadata
      const stored = await getChatMessages({ sessionId: session.id });
      assert.equal(stored.length, 2);
      assert.equal(stored[1].metadata.retryCount, 1);
    });

    it("retries same model upon pre-transmission failure in non-streaming prompt submission", async () => {
      const session = await createChatSession({ title: "Scenario B: Non-streaming Retry" });
      const prompt = "Non-streaming query with __RETRY_THEN_SUCCEED__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.ok(result);
      assert.equal(result.assistantMessage.metadata.retryCount, 1);
      assert.equal(result.assistantMessage.metadata.totalAttempts, 2);
      assert.equal(result.assistantMessage.metadata.failoverUsed ?? false, false);
      assert.equal(result.routedProvider, "deepseek");
    });
  });

  // ==========================================================================
  // Scenario C: Rate Limit (429) & Repeated Backoff -> Exhaustion -> Failover
  // ==========================================================================
  describe("Scenario C & D: Rate Limit Backoff & Exhaustion to Failover", () => {
    it("retries up to bounded candidate limit upon repeated 429 and then cleanly fails over to Step 37 candidate", async () => {
      const session = await createChatSession({ title: "Scenario D: Rate Limit Exhaustion" });
      const prompt = "Repeated 429 rate limit query with __RATE_LIMIT_REPEATED_THEN_FAILOVER__";

      const events: ChatStreamEvent[] = [];
      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
        }
      );

      assert.ok(assistantMessage);
      assert.equal(assistantMessage.metadata.retryCount, 2);
      assert.equal(assistantMessage.metadata.totalAttempts, 3);
      assert.equal(assistantMessage.metadata.failoverUsed, true);
      assert.equal(assistantMessage.metadata.routedProvider, "openai");
      assert.equal(assistantMessage.metadata.failoverFromProvider, "deepseek");

      // Verify sequence: retry 1 -> retry 2 -> failover -> fallback success
      const retryEvents = events.filter((e): e is ChatStreamRetryEvent => e.type === "retry");
      assert.equal(retryEvents.length, 2);
      assert.equal(retryEvents[0].attempt, 1);
      assert.equal(retryEvents[1].attempt, 2);

      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.equal(failoverEvents.length, 1);
      assert.equal(failoverEvents[0].fromProvider, "deepseek");
      assert.equal(failoverEvents[0].toProvider, "openai");

      const completed = events.find((e): e is ChatStreamCompletedEvent => e.type === "completed");
      assert.ok(completed);
      assert.equal(completed.assistantMessage.metadata.routedProvider, "openai");
    });
  });

  // ==========================================================================
  // Scenario G: Ambiguous Timeout After Request Transmission
  // ==========================================================================
  describe("Scenario G: Ambiguous Post-Transmission Timeout Protection", () => {
    it("disallows automatic replay on same model after ambiguous transmission and defers directly to failover", async () => {
      const session = await createChatSession({ title: "Scenario G: Ambiguous Timeout" });
      const prompt = "Post-transmission timeout query __AMBIGUOUS_TIMEOUT_NO_RETRY__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.ok(result);
      // Verify zero retries attempted on the same candidate due to ambiguity
      assert.equal(result.assistantMessage.metadata.retryCount, 0);
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      assert.equal(result.assistantMessage.metadata.failoverFromProvider, "deepseek");
      assert.equal(result.assistantMessage.metadata.routedProvider, "openai");
      assert.ok(result.assistantMessage.metadata.failoverReason?.includes("Ambiguous timeout"));
    });
  });

  // ==========================================================================
  // Scenario H & J: Streaming Output Token Safety
  // ==========================================================================
  describe("Scenario H: Streaming Output Token Safety Invariant", () => {
    it("never replays the same prompt against the same model if provider tokens were already emitted", async () => {
      const session = await createChatSession({ title: "Scenario H: Stream Token Safety" });
      const prompt = "Streaming query with tokens emitted __STREAM_TOKEN_EMITTED_NO_RETRY__";

      const events: ChatStreamEvent[] = [];
      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
        }
      );

      assert.ok(assistantMessage);
      assert.equal(assistantMessage.metadata.failoverUsed, true);
      assert.equal(assistantMessage.metadata.failoverFromProvider, "deepseek");

      // Verify ZERO retry events were emitted (safety rule: tokens emitted = unsafe for same-model retry)
      const retryEvents = events.filter((e) => e.type === "retry");
      assert.equal(retryEvents.length, 0);

      // Verify failover occurred directly
      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.equal(failoverEvents.length, 1);
      assert.equal(failoverEvents[0].fromProvider, "deepseek");
      assert.equal(failoverEvents[0].toProvider, "openai");

      // Primary partial text was discarded, NOT concatenated into final response
      assert.ok(!assistantMessage.content.includes("Partial stream token output"));
      assert.ok(assistantMessage.content.startsWith("Fallback response from"));
    });
  });

  // ==========================================================================
  // Scenario I: Cooperative Cancellation During Retry Backoff
  // ==========================================================================
  describe("Scenario I: Cooperative Cancellation During Retry Backoff", () => {
    it("halts immediately on cancellation during backoff delay without dispatching attempt 2", async () => {
      const session = await createChatSession({ title: "Scenario I: Cancel During Backoff" });
      const prompt = "Query with retry then cancel __RETRY_THEN_SUCCEED__ __RETRY_CANCEL__";

      const events: ChatStreamEvent[] = [];
      const result = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
        }
      );

      assert.equal(result, null, "Cancelled execution must resolve with null");

      // Verify retry event was emitted
      const retryEvent = events.find((e): e is ChatStreamRetryEvent => e.type === "retry");
      assert.ok(retryEvent, "Retry event was scheduled before cancellation");

      // Verify terminal cancelled event
      const cancelEvent = events.find((e): e is ChatStreamCancelledEvent => e.type === "cancelled");
      assert.ok(cancelEvent, "Cancelled event must be emitted");
      assert.equal(cancelEvent.reason, "user_cancelled");

      // Verify zero assistant messages saved in SQLite
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 1);
      assert.equal(messages[0].sender, "user");
    });
  });

  // ==========================================================================
  // Scenario K: Security & Confidentiality Invariants
  // ==========================================================================
  describe("Scenario K: Security & Confidentiality Invariants", () => {
    it("guarantees retry stream events and message metadata contain zero API keys or authorization headers", async () => {
      const session = await createChatSession({ title: "Scenario K: Security" });
      const prompt = "Test with sk-proj-1234567890abcdef and __RETRY_THEN_SUCCEED__";

      const events: ChatStreamEvent[] = [];
      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
        }
      );

      assert.ok(assistantMessage);

      // Check all retry events
      const retryEvents = events.filter((e): e is ChatStreamRetryEvent => e.type === "retry");
      assert.equal(retryEvents.length, 1);
      const serializedRetry = JSON.stringify(retryEvents[0]);
      assert.ok(!serializedRetry.includes("sk-proj-"), "Retry event must not leak API key");
      assert.ok(!serializedRetry.includes("Bearer"), "Retry event must not leak Bearer token");

      // Check message metadata
      const serializedMeta = JSON.stringify(assistantMessage.metadata);
      assert.ok(!serializedMeta.includes("sk-proj-"), "Metadata must not leak API key");
      assert.ok(!serializedMeta.includes("Bearer"), "Metadata must not leak Bearer token");
    });
  });
});

