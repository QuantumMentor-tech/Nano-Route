/**
//! Nano Route — Chat Streaming Response Engine Test Suite
//! File: src/features/chat/__tests__/chatStreaming.test.ts
//!
//! Validates Step 33: Live streaming transport, Tauri v2 Channel contracts,
//! monotonic sequence ordering, single-write database persistence on completion,
//! failure resilience without partial persistence, and session isolation.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  getChatMessages,
  listChatSessions,
  streamChatPrompt,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import type {
  ChatStreamEvent,
  ChatStreamStartedEvent,
  ChatStreamDeltaEvent,
  ChatStreamUsageEvent,
  ChatStreamCompletedEvent,
  ChatStreamFailedEvent,
} from "../types.ts";

describe("Step 33 Streaming Response Engine & Live Chat Transport", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // 1. Live Stream Protocol & Sequence Ordering
  // ==========================================================================
  describe("End-to-End Live Stream Delivery", () => {
    it("delivers Started, ordered Deltas, Usage, and Completed events with monotonic sequence numbers", async () => {
      const session = await createChatSession({ title: "Live Streaming Test" });
      const prompt = "Explain the benefits of streaming AI responses in desktop UI.";

      const events: ChatStreamEvent[] = [];
      let accumulatedText = "";

      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        (event) => {
          events.push(event);
          if (event.type === "delta") {
            accumulatedText += event.text;
          }
        }
      );

      // Verify at least Started, multiple Deltas, Usage, and Completed were received
      assert.ok(events.length >= 4, `Expected at least 4 events, got ${events.length}`);

      // 1. Started Event
      const started = events[0] as ChatStreamStartedEvent;
      assert.equal(started.type, "started");
      assert.equal(started.sequence, 0);
      assert.ok(started.streamId.startsWith("strm_"));
      assert.equal(started.sessionId, session.id);
      assert.ok(started.userMessageId);
      assert.ok(started.providerId);
      assert.ok(started.modelId);
      assert.equal(started.selectionMode, "automatic");
      assert.ok(started.routingReason.length > 0);
      assert.ok(started.timestampMs > 0);

      // 2. Monotonic sequence ordering across all events
      for (let i = 0; i < events.length; i++) {
        assert.equal(events[i].sequence, i, `Event at index ${i} has unexpected sequence ${events[i].sequence}`);
      }

      // 3. Deltas exist and accumulate into complete text
      assert.ok(assistantMessage);
      const deltas = events.filter((e): e is ChatStreamDeltaEvent => e.type === "delta");
      assert.ok(deltas.length >= 2, `Expected multiple delta chunks, got ${deltas.length}`);
      assert.equal(accumulatedText, assistantMessage.content);

      // 4. Usage Event exists
      const usageEvents = events.filter((e): e is ChatStreamUsageEvent => e.type === "usage");
      assert.equal(usageEvents.length, 1);
      assert.ok(usageEvents[0].promptTokens > 0);
      assert.ok(usageEvents[0].completionTokens > 0);

      // 5. Terminal Completed Event
      const completed = events[events.length - 1] as ChatStreamCompletedEvent;
      assert.equal(completed.type, "completed");
      assert.equal(completed.streamId, started.streamId);
      assert.equal(completed.finishReason, "stop");
      assert.ok(completed.latencyMs > 0);
      assert.ok(completed.promptTokens > 0);
      assert.ok(completed.completionTokens > 0);
      assert.equal(completed.assistantMessage.id, assistantMessage.id);
      assert.equal(completed.assistantMessage.content, accumulatedText);
    });
  });

  // ==========================================================================
  // 2. Single Database Persistence Boundary (SQLite)
  // ==========================================================================
  describe("Single SQLite Write Persistence Contract", () => {
    it("persists user message before streaming and assistant message exactly once upon completion", async () => {
      const session = await createChatSession({ title: "Persistence Invariant Test" });
      const prompt = "Verify atomic single-write database persistence.";

      let userMsgIdDuringStream: string | null = null;
      let dbMessageCountDuringStream = 0;

      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt,
        },
        async (event) => {
          if (event.type === "started") {
            userMsgIdDuringStream = event.userMessageId;
            // Inspect database immediately after Started event: user message MUST already be persisted
            const msgs = await getChatMessages({ sessionId: session.id });
            dbMessageCountDuringStream = msgs.length;
          }
        }
      );

      // Verify that during streaming, ONLY the user message was in the database
      assert.ok(userMsgIdDuringStream);
      assert.equal(dbMessageCountDuringStream, 1);

      // Check database after stream completion: now exactly 2 messages (1 user, 1 assistant)
      const finalizedMessages = await getChatMessages({ sessionId: session.id });
      assert.equal(finalizedMessages.length, 2);

      const [persistedUser, persistedAssistant] = finalizedMessages;
      assert.ok(assistantMessage);
      assert.equal(persistedUser.sender, "user");
      assert.equal(persistedUser.content, prompt);

      assert.equal(persistedAssistant.sender, "assistant");
      assert.equal(persistedAssistant.id, assistantMessage.id);
      assert.equal(persistedAssistant.content, assistantMessage.content);

      // Verify metadata is completely populated in persisted record
      assert.ok(persistedAssistant.metadata.routedProvider);
      assert.ok(persistedAssistant.metadata.routedModel);
      assert.ok(persistedAssistant.metadata.routingReason);
      assert.ok(persistedAssistant.metadata.promptTokens > 0);
      assert.ok(persistedAssistant.metadata.completionTokens > 0);
      assert.ok(persistedAssistant.metadata.latencyMs >= 0);
    });

    it("updates session updatedAt timestamp upon stream completion", async () => {
      const session = await createChatSession({ title: "Timestamp Update Test" });
      const initialUpdatedAt = session.updatedAt;

      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt: "Check timestamp update.",
        },
        () => {}
      );

      const sessions = await listChatSessions({ limit: 10 });
      const found = sessions.find((s) => s.id === session.id);
      assert.ok(assistantMessage);
      assert.ok(found);
      assert.ok(found.updatedAt >= initialUpdatedAt);
      assert.equal(found.updatedAt, assistantMessage.createdAt);
    });
  });

  // ==========================================================================
  // 3. Failure Handling & Clean Degradation
  // ==========================================================================
  describe("Stream Failure Resilience", () => {
    it("handles provider stream error: retains user message in SQLite but NEVER persists assistant message", async () => {
      const session = await createChatSession({ title: "Failure Resilience Test" });
      const prompt = "This prompt will trigger __FAIL_STREAM__ in provider.";

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
        (err: Error) => {
          assert.ok(err.message.includes("Injected stream provider failure"));
          return true;
        }
      );

      // Started event was emitted
      assert.equal(events[0]?.type, "started");

      // Failed event was emitted with sequence number
      const failed = events.find((e): e is ChatStreamFailedEvent => e.type === "failed");
      assert.ok(failed, "Expected Failed event to be emitted");
      assert.equal(failed.code, "STREAM_PROVIDER_ERROR");
      assert.equal(failed.isRetryable, false);

      // Verify SQLite state: user message MUST be preserved, assistant message MUST NOT exist
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 1, "Only user message should be in database after stream failure");
      assert.equal(messages[0].sender, "user");
      assert.equal(messages[0].content, prompt);
    });
  });

  // ==========================================================================
  // 4. Manual Route Override
  // ==========================================================================
  describe("Manual Override in Streaming", () => {
    it("respects manual route override in stream Started event and persisted metadata", async () => {
      const session = await createChatSession({ title: "Manual Override Stream" });

      let startedEvent: ChatStreamStartedEvent | null = null;

      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt: "Testing manual override streaming.",
          manualOverride: {
            providerId: "anthropic",
            modelId: "claude-3-5-sonnet-20241022",
          },
        },
        (event) => {
          if (event.type === "started") {
            startedEvent = event;
          }
        }
      );

      assert.ok(startedEvent);
      const ev = startedEvent as ChatStreamStartedEvent;
      assert.equal(ev.providerId, "anthropic");
      assert.equal(ev.modelId, "claude-3-5-sonnet-20241022");
      assert.equal(ev.selectionMode, "manual_override");

      assert.ok(assistantMessage);
      assert.equal(assistantMessage.metadata.routedProvider, "anthropic");
      assert.equal(assistantMessage.metadata.routedModel, "claude-3-5-sonnet-20241022");
    });

    it("rejects invalid manual override before streaming deltas", async () => {
      const session = await createChatSession({ title: "Invalid Override Stream" });

      const events: ChatStreamEvent[] = [];

      await assert.rejects(
        async () => {
          await streamChatPrompt(
            {
              sessionId: session.id,
              prompt: "Testing invalid override.",
              manualOverride: {
                providerId: "invalid",
                modelId: "unknown",
              },
            },
            (event) => {
              events.push(event);
            }
          );
        },
        (err: Error) => {
          assert.ok(err.message.includes("Manual override rejected"));
          return true;
        }
      );

      // Failed event emitted, no deltas
      const deltas = events.filter((e) => e.type === "delta");
      assert.equal(deltas.length, 0);
    });
  });

  // ==========================================================================
  // 5. Session Isolation
  // ==========================================================================
  describe("Session Switching Isolation", () => {
    it("isolates streams strictly to their originating session", async () => {
      const sessionA = await createChatSession({ title: "Session A" });
      const sessionB = await createChatSession({ title: "Session B" });

      await streamChatPrompt(
        {
          sessionId: sessionA.id,
          prompt: "Prompt for Session A.",
        },
        () => {}
      );

      // Session A has 2 messages
      const msgsA = await getChatMessages({ sessionId: sessionA.id });
      assert.equal(msgsA.length, 2);

      // Session B has 0 messages (unpolluted)
      const msgsB = await getChatMessages({ sessionId: sessionB.id });
      assert.equal(msgsB.length, 0);
    });
  });

  // ==========================================================================
  // 6. Input Validation
  // ==========================================================================
  describe("Streaming Request Validation", () => {
    it("rejects empty prompt before streaming begins", async () => {
      const session = await createChatSession({ title: "Validation Test" });

      await assert.rejects(
        async () => {
          await streamChatPrompt(
            {
              sessionId: session.id,
              prompt: "   ",
            },
            () => {}
          );
        },
        (err: Error) => {
          assert.ok(err.message.includes("cannot be empty"));
          return true;
        }
      );
    });

    it("rejects non-existent session ID", async () => {
      await assert.rejects(
        async () => {
          await streamChatPrompt(
            {
              sessionId: "non-existent-session-id",
              prompt: "Valid prompt.",
            },
            () => {}
          );
        },
        (err: Error) => {
          assert.ok(err.message.includes("does not exist"));
          return true;
        }
      );
    });
  });
});
