/**
//! Nano Route — Step 46 Settings & Provider Management Integration Tests
//! File: src/features/settings/__tests__/settingsWorkspace.test.ts
//!
//! Validates Settings Workspace snapshot retrieval, DPAPI credential lifecycle,
//! endpoint updates, provider enable/disable, manual route overrides,
//! settings reset, and zero-leakage security boundaries.
*/

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearMockSettings,
  deleteProviderCredential,
  getAppSettings,
  getProviderCredentialStatus,
  getSettingsWorkspaceSnapshot,
  listRegisteredModels,
  listRegisteredProviders,
  resetAllAppSettings,
  resetCredentialMockStore,
  resetProviderPreferences,
  saveProviderCredential,
  setAppSetting,
  setProviderActive,
  updateProviderPreferences,
  validateManualOverride,
  checkProviderHealth,
  type SaveCredentialRequest,
} from "../../../services/ipc/index.ts";
import {
  formatHealthFreshness,
  formatProviderHealthBadge,
  formatTokenCount,
  getRoutingProfileDescription,
} from "../settingsFormatters.ts";

describe("Step 46 — Settings, Provider Management & Configuration Control Center", () => {
  beforeEach(() => {
    clearMockSettings();
    resetCredentialMockStore();
  });

  // ==========================================================================
  // 1. Consolidated Settings Workspace Snapshot
  // ==========================================================================
  describe("1. Consolidated Settings Workspace Snapshot", () => {
    it("returns a comprehensive snapshot with all 6 canonical providers and models", async () => {
      const snapshot = await getSettingsWorkspaceSnapshot();

      assert.ok(snapshot.appSettings, "AppSettings must be present");
      assert.equal(snapshot.appSettings.routingPreferenceMode, "balanced");
      assert.equal(snapshot.appSettings.telemetryEnabled, true);

      // Verify all 6 registered providers exist in snapshot
      assert.ok(snapshot.providers.length >= 6, "Expected at least 6 canonical providers");
      const providerIds = snapshot.providers.map((p) => p.providerId);
      assert.ok(providerIds.includes("openai"));
      assert.ok(providerIds.includes("anthropic"));
      assert.ok(providerIds.includes("gemini"));
      assert.ok(providerIds.includes("deepseek"));
      assert.ok(providerIds.includes("groq"));
      assert.ok(providerIds.includes("mistral"));

      // Verify models are populated
      assert.ok(snapshot.models.length >= 6, "Model catalog must contain multiple models");

      // Verify security guarantees
      assert.equal(snapshot.securityStatus.dpapiProtectionActive, true);
      assert.equal(snapshot.securityStatus.plaintextKeysProhibited, true);
      assert.equal(snapshot.securityStatus.remoteSyncDisabled, true);
    });
  });

  // ==========================================================================
  // 2. DPAPI Credential Lifecycle (Save, Replace, Inspect, Delete)
  // ==========================================================================
  describe("2. DPAPI Credential Lifecycle & Status Metadata", () => {
    it("saves and encrypts credentials with DPAPI, returning safe non-secret metadata", async () => {
      const req: SaveCredentialRequest = {
        providerId: "openai",
        apiKey: "sk-proj-test-super-secret-key-12345",
        priorityWeight: 8,
      };

      const status = await saveProviderCredential(req);
      assert.equal(status.providerId, "openai");
      assert.equal(status.isConfigured, true);
      assert.equal(status.isActive, true);
      assert.equal(status.priorityWeight, 8);
      assert.ok(status.updatedAt > 0);

      // CRITICAL SECURITY INVARIANT: Secret key is NEVER returned in status DTO
      assert.equal((status as unknown as Record<string, unknown>).apiKey, undefined);
      assert.equal((status as unknown as Record<string, unknown>).encryptedApiKey, undefined);

      // Inspect credential status
      const fetched = await getProviderCredentialStatus("openai");
      assert.ok(fetched);
      assert.equal(fetched.isConfigured, true);
      assert.equal(fetched.priorityWeight, 8);
    });

    it("replaces an existing credential seamlessly with updated timestamp", async () => {
      await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-original-key-1111",
      });

      const initialStatus = await getProviderCredentialStatus("anthropic");
      assert.ok(initialStatus);

      // Replace key
      const replacedStatus = await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-rotated-key-2222",
        priorityWeight: 9,
      });

      assert.equal(replacedStatus.priorityWeight, 9);
      assert.ok(replacedStatus.updatedAt >= initialStatus.updatedAt);
    });

    it("deletes credential and removes configuration state without deleting registry entry", async () => {
      await saveProviderCredential({
        providerId: "gemini",
        apiKey: "AIza-gemini-test-secret-key",
      });

      const beforeDelete = await getProviderCredentialStatus("gemini");
      assert.equal(beforeDelete?.isConfigured, true);

      // Delete credential
      const deleted = await deleteProviderCredential("gemini");
      assert.equal(deleted, true);

      // Verify status is cleared
      const afterDelete = await getProviderCredentialStatus("gemini");
      assert.equal(afterDelete, null);

      // Verify provider still exists in static registry
      const providers = await listRegisteredProviders();
      assert.ok(providers.some((p) => p.providerId === "gemini"));
    });

    it("rejects empty or whitespace-only API keys", async () => {
      await assert.rejects(
        async () => {
          await saveProviderCredential({
            providerId: "mistral",
            apiKey: "   ",
          });
        },
        { name: "IpcError", message: /API key cannot be empty/i }
      );
    });
  });

  // ==========================================================================
  // 3. Provider Configuration, Activation & Endpoint Editing
  // ==========================================================================
  describe("3. Provider Configuration & Endpoint Management", () => {
    it("toggles provider active state atomically", async () => {
      await saveProviderCredential({
        providerId: "groq",
        apiKey: "gsk-groq-test-key-555",
      });

      // Disable provider
      const disabled = await setProviderActive("groq", false);
      assert.equal(disabled.isActive, false);

      let status = await getProviderCredentialStatus("groq");
      assert.equal(status?.isActive, false);

      // Re-enable provider
      const enabled = await setProviderActive("groq", true);
      assert.equal(enabled.isActive, true);

      status = await getProviderCredentialStatus("groq");
      assert.equal(status?.isActive, true);
    });

    it("configures custom base URL and restores default endpoint safely", async () => {
      await saveProviderCredential({
        providerId: "deepseek",
        apiKey: "sk-deepseek-test-key",
      });

      // Set custom HTTPS base URL
      const customUrl = "https://custom.deepseek.proxy.internal/v1";
      const updated = await updateProviderPreferences({
        providerId: "deepseek",
        baseUrl: customUrl,
      });

      assert.equal(updated.baseUrl, customUrl);

      // Restore default endpoint by setting baseUrl to null
      const restored = await updateProviderPreferences({
        providerId: "deepseek",
        baseUrl: null,
      });

      assert.equal(restored.baseUrl, null);
    });

    it("rejects insecure or malformed endpoint URLs", async () => {
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-test-key",
      });

      // Disallow non-HTTPS external protocols
      await assert.rejects(
        async () => {
          await updateProviderPreferences({
            providerId: "openai",
            baseUrl: "ftp://api.openai.com",
          });
        },
        { name: "IpcError", message: /Base URL must use HTTPS/i }
      );

      // Disallow embedded user credentials
      await assert.rejects(
        async () => {
          await updateProviderPreferences({
            providerId: "openai",
            baseUrl: "https://user:password@api.openai.com",
          });
        },
        { name: "IpcError", message: /embedded user credentials/i }
      );
    });

    it("resets provider preferences while preserving DPAPI credentials", async () => {
      await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-test-key",
        baseUrl: "https://custom.anthropic.endpoint.com",
        priorityWeight: 10,
        isActive: false,
      });

      // Reset preferences
      const reset = await resetProviderPreferences("anthropic");
      assert.equal(reset.baseUrl, null);
      assert.equal(reset.priorityWeight, 5);
      assert.equal(reset.isActive, true);
      assert.equal(reset.isConfigured, true); // Credential preserved!
    });
  });

  // ==========================================================================
  // 4. Models & Manual Route Override
  // ==========================================================================
  describe("4. Models Catalog & Manual Route Override", () => {
    it("lists models grouped by provider with context limits and defaults", async () => {
      const allModels = await listRegisteredModels();
      const openAiModels = await listRegisteredModels("openai");

      assert.ok(allModels.length > openAiModels.length);
      assert.ok(openAiModels.some((m) => m.modelId === "gpt-4o"));

      const gpt4o = openAiModels.find((m) => m.modelId === "gpt-4o");
      assert.ok(gpt4o);
      assert.equal(gpt4o.isDefault, true);
      assert.equal(gpt4o.contextWindow, 128000);
    });

    it("validates manual route override candidates against catalog capabilities", async () => {
      const validRes = await validateManualOverride({
        provider_id: "openai",
        model_id: "gpt-4o",
        enabled: true,
      });
      assert.equal(validRes.is_valid, true);

      // Invalid provider rejection
      const invalidProvider = await validateManualOverride({
        provider_id: "non_existent_provider",
        model_id: "fake_model",
        enabled: true,
      });
      assert.equal(invalidProvider.is_valid, false);
      assert.match(invalidProvider.message, /not registered in the catalog/i);
    });

    it("persists manual override in app_settings and clears override on demand", async () => {
      // Set manual override
      await setAppSetting("routing.manual_override_enabled", "true");
      await setAppSetting("routing.manual_override_provider", "anthropic");
      await setAppSetting("routing.manual_override_model", "claude-3-5-sonnet-20241022");

      let snapshot = await getAppSettings();
      assert.equal(snapshot.manualOverrideEnabled, true);
      assert.equal(snapshot.manualOverrideProvider, "anthropic");
      assert.equal(snapshot.manualOverrideModel, "claude-3-5-sonnet-20241022");

      // Clear override
      await setAppSetting("routing.manual_override_enabled", "false");
      snapshot = await getAppSettings();
      assert.equal(snapshot.manualOverrideEnabled, false);
    });
  });

  // ==========================================================================
  // 5. Application Settings, Virtual Defaults & Safe Reset
  // ==========================================================================
  describe("5. Application Settings & Safe Reset", () => {
    it("updates routing preference mode, window state, and telemetry toggle", async () => {
      await setAppSetting("routing.preference_mode", "quality");
      await setAppSetting("window.start_maximized", "true");
      await setAppSetting("telemetry.enabled", "false");

      const snapshot = await getAppSettings();
      assert.equal(snapshot.routingPreferenceMode, "quality");
      assert.equal(snapshot.windowStartMaximized, true);
      assert.equal(snapshot.telemetryEnabled, false);
    });

    it("resets all application settings to virtual defaults without touching credentials", async () => {
      // Modify app settings
      await setAppSetting("routing.preference_mode", "cost_saving");
      await setAppSetting("window.start_maximized", "true");

      // Configure a provider credential
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-proj-persistent-key",
      });

      // Reset all settings
      const resetCount = await resetAllAppSettings();
      assert.ok(resetCount >= 0);

      // Verify settings reverted to defaults
      const snapshot = await getAppSettings();
      assert.equal(snapshot.routingPreferenceMode, "balanced");
      assert.equal(snapshot.windowStartMaximized, false);

      // Verify DPAPI credential was NOT deleted
      const credStatus = await getProviderCredentialStatus("openai");
      assert.ok(credStatus);
      assert.equal(credStatus.isConfigured, true);
    });
  });

  // ==========================================================================
  // 6. Explicit Health Probes
  // ==========================================================================
  describe("6. Explicit Health Probes", () => {
    it("executes explicit provider health probe without sending prompt data", async () => {
      const probeRes = await checkProviderHealth("openai");
      assert.ok(probeRes);
      assert.equal(probeRes.providerId, "openai");
      assert.ok(["ready", "unknown", "degraded"].includes(probeRes.status));
      assert.ok(probeRes.checkedAtMs > 0);
    });
  });

  // ==========================================================================
  // 7. Settings Formatters & Visual Helpers
  // ==========================================================================
  describe("7. Settings Formatters & Helpers", () => {
    it("formats health state badges deterministically", () => {
      const ready = formatProviderHealthBadge("ready");
      assert.equal(ready.label, "Ready");
      assert.equal(ready.color, "#4ade80");

      const degraded = formatProviderHealthBadge("degraded");
      assert.equal(degraded.label, "Degraded");

      const authFailed = formatProviderHealthBadge("authentication_failed");
      assert.equal(authFailed.label, "Auth Failed");

      const unknown = formatProviderHealthBadge("unknown");
      assert.equal(unknown.label, "Unknown");
    });

    it("formats timestamps and token numbers cleanly", () => {
      assert.equal(formatHealthFreshness(null), "Not checked yet");
      assert.equal(formatHealthFreshness(Date.now() - 5000), "Checked just now");
      assert.equal(formatTokenCount(128000), "128k tokens");
      assert.equal(formatTokenCount(2000000), "2M tokens");
      assert.match(getRoutingProfileDescription("quality"), /highest capability/i);
    });
  });
});
