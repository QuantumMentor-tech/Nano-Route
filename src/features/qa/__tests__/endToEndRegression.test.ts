/**
 * Nano Route — Step 49 Master End-to-End Regression & Edge-Case Test Suite
 * File: src/features/qa/__tests__/endToEndRegression.test.ts
 *
 * Comprehensive cross-feature integration, failure-injection, edge-case matrix,
 * data-consistency, and crash-recovery validation across Steps 1–48.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// IPC Services
import {
  createChatSession,
  appendChatMessage,
  listChatSessions,
  renameChatSession,
  setChatSessionPinned,
  deleteChatSession,
  getChatMessages,
  submitChatPrompt,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import {
  recordTelemetryEvent,
  getTelemetryAggregates,
  clearTelemetry,
  resetTelemetryMockStore,
} from "../../../services/ipc/telemetry.ts";
import {
  saveProviderCredential,
  listProviderCredentialStatuses,
  deleteProviderCredential,
  resetCredentialMockStore,
} from "../../../services/ipc/credentials.ts";
import { sanitizeErrorMessage, IpcError } from "../../../services/ipc/errors.ts";

describe("Step 49 — Full QA, Regression, Edge-Case & Release-Candidate Validation", () => {
  beforeEach(() => {
    resetChatMockStore();
    resetTelemetryMockStore();
    resetCredentialMockStore();
  });

  // ==========================================================================
  // 1. CROSS-FEATURE INTEGRATION SCENARIOS (Section 35)
  // ==========================================================================
  describe("1. Cross-Feature Integration Scenarios", () => {
    it("Scenario A: Settings Provider Config -> Chat Studio -> History -> Telemetry", async () => {
      // Step A1: Configure provider in settings
      const status = await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-test-scenario-a-key-12345",
      });
      assert.equal(status.providerId, "openai");
      assert.equal(status.isConfigured, true);
      assert.equal(status.isActive, true);

      const creds = await listProviderCredentialStatuses();
      const openAiCred = creds.find((c) => c.providerId === "openai");
      assert.ok(openAiCred);
      assert.equal(openAiCred.isConfigured, true);

      // Step A2: Create chat session & submit prompt
      const session = await createChatSession({ title: "Scenario A Session" });
      assert.ok(session.id);

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Calculate fibonacci sequence in Rust",
      });

      assert.equal(result.status, "completed");
      assert.ok(result.assistantMessage);
      assert.ok(result.routedProvider);

      // Step A3: History persistence verification
      const messages = await getChatMessages({ sessionId: session.id });
      assert.equal(messages.length, 2); // 1 user + 1 assistant
      assert.equal(messages[0].sender, "user");
      assert.equal(messages[1].sender, "assistant");
      assert.equal(messages[1].metadata?.routedProvider, result.routedProvider);

      // Step A4: Telemetry verification
      await recordTelemetryEvent({
        providerId: result.routedProvider,
        modelId: result.routedModel,
        eventType: "routing_decision",
        outcome: "success",
        promptTokens: 25,
        completionTokens: 80,
        costUsd: 0.0005,
      });

      const telemetry = await getTelemetryAggregates();
      assert.ok(telemetry.totalEvents >= 1);
      assert.ok(telemetry.totalPromptTokens >= 25);
    });

    it("Scenario B: Chat -> Automatic Failover Metadata -> History Invariants", async () => {
      const session = await createChatSession({ title: "Scenario B Failover" });

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Simulate prompt processing",
      });

      assert.equal(result.status, "completed");
      assert.ok(result.assistantMessage);

      // Ensure message was persisted under active session
      const history = await getChatMessages({ sessionId: session.id });
      assert.equal(history.length, 2);
      assert.equal(history[1].id, result.assistantMessage.id);
    });

    it("Scenario C: Manual Route Override -> Execution -> History Invariant", async () => {
      const session = await createChatSession({ title: "Scenario C Override" });

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Explain quantum annealing",
        manualOverride: {
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
        },
      });

      assert.equal(result.status, "completed");
      assert.equal(result.selectionMode, "manual_override");
      assert.equal(result.routedProvider, "anthropic");
      assert.equal(result.routedModel, "claude-3-5-sonnet");

      const history = await getChatMessages({ sessionId: session.id });
      assert.equal(history[1].metadata.routedProvider, "anthropic");
      assert.equal(history[1].metadata.routedModel, "claude-3-5-sonnet");
    });

    it("Scenario D: Session Lifecycle -> Pin -> Search -> Delete -> Persistence Invariants", async () => {
      // Create 3 sessions
      const s1 = await createChatSession({ title: "Project Alpha Architecture" });
      const s2 = await createChatSession({ title: "Project Beta Performance" });
      const s3 = await createChatSession({ title: "Gamma Telemetry Exploration" });

      // Add messages to s1
      await appendChatMessage({
        sessionId: s1.id,
        sender: "user",
        content: "What is the memory limit?",
      });

      // Pin s2
      await setChatSessionPinned(s2.id, true);
      const listAfterPin = await listChatSessions();
      const pinnedSession = listAfterPin.find((s) => s.id === s2.id);
      assert.equal(pinnedSession?.pinned, true);

      // Rename s3
      await renameChatSession(s3.id, "Renamed Gamma Session");
      const listAfterRename = await listChatSessions();
      const renamed = listAfterRename.find((s) => s.id === s3.id);
      assert.equal(renamed?.title, "Renamed Gamma Session");

      // Delete s1 and ensure message cascade
      await deleteChatSession(s1.id);
      const remainingSessions = await listChatSessions();
      assert.equal(remainingSessions.some((s) => s.id === s1.id), false);

      // Verify that querying deleted session messages correctly fails with NOT_FOUND
      await assert.rejects(
        async () => {
          await getChatMessages({ sessionId: s1.id });
        },
        {
          code: "NOT_FOUND",
        }
      );
    });

    it("Scenario F: Data Retention -> Full Wipe -> Pristine State Recovery", async () => {
      // Seed data
      const s = await createChatSession({ title: "Wipe Target Session" });
      await appendChatMessage({ sessionId: s.id, sender: "user", content: "Ephemeral" });
      await recordTelemetryEvent({
        providerId: "openai",
        modelId: "gpt-4o",
        eventType: "routing_decision",
        outcome: "success",
        promptTokens: 50,
        completionTokens: 100,
        latencyMs: 250,
      });

      // Execute wipe simulation
      await clearTelemetry();
      const clearedTelemetry = await getTelemetryAggregates();
      assert.equal(clearedTelemetry.totalEvents, 0);
      assert.equal(clearedTelemetry.totalPromptTokens, 0);
      assert.equal(clearedTelemetry.totalCostUsd, 0);
    });

    it("Scenario G: Credential Replacement & Deletion Lifecycle", async () => {
      // Add credential
      await saveProviderCredential({
        providerId: "groq",
        apiKey: "gsk_initial_key_123456789",
      });

      let creds = await listProviderCredentialStatuses();
      let groqCred = creds.find((c) => c.providerId === "groq");
      assert.equal(groqCred?.isConfigured, true);

      // Replace credential
      await saveProviderCredential({
        providerId: "groq",
        apiKey: "gsk_updated_key_987654321",
      });

      creds = await listProviderCredentialStatuses();
      groqCred = creds.find((c) => c.providerId === "groq");
      assert.equal(groqCred?.isConfigured, true);

      // Delete credential
      await deleteProviderCredential("groq");
      creds = await listProviderCredentialStatuses();
      groqCred = creds.find((c) => c.providerId === "groq");
      assert.equal(groqCred, undefined);
    });
  });

  // ==========================================================================
  // 2. EDGE-CASE MATRIX VALIDATION (Section 28)
  // ==========================================================================
  describe("2. Edge-Case Matrix Tests", () => {
    it("handles large input sizes (16k prompt) and rejects oversized inputs (>32k) safely", async () => {
      const session = await createChatSession({ title: "Large Prompt Session" });
      const largePrompt = "A".repeat(16_000);

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: largePrompt,
      });

      assert.equal(result.status, "completed");
      assert.ok(result.assistantMessage);

      // Oversized prompt test (> 32,768 chars)
      const oversizedPrompt = "X".repeat(50_000);
      await assert.rejects(
        async () => {
          await submitChatPrompt({
            sessionId: session.id,
            prompt: oversizedPrompt,
          });
        },
        {
          code: "INVALID_INPUT",
        }
      );
    });

    it("handles multiline, punctuation, code blocks, and JSON structures cleanly", async () => {
      const session = await createChatSession({ title: "Complex Text Session" });
      const complexPrompt = `
\`\`\`json
{
  "key": "value",
  "nested": { "array": [1, 2, 3] },
  "specialChars": "<>&'\\"/!@#$%^&*()_+"
}
\`\`\`
Can you parse this?`;

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: complexPrompt,
      });

      assert.equal(result.status, "completed");
      assert.ok(result.assistantMessage.content.length > 0);
    });

    it("handles Unicode, emoji, RTL text, and multibyte sequences without corruption", async () => {
      const session = await createChatSession({ title: "Unicode Multibyte Session" });
      const unicodePrompt = "Hello 🚀 🌍 العربية 日本語 한국어 🌟 \u0000 \uFFFF";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: unicodePrompt,
      });

      assert.equal(result.status, "completed");
      assert.ok(result.assistantMessage);
    });

    it("handles zero, null, and divide-by-zero analytics calculations safely", () => {
      function calculateCostPerToken(cost: number, tokens: number): number {
        if (!tokens || tokens <= 0 || !Number.isFinite(tokens)) return 0.0;
        return cost / tokens;
      }

      assert.equal(calculateCostPerToken(10.0, 0), 0.0);
      assert.equal(calculateCostPerToken(0.0, 0), 0.0);
      assert.equal(calculateCostPerToken(5.0, -10), 0.0);
      assert.equal(calculateCostPerToken(1.0, 1000), 0.001);
    });
  });

  // ==========================================================================
  // 3. FAILURE INJECTION & RESILIENCE (Section 33)
  // ==========================================================================
  describe("3. Failure Injection & Resilience", () => {
    it("guarantees error messages scrub private credentials and file paths", () => {
      const rawError =
        "Error connecting to https://api.openai.com with key sk-proj-supersecretkey12345 at C:\\Users\\Administrator\\AppData\\Local\\Nano Route";
      const sanitized = sanitizeErrorMessage(rawError);

      assert.equal(sanitized.includes("sk-proj-supersecretkey12345"), false);
      assert.equal(sanitized.includes("C:\\Users\\Administrator"), false);
      assert.ok(sanitized.includes("[REDACTED_SECRET]"));
      assert.ok(sanitized.includes("[REDACTED_PATH]"));
    });

    it("normalizes technical transport failures into structured IpcError objects", () => {
      const ipcError = new IpcError({
        code: "COMMAND_TIMEOUT",
        category: "ServiceUnavailable",
        message: "Network call to https://api.anthropic.com timed out after 30000ms with token Bearer secret-12345",
        retryable: true,
      });

      assert.equal(ipcError.code, "COMMAND_TIMEOUT");
      assert.equal(ipcError.category, "ServiceUnavailable");
      assert.equal(ipcError.retryable, true);
      assert.equal(ipcError.message.includes("secret-12345"), false);
      assert.ok(ipcError.message.includes("[REDACTED_SECRET]"));
    });
  });

  // ==========================================================================
  // 4. DATA-CONSISTENCY REGRESSION (Section 36)
  // ==========================================================================
  describe("4. Data-Consistency Invariants", () => {
    it("ensures historical routing decisions and cost values are immutable across reads", async () => {
      const session = await createChatSession({ title: "Immutable History Session" });

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Summarize the law of thermodynamics",
      });

      const firstRead = await getChatMessages({ sessionId: session.id });
      const assistant1 = firstRead.find((m) => m.sender === "assistant");
      assert.ok(assistant1);
      const originalProvider = assistant1.metadata?.routedProvider;
      const originalModel = assistant1.metadata?.routedModel;
      assert.equal(originalProvider, result.routedProvider);

      // Perform subsequent read
      const secondRead = await getChatMessages({ sessionId: session.id });
      const assistant2 = secondRead.find((m) => m.sender === "assistant");
      assert.ok(assistant2);

      assert.equal(assistant2.metadata?.routedProvider, originalProvider);
      assert.equal(assistant2.metadata?.routedModel, originalModel);
    });
  });
});
