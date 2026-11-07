// ============================================================================
// Nano Route - Step 20 Application Settings & Provider Preferences Unit Tests
// File: src/services/ipc/__tests__/settings.test.ts
// ============================================================================
// Verifies typed application settings, virtual defaults, strict validation,
// non-secret provider preferences, atomic updates, and zero-secret invariants.
// ============================================================================

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getAppSettings,
  getAppSetting,
  setAppSetting,
  resetAppSetting,
  getProviderPreferences,
  listProviderPreferences,
  updateProviderPreferences,
  resetProviderPreferences,
  clearMockSettings,
  seedMockProviderPreference,
  validateSetting,
  validateBaseUrl,
  validateProviderId,
} from "../settings.ts";
import {
  registerMockCommandHandler,
  clearMockCommandHandlers,
  setMockTauriContext,
} from "../client.ts";
import { IPC_COMMANDS, type ProviderCredentialStatus } from "../types.ts";
import { IpcError } from "../errors.ts";

describe("Step 20 Application Settings & Provider Preferences", () => {
  beforeEach(() => {
    clearMockSettings();
    clearMockCommandHandlers();
  });

  describe("1. Application Settings Virtual Defaults & CRUD", () => {
    it("returns virtual defaults on clean start without persisted settings", async () => {
      const snapshot = await getAppSettings();

      assert.equal(snapshot.routingPreferenceMode, "balanced");
      assert.equal(snapshot.telemetryEnabled, true);
      assert.equal(snapshot.historyRetentionDays, 0);
      assert.equal(snapshot.windowStartMaximized, false);
    });

    it("reads virtual defaults for individual unset keys", async () => {
      const routing = await getAppSetting("routing.preference_mode");
      assert.equal(routing, "balanced");

      const telemetry = await getAppSetting("telemetry.enabled");
      assert.equal(telemetry, "true");

      const retention = await getAppSetting("history.retention_days");
      assert.equal(retention, "0");

      const windowState = await getAppSetting("window.start_maximized");
      assert.equal(windowState, "false");
    });

    it("sets, updates, and retrieves a typed setting value", async () => {
      const setResult = await setAppSetting("routing.preference_mode", "quality");
      assert.equal(setResult, true);

      const updated = await getAppSetting("routing.preference_mode");
      assert.equal(updated, "quality");

      const snapshot = await getAppSettings();
      assert.equal(snapshot.routingPreferenceMode, "quality");
    });

    it("resets a setting back to its virtual default", async () => {
      await setAppSetting("telemetry.enabled", "false");
      let val = await getAppSetting("telemetry.enabled");
      assert.equal(val, "false");

      const resetResult = await resetAppSetting("telemetry.enabled");
      assert.equal(resetResult, true);

      val = await getAppSetting("telemetry.enabled");
      assert.equal(val, "true"); // Reverted to virtual default
    });
  });

  describe("2. Application Settings Validation Constraints", () => {
    it("accepts valid routing preference modes and rejects invalid ones", () => {
      assert.equal(validateSetting("routing.preference_mode", "quality"), "quality");
      assert.equal(validateSetting("routing.preference_mode", "balanced"), "balanced");
      assert.equal(validateSetting("routing.preference_mode", "cost_saving"), "cost_saving");

      assert.throws(
        () => validateSetting("routing.preference_mode", "ultra_fast"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });

    it("accepts valid boolean strings and rejects arbitrary text", () => {
      assert.equal(validateSetting("telemetry.enabled", "true"), "true");
      assert.equal(validateSetting("telemetry.enabled", "false"), "false");

      assert.throws(
        () => validateSetting("telemetry.enabled", "yes"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateSetting("telemetry.enabled", "1"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });

    it("enforces retention days bounds (0 to 365)", () => {
      assert.equal(validateSetting("history.retention_days", "0"), "0");
      assert.equal(validateSetting("history.retention_days", "30"), "30");
      assert.equal(validateSetting("history.retention_days", "365"), "365");

      assert.throws(
        () => validateSetting("history.retention_days", "-5"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateSetting("history.retention_days", "366"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateSetting("history.retention_days", "infinite"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });
  });

  describe("3. Provider Preferences CRUD & Status", () => {
    const mockProvider: ProviderCredentialStatus = {
      providerId: "anthropic",
      isConfigured: true,
      isActive: true,
      priorityWeight: 8,
      baseUrl: "https://api.anthropic.com",
      monthlyBudgetLimit: 100.0,
      currentMonthSpend: 12.5,
      updatedAt: 1700000000000,
    };

    it("retrieves configured provider preferences", async () => {
      seedMockProviderPreference(mockProvider);

      const prefs = await getProviderPreferences("anthropic");
      assert.ok(prefs);
      assert.equal(prefs.providerId, "anthropic");
      assert.equal(prefs.priorityWeight, 8);
      assert.equal(prefs.baseUrl, "https://api.anthropic.com");
      assert.equal(prefs.monthlyBudgetLimit, 100.0);
    });

    it("returns null when querying unconfigured provider preferences", async () => {
      const prefs = await getProviderPreferences("unknown-provider");
      assert.equal(prefs, null);
    });

    it("lists all configured provider preferences sorted by priority descending", async () => {
      seedMockProviderPreference({ ...mockProvider, providerId: "p1", priorityWeight: 3 });
      seedMockProviderPreference({ ...mockProvider, providerId: "p2", priorityWeight: 9 });
      seedMockProviderPreference({ ...mockProvider, providerId: "p3", priorityWeight: 6 });

      const list = await listProviderPreferences();
      assert.equal(list.length, 3);
      assert.equal(list[0].providerId, "p2");
      assert.equal(list[1].providerId, "p3");
      assert.equal(list[2].providerId, "p1");
    });

    it("atomically updates provider preferences while preserving spend and credential state", async () => {
      seedMockProviderPreference(mockProvider);

      const updated = await updateProviderPreferences({
        providerId: "anthropic",
        priorityWeight: 10,
        monthlyBudgetLimit: 250.0,
        baseUrl: "https://custom.anthropic.proxy.internal",
      });

      assert.equal(updated.priorityWeight, 10);
      assert.equal(updated.monthlyBudgetLimit, 250.0);
      assert.equal(updated.baseUrl, "https://custom.anthropic.proxy.internal");
      // Current spend is strictly preserved
      assert.equal(updated.currentMonthSpend, 12.5);
      assert.equal(updated.isConfigured, true);
    });

    it("resets provider preferences to documented defaults while preserving spend", async () => {
      seedMockProviderPreference(mockProvider);

      const reset = await resetProviderPreferences("anthropic");

      assert.equal(reset.isActive, true);
      assert.equal(reset.priorityWeight, 5); // Default priority
      assert.equal(reset.monthlyBudgetLimit, null);
      assert.equal(reset.baseUrl, null);
      assert.equal(reset.currentMonthSpend, 12.5); // Preserved
      assert.equal(reset.isConfigured, true);
    });
  });

  describe("4. Provider Preferences Validation & Security Boundaries", () => {
    it("rejects preference updates for unconfigured providers", async () => {
      await assert.rejects(
        async () => {
          await updateProviderPreferences({
            providerId: "nonexistent",
            priorityWeight: 5,
          });
        },
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });

    it("rejects priority weights outside 1..10 range", async () => {
      seedMockProviderPreference({
        providerId: "openai",
        isConfigured: true,
        isActive: true,
        priorityWeight: 5,
        currentMonthSpend: 0,
        updatedAt: Date.now(),
      });

      await assert.rejects(
        async () => {
          await updateProviderPreferences({
            providerId: "openai",
            priorityWeight: 0,
          });
        },
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );

      await assert.rejects(
        async () => {
          await updateProviderPreferences({
            providerId: "openai",
            priorityWeight: 11,
          });
        },
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });

    it("rejects negative or NaN budget limits", async () => {
      seedMockProviderPreference({
        providerId: "openai",
        isConfigured: true,
        isActive: true,
        priorityWeight: 5,
        currentMonthSpend: 0,
        updatedAt: Date.now(),
      });

      await assert.rejects(
        async () => {
          await updateProviderPreferences({
            providerId: "openai",
            monthlyBudgetLimit: -10,
          });
        },
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });

    it("enforces base URL security rules (rejects non-network schemes and embedded credentials)", () => {
      assert.equal(validateBaseUrl("https://api.openai.com/v1"), "https://api.openai.com/v1");
      assert.equal(validateBaseUrl("http://localhost:11434"), "http://localhost:11434");
      assert.equal(validateBaseUrl("http://127.0.0.1:8080"), "http://127.0.0.1:8080");

      assert.throws(
        () => validateBaseUrl("javascript:alert(1)"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateBaseUrl("file:///etc/passwd"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateBaseUrl("data:text/html,payload"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateBaseUrl("https://user:pass@proxy.example.com"),
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });

    it("validates provider ID format", () => {
      assert.equal(validateProviderId("openai"), "openai");
      assert.equal(validateProviderId("custom-proxy_1"), "custom-proxy_1");

      assert.throws(
        () => validateProviderId("a"), // Too short
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateProviderId("OpenAI"), // Uppercase
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
      assert.throws(
        () => validateProviderId("invalid name!"), // Space & special chars
        (err) => err instanceof IpcError && err.category === "InvalidInput"
      );
    });
  });

  describe("5. Zero-Secret Boundary Invariant", () => {
    it("guarantees AppSettingsSnapshot contains zero credential or secret fields", async () => {
      const snapshot = await getAppSettings();
      const keys = Object.keys(snapshot);

      assert.ok(!keys.includes("apiKey"));
      assert.ok(!keys.includes("api_key"));
      assert.ok(!keys.includes("secret"));
      assert.ok(!keys.includes("encryptedApiKey"));
      assert.ok(!keys.includes("ciphertext"));
    });

    it("guarantees ProviderCredentialStatus contains zero secret material", async () => {
      seedMockProviderPreference({
        providerId: "deepseek",
        isConfigured: true,
        isActive: true,
        priorityWeight: 5,
        currentMonthSpend: 0,
        updatedAt: Date.now(),
      });

      const prefs = await getProviderPreferences("deepseek");
      assert.ok(prefs);
      const keys = Object.keys(prefs);

      assert.ok(!keys.includes("apiKey"));
      assert.ok(!keys.includes("api_key"));
      assert.ok(!keys.includes("encryptedApiKey"));
      assert.ok(!keys.includes("encrypted_api_key"));
      assert.ok(!keys.includes("ciphertext"));
    });
  });

  describe("6. IPC Boundary Round-Trip (Simulated Tauri Environment)", () => {
    it("dispatches cmd_get_app_settings via mock Tauri IPC registry", async () => {
      setMockTauriContext(true);
      registerMockCommandHandler(IPC_COMMANDS.GET_APP_SETTINGS, async () => {
        return {
          routingPreferenceMode: "cost_saving",
          telemetryEnabled: false,
          historyRetentionDays: 60,
          windowStartMaximized: true,
        };
      });

      const snapshot = await getAppSettings();
      assert.equal(snapshot.routingPreferenceMode, "cost_saving");
      assert.equal(snapshot.telemetryEnabled, false);
      assert.equal(snapshot.historyRetentionDays, 60);
      assert.equal(snapshot.windowStartMaximized, true);
    });

    it("dispatches cmd_update_provider_preferences via mock Tauri IPC registry", async () => {
      setMockTauriContext(true);
      registerMockCommandHandler(IPC_COMMANDS.UPDATE_PROVIDER_PREFERENCES, async (args) => {
        const input = (args as { input: { providerId: string; priorityWeight: number } }).input;
        return {
          providerId: input.providerId,
          isConfigured: true,
          isActive: true,
          priorityWeight: input.priorityWeight,
          baseUrl: null,
          monthlyBudgetLimit: null,
          currentMonthSpend: 0,
          updatedAt: Date.now(),
        };
      });

      const updated = await updateProviderPreferences({
        providerId: "openai",
        priorityWeight: 9,
      });

      assert.equal(updated.providerId, "openai");
      assert.equal(updated.priorityWeight, 9);
      assert.equal(updated.isConfigured, true);
    });
  });
});
