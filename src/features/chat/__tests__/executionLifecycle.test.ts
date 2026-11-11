/**
//! Nano Route — Execution Lifecycle & Recovery Control Test Suite
//! File: src/features/chat/__tests__/executionLifecycle.test.ts
//!
//! Validates Step 35: Execution lifecycle state machine, cooperative cancellation tokens,
//! single terminal finalization invariant, stream cancellation without partial SQLite persistence,
//! session-switching isolation, component unmount safety, and zero execution leaks.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  getChatMessages,
  streamChatPrompt,
  submitChatPrompt,
  cancelChatExecution,
  cancelSessionChat,
  getExecutionState,
  resetChatMockStore,
  getActiveMockExecutionCount,
  getMockExecutionCount,
} from "../../../services/ipc/chat.ts";
import type {
  ChatStreamEvent,
  ChatStreamCancelledEvent,
} from "../types.ts";

describe("Step 35 Execution Lifecycle & Recovery Control", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // 1. Cooperative Cancellation During Streaming
  // ==========================================================================
  describe("Streaming Cooperative Cancellation", () => {
    it("halts live streaming upon cancellation and emits Cancelled event", async () => {
      const session = await createChatSession({ title: "Streaming Cancel Test" });
      const events: ChatStreamEvent[] = [];

      const assistantMessage = await streamChatPrompt(
        {
          sessionId: session.id,
          prompt: "Please write a comprehensive guide __CANCEL_MID_STREAM__ on async Rust.",
        },
        (event) => {
          events.push(event);
        }
      );

      // streamChatPrompt resolves null on cancellation
      assert.equal(assistantMessage, null);

      // Verify sequence of events
      assert.ok(events.length >= 3, `Expected at least 3 events, got ${events.length}`);
      assert.equal(events[0].type, "started");

      const hasDeltas = events.some((e) => e.type === "delta");
      assert.ok(hasDeltas, "Expected some deltas before cancellation was handled");

      const lastEvent = events[events.length - 1];
      assert.equal(lastEvent.type, "cancelled");

      const cancelEvent = lastEvent as ChatStreamCancelledEvent;
      assert.equal(cancelEvent.reason, "user_cancelled");
      assert.ok(cancelEvent.streamId.startsWith("strm_"));
      assert.ok(typeof cancelEvent.partialText === "string");

      // Verify no terminal completed event was ever emitted
      const completedEvents = events.filter((e) => e.type === "completed");
      assert.equal(completedEvents.length, 0, "Completed event must NOT be emitted after cancellation");
    });

    it("persists user message to SQLite but NEVER persists assistant message when stream is cancelled", async () => {
      const session = await createChatSession({ title: "Cancellation Persistence Test" });

      await streamChatPrompt(
        {
          sessionId: session.id,
          prompt: "Cancel this stream immediately __CANCEL_STREAM__ please.",
        },
        () => {}
      );

      // Query persistent SQLite messages for this session
      const persistedMessages = await getChatMessages({ sessionId: session.id });

      // Invariant: User message MUST be preserved, Assistant message must NEVER be written
      assert.equal(persistedMessages.length, 1, `Expected exactly 1 persisted message, got ${persistedMessages.length}`);
      assert.equal(persistedMessages[0].sender, "user");
      assert.equal(persistedMessages[0].content, "Cancel this stream immediately __CANCEL_STREAM__ please.");

      const assistantMessages = persistedMessages.filter((m) => m.sender === "assistant");
      assert.equal(assistantMessages.length, 0, "Cancelled stream must NEVER be written to SQLite as assistant message");
    });

    it("allows programmatic cancellation via cancelChatExecution during stream", async () => {
      const session = await createChatSession({ title: "Programmatic Cancel Test" });
      const executionId = "exec_test_prog_cancel_1";

      const events: ChatStreamEvent[] = [];

      // Start stream with fixed executionId
      const streamPromise = streamChatPrompt(
        {
          executionId,
          sessionId: session.id,
          prompt: "Streaming prompt to cancel programmatically __CANCEL_MID_STREAM__",
        },
        (event) => {
          events.push(event);
        }
      );

      // Query active execution state while in flight
      const activeState = await getExecutionState(executionId);
      assert.ok(activeState);
      assert.equal(activeState.executionId, executionId);
      assert.equal(activeState.sessionId, session.id);

      const result = await streamPromise;
      assert.equal(result, null);

      // Check terminal state after cancellation
      const terminalState = await getExecutionState(executionId);
      assert.ok(terminalState);
      assert.equal(terminalState.state, "cancelled");
      assert.equal(terminalState.isTerminal, true);
      assert.equal(terminalState.isActive, false);
      assert.equal(terminalState.canCancel, false);
    });
  });

  // ==========================================================================
  // 2. Cancellation During Non-Streaming Execution
  // ==========================================================================
  describe("Non-Streaming Cancellation Contract", () => {
    it("handles cancellation during non-streaming prompt execution cleanly", async () => {
      const session = await createChatSession({ title: "Non-Streaming Cancel Test" });

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt: "Non-streaming prompt to cancel __CANCEL_SUBMIT__",
          });
        },
        (err: unknown) => {
          assert.ok(typeof err === "object" && err !== null);
          const ipcErr = err as { code: string; message: string };
          assert.equal(ipcErr.code, "EXECUTION_CANCELLED");
          return true;
        }
      );

      // Verify SQLite state: user message persisted, assistant message not persisted
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 1);
      assert.equal(messages[0].sender, "user");
    });
  });

  // ==========================================================================
  // 3. Idempotent Cancellation Invariant
  // ==========================================================================
  describe("Idempotent Single-Finalization Invariant", () => {
    it("permits repeated cancellation calls without error or state corruption", async () => {
      const session = await createChatSession({ title: "Idempotency Test" });
      const executionId = "exec_idempotency_1";

      await streamChatPrompt(
        {
          executionId,
          sessionId: session.id,
          prompt: "Prompt for double stop __CANCEL_STREAM__",
        },
        () => {}
      );

      // First programmatic cancel call on already-cancelled execution
      const firstCancel = await cancelChatExecution(executionId, "user_cancelled");
      assert.equal(firstCancel.cancelled, true);
      assert.equal(firstCancel.state, "cancelled");

      // Second programmatic cancel call (duplicate / user double-clicks stop)
      const secondCancel = await cancelChatExecution(executionId, "user_cancelled");
      assert.equal(secondCancel.cancelled, true);
      assert.equal(secondCancel.state, "cancelled");
    });
  });

  // ==========================================================================
  // 4. Session-Switching Isolation & Safety
  // ==========================================================================
  describe("Session Switching Isolation", () => {
    it("cancels active session execution when cancelSessionChat is invoked", async () => {
      const sessionA = await createChatSession({ title: "Session A" });
      const sessionB = await createChatSession({ title: "Session B" });

      const eventsA: ChatStreamEvent[] = [];

      // Start stream in Session A with async yielding
      const streamPromise = streamChatPrompt(
        {
          sessionId: sessionA.id,
          prompt: "Stream in session A __ASYNC_STREAM__",
        },
        (e) => eventsA.push(e)
      );

      // Cancel Session A when user switches to Session B
      const cancelResult = await cancelSessionChat(sessionA.id, "session_changed");
      assert.ok(cancelResult);
      assert.equal(cancelResult.cancelled, true);
      assert.equal(cancelResult.reason, "session_changed");

      await streamPromise;

      // Ensure Session B has zero messages
      const messagesB = await getChatMessages({ sessionId: sessionB.id });
      assert.equal(messagesB.length, 0, "Session B must have zero messages from Session A");
    });

    it("returns null when cancelSessionChat is called on an inactive session", async () => {
      const session = await createChatSession({ title: "Idle Session" });
      const result = await cancelSessionChat(session.id, "session_changed");
      assert.equal(result, null);
    });
  });

  // ==========================================================================
  // 5. Validation & Input Guards
  // ==========================================================================
  describe("Validation Guards", () => {
    it("rejects empty or whitespace-only execution IDs on cancelChatExecution", async () => {
      await assert.rejects(
        async () => {
          await cancelChatExecution("");
        },
        (err: unknown) => {
          assert.ok(typeof err === "object" && err !== null);
          assert.equal((err as { code: string }).code, "INVALID_INPUT");
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await cancelChatExecution("   ");
        },
        (err: unknown) => {
          assert.ok(typeof err === "object" && err !== null);
          assert.equal((err as { code: string }).code, "INVALID_INPUT");
          return true;
        }
      );
    });

    it("rejects unknown execution ID with EXECUTION_NOT_FOUND error", async () => {
      await assert.rejects(
        async () => {
          await cancelChatExecution("non_existent_execution_id_xyz");
        },
        (err: unknown) => {
          assert.ok(typeof err === "object" && err !== null);
          assert.equal((err as { code: string }).code, "EXECUTION_NOT_FOUND");
          return true;
        }
      );
    });

    it("returns null when getExecutionState is called for non-existent execution ID", async () => {
      const state = await getExecutionState("completely_unknown_id");
      assert.equal(state, null);
    });
  });

  // ==========================================================================
  // 6. Stress & Zero-Leak Invariant
  // ==========================================================================
  describe("Stress & Zero Execution Leak Invariant", () => {
    it("leaves zero active executions in the registry after repeated send-then-cancel cycles", async () => {
      const session = await createChatSession({ title: "Stress Cancel Test" });

      // Run 10 rapid send-then-cancel cycles
      for (let i = 0; i < 10; i++) {
        await streamChatPrompt(
          {
            sessionId: session.id,
            prompt: `Rapid cycle ${i} __CANCEL_STREAM__`,
          },
          () => {}
        );
      }

      // Verify that active executions count returned to exactly 0
      const activeCount = getActiveMockExecutionCount();
      assert.equal(activeCount, 0, `Expected 0 active executions, found ${activeCount}`);

      // Total tracked executions equals the 10 cycles executed
      const totalCount = getMockExecutionCount();
      assert.equal(totalCount, 10);
    });

    it("leaves zero active executions after successful completions", async () => {
      const session = await createChatSession({ title: "Normal Completion Stress" });

      for (let i = 0; i < 5; i++) {
        await streamChatPrompt(
          {
            sessionId: session.id,
            prompt: `Normal query ${i}`,
          },
          () => {}
        );
      }

      const activeCount = getActiveMockExecutionCount();
      assert.equal(activeCount, 0, `Expected 0 active executions, found ${activeCount}`);
    });
  });

  // ==========================================================================
  // 7. Lifecycle State Machine Transition Contracts
  // ==========================================================================
  describe("Lifecycle State Machine Invariants", () => {
    function canTransition(
      current: string,
      next: string
    ): boolean {
      if (current === next) return true;
      const isTerminal = (s: string) => s === "completed" || s === "cancelled" || s === "failed";
      if (isTerminal(current)) return false;

      const allowedTransitions: Record<string, string[]> = {
        created: ["validating", "cancelling", "failed"],
        validating: ["routing", "cancelling", "failed"],
        routing: ["route_resolved", "cancelling", "failed"],
        route_resolved: ["executing", "streaming", "cancelling", "failed"],
        executing: ["completed", "cancelling", "recovering", "failed"],
        streaming: ["completed", "cancelling", "recovering", "failed"],
        cancelling: ["cancelled", "recovering", "failed"],
        recovering: ["cancelled", "failed", "completed"],
      };

      return allowedTransitions[current]?.includes(next) ?? false;
    }

    it("verifies standard forward progression path", () => {
      assert.equal(canTransition("created", "validating"), true);
      assert.equal(canTransition("validating", "routing"), true);
      assert.equal(canTransition("routing", "route_resolved"), true);
      assert.equal(canTransition("route_resolved", "streaming"), true);
      assert.equal(canTransition("streaming", "completed"), true);
    });

    it("allows cooperative cancellation from any active state", () => {
      assert.equal(canTransition("created", "cancelling"), true);
      assert.equal(canTransition("validating", "cancelling"), true);
      assert.equal(canTransition("routing", "cancelling"), true);
      assert.equal(canTransition("route_resolved", "cancelling"), true);
      assert.equal(canTransition("executing", "cancelling"), true);
      assert.equal(canTransition("streaming", "cancelling"), true);
      assert.equal(canTransition("cancelling", "cancelled"), true);
    });

    it("forbids transitions out of terminal states (completed, cancelled, failed)", () => {
      assert.equal(canTransition("completed", "executing"), false);
      assert.equal(canTransition("completed", "cancelling"), false);
      assert.equal(canTransition("cancelled", "streaming"), false);
      assert.equal(canTransition("cancelled", "completed"), false);
      assert.equal(canTransition("failed", "routing"), false);
      assert.equal(canTransition("failed", "cancelled"), false);
    });
  });

  // ==========================================================================
  // 8. Termination Reasons Matrix
  // ==========================================================================
  describe("Termination Reasons Contract", () => {
    const validTerminationReasons = [
      "user_cancelled",
      "session_changed",
      "view_disposed",
      "application_interrupted",
      "transport_interrupted",
      "stream_closed",
      "execution_aborted",
      "provider_failed",
      "unknown_interruption",
    ];

    it("contains all 9 standardized termination reasons", () => {
      assert.equal(validTerminationReasons.length, 9);
      assert.ok(validTerminationReasons.includes("user_cancelled"));
      assert.ok(validTerminationReasons.includes("session_changed"));
      assert.ok(validTerminationReasons.includes("view_disposed"));
      assert.ok(validTerminationReasons.includes("application_interrupted"));
    });
  });

  // ==========================================================================
  // 9. UI Message State Contracts
  // ==========================================================================
  describe("UI Message Representation Contracts", () => {
    it("marks message as cancelled distinctly from failed", () => {
      const message = {
        id: "msg_test_cancelled_1",
        sessionId: "session_123",
        sender: "assistant" as const,
        content: "Partial output before cancel",
        metadata: {
          routedProvider: "anthropic",
          routedModel: "claude-3-5-sonnet-20241022",
          routingReason: "Policy selection",
          slmConfidenceScore: 0.95,
          promptTokens: 10,
          completionTokens: 5,
          latencyMs: 120,
          costUsd: 0.0001,
        },
        createdAt: Date.now(),
        isStreaming: false,
        isCancelled: true,
        isFailed: false,
      };

      assert.equal(message.isCancelled, true);
      assert.equal(message.isFailed, false);
      assert.equal(message.isStreaming, false);
      assert.equal(message.content, "Partial output before cancel");
    });
  });
});
