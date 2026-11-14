/**
 * Nano Route — Application Reset & Factory Defaults Test Suite
 * File: src/features/reset/__tests__/resetFramework.test.ts
 *
 * Verifies Step 69 Reset taxonomy, safety classifications, precondition gating,
 * pre-reset backup options, typed token enforcement, and state verification.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  type ResetOperationType,
  FACTORY_RESET_CONFIRMATION_TOKEN,
  FULL_LOCAL_WIPE_TOKEN,
  CONFIG_RESET_TOKEN,
} from "../types.ts";
import {
  RESET_CATALOG,
  getResetScopeDefinition,
} from "../catalog.ts";
import {
  checkResetPreconditions,
  executeResetOperation,
} from "../engine.ts";
import {
  setAppSetting,
  getAppSettings,
} from "../../../services/ipc/settings.ts";
import {
  saveProviderCredential,
  getProviderCredentialStatus,
  listProviderCredentialStatuses,
  resetCredentialMockStore,
} from "../../../services/ipc/credentials.ts";
import {
  setActiveExecutionRunning,
} from "../../../services/ipc/updater.ts";
import {
  getStoredOnboardingProgress,
  markOnboardingCompleted,
} from "../../onboarding/onboardingStorage.ts";

describe("Step 69 — Controlled Application Reset & Factory Defaults", () => {
  beforeEach(() => {
    setActiveExecutionRunning(false);
    resetCredentialMockStore();
  });

  describe("1. Reset Taxonomy & Catalog Specifications", () => {
    const requiredOps: ResetOperationType[] = [
      "RESET_PREFERENCES",
      "RESET_WORKSPACE",
      "RESET_SESSION_STATE",
      "REMOVE_PROVIDER_CREDENTIAL",
      "RESET_APPLICATION_CONFIGURATION",
      "CLEAR_SELECTED_USER_DATA",
      "FULL_LOCAL_DATA_RESET",
      "FACTORY_RESET",
    ];

    it("defines all 8 required operations in the authoritative catalog", () => {
      for (const op of requiredOps) {
        const def = getResetScopeDefinition(op);
        assert.ok(def, `Missing definition for ${op}`);
        assert.equal(def.operation, op);
        assert.ok(def.displayName.length > 0);
        assert.ok(def.shortDescription.length > 0);
        assert.ok(Array.isArray(def.willChange));
        assert.ok(Array.isArray(def.willBeDeleted));
        assert.ok(Array.isArray(def.willRemain));
        assert.ok(def.recoveryOption.length > 0);
      }
    });

    it("verifies accurate safety classifications", () => {
      assert.equal(RESET_CATALOG.RESET_PREFERENCES.classification, "NON_DESTRUCTIVE_RESET");
      assert.equal(RESET_CATALOG.RESET_SESSION_STATE.classification, "NON_DESTRUCTIVE_RESET");
      assert.equal(RESET_CATALOG.RESET_WORKSPACE.classification, "CONFIGURATION_RESET");
      assert.equal(RESET_CATALOG.RESET_APPLICATION_CONFIGURATION.classification, "CONFIGURATION_RESET");
      assert.equal(RESET_CATALOG.REMOVE_PROVIDER_CREDENTIAL.classification, "SECURITY_SENSITIVE");
      assert.equal(RESET_CATALOG.CLEAR_SELECTED_USER_DATA.classification, "DATA_DELETION");
      assert.equal(RESET_CATALOG.FULL_LOCAL_DATA_RESET.classification, "DATA_DELETION");
      assert.equal(RESET_CATALOG.FACTORY_RESET.classification, "IRREVERSIBLE_OR_PRACTICALLY_IRREVERSIBLE");
    });

    it("enforces explicit confirmation tokens on high-impact operations", () => {
      assert.equal(RESET_CATALOG.RESET_APPLICATION_CONFIGURATION.requiresTypedToken, true);
      assert.equal(RESET_CATALOG.RESET_APPLICATION_CONFIGURATION.expectedToken, CONFIG_RESET_TOKEN);

      assert.equal(RESET_CATALOG.FULL_LOCAL_DATA_RESET.requiresTypedToken, true);
      assert.equal(RESET_CATALOG.FULL_LOCAL_DATA_RESET.expectedToken, FULL_LOCAL_WIPE_TOKEN);

      assert.equal(RESET_CATALOG.FACTORY_RESET.requiresTypedToken, true);
      assert.equal(RESET_CATALOG.FACTORY_RESET.expectedToken, FACTORY_RESET_CONFIRMATION_TOKEN);
    });

    it("offers pre-reset backup for destructive and high-impact operations", () => {
      assert.equal(RESET_CATALOG.RESET_PREFERENCES.offersPreResetBackup, false);
      assert.equal(RESET_CATALOG.RESET_APPLICATION_CONFIGURATION.offersPreResetBackup, true);
      assert.equal(RESET_CATALOG.CLEAR_SELECTED_USER_DATA.offersPreResetBackup, true);
      assert.equal(RESET_CATALOG.FULL_LOCAL_DATA_RESET.offersPreResetBackup, true);
      assert.equal(RESET_CATALOG.FACTORY_RESET.offersPreResetBackup, true);
    });
  });

  describe("2. Precondition Validation & Conflict Protection", () => {
    it("permits reset execution when application is idle", async () => {
      const result = await checkResetPreconditions();
      assert.equal(result.canProceed, true);
      assert.equal(result.blockReason, null);
    });

    it("blocks reset execution when prompt streaming or AI generation is active", async () => {
      setActiveExecutionRunning(true);
      const result = await checkResetPreconditions();
      assert.equal(result.canProceed, false);
      assert.ok(result.blockReason?.includes("Active AI generation"));
      setActiveExecutionRunning(false);
    });

    it("rejects execution if unconfirmed", async () => {
      await assert.rejects(
        () =>
          executeResetOperation({
            operation: "RESET_PREFERENCES",
            confirmed: false,
          }),
        /requires explicit confirmation/
      );
    });

    it("rejects execution if typed confirmation token does not match", async () => {
      await assert.rejects(
        () =>
          executeResetOperation({
            operation: "FACTORY_RESET",
            confirmed: true,
            typedToken: "WRONG TOKEN",
          }),
        /Confirmation mismatch/
      );
    });

    it("requires providerId for REMOVE_PROVIDER_CREDENTIAL", async () => {
      await assert.rejects(
        () =>
          executeResetOperation({
            operation: "REMOVE_PROVIDER_CREDENTIAL",
            confirmed: true,
          }),
        /Provider ID must be specified/
      );
    });
  });

  describe("3. Execution of Non-Destructive Resets", () => {
    it("executes RESET_PREFERENCES successfully and restores defaults", async () => {
      await setAppSetting("appearance.theme_mode", "light");
      await setAppSetting("appearance.density", "compact");

      const result = await executeResetOperation({
        operation: "RESET_PREFERENCES",
        confirmed: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);
      const settings = await getAppSettings();
      assert.equal(settings.themeMode, "dark");
    });

    it("executes RESET_WORKSPACE and resets custom profiles", async () => {
      await setAppSetting("workspace.profiles", JSON.stringify([{ id: "custom1", name: "Custom" }]));
      await setAppSetting("workspace.active_profile_id", "custom1");

      const result = await executeResetOperation({
        operation: "RESET_WORKSPACE",
        confirmed: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);
      const settings = await getAppSettings();
      assert.equal(settings.activeProfileId, "prof_default");
      assert.equal(settings.customProfilesJson, "[]");
    });

    it("executes RESET_SESSION_STATE and clears session snapshot", async () => {
      await setAppSetting("workspace.session_state", JSON.stringify({ route: "/settings" }));
      await setAppSetting("workspace.last_exit_status", "unexpected_exit");

      const result = await executeResetOperation({
        operation: "RESET_SESSION_STATE",
        confirmed: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);
      const settings = await getAppSettings();
      assert.equal(settings.sessionStateJson, "");
      assert.equal(settings.lastExitStatus, "clean_exit");
    });
  });

  describe("4. Security-Sensitive Credential Removal", () => {
    it("removes specified provider credential while preserving other providers", async () => {
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-test-openai-12345",
      });
      await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-test-54321",
      });

      const result = await executeResetOperation({
        operation: "REMOVE_PROVIDER_CREDENTIAL",
        providerId: "openai",
        confirmed: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);

      const openaiStatus = await getProviderCredentialStatus("openai");
      assert.equal(openaiStatus, null);

      const anthropicStatus = await getProviderCredentialStatus("anthropic");
      assert.ok(anthropicStatus);
      assert.equal(anthropicStatus.isConfigured, true);
    });
  });

  describe("5. High-Impact & Factory Reset Execution", () => {
    it("executes RESET_APPLICATION_CONFIGURATION with pre-reset backup", async () => {
      await setAppSetting("routing.preference_mode", "cost_saving");
      await setAppSetting("telemetry.enabled", "false");

      const result = await executeResetOperation({
        operation: "RESET_APPLICATION_CONFIGURATION",
        confirmed: true,
        typedToken: CONFIG_RESET_TOKEN,
        createBackupFirst: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);
      assert.ok(result.backupCreatedId);

      const settings = await getAppSettings();
      assert.equal(settings.routingPreferenceMode, "quality");
      assert.equal(settings.telemetryEnabled, true);
    });

    it("executes CLEAR_SELECTED_USER_DATA targeting history", async () => {
      const result = await executeResetOperation({
        operation: "CLEAR_SELECTED_USER_DATA",
        userDataScope: "history_only",
        confirmed: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);
    });

    it("executes FULL_LOCAL_DATA_RESET, wiping data while preserving provider credentials", async () => {
      await saveProviderCredential({
        providerId: "anthropic",
        apiKey: "sk-ant-keep-me-safe",
      });

      const result = await executeResetOperation({
        operation: "FULL_LOCAL_DATA_RESET",
        confirmed: true,
        typedToken: FULL_LOCAL_WIPE_TOKEN,
        createBackupFirst: false,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);

      // Verify credentials remain preserved
      const cred = await getProviderCredentialStatus("anthropic");
      assert.ok(cred);
      assert.equal(cred.isConfigured, true);
    });

    it("executes FACTORY_RESET to restore complete pristine state and re-activate onboarding", async () => {
      // 1. Seed dummy data
      await saveProviderCredential({
        providerId: "groq",
        apiKey: "gsk-test-groq-key",
      });
      await setAppSetting("workspace.profiles", JSON.stringify([{ id: "prof_temp" }]));
      await setAppSetting("workspace.session_state", JSON.stringify({ route: "/chat" }));
      markOnboardingCompleted();

      const preOnboarding = getStoredOnboardingProgress();
      assert.equal(preOnboarding.state, "COMPLETED");

      // 2. Execute Factory Reset
      const result = await executeResetOperation({
        operation: "FACTORY_RESET",
        confirmed: true,
        typedToken: FACTORY_RESET_CONFIRMATION_TOKEN,
        createBackupFirst: true,
      });

      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verified, true);
      assert.equal(result.requiresRestart, true);
      assert.equal(result.requiresOnboarding, true);
      assert.ok(result.backupCreatedId);

      // 3. Verify clean state
      const postSettings = await getAppSettings();
      assert.equal(postSettings.sessionStateJson, "");
      assert.equal(postSettings.customProfilesJson, "[]");

      const creds = await listProviderCredentialStatuses();
      const configuredCreds = creds.filter((c) => c.isConfigured);
      assert.equal(configuredCreds.length, 0);

      const postOnboarding = getStoredOnboardingProgress();
      assert.equal(postOnboarding.state, "NOT_STARTED");
    });
  });
});
