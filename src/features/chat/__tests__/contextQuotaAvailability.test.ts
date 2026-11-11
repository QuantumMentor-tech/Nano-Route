/**
//! Nano Route — Context, Quota & Availability Control Engine Test Suite
//! File: src/features/chat/__tests__/contextQuotaAvailability.test.ts
//!
//! Validates Step 39: Context window headroom calculation and safety margins,
//! local budget limit guards, provider quota tracking and exhaustion states,
//! availability and endpoint preflight checks, zero-network-call candidate
//! disqualification, preflight-driven failover, and pricing tolerance.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatSession,
  getChatMessages,
  submitChatPrompt,
  streamChatPrompt,
  checkPreflight,
  getQuotaSnapshot,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import type {
  ChatStreamEvent,
  ChatStreamStartedEvent,
  ChatStreamFailoverEvent,
  ChatStreamFailedEvent,
} from "../types.ts";

describe("Step 39 Context, Quota & Availability Control Engine", () => {
  beforeEach(() => {
    resetChatMockStore();
  });

  // ==========================================================================
  // Scenario A: Normal Feasibility & Headroom
  // ==========================================================================
  describe("Scenario A: Context Fits, Budget Available, Provider Ready", () => {
    it("evaluates preflight as eligible with sufficient context headroom", async () => {
      const preflight = await checkPreflight(
        "openai",
        "gpt-4o-mini",
        "What are the three pillars of reliable AI orchestration?",
        undefined,
        4096
      );

      assert.equal(preflight.eligible, true);
      assert.ok(preflight.contextCheck);
      assert.equal(preflight.contextCheck.status, "sufficient");
      assert.ok(preflight.contextCheck.availableHeadroom > 50000);
      assert.ok(preflight.estimatedCostUsd !== undefined && preflight.estimatedCostUsd > 0);
    });

    it("executes successfully without failover when all preflight criteria are satisfied", async () => {
      const session = await createChatSession({ title: "Scenario A: Feasible" });
      const prompt = "Explain context window headroom and safety margins";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.assistantMessage.metadata.failoverUsed ?? false, false);
      assert.ok(result.assistantMessage.metadata.costUsd > 0);
    });
  });

  // ==========================================================================
  // Scenario B: Context Exceeds Primary -> Preflight Fallback
  // ==========================================================================
  describe("Scenario B: Context Exceeds Primary Candidate -> Preflight Fallback", () => {
    it("disqualifies primary before send and completes via fallback candidate (non-streaming)", async () => {
      const session = await createChatSession({ title: "Scenario B: Context Fallback Non-Streaming" });
      const prompt = "Please analyze this large codebase __CONTEXT_EXCEEDED_PRIMARY_FALLBACK__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      assert.equal(result.routedProvider, "anthropic");
      assert.equal(result.routedModel, "claude-3-5-sonnet-20241022");
      assert.equal(result.selectionMode, "fallback");
      assert.equal(result.assistantMessage.metadata.failoverUsed, true);
      assert.equal(result.assistantMessage.metadata.failoverFromProvider, "deepseek");
      // Zero physical provider attempts to primary
      assert.equal(result.assistantMessage.metadata.failoverAttempts, 1);
    });

    it("emits Started event directly with fallback candidate and completes cleanly (streaming)", async () => {
      const session = await createChatSession({ title: "Scenario B: Context Fallback Streaming" });
      const prompt = "Analyze long document __CONTEXT_EXCEEDED_PRIMARY_FALLBACK__";

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
      assert.equal(assistantMessage.metadata.routedProvider, "anthropic");
      assert.equal(assistantMessage.metadata.routedModel, "claude-3-5-sonnet-20241022");
      assert.equal(assistantMessage.metadata.failoverUsed, true);
      assert.equal(assistantMessage.metadata.failoverFromProvider, "deepseek");

      // Verify started event had the fallback provider from the start (zero primary deltas)
      const started = events.find((e): e is ChatStreamStartedEvent => e.type === "started");
      assert.ok(started);
      assert.equal(started.providerId, "anthropic");
      assert.equal(started.modelId, "claude-3-5-sonnet-20241022");
    });
  });

  // ==========================================================================
  // Scenario C: All Candidates Exceed Context
  // ==========================================================================
  describe("Scenario C: Prompt Exceeds All Candidates Context Windows", () => {
    it("rejects non-streaming execution immediately with CONTEXT_LIMIT_EXCEEDED and zero provider calls", async () => {
      const session = await createChatSession({ title: "Scenario C: Context Blocked Non-Streaming" });
      const prompt = "Giant multi-megabyte log dump __ALL_CANDIDATES_CONTEXT_BLOCKED__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "CONTEXT_LIMIT_EXCEEDED");
          assert.equal(err.retryable, false);
          return true;
        }
      );

      // Verify no assistant messages persisted
      const messages = await getChatMessages({ sessionId: session.id });
      const assistantMsgs = messages.filter((m) => m.sender === "assistant");
      assert.equal(assistantMsgs.length, 0);
    });

    it("emits failed event and prevents stream deltas when all candidates are context-blocked", async () => {
      const session = await createChatSession({ title: "Scenario C: Context Blocked Streaming" });
      const prompt = "Oversized content __ALL_CANDIDATES_CONTEXT_BLOCKED__";

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
          assert.equal(err.code, "CONTEXT_LIMIT_EXCEEDED");
          return true;
        }
      );

      const failEvent = events.find((e): e is ChatStreamFailedEvent => e.type === "failed");
      assert.ok(failEvent);
      assert.equal(failEvent.code, "CONTEXT_LIMIT_EXCEEDED");
      assert.equal(failEvent.isRetryable, false);

      // Ensure zero deltas emitted
      const deltas = events.filter((e) => e.type === "delta");
      assert.equal(deltas.length, 0);
    });
  });

  // ==========================================================================
  // Scenario D: Local Monthly Budget Exceeded
  // ==========================================================================
  describe("Scenario D: Local Monthly Budget Limit Guard", () => {
    it("disqualifies provider before network dispatch when spend ceiling is breached", async () => {
      const session = await createChatSession({ title: "Scenario D: Budget Guard" });
      const prompt = "Query requiring compute __LOCAL_BUDGET_EXCEEDED__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "LOCAL_BUDGET_EXCEEDED");
          assert.equal(err.retryable, false);
          assert.ok(err.userActionRequired);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // Scenario E: Provider Quota Exhaustion
  // ==========================================================================
  describe("Scenario E: Provider Quota Exhaustion Tracking", () => {
    it("halts non-retryable provider quota exhaustion without blind retry attempts", async () => {
      const session = await createChatSession({ title: "Scenario E: Quota Exhausted" });
      const prompt = "Billing period prompt __PROVIDER_QUOTA_EXHAUSTED__";

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
  });

  // ==========================================================================
  // Scenario F: Stale Quota Snapshot Handling
  // ==========================================================================
  describe("Scenario F: Stale Quota Advisory Posture", () => {
    it("retrieves quota snapshot and inspects staleness and budget thresholds", async () => {
      const snapshot = await getQuotaSnapshot("openai", "gpt-4o-mini");

      assert.equal(snapshot.providerId, "openai");
      assert.equal(snapshot.scope, "provider");
      assert.equal(snapshot.isExhausted, false);
      assert.equal(snapshot.isStale, false);
      assert.ok(snapshot.monthlyBudgetLimit !== undefined && snapshot.monthlyBudgetLimit > 0);
      assert.ok(snapshot.currentMonthSpend >= 0);
    });
  });

  // ==========================================================================
  // Scenario G: Provider Unavailable / Disabled in Preferences
  // ==========================================================================
  describe("Scenario G: Provider Availability Guard", () => {
    it("rejects disabled or unavailable provider candidate before network call", async () => {
      const session = await createChatSession({ title: "Scenario G: Provider Unavailable" });
      const prompt = "Perform request __PROVIDER_UNAVAILABLE__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "PROVIDER_UNAVAILABLE");
          assert.equal(err.retryable, false);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // Scenario H: DPAPI Credential Missing
  // ==========================================================================
  describe("Scenario H: DPAPI Credential Readiness Check", () => {
    it("rejects candidate before physical dispatch when DPAPI credentials are unconfigured", async () => {
      const session = await createChatSession({ title: "Scenario H: Missing Credential" });
      const prompt = "Perform request __CREDENTIAL_MISSING__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "CREDENTIAL_MISSING");
          assert.equal(err.retryable, false);
          assert.ok(err.userActionRequired);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // Scenario I: Endpoint Misconfiguration
  // ==========================================================================
  describe("Scenario I: Endpoint Syntax & Scheme Preflight", () => {
    it("rejects candidate when endpoint URL lacks valid http/https scheme", async () => {
      const session = await createChatSession({ title: "Scenario I: Endpoint Misconfigured" });
      const prompt = "Perform request __ENDPOINT_MISCONFIGURED__";

      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt,
          });
        },
        (err: any) => {
          assert.equal(err.code, "ENDPOINT_MISCONFIGURED");
          assert.equal(err.retryable, false);
          return true;
        }
      );
    });
  });

  // ==========================================================================
  // Scenario J: Retry Becomes Budget-Blocked -> Clean Failover
  // ==========================================================================
  describe("Scenario J: Retry Becomes Budget-Blocked Mid-Flight", () => {
    it("cancels retry and transitions cleanly to failover when budget cap is hit during retry", async () => {
      const session = await createChatSession({ title: "Scenario J: Retry Budget Blocked" });
      const prompt = "Retry test __RETRY_THEN_SUCCEED__ __RETRY_BUDGET_BLOCKED__";

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
      const failoverEvent = events.find((e): e is ChatStreamFailoverEvent => e.type === "failover");
      assert.ok(failoverEvent);
      assert.equal(failoverEvent.toProvider, "openai");
      assert.ok(failoverEvent.reason.includes("budget ceiling"));
    });
  });

  // ==========================================================================
  // Scenario K: Concurrent Request Budget Protection
  // ==========================================================================
  describe("Scenario K: Budget Reservation Race & Concurrency Protection", () => {
    it("protects local budget limits under concurrent allocation attempts", async () => {
      const session = await createChatSession({ title: "Scenario K: Budget Race" });
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
  });

  // ==========================================================================
  // Scenario L: Unknown Pricing Tolerance
  // ==========================================================================
  describe("Scenario L: Unknown Pricing Model Tolerance", () => {
    it("successfully completes execution and records usage even when pricing is unknown", async () => {
      const session = await createChatSession({ title: "Scenario L: Unknown Pricing" });
      const prompt = "Query model with unknown pricing __UNKNOWN_PRICING_SUCCESS__";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt,
      });

      assert.equal(result.status, "completed");
      assert.ok(result.promptTokens > 0);
      assert.ok(result.completionTokens > 0);
      assert.equal(result.costUsd, 0.0);
      assert.equal(result.assistantMessage.metadata.costUsd, 0.0);
    });
  });
});
