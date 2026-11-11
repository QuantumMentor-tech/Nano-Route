/**
//! Nano Route — Automatic Failover & Fallback Execution Engine Test Suite
//! File: src/features/chat/__tests__/automaticFailover.test.ts
//!
//! Validates Step 37: Automatic Failover across pre-ranked Step 30 candidates,
//! bounded attempts, stream isolation, partial text discarding, manual override
//! strictness, cancellation precedence, single SQLite write contract, and
//! credential protection invariants.
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
  ChatStreamFailoverEvent,
  ChatStreamCompletedEvent,
  ChatStreamFailedEvent,
  ChatStreamCancelledEvent,
} from "../types.ts";

describe("Step 37 Automatic Failover & Fallback Execution Engine", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // 1. Primary Success Path (No Failover Invariant)
  // ==========================================================================
  describe("1. Primary Success — No Failover Contract", () => {
    it("completes primary route without emitting failover events when primary succeeds", async () => {
      const session = await createChatSession({ title: "Primary Success Session" });
      const prompt = "Explain determinism in SLM routing";

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
      assert.ok(!assistantMessage.metadata.failoverFromProvider);

      // Verify no failover events were emitted
      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.equal(failoverEvents.length, 0);

      // Verify exactly 1 user and 1 assistant message in SQLite
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2);
      assert.equal(messages[0].sender, "user");
      assert.equal(messages[1].sender, "assistant");
      assert.equal(messages[1].metadata.failoverUsed ?? false, false);
    });
  });

  // ==========================================================================
  // 2. Non-Streaming Automatic Failover Execution
  // ==========================================================================
  describe("2. Non-Streaming Prompt Submission Failover", () => {
    it("automatically fails over to secondary candidate on primary 429 rate limit and records failover metadata", async () => {
      const session = await createChatSession({ title: "Non-streaming Failover Session" });
      const prompt = "Please process this request with failover test __FAILOVER_TEST__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.ok(result);
      assert.equal(result.routedProvider, "openai");
      assert.equal(result.routedModel, "gpt-4o-mini");
      assert.equal(result.selectionMode, "fallback");

      // Verify assistant message metadata
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      assert.equal(result.assistantMessage.metadata.failoverFromProvider, "deepseek");
      assert.equal(result.assistantMessage.metadata.failoverFromModel, "deepseek-chat");
      assert.equal(result.assistantMessage.metadata.failoverAttempts, 2);
      assert.ok(result.assistantMessage.metadata.failoverReason?.includes("429"));

      // Exactly one user and one assistant message persisted in database
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2);
      assert.equal(messages[1].id, result.assistantMessage.id);
      assert.equal(messages[1].metadata.failoverUsed, true);
    });
  });

  // ==========================================================================
  // 3. Streaming Automatic Failover & Stream Isolation
  // ==========================================================================
  describe("3. Streaming Failover & Discard Isolation Contract", () => {
    it("emits failover event, starts fresh isolated stream, discards primary deltas, and completes cleanly", async () => {
      const session = await createChatSession({ title: "Streaming Failover Session" });
      const prompt = "Streaming query with __FAILOVER_TEST__ and __PARTIAL_BEFORE_FAILOVER__";

      const events: ChatStreamEvent[] = [];
      let activeStreamId = "";
      let accumulatedText = "";

      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);

          if (event.type === "started") {
            activeStreamId = event.streamId;
            // When a new stream starts (e.g. fallback), reset accumulated buffer
            accumulatedText = "";
          } else if (event.type === "failover") {
            // Discard any text accumulated from primary failed attempt
            accumulatedText = "";
          } else if (event.type === "delta") {
            // Only accumulate deltas belonging to the active stream
            if (event.streamId === activeStreamId) {
              accumulatedText += event.text;
            }
          }
        }
      );

      assert.ok(assistantMessage);

      // Verify event sequence:
      // 1. Started (primary)
      // 2. Delta (primary partial)
      // 3. Failover
      // 4. Started (fallback, sequence 0)
      // 5. Delta (fallback)
      // 6. Usage (fallback)
      // 7. Completed (fallback)
      const failoverEvent = events.find((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.ok(failoverEvent, "Expected failover event to be emitted");
      assert.equal(failoverEvent.fromProvider, "deepseek");
      assert.equal(failoverEvent.fromModel, "deepseek-chat");
      assert.equal(failoverEvent.toProvider, "openai");
      assert.equal(failoverEvent.toModel, "gpt-4o-mini");
      assert.equal(failoverEvent.attempt, 2);
      assert.ok(failoverEvent.newStreamId.startsWith("strm_fallback_"));

      const startedEvents = events.filter((e): e is ChatStreamStartedEvent => e.type === "started");
      assert.equal(startedEvents.length, 2, "Expected primary Started and fallback Started events");
      assert.equal(startedEvents[0].providerId, "deepseek");
      assert.equal(startedEvents[1].providerId, "openai");
      assert.equal(startedEvents[1].sequence, 0, "Fallback stream must restart sequence at 0");
      assert.equal(startedEvents[1].streamId, failoverEvent.newStreamId);

      // Completed event matches the fallback stream
      const completed = events.find((e): e is ChatStreamCompletedEvent => e.type === "completed");
      assert.ok(completed);
      assert.equal(completed.streamId, failoverEvent.newStreamId);

      // Assistant message content contains only fallback response, not primary partial text
      assert.ok(!assistantMessage.content.includes("Partial text from primary model"));
      assert.ok(assistantMessage.content.startsWith("Fallback response from"));
      assert.equal(assistantMessage.metadata.failoverUsed, true);
      assert.equal(assistantMessage.metadata.failoverFromProvider, "deepseek");

      // Verify database state: exactly 2 messages
      const stored = await getChatMessages({ sessionId: session.id });
      assert.equal(stored.length, 2);
      assert.equal(stored[1].content, assistantMessage.content);
    });
  });

  // ==========================================================================
  // 4. Manual Route Override Strictly Disallows Failover
  // ==========================================================================
  describe("4. Manual Override Invariant", () => {
    it("strictly disallows automatic failover when user specified manual override", async () => {
      const session = await createChatSession({ title: "Manual Override Failover Protection" });
      const prompt = "Manual override test prompt __FAILOVER_TEST__";

      // Non-streaming check
      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
            manualOverride: {
              providerId: "anthropic",
              modelId: "claude-3-5-sonnet",
            },
          });
        },
        (err: any) => {
          assert.equal(err.code, "PROVIDER_RATE_LIMIT");
          return true;
        }
      );

      // Verify no assistant message was persisted
      const messagesAfterSubmit = await getChatMessages({ sessionId: session.id });
      assert.equal(messagesAfterSubmit.length, 1);
      assert.equal(messagesAfterSubmit[0].sender, "user");

      // Streaming check
      const events: ChatStreamEvent[] = [];
      await assert.rejects(
        async () => {
          await streamChatPrompt(
            {
              sessionId: session.id,
              prompt,
              manualOverride: {
                providerId: "anthropic",
                modelId: "claude-3-5-sonnet",
              },
            },
            (event) => {
              events.push(event);
            }
          );
        },
        (err: any) => {
          assert.equal(err.code, "PROVIDER_RATE_LIMIT");
          return true;
        }
      );

      // Zero failover events emitted
      const failoverEvents = events.filter((e) => e.type === "failover");
      assert.equal(failoverEvents.length, 0);

      // Terminal event was failed
      const failed = events.find((e): e is ChatStreamFailedEvent => e.type === "failed");
      assert.ok(failed);
      assert.equal(failed.code, "PROVIDER_RATE_LIMIT");
    });
  });

  // ==========================================================================
  // 5. Failover Candidate Exhaustion
  // ==========================================================================
  describe("5. Bounded Candidate Exhaustion", () => {
    it("terminates with FAILOVER_EXHAUSTED when all candidates fail without infinite looping", async () => {
      const session = await createChatSession({ title: "Failover Exhausted Session" });
      const prompt = "Exhaust all fallbacks __FAILOVER_EXHAUSTED__";

      // Non-streaming exhaustion
      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "FAILOVER_EXHAUSTED");
          return true;
        }
      );

      // Streaming exhaustion
      const events: ChatStreamEvent[] = [];
      await assert.rejects(
        async () => {
          await streamChatPrompt(
            {
              sessionId: session.id,
              prompt,
            },
            (event) => {
              events.push(event);
            }
          );
        },
        (err: any) => {
          assert.equal(err.code, "FAILOVER_EXHAUSTED");
          return true;
        }
      );

      const failedEvent = events.find((e): e is ChatStreamFailedEvent => e.type === "failed");
      assert.ok(failedEvent);
      assert.equal(failedEvent.code, "FAILOVER_EXHAUSTED");

      // Database has user messages, but ZERO assistant messages
      const messages = await getChatMessages({ sessionId: session.id });
      assert.ok(messages.length >= 1);
      assert.ok(messages.every((m) => m.sender === "user"));
    });
  });

  // ==========================================================================
  // 6. Cancellation Precedence During Failover
  // ==========================================================================
  describe("6. Cancellation Precedence During Failover", () => {
    it("halts immediately on cancellation during failover without executing further fallbacks", async () => {
      const session = await createChatSession({ title: "Cancel During Failover" });
      const prompt = "Cancel during failover __FAILOVER_TEST__ __FAILOVER_CANCEL__";

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

      assert.equal(result, null, "Cancelled stream must resolve with null");

      const failoverEvent = events.find((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.ok(failoverEvent, "Failover event was emitted before cancellation");

      const cancelEvent = events.find((e): e is ChatStreamCancelledEvent => e.type === "cancelled");
      assert.ok(cancelEvent, "Stream cancelled event must be emitted");
      assert.equal(cancelEvent.streamId, failoverEvent.newStreamId);

      // Zero assistant messages in database
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 1);
      assert.equal(messages[0].sender, "user");
    });
  });

  // ==========================================================================
  // 7. Security & Credential Redaction Invariants
  // ==========================================================================
  describe("7. Security & Credential Redaction Invariants", () => {
    it("ensures failover events and message metadata contain zero credential material or unredacted keys", async () => {
      const session = await createChatSession({ title: "Security Invariants" });
      const prompt = "Prompt for failover with sensitive header context __FAILOVER_TEST__";

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

      // Verify failover event was emitted and does not leak secrets
      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.equal(failoverEvents.length, 1);
      const failoverSerialized = JSON.stringify(failoverEvents[0]);
      assert.ok(!failoverSerialized.includes("sk-"));
      assert.ok(!failoverSerialized.includes("Bearer"));

      // Check metadata does not contain raw API keys or file paths
      const serializedMeta = JSON.stringify(assistantMessage.metadata);
      assert.ok(!serializedMeta.includes("sk-"));
      assert.ok(!serializedMeta.includes("Bearer"));
      assert.ok(!serializedMeta.includes("C:\\Users\\"));
    });
  });
});
