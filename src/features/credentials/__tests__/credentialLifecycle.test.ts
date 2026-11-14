/**
 * Nano Route — Step 74 Credential Lifecycle & Secret Security Tests
 * File: src/features/credentials/__tests__/credentialLifecycle.test.ts
 *
 * Comprehensive tests verifying:
 * 1. State machine: NOT_CONFIGURED, CONFIGURED, VALID, INVALID, REVOKED_OR_REJECTED, EXPIRING_OR_STALE, DISABLED, DELETION_PENDING, ERROR.
 * 2. Presence vs Validity separation.
 * 3. Safe Rotation workflow with validation confirmation.
 * 4. Zero-prompt validation guarantees (no prompt/session text transmitted).
 * 5. Compromise incident response (local purge/disable vs mandatory remote revocation distinction).
 * 6. Custom endpoint security (TLS enforcement, localhost permitted, query secret rejection, embedded auth rejection).
 * 7. Synthetic Secret Leak Verification across:
 *    - Diagnostic report generation
 *    - User data export serialization
 *    - Workspace profile generation
 *    - Local notification payloads
 *    - Credential lifecycle DTO serialization
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  auditCustomEndpointSecurity,
  resolveCredentialLifecycleState,
  rotateProviderCredential,
  verifyCredentialZeroPrompt,
  handleCompromisedCredential,
  resetCredentialLifecycleCache,
  CREDENTIAL_STALE_THRESHOLD_MS,
  PROVIDER_CONSOLE_REVOCATION_URLS,
} from "../engine.ts";
import {
  saveProviderCredential,
  getProviderCredentialStatus,
  resetCredentialMockStore,
} from "../../../services/ipc/credentials.ts";
import type { ProviderCredentialStatus } from "../../../services/ipc/types.ts";
import {
  setMockProviderHealth,
  resetMockHealth,
} from "../../../services/ipc/provider_health.ts";

import { generateDiagnosticReport } from "../../diagnostics/reportGenerator.ts";
import type { DiagnosticRunSummary } from "../../diagnostics/types.ts";
import { executeDataExport, scanForSecretLeaks } from "../../export/engine.ts";
import { exportProfileToJson } from "../../profiles/engine.ts";
import { BUILTIN_PROFILES } from "../../profiles/presets.ts";
import { sanitizeNotificationText } from "../../notifications/sanitizer.ts";

describe("Step 74 — Credential Lifecycle & Secret Management", () => {
  beforeEach(() => {
    resetCredentialMockStore();
    resetMockHealth();
    resetCredentialLifecycleCache();
  });

  describe("1. Credential State Resolution & Presence vs Validity", () => {
    it("resolves NOT_CONFIGURED when no key exists in DPAPI vault", () => {
      const state = resolveCredentialLifecycleState(null);
      assert.equal(state.isConfigured, false);
      assert.equal(state.validationStatus, "NOT_CONFIGURED");
      assert.equal(state.lastVerifiedAtMs, null);
    });

    it("resolves CONFIGURED when key is present but unvalidated", () => {
      const mockStatus: ProviderCredentialStatus = {
        providerId: "openai",
        isConfigured: true,
        isActive: true,
        priorityWeight: 5,
        currentMonthSpend: 0,
        updatedAt: Date.now(),
      };
      const state = resolveCredentialLifecycleState(mockStatus);
      assert.equal(state.isConfigured, true);
      assert.equal(state.isActive, true);
      assert.equal(state.validationStatus, "CONFIGURED");
      assert.equal(state.isStale, false);
    });

    it("resolves DISABLED when key exists in DPAPI but is deactivated locally", () => {
      const mockStatus: ProviderCredentialStatus = {
        providerId: "anthropic",
        isConfigured: true,
        isActive: false,
        priorityWeight: 5,
        currentMonthSpend: 0,
        updatedAt: Date.now(),
      };
      const state = resolveCredentialLifecycleState(mockStatus);
      assert.equal(state.isConfigured, true);
      assert.equal(state.isActive, false);
      assert.equal(state.validationStatus, "DISABLED");
    });

    it("resolves EXPIRING_OR_STALE when credential age exceeds 90 days", () => {
      const oldTime = Date.now() - (CREDENTIAL_STALE_THRESHOLD_MS + 24 * 60 * 60 * 1000); // 91 days old
      const mockStatus: ProviderCredentialStatus = {
        providerId: "gemini",
        isConfigured: true,
        isActive: true,
        priorityWeight: 5,
        currentMonthSpend: 0,
        updatedAt: oldTime,
      };
      const state = resolveCredentialLifecycleState(mockStatus, Date.now());
      assert.equal(state.isStale, true);
      assert.ok(state.staleDays >= 90);
      assert.equal(state.validationStatus, "EXPIRING_OR_STALE");
    });
  });

  describe("2. Zero-Prompt Validation Workflow", () => {
    it("validates credential successfully without conversational prompts", async () => {
      // 1. Configure key
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-test-verification-key-1234567890",
      });

      // 2. Mock health returns Ready
      setMockProviderHealth({
        providerId: "openai",
        displayName: "OpenAI",
        state: "ready",
        isEnabled: true,
        isCredentialConfigured: true,
        isAdapterImplemented: true,
        rateLimitInfo: { isLimited: false },
        models: [],
      });

      const res = await verifyCredentialZeroPrompt("openai");
      assert.equal(res.isZeroPrompt, true);
      assert.equal(res.status, "VALID");
      assert.ok(res.message.includes("Authentication verified"));

      // Check resolved state
      const current = await getProviderCredentialStatus("openai");
      const lifecycle = resolveCredentialLifecycleState(current);
      assert.equal(lifecycle.validationStatus, "VALID");
      assert.ok(lifecycle.lastVerifiedAtMs !== null);
    });

    it("identifies upstream 401 unauthorized as INVALID", async () => {
      await saveProviderCredential({
        providerId: "groq",
        apiKey: "gsk_invalid_mock_key_12345",
      });

      // Mock health returns 401 Unauthorized
      setMockProviderHealth({
        providerId: "groq",
        displayName: "Groq",
        state: "authentication_failed",
        isEnabled: true,
        isCredentialConfigured: true,
        isAdapterImplemented: true,
        rateLimitInfo: { isLimited: false },
        models: [],
        reasonCode: "invalid_api_key",
        lastHttpStatus: 401,
      });

      const res = await verifyCredentialZeroPrompt("groq");
      assert.equal(res.isZeroPrompt, true);
      assert.equal(res.status, "INVALID");
      assert.ok(res.message.includes("401 Unauthorized"));
    });

    it("identifies upstream 403 / revoked keys as REVOKED_OR_REJECTED", async () => {
      await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-sample-revoked-key-12345",
      });

      setMockProviderHealth({
        providerId: "anthropic",
        displayName: "Anthropic",
        state: "authorization_failed",
        isEnabled: true,
        isCredentialConfigured: true,
        isAdapterImplemented: true,
        rateLimitInfo: { isLimited: false },
        models: [],
        reasonCode: "revoked_credential",
        lastHttpStatus: 403,
      });

      const res = await verifyCredentialZeroPrompt("anthropic");
      assert.equal(res.isZeroPrompt, true);
      assert.equal(res.status, "REVOKED_OR_REJECTED");
      assert.ok(res.message.includes("403"));
    });
  });

  describe("3. Safe Credential Rotation Workflow", () => {
    it("successfully rotates existing key and runs zero-prompt validation", async () => {
      // 1. Initial key setup
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-old-key-version-1",
      });

      // 2. Perform rotation
      const rotationResult = await rotateProviderCredential(
        "openai",
        "sk-proj-new-rotated-key-version-2",
        { validateImmediately: true }
      );

      assert.equal(rotationResult.status.providerId, "openai");
      assert.equal(rotationResult.status.isConfigured, true);
      assert.equal(rotationResult.lifecycle.validationStatus, "VALID");
      assert.ok(rotationResult.validationResult);
      assert.equal(rotationResult.validationResult.isZeroPrompt, true);

      // Verify no plaintext key in return structures
      const serialized = JSON.stringify(rotationResult);
      assert.ok(!serialized.includes("sk-proj-old-key-version-1"));
      assert.ok(!serialized.includes("sk-proj-new-rotated-key-version-2"));
    });
  });

  describe("4. Compromise Incident Response & Emergency Workflows", () => {
    it("handles local purge with explicit remote revocation guidance", async () => {
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-compromised-secret-key-123",
      });

      const response = await handleCompromisedCredential("openai", "OpenAI", "PURGE_LOCAL");

      // Verify local purge
      assert.equal(response.localActionTaken, "LOCAL_CREDENTIAL_PURGED");
      assert.equal(response.remoteRevocationRequired, true);
      assert.equal(response.providerRevocationUrl, PROVIDER_CONSOLE_REVOCATION_URLS.openai);

      const status = await getProviderCredentialStatus("openai");
      assert.equal(status, null); // purged from DPAPI vault

      // Verify remediation runbook has clear distinction
      assert.ok(response.remediationSteps.length >= 4);
      assert.ok(response.incidentNotice.includes("does NOT revoke the key on OpenAI's servers"));
    });

    it("handles emergency disable without purging DPAPI record", async () => {
      await saveProviderCredential({
        providerId: "deepseek",
        apiKey: "sk-deepseek-compromised-secret-999",
      });

      const response = await handleCompromisedCredential("deepseek", "DeepSeek", "DISABLE_LOCAL");
      assert.equal(response.localActionTaken, "LOCAL_CREDENTIAL_DISABLED");

      const status = await getProviderCredentialStatus("deepseek");
      assert.ok(status !== null);
      assert.equal(status.isActive, false); // Disabled
    });
  });

  describe("5. Custom Endpoint Security & Leak Prevention", () => {
    it("permits secure HTTPS custom endpoints", () => {
      const audit = auditCustomEndpointSecurity("https://custom-openai-proxy.internal.corp/v1");
      assert.equal(audit.isValid, true);
      assert.equal(audit.isTlsEnforced, true);
      assert.equal(audit.isLocalhost, false);
      assert.equal(audit.hasEmbeddedAuth, false);
      assert.equal(audit.hasQuerySecrets, false);
    });

    it("permits standard HTTP localhost and 127.0.0.1 development endpoints", () => {
      const audit1 = auditCustomEndpointSecurity("http://localhost:8000/v1");
      assert.equal(audit1.isValid, true);
      assert.equal(audit1.isLocalhost, true);

      const audit2 = auditCustomEndpointSecurity("http://127.0.0.1:11434/v1");
      assert.equal(audit2.isValid, true);
      assert.equal(audit2.isLocalhost, true);
    });

    it("rejects unencrypted HTTP for non-localhost endpoints", () => {
      const audit = auditCustomEndpointSecurity("http://api.my-remote-server.com/v1");
      assert.equal(audit.isValid, false);
      assert.ok(audit.rejectionReason?.includes("Insecure HTTP protocol is prohibited"));
    });

    it("rejects URLs containing embedded credentials (user:pass@host)", () => {
      const audit = auditCustomEndpointSecurity("https://admin:mySecretPassword@api.service.com/v1");
      assert.equal(audit.isValid, false);
      assert.equal(audit.hasEmbeddedAuth, true);
      assert.ok(audit.rejectionReason?.includes("embedded credentials"));
    });

    it("rejects URLs with query string token or secret parameters", () => {
      const audit = auditCustomEndpointSecurity("https://api.gateway.com/v1?api_key=secret12345");
      assert.equal(audit.isValid, false);
      assert.equal(audit.hasQuerySecrets, true);
      assert.ok(audit.rejectionReason?.includes("URL query parameters"));
    });
  });

  describe("6. Synthetic Secret Leak Verification Across All Subsystems", () => {
    const SYNTHETIC_SECRET = "sk-proj-SYNTHETIC-LEAK-TEST-TOKEN-999888777";

    it("verifies Diagnostic Reports contain zero plaintext secrets or API keys", async () => {
      const now = new Date().toISOString();
      const summary: DiagnosticRunSummary = {
        overallHealth: "HEALTHY",
        healthHeadline: "All Systems Operational",
        healthDescription: "Zero errors detected",
        runMode: "quick",
        startedAt: now,
        completedAt: now,
        totalTests: 1,
        passedCount: 1,
        failedCount: 0,
        warningCount: 0,
        blockedCount: 0,
        notRunCount: 0,
        results: [
          {
            id: "SLM-001",
            name: "Local SLM",
            category: "runtime",
            isNetworkBound: false,
            status: "PASS",
            startedAt: now,
            completedAt: now,
            durationMs: 10,
            summary: "SLM online and ready",
          },
        ],
      };
      const report = generateDiagnosticReport(summary);
      const serialized = JSON.stringify(report);
      assert.ok(!serialized.includes(SYNTHETIC_SECRET));
      assert.ok(!serialized.includes("sk-proj-SYNTHETIC"));
      // Redaction verification
      assert.ok(!serialized.match(/sk-proj-[A-Za-z0-9_-]{10,}/));
    });

    it("verifies User Data Exports contain zero credentials or vault ciphertext", async () => {
      await saveProviderCredential({
        providerId: "openai",
        apiKey: SYNTHETIC_SECRET,
      });

      const exportResult = await executeDataExport({
        categories: ["provider_registry_metadata", "user_preferences"],
        format: "json",
      });

      assert.equal(exportResult.success, true);
      const pkgJson = exportResult.serializedJson || "";
      assert.ok(!pkgJson.includes(SYNTHETIC_SECRET));
      assert.ok(!pkgJson.includes("encrypted_api_key"));
      assert.ok(!pkgJson.includes("dpapi_blob"));

      const leakCheck = scanForSecretLeaks(pkgJson);
      assert.equal(leakCheck.hasLeak, false);
    });

    it("verifies Workspace Profiles JSON contains zero credentials", () => {
      const profile = BUILTIN_PROFILES[0];
      const json = exportProfileToJson(profile);
      assert.ok(!json.includes(SYNTHETIC_SECRET));
      assert.ok(!json.includes("apiKey"));
      assert.ok(!json.includes("secret"));
    });

    it("verifies Desktop Notification sanitizer strips secrets and API keys", () => {
      const dirty = `Successfully rotated OpenAI key (${SYNTHETIC_SECRET})`;
      const clean = sanitizeNotificationText(dirty);

      assert.ok(!clean.includes(SYNTHETIC_SECRET));
      assert.ok(!clean.includes("sk-proj-SYNTHETIC"));
      assert.ok(clean.includes("[REDACTED_SECRET]"));
    });

    it("verifies ProviderCredentialLifecycleDto serializes without secret material", async () => {
      await saveProviderCredential({
        providerId: "mistral",
        apiKey: SYNTHETIC_SECRET,
      });

      const cred = await getProviderCredentialStatus("mistral");
      const lifecycle = resolveCredentialLifecycleState(cred);
      const serialized = JSON.stringify(lifecycle);

      assert.ok(!serialized.includes(SYNTHETIC_SECRET));
      assert.ok(!serialized.includes("apiKey"));
      assert.equal(lifecycle.providerId, "mistral");
      assert.equal(lifecycle.isConfigured, true);
    });
  });
});
