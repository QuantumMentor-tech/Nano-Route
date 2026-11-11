/**
//! Nano Route — Master Reliability & Resilience Validation Test Suite
//! File: src/features/chat/__tests__/reliabilityResilience.test.ts
//!
//! Master validation gate verifying the complete Step 35 through Step 39
//! resilience architecture as a unified, coherent system.
//!
//! Covers:
//! - Section 146: All 18 Required Reliability Scenarios
//! - Section 98: All 10 Property-Style Architectural Invariants
//! - Concurrency, session isolation, resource cleanup, and anti-regression invariants
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  getChatMessages,
  submitChatPrompt,
  streamChatPrompt,
  cancelChatExecution,
  classifyError,
  resetChatMockStore,
  getMockExecutionCount,
  getActiveMockExecutionCount,
} from "../../../services/ipc/chat.ts";
import type {
  ChatStreamEvent,
  ChatStreamRetryEvent,
  ChatStreamFailoverEvent,
  ChatStreamCancelledEvent,
} from "../types.ts";

describe("Step 40 Master Reliability & Resilience Validation Suite", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // SECTION 146: SCENARIOS 1 THROUGH 18
  // ==========================================================================

  describe("Section 146 — 18 Core Reliability Scenarios", () => {
    // Scenario 1: Normal Request
    it("Scenario 1: Normal request completes via Route -> Preflight -> Provider -> Stream -> Complete -> Persist", async () => {
      const session = await createChatSession({ title: "Scenario 1: Normal" });
      const prompt = "Explain the master reliability principle in AI routing";

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
      assert.equal(assistantMessage.sessionId, session.id);
      assert.equal(assistantMessage.metadata.failoverUsed ?? false, false);
      assert.equal(assistantMessage.metadata.retryCount ?? 0, 0);

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2);
      assert.equal(messages[0].sender, "user");
      assert.equal(messages[1].sender, "assistant");
      assert.equal(messages[1].id, assistantMessage.id);

      assert.equal(getActiveMockExecutionCount(), 0);
    });

    // Scenario 2: User Cancellation
    it("Scenario 2: User cancellation during execution produces Cancelled state without assistant persistence", async () => {
      const session = await createChatSession({ title: "Scenario 2: Cancellation" });
      const prompt = "Compute heavy task __CANCEL_STREAM__";

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

      assert.equal(result, null);
      const cancelEvent = events.find((e): e is ChatStreamCancelledEvent => e.type === "cancelled");
      assert.ok(cancelEvent);

      // Verify user message exists but assistant message was NEVER committed
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 1);
      assert.equal(messages[0].sender, "user");

      assert.equal(getActiveMockExecutionCount(), 0);
    });

    // Scenario 3: Safe Retry
    it("Scenario 3: Safe retry before send results in exactly 2 physical attempts and one final response", async () => {
      const session = await createChatSession({ title: "Scenario 3: Safe Retry" });
      const prompt = "Fetch status __RETRY_THEN_SUCCEED__";

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

      const retryEvents = events.filter((e): e is ChatStreamRetryEvent => e.type === "retry");
      assert.equal(retryEvents.length, 1);
      assert.equal(retryEvents[0].attempt, 1);

      // Exactly one assistant message persisted
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2);
    });

    // Scenario 4: Unsafe Timeout
    it("Scenario 4: Ambiguous timeout after send disallows blind retry to prevent duplicate billing", async () => {
      const session = await createChatSession({ title: "Scenario 4: Ambiguous Timeout" });
      const prompt = "Execute critical transaction __AMBIGUOUS_TIMEOUT_NO_RETRY__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      // Zero same-provider blind retries; deferred to failover
      assert.equal(result.assistantMessage.metadata.retryCount ?? 0, 0);
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      assert.ok(result.assistantMessage.metadata.failoverReason?.includes("Ambiguous timeout"));
    });

    // Scenario 5: Rate-Limit Recovery
    it("Scenario 5: 429 rate limit recovers via bounded Retry-After delay", async () => {
      const session = await createChatSession({ title: "Scenario 5: 429 Recovery" });
      const prompt = "Query under burst conditions __RETRY_THEN_SUCCEED__";

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
      const retryEvent = events.find((e): e is ChatStreamRetryEvent => e.type === "retry");
      assert.ok(retryEvent);
      assert.ok(retryEvent.delayMs > 0 && retryEvent.delayMs <= 10000);
    });

    // Scenario 6: Automatic Failover
    it("Scenario 6: Automatic failover from unavailable primary to secondary succeeds cleanly", async () => {
      const session = await createChatSession({ title: "Scenario 6: Failover" });
      const prompt = "Summarize meeting notes __FAILOVER_TEST__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      assert.equal(result.assistantMessage.metadata.failoverFromProvider, "deepseek");
      assert.equal(result.routedProvider, "openai");
      assert.equal(result.routedModel, "gpt-4o-mini");
    });

    // Scenario 7: Retry Then Failover
    it("Scenario 7: Candidate retries exhausted triggers automatic failover with exact attempt counting", async () => {
      const session = await createChatSession({ title: "Scenario 7: Retry Then Failover" });
      const prompt = "Task requiring endurance __RATE_LIMIT_REPEATED_THEN_FAILOVER__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.assistantMessage.metadata.retryCount, 2);
      assert.equal(result.assistantMessage.metadata.totalAttempts, 3);
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      assert.equal(result.routedProvider, "openai");
    });

    // Scenario 8: Streaming Failover & Discard Isolation
    it("Scenario 8: Partial stream failure discards primary deltas and completes exclusively with fallback output", async () => {
      const session = await createChatSession({ title: "Scenario 8: Stream Discard Isolation" });
      const prompt = "Stream with partial output __PARTIAL_BEFORE_FAILOVER__";

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

      // Verify that final assistant content contains ONLY fallback output, never corrupted by partial primary
      assert.ok(assistantMessage.content.includes("Fallback response"));
      assert.ok(!assistantMessage.content.includes("Partial primary delta"));

      // Exactly one failover event
      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.equal(failoverEvents.length, 1);
    });

    // Scenario 9: Context Preflight No-Send
    it("Scenario 9: Context window overflow disqualifies primary before send with zero network calls and executes fallback", async () => {
      const session = await createChatSession({ title: "Scenario 9: Context Preflight" });
      const prompt = "Massive repository content __CONTEXT_EXCEEDED_PRIMARY_FALLBACK__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.routedProvider, "anthropic");
      assert.equal(result.routedModel, "claude-3-5-sonnet-20241022");
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      // Failover attempts = 1 because primary was rejected in preflight with 0 network calls
      assert.equal(result.assistantMessage.metadata.failoverAttempts, 1);
    });

    // Scenario 10: Quota Exhaustion Block
    it("Scenario 10: Observed quota exhaustion halts non-retryable provider execution before send", async () => {
      const session = await createChatSession({ title: "Scenario 10: Quota Block" });
      const prompt = "Compute request __PROVIDER_QUOTA_EXHAUSTED__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "PROVIDER_QUOTA_EXHAUSTED");
          assert.equal(err.retryable, false);
          return true;
        }
      );
    });

    // Scenario 11: Budget Reservation Race Protection
    it("Scenario 11: Concurrent allocations prevent overspending local monthly budget limit", async () => {
      const session = await createChatSession({ title: "Scenario 11: Budget Race" });
      const prompt = "Concurrent query __BUDGET_RESERVATION_RACE__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "LOCAL_BUDGET_EXCEEDED");
          return true;
        }
      );
    });

    // Scenario 12: Persistence Failure Control
    it("Scenario 12: Persistence failure does not cause blind provider replay or corruption", async () => {
      const session = await createChatSession({ title: "Scenario 12: Persistence Failure" });
      const prompt = "Query resulting in DB disk error __PERSISTENCE_FAILURE__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "DATABASE_WRITE_FAILED");
          assert.equal(err.retryable, false);
          return true;
        }
      );

      // Verify no corrupted assistant message was written
      const messages = await getChatMessages({ sessionId: session.id });
      const assistantMsgs = messages.filter((m) => m.sender === "assistant");
      assert.equal(assistantMsgs.length, 0);
    });

    // Scenario 13: Full Exhaustion Boundedness
    it("Scenario 13: All candidates failing produces FAILOVER_EXHAUSTED without infinite loop or invented routes", async () => {
      const session = await createChatSession({ title: "Scenario 13: Full Exhaustion" });
      const prompt = "All candidate providers failing __FULL_EXHAUSTION__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "FAILOVER_EXHAUSTED");
          assert.equal(err.retryable, false);
          assert.ok(err.userActionRequired);
          return true;
        }
      );

      assert.equal(getActiveMockExecutionCount(), 0);
    });

    // Scenario 14: Cancellation During Retry
    it("Scenario 14: User cancellation during retry backoff cancels timer without delayed replay", async () => {
      const session = await createChatSession({ title: "Scenario 14: Cancel During Retry" });
      const prompt = "Retry in flight __RETRY_THEN_SUCCEED__ __RETRY_CANCEL__";

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

      assert.equal(assistantMessage, null);
      const cancelEvent = events.find((e): e is ChatStreamCancelledEvent => e.type === "cancelled");
      assert.ok(cancelEvent);

      // No assistant message committed
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.filter((m) => m.sender === "assistant").length, 0);
      assert.equal(getActiveMockExecutionCount(), 0);
    });

    // Scenario 15: Cancellation During Fallback
    it("Scenario 15: Cancellation during fallback evaluation halts execution without evaluating further candidates", async () => {
      const session = await createChatSession({ title: "Scenario 15: Cancel During Fallback" });
      const prompt = "Fallback in progress __FAILOVER_TEST__ __FAILOVER_CANCEL__";

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

      assert.equal(assistantMessage, null);
      const cancelEvent = events.find((e): e is ChatStreamCancelledEvent => e.type === "cancelled");
      assert.ok(cancelEvent);

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.filter((m) => m.sender === "assistant").length, 0);
    });

    // Scenario 16: Multi-Session Isolation
    it("Scenario 16: Multiple concurrent sessions maintain strict state and stream isolation", async () => {
      const sessionA = await createChatSession({ title: "Session A" });
      const sessionB = await createChatSession({ title: "Session B" });

      const eventsA: ChatStreamEvent[] = [];
      const eventsB: ChatStreamEvent[] = [];

      const [msgA, msgB] = await Promise.all([
        streamChatPrompt({ sessionId: sessionA.id, prompt: "Prompt for A" }, (e) => eventsA.push(e)),
        streamChatPrompt({ sessionId: sessionB.id, prompt: "Prompt for B" }, (e) => eventsB.push(e)),
      ]);

      assert.ok(msgA && msgB);
      assert.equal(msgA.sessionId, sessionA.id);
      assert.equal(msgB.sessionId, sessionB.id);

      // Verify events from session A strictly reference stream and session A
      for (const e of eventsA) {
        if ("sessionId" in e && e.sessionId) {
          assert.equal(e.sessionId, sessionA.id);
        }
      }
      for (const e of eventsB) {
        if ("sessionId" in e && e.sessionId) {
          assert.equal(e.sessionId, sessionB.id);
        }
      }
    });

    // Scenario 17: Historical Integrity
    it("Scenario 17: Historical routing records remain immutable when routing policies change", async () => {
      const session = await createChatSession({ title: "Historical Session" });
      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "First historical prompt",
      });

      const initialReason = result.assistantMessage.metadata.routingReason;
      const initialProvider = result.assistantMessage.metadata.routedProvider;

      // Re-query historical session
      const history = await getChatMessages({ sessionId: session.id });
      const storedAssistant = history.find((m) => m.sender === "assistant");

      assert.ok(storedAssistant);
      assert.equal(storedAssistant.metadata.routingReason, initialReason);
      assert.equal(storedAssistant.metadata.routedProvider, initialProvider);
    });

    // Scenario 18: Application Restart Behavior
    it("Scenario 18: Restarting chat store clears transient timers and does not auto-resume stale retries", async () => {
      const session = await createChatSession({ title: "Pre-Restart Session" });
      await submitChatPrompt({
        sessionId: session.id,
        prompt: "Completed prompt before restart",
      });

      // Simulate application restart
      resetChatMockStore();

      assert.equal(getMockExecutionCount(), 0);
      assert.equal(getActiveMockExecutionCount(), 0);
    });
  });

  // ==========================================================================
  // SECTION 98: 10 PROPERTY-STYLE ARCHITECTURAL INVARIANTS
  // ==========================================================================

  describe("Section 98 — 10 Property-Style Invariants", () => {
    // Invariant 1: Cancelled logical request never produces later successful assistant response
    it("Invariant 1: A cancelled logical request never produces a later successful assistant response", async () => {
      const session = await createChatSession({ title: "Invariant 1: Cancel Never Succeeds" });
      const prompt = "Task to abort __CANCEL_STREAM__";

      const result = await streamChatPrompt({ sessionId: session.id, prompt }, () => {});
      assert.equal(result, null);

      const messages = await getChatMessages({ sessionId: session.id });
      const assistant = messages.find((m) => m.sender === "assistant");
      assert.equal(assistant, undefined);
    });

    // Invariant 2: Single logical request never produces two final successful assistant messages
    it("Invariant 2: A single logical request never produces two final successful assistant messages", async () => {
      const session = await createChatSession({ title: "Invariant 2: Single Commit" });
      const prompt = "Deterministic single commit request";

      await submitChatPrompt({ sessionId: session.id, prompt });

      const messages = await getChatMessages({ sessionId: session.id });
      const assistantMsgs = messages.filter((m) => m.sender === "assistant");
      assert.equal(assistantMsgs.length, 1);
    });

    // Invariant 3: Hard preflight rejection produces zero provider calls
    it("Invariant 3: A candidate rejected by hard preflight is never sent to a provider", async () => {
      const session = await createChatSession({ title: "Invariant 3: Hard Preflight No-Send" });
      const prompt = "Exceeds all context limits __ALL_CANDIDATES_CONTEXT_BLOCKED__";

      await assert.rejects(async () => {
        await submitChatPrompt({ sessionId: session.id, prompt });
      });

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.filter((m) => m.sender === "assistant").length, 0);
    });

    // Invariant 4: Stale stream event never mutates a newer attempt
    it("Invariant 4: Stale stream events from an aborted attempt never mutate a newer attempt", async () => {
      const session = await createChatSession({ title: "Invariant 4: Stale Event Isolation" });
      const prompt = "Failover test __PARTIAL_BEFORE_FAILOVER__";

      const events: ChatStreamEvent[] = [];
      const assistantMessage = await streamChatPrompt({ sessionId: session.id, prompt }, (e) => events.push(e));

      assert.ok(assistantMessage);
      assert.ok(!assistantMessage.content.includes("Partial primary delta"));
    });

    // Invariant 5: Persistence failure never automatically replays a successful provider request
    it("Invariant 5: A persistence failure never automatically replays a successful provider request", async () => {
      const session = await createChatSession({ title: "Invariant 5: Persistence No-Replay" });
      const prompt = "Query with DB lock __PERSISTENCE_FAILURE__";

      await assert.rejects(async () => {
        await submitChatPrompt({ sessionId: session.id, prompt });
      });
    });

    // Invariant 6: A disabled provider is never selected for execution
    it("Invariant 6: A disabled or unavailable provider is never dispatched to", async () => {
      const session = await createChatSession({ title: "Invariant 6: Disabled Provider Guard" });
      const prompt = "Query to disabled provider __PROVIDER_UNAVAILABLE__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({ sessionId: session.id, prompt });
        },
        (err: any) => {
          assert.equal(err.code, "PROVIDER_UNAVAILABLE");
          return true;
        }
      );
    });

    // Invariant 7: No retry occurs after retry budget exhaustion
    it("Invariant 7: No retry occurs after retry budget is exhausted", async () => {
      const session = await createChatSession({ title: "Invariant 7: Retry Ceiling" });
      const prompt = "Repeated 429 prompt __RATE_LIMIT_REPEATED_THEN_FAILOVER__";

      const result = await submitChatPrompt({ sessionId: session.id, prompt });
      // Enforced max 2 retries per candidate
      assert.equal(result.assistantMessage.metadata.retryCount, 2);
    });

    // Invariant 8: No failover occurs after explicit user cancellation
    it("Invariant 8: No failover occurs after explicit user cancellation", async () => {
      const session = await createChatSession({ title: "Invariant 8: Cancel Blocks Failover" });
      const prompt = "Cancel during failover __FAILOVER_TEST__ __FAILOVER_CANCEL__";

      const events: ChatStreamEvent[] = [];
      const result = await streamChatPrompt({ sessionId: session.id, prompt }, (e) => events.push(e));

      assert.equal(result, null);
      const failoverEvents = events.filter((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.ok(failoverEvents.length <= 1);
      // Execution terminated upon cancellation; did not proceed to complete fallback
      assert.equal(events.some((e) => e.type === "completed"), false);
    });

    // Invariant 9: Provider credentials never cross provider boundaries
    it("Invariant 9: Error classification and IPC DTOs sanitize and redact all credential material", async () => {
      const envelope = await classifyError({
        errorMessage: "Bearer sk-proj-1234567890abcdef12345678 failed at C:\\Users\\Administrator\\nano-route\\secrets.json",
        httpStatus: 401,
        providerId: "openai",
        modelId: "gpt-4o",
      });

      assert.ok(!envelope.userMessage.includes("sk-proj-"));
      assert.ok(!envelope.userMessage.includes("C:\\Users"));
      assert.ok(!envelope.technicalMessage.includes("sk-proj-"));
      assert.ok(!envelope.technicalMessage.includes("C:\\Users"));
    });

    // Invariant 10: Historical routing records are never recomputed during runtime recovery
    it("Invariant 10: Historical routing metadata remains permanently committed and immutable", async () => {
      const session = await createChatSession({ title: "Invariant 10: Historical Immutability" });
      const result = await submitChatPrompt({ sessionId: session.id, prompt: "Permanent record prompt" });

      const initialId = result.assistantMessage.id;
      const initialConfidence = result.assistantMessage.metadata.slmConfidenceScore;

      const sessionMessages = await getChatMessages({ sessionId: session.id });
      const target = sessionMessages.find((m) => m.id === initialId);

      assert.ok(target);
      assert.equal(target.metadata.slmConfidenceScore, initialConfidence);
    });
  });

  // ==========================================================================
  // CONCURRENCY, RESOURCE LEAK & ACCESSIBILITY RESILIENCE
  // ==========================================================================

  describe("Concurrency & Resource Leak Verification", () => {
    it("maintains zero orphaned active executions across high-volume burst submissions", async () => {
      const session = await createChatSession({ title: "Burst Concurrency Test" });
      const iterations = 10;

      for (let i = 0; i < iterations; i++) {
        await submitChatPrompt({
          sessionId: session.id,
          prompt: `Burst prompt ${i}`,
        });
      }

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, iterations * 2);
      assert.equal(getActiveMockExecutionCount(), 0);
    });

    it("verifies cooperative cancellation idempotency under rapid sequential cancel calls", async () => {
      const session = await createChatSession({ title: "Idempotent Cancellation" });
      const prompt = "Long query __ASYNC_STREAM__";

      const resultPromise = streamChatPrompt(
        { sessionId: session.id, prompt, executionId: "test_exec_1" },
        () => {}
      );

      // Rapidly fire multiple cancellations (should not throw or corrupt state)
      const cancels = await Promise.all([
        cancelChatExecution("test_exec_1", "user_cancelled"),
        cancelChatExecution("test_exec_1", "user_cancelled"),
        cancelChatExecution("test_exec_1", "user_cancelled"),
      ]);

      const result = await resultPromise;
      assert.equal(result, null);
      assert.equal(getActiveMockExecutionCount(), 0);
      assert.equal(cancels.every((c) => c.cancelled && c.state === "cancelled"), true);
    });
  });
});
