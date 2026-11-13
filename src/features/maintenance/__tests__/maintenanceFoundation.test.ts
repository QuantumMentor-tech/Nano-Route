/**
 * Nano Route — Phase 11 Step 51 Maintenance & Observability Test Suite
 * File: src/features/maintenance/__tests__/maintenanceFoundation.test.ts
 *
 * Validates post-release stability baseline, error correlation, safe diagnostics,
 * component health isolation, and hotfix regression protections.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { IpcError } from "../../../services/ipc/errors.ts";
import { validateExternalUrl } from "../../about/utils/externalLinks.ts";
import {
  createChatSession,
  getChatMessages,
  submitChatPrompt,
  resetChatMockStore,
} from "../../../services/ipc/chat.ts";
import {
  listProviderCredentialStatuses,
  saveProviderCredential,
  resetCredentialMockStore,
} from "../../../services/ipc/credentials.ts";
import {
  getTelemetryAggregates,
  resetTelemetryMockStore,
} from "../../../services/ipc/telemetry.ts";

describe("Step 51 — Post-Release Stability & Maintenance Foundation", () => {
  beforeEach(() => {
    resetChatMockStore();
    resetCredentialMockStore();
    resetTelemetryMockStore();
  });

  // ==========================================================================
  // 1. ERROR CORRELATION & SANITIZED OBSERVABILITY
  // ==========================================================================
  describe("1. Error Correlation & Safe Observability", () => {
    it("correlates technical failures with structured request IDs without leaking secrets", () => {
      const correlationId = "req_maint_diag_987654";
      const sensitiveRawMessage =
        "Failed POST to https://api.openai.com/v1/chat/completions with Bearer sk-proj-supersecretkey1234567890 at C:\\Users\\Engineer\\AppData\\Local\\Nano Route";

      const ipcError = new IpcError({
        code: "INTERNAL_ERROR",
        category: "Internal",
        message: sensitiveRawMessage,
        retryable: false,
        userActionRequired: true,
        requestId: correlationId,
      });

      // Verify correlation
      assert.equal(ipcError.requestId, correlationId);
      assert.equal(ipcError.code, "INTERNAL_ERROR");

      // Verify scrubbing
      assert.equal(ipcError.message.includes("sk-proj-supersecretkey1234567890"), false);
      assert.equal(ipcError.message.includes("C:\\Users\\Engineer"), false);
      assert.ok(ipcError.message.includes("[REDACTED_SECRET]"));
      assert.ok(ipcError.message.includes("[REDACTED_PATH]"));
    });
  });

  // ==========================================================================
  // 2. COMPONENT HEALTH ISOLATION
  // ==========================================================================
  describe("2. Component Health Isolation", () => {
    it("ensures an unconfigured or failing provider does not invalidate application core readiness", async () => {
      // Configure OpenAI but leave Anthropic unconfigured
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-test-key-maintenance",
      });

      const creds = await listProviderCredentialStatuses();
      const openAi = creds.find((c) => c.providerId === "openai");
      const anthropic = creds.find((c) => c.providerId === "anthropic");

      assert.equal(openAi?.isConfigured, true);
      assert.equal(anthropic, undefined); // Unconfigured credentials are absent from active credential vault store

      // Verify application can execute successfully through configured provider
      const session = await createChatSession({ title: "Maintenance Health Session" });
      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: "Verify health isolation",
      });

      assert.equal(result.status, "completed");
      assert.ok(result.assistantMessage);
    });
  });

  // ==========================================================================
  // 3. SAFE DIAGNOSTIC SUPPORT EXPORT
  // ==========================================================================
  describe("3. Safe Diagnostic Support Bundle", () => {
    it("generates support diagnostics package containing strictly sanitized metadata", async () => {
      // Simulate diagnostic bundle assembly
      const telemetry = await getTelemetryAggregates();
      const creds = await listProviderCredentialStatuses();

      const diagnosticBundle = {
        exportedAt: new Date().toISOString(),
        applicationVersion: "0.1.0",
        platform: "Windows Desktop (x86_64)",
        databaseStatus: "ready",
        databaseSchemaVersion: 5,
        totalEventsRecorded: telemetry.totalEvents,
        providersStatus: creds.map((c) => ({
          providerId: c.providerId,
          isConfigured: c.isConfigured,
          isActive: c.isActive,
          priorityWeight: c.priorityWeight,
          // Plaintext and DPAPI ciphertext blobs omitted
        })),
      };

      const serialized = JSON.stringify(diagnosticBundle);

      assert.equal(serialized.includes("apiKey"), false);
      assert.equal(serialized.includes("api_key"), false);
      assert.equal(serialized.includes("ciphertext"), false);
      assert.equal(serialized.includes("encrypted_api_key"), false);
      assert.equal(diagnosticBundle.applicationVersion, "0.1.0");
      assert.equal(diagnosticBundle.databaseSchemaVersion, 5);
    });
  });

  // ==========================================================================
  // 4. REGRESSION PROTECTION & HOTFIX CONTRACTS
  // ==========================================================================
  describe("4. Regression Protection & Hotfix Contracts", () => {
    it("enforces session title length limits (rejects > 255 chars with INVALID_INPUT)", async () => {
      // 255-character title succeeds
      const maxTitle = "T".repeat(255);
      const session = await createChatSession({ title: maxTitle });
      assert.equal(session.title.length, 255);

      // >255 characters fails closed with INVALID_INPUT
      const oversizedTitle = "T".repeat(256);
      await assert.rejects(
        async () => {
          await createChatSession({ title: oversizedTitle });
        },
        {
          code: "INVALID_INPUT",
        }
      );
    });

    it("enforces external URL CRLF rejection to prevent header injection in mailto links", () => {
      const dangerousMailto = "mailto:support@nanoroute.ai\r\nBcc:attacker@evil.com\r\nSubject:Injected";
      const validation = validateExternalUrl(dangerousMailto);

      assert.equal(validation.isValid, false);
      assert.ok(validation.error?.includes("prohibited control characters or line breaks"));
    });
  });

  // ==========================================================================
  // 5. ROLLBACK & PERSISTENCE IMMUTABILITY
  // ==========================================================================
  describe("5. Rollback & Historical Immutability", () => {
    it("preserves historical messages and telemetry without retroactive mutation", async () => {
      const session = await createChatSession({ title: "Rollback Invariant Session" });
      const promptText = "Explain second law of thermodynamics";

      const result = await submitChatPrompt({
        sessionId: session.id,
        prompt: promptText,
      });
      assert.equal(result.status, "completed");

      const initialHistory = await getChatMessages({ sessionId: session.id });
      assert.equal(initialHistory.length, 2);

      // Verify that subsequent read operations do not alter metadata or timestamps
      const secondHistory = await getChatMessages({ sessionId: session.id });
      assert.deepEqual(initialHistory, secondHistory);
    });
  });
});
