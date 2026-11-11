/**
//! Nano Route — Chat Submission & Provider Execution Test Suite
//! File: src/features/chat/__tests__/chatSubmission.test.ts
//!
//! Validates Step 32 end-to-end prompt submission, routing pipeline invocation,
//! manual override validation, conversation context construction, persistence invariants,
//! and session race-condition isolation.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  getChatMessages,
  listChatSessions,
  submitChatPrompt,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";

describe("Step 32 Prompt Submission, Routing Pipeline & Provider Execution", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // 1. End-to-End Success Path
  // ==========================================================================
  describe("End-to-End Prompt Submission (Section 75)", () => {
    it("submits prompt, runs routing, executes provider, and returns complete response with metadata", async () => {
      const session = await createChatSession({ title: "End-to-End Routing Test" });

      const prompt = "Explain on-device SLM routing architecture in Nano Route.";
      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      // Assert submission result contracts
      assert.ok(result.requestId);
      assert.equal(result.sessionId, session.id);
      assert.equal(result.status, "completed");

      // Assert user message
      assert.ok(result.userMessage.id);
      assert.equal(result.userMessage.sender, "user");
      assert.equal(result.userMessage.content, prompt);
      assert.equal(result.userMessage.sessionId, session.id);

      // Assert assistant message
      assert.ok(result.assistantMessage.id);
      assert.equal(result.assistantMessage.sender, "assistant");
      assert.ok(result.assistantMessage.content.length > 0);
      assert.equal(result.assistantMessage.sessionId, session.id);

      // Assert authoritative routing metadata
      assert.ok(result.routedProvider);
      assert.ok(result.routedModel);
      assert.equal(result.selectionMode, "automatic");
      assert.ok(result.routingReason.length > 0);
      assert.ok(result.latencyMs >= 0);
      assert.ok(result.promptTokens > 0);
      assert.ok(result.completionTokens > 0);

      // Verify persistence in SQLite mock store
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2);
      assert.equal(messages[0].id, result.userMessage.id);
      assert.equal(messages[0].sender, "user");
      assert.equal(messages[1].id, result.assistantMessage.id);
      assert.equal(messages[1].sender, "assistant");
      assert.equal(messages[1].metadata.routedProvider, result.routedProvider);
      assert.equal(messages[1].metadata.routedModel, result.routedModel);
    });

    it("updates session updatedAt timestamp after successful submission", async () => {
      const session = await createChatSession({ title: "Timestamp Test" });
      const initialUpdatedAt = session.updatedAt;

      // Small delay to ensure timestamp delta
      await new Promise((r) => setTimeout(r, 5));

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Hello world",
      });

      assert.ok(result.assistantMessage.createdAt >= initialUpdatedAt);

      const sessions = await listChatSessions();
      const updatedSession = sessions.find((s) => s.id === session.id);
      assert.ok(updatedSession);
      assert.ok(updatedSession.updatedAt >= initialUpdatedAt);
    });
  });

  // ==========================================================================
  // 2. Request Validation Boundary (Sections 10, 11, 12)
  // ==========================================================================
  describe("Request Validation (Sections 10, 11, 12)", () => {
    it("rejects empty prompt before routing or provider execution", async () => {
      const session = await createChatSession({ title: "Validation Test" });

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt: "",
          });
        },
        (err: any) => {
          assert.equal(err.code, "INVALID_INPUT");
          return true;
        }
      );

      // Ensure no messages were persisted
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 0);
    });

    it("rejects whitespace-only prompt before provider execution", async () => {
      const session = await createChatSession({ title: "Validation Test" });

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt: "    \n\t   ",
          });
        },
        (err: any) => {
          assert.equal(err.code, "INVALID_INPUT");
          return true;
        }
      );

      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 0);
    });

    it("rejects prompt exceeding 32,768 characters", async () => {
      const session = await createChatSession({ title: "Length Limit Test" });
      const oversized = "a".repeat(32769);

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt: oversized,
          });
        },
        (err: any) => {
          assert.equal(err.code, "INVALID_INPUT");
          return true;
        }
      );
    });

    it("rejects submission targeting a non-existent session", async () => {
      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: "non_existent_session_id",
            prompt: "Valid prompt",
          });
        },
        (err: any) => {
          assert.equal(err.code, "NOT_FOUND");
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 3. Manual Override Validation & Execution (Sections 28, 66)
  // ==========================================================================
  describe("Manual Override Execution (Sections 28, 66)", () => {
    it("executes valid manual override and preserves selectionMode=manual_override", async () => {
      const session = await createChatSession({ title: "Manual Override Test" });

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Write a high-performance Rust sorting routine",
        manualOverride: {
          providerId: "groq",
          modelId: "llama-3.3-70b-versatile",
        },
      });

      assert.equal(result.selectionMode, "manual_override");
      assert.equal(result.routedProvider, "groq");
      assert.equal(result.routedModel, "llama-3.3-70b-versatile");
      assert.ok(result.routingReason.toLowerCase().includes("manual override"));
    });

    it("rejects invalid manual override targeting non-existent or invalid model", async () => {
      const session = await createChatSession({ title: "Invalid Override Test" });

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt: "Write code",
            manualOverride: {
              providerId: "invalid",
              modelId: "unknown",
            },
          });
        },
        (err: any) => {
          assert.equal(err.code, "INVALID_INPUT");
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // 4. Multi-Turn Context Assembly (Sections 25, 60, 61)
  // ==========================================================================
  describe("Multi-Turn Context Assembly (Sections 25, 60)", () => {
    it("preserves conversation turns in strict chronological order across turns", async () => {
      const session = await createChatSession({ title: "Multi-Turn Context" });

      // Turn 1
      const turn1 = await submitChatPrompt({
        sessionId: session.id,
        prompt: "First question",
      });
      assert.equal(turn1.userMessage.content, "First question");

      // Turn 2
      const turn2 = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Follow-up question",
      });
      assert.equal(turn2.userMessage.content, "Follow-up question");

      // Verify full conversation history
      const history = await getChatMessages({ sessionId: session.id });
      assert.equal(history.length, 4);
      assert.equal(history[0].content, "First question");
      assert.equal(history[0].sender, "user");
      assert.equal(history[1].sender, "assistant");
      assert.equal(history[2].content, "Follow-up question");
      assert.equal(history[2].sender, "user");
      assert.equal(history[3].sender, "assistant");

      // Assert chronological ordering: msg[0] <= msg[1] <= msg[2] <= msg[3]
      assert.ok(history[0].createdAt <= history[1].createdAt);
      assert.ok(history[1].createdAt <= history[2].createdAt);
      assert.ok(history[2].createdAt <= history[3].createdAt);
    });
  });

  // ==========================================================================
  // 5. Session Switching Race Condition Isolation (Sections 51, 86)
  // ==========================================================================
  describe("Session Switching Isolation (Sections 51, 86)", () => {
    it("isolates execution so results belong strictly to originating session", async () => {
      const sessionA = await createChatSession({ title: "Session A" });
      const sessionB = await createChatSession({ title: "Session B" });

      // Submit in Session A
      const resultA = await submitChatPrompt({
        sessionId: sessionA.id,
        prompt: "Query for Session A",
      });

      // Submit in Session B
      const resultB = await submitChatPrompt({
        sessionId: sessionB.id,
        prompt: "Query for Session B",
      });

      // Verify Session A has only Session A messages
      const msgsA = await getChatMessages({ sessionId: sessionA.id });
      assert.equal(msgsA.length, 2);
      assert.equal(msgsA[0].content, "Query for Session A");
      assert.equal(msgsA[1].id, resultA.assistantMessage.id);

      // Verify Session B has only Session B messages
      const msgsB = await getChatMessages({ sessionId: sessionB.id });
      assert.equal(msgsB.length, 2);
      assert.equal(msgsB[0].content, "Query for Session B");
      assert.equal(msgsB[1].id, resultB.assistantMessage.id);

      // Zero cross-talk
      assert.notEqual(resultA.assistantMessage.id, resultB.assistantMessage.id);
      assert.equal(msgsA.some((m) => m.content.includes("Session B")), false);
      assert.equal(msgsB.some((m) => m.content.includes("Session A")), false);
    });
  });

  // ==========================================================================
  // 6. Security & Credential Safety (Sections 23, 71, 104)
  // ==========================================================================
  describe("Security & Redaction Invariants", () => {
    it("guarantees returned DTO contains zero plaintext API keys or authorization headers", async () => {
      const session = await createChatSession({ title: "Security Invariant Test" });

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Analyze security architecture",
      });

      const serialized = JSON.stringify(result);

      // Assert no secret patterns exist
      assert.equal(serialized.includes("Bearer "), false);
      assert.equal(serialized.includes("sk-"), false);
      assert.equal(serialized.includes("gsk_"), false);
      assert.equal(serialized.includes("AIza"), false);
      assert.equal(serialized.includes("x-api-key"), false);
    });
  });
});
