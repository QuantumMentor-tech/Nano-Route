/**
 * Nano Route — Step 66 User Preferences & Workspace Personalization Tests
 * File: src/features/settings/__tests__/userPreferences.test.ts
 *
 * Verifies preference defaults, domain validation, safe migration fallbacks,
 * section-specific resets, zero-leakage JSON export/import, and security boundaries.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_APP_SETTINGS,
  validateSetting,
  getAppSettings,
  setAppSetting,
  resetSettingsSection,
  clearMockSettings,
  __internalGetMockSettingsStore,
} from "../../../services/ipc/index.ts";
import {
  exportPreferencesToJson,
  importPreferencesFromJson,
  PREFERENCES_SCHEMA_FORMAT,
  PREFERENCES_SCHEMA_VERSION,
} from "../preferencesIO.ts";

describe("Step 66 — User Preferences & Workspace Personalization", () => {
  beforeEach(() => {
    clearMockSettings();
  });

  describe("1. Preference Virtual Defaults & Completeness", () => {
    it("provides safe, accessible defaults across all preference domains", () => {
      assert.equal(DEFAULT_APP_SETTINGS.themeMode, "dark");
      assert.equal(DEFAULT_APP_SETTINGS.density, "comfortable");
      assert.equal(DEFAULT_APP_SETTINGS.reducedMotion, "system");
      assert.equal(DEFAULT_APP_SETTINGS.textScale, "100%");
      assert.equal(DEFAULT_APP_SETTINGS.enhancedFocus, false);
      assert.equal(DEFAULT_APP_SETTINGS.startupRoute, "overview");
      assert.equal(DEFAULT_APP_SETTINGS.sidebarCollapsed, false);
      assert.equal(DEFAULT_APP_SETTINGS.confirmChatClear, true);
      assert.equal(DEFAULT_APP_SETTINGS.chatShowTimestamps, false);
      assert.equal(DEFAULT_APP_SETTINGS.chatCompactSpacing, false);
      assert.equal(DEFAULT_APP_SETTINGS.chatEnterToSend, true);
      assert.equal(DEFAULT_APP_SETTINGS.chatAutoScroll, true);
      assert.equal(DEFAULT_APP_SETTINGS.notificationEnableNonCriticalToasts, true);
      assert.equal(DEFAULT_APP_SETTINGS.notificationToastDurationMs, 5000);
      assert.equal(DEFAULT_APP_SETTINGS.paletteShowDescriptions, true);
      assert.equal(DEFAULT_APP_SETTINGS.paletteShowShortcuts, true);
    });

    it("resolves virtual defaults on clean start without persisted settings", async () => {
      const snapshot = await getAppSettings();
      assert.equal(snapshot.themeMode, "dark");
      assert.equal(snapshot.density, "comfortable");
      assert.equal(snapshot.reducedMotion, "system");
      assert.equal(snapshot.startupRoute, "overview");
      assert.equal(snapshot.chatEnterToSend, true);
      assert.equal(snapshot.notificationToastDurationMs, 5000);
    });
  });

  describe("2. Strict Domain Validation", () => {
    it("validates theme mode options and rejects unknown themes", () => {
      assert.equal(validateSetting("appearance.theme_mode", "dark"), "dark");
      assert.equal(validateSetting("appearance.theme_mode", "light"), "light");
      assert.equal(validateSetting("appearance.theme_mode", "system"), "system");

      assert.throws(
        () => validateSetting("appearance.theme_mode", "solarized"),
        /Invalid theme mode/
      );
    });

    it("validates interface density and rejects unsupported variants", () => {
      assert.equal(validateSetting("appearance.density", "comfortable"), "comfortable");
      assert.equal(validateSetting("appearance.density", "compact"), "compact");

      assert.throws(
        () => validateSetting("appearance.density", "dense"),
        /Invalid interface density/
      );
    });

    it("validates reduced motion modes", () => {
      assert.equal(validateSetting("appearance.reduced_motion", "system"), "system");
      assert.equal(validateSetting("appearance.reduced_motion", "reduced"), "reduced");
      assert.equal(validateSetting("appearance.reduced_motion", "standard"), "standard");

      assert.throws(
        () => validateSetting("appearance.reduced_motion", "instant"),
        /Invalid motion preference/
      );
    });

    it("validates text scale tokens strictly", () => {
      assert.equal(validateSetting("appearance.text_scale", "100%"), "100%");
      assert.equal(validateSetting("appearance.text_scale", "110%"), "110%");
      assert.equal(validateSetting("appearance.text_scale", "125%"), "125%");

      assert.throws(
        () => validateSetting("appearance.text_scale", "150%"),
        /Invalid text scale/
      );
    });

    it("validates boolean preferences strictly", () => {
      assert.equal(validateSetting("appearance.enhanced_focus", "true"), "true");
      assert.equal(validateSetting("appearance.enhanced_focus", "false"), "false");

      assert.throws(
        () => validateSetting("appearance.enhanced_focus", "yes"),
        /Invalid boolean value/
      );
      assert.throws(
        () => validateSetting("chat.enter_to_send", "1"),
        /Invalid boolean value/
      );
    });

    it("validates notification toast duration bounds (1000ms - 30000ms)", () => {
      assert.equal(validateSetting("notifications.toast_duration_ms", "5000"), "5000");
      assert.equal(validateSetting("notifications.toast_duration_ms", "1000"), "1000");
      assert.equal(validateSetting("notifications.toast_duration_ms", "30000"), "30000");

      assert.throws(
        () => validateSetting("notifications.toast_duration_ms", "500"),
        /Must be an integer between 1000 and 30000/
      );
      assert.throws(
        () => validateSetting("notifications.toast_duration_ms", "45000"),
        /Must be an integer between 1000 and 30000/
      );
    });

    it("validates startup route options", () => {
      assert.equal(validateSetting("workspace.startup_route", "overview"), "overview");
      assert.equal(validateSetting("workspace.startup_route", "chat"), "chat");

      assert.throws(
        () => validateSetting("workspace.startup_route", "settings"),
        /Invalid startup route/
      );
    });
  });

  describe("3. Safe Fallback & Corrupted Value Recovery", () => {
    it("falls back to virtual default if SQLite contains malformed enum or number", async () => {
      const store = __internalGetMockSettingsStore();
      // Inject corrupted values directly into storage
      store.set("appearance.theme_mode", "corrupted_theme");
      store.set("notifications.toast_duration_ms", "not_a_number");
      store.set("workspace.startup_route", "invalid_route");

      const snapshot = await getAppSettings();
      // Fallbacks trigger cleanly without throwing exceptions
      assert.equal(snapshot.themeMode, "dark");
      assert.equal(snapshot.notificationToastDurationMs, 5000);
      assert.equal(snapshot.startupRoute, "overview");
    });
  });

  describe("4. Section-Specific Reset & Safe Reset Policy", () => {
    it("resets only appearance preferences without mutating chat or routing settings", async () => {
      await setAppSetting("appearance.theme_mode", "light");
      await setAppSetting("appearance.density", "compact");
      await setAppSetting("chat.show_timestamps", "true");
      await setAppSetting("routing.preference_mode", "quality");

      // Reset only appearance
      const resetCount = await resetSettingsSection("appearance");
      assert.equal(resetCount, 2);

      const snapshot = await getAppSettings();
      assert.equal(snapshot.themeMode, "dark"); // Reverted to default
      assert.equal(snapshot.density, "comfortable"); // Reverted to default
      assert.equal(snapshot.chatShowTimestamps, true); // Preserved!
      assert.equal(snapshot.routingPreferenceMode, "quality"); // Preserved!
    });

    it("resets all user preferences while leaving credentials and history untouched", async () => {
      await setAppSetting("appearance.theme_mode", "light");
      await setAppSetting("chat.show_timestamps", "true");
      await setAppSetting("notifications.enable_non_critical_toasts", "false");
      await setAppSetting("window.start_maximized", "true");
      await setAppSetting("history.retention_days", "30");

      const resetCount = await resetSettingsSection("all_preferences");
      assert.ok(resetCount >= 4);

      const snapshot = await getAppSettings();
      assert.equal(snapshot.themeMode, "dark");
      assert.equal(snapshot.chatShowTimestamps, false);
      assert.equal(snapshot.notificationEnableNonCriticalToasts, true);
      assert.equal(snapshot.windowStartMaximized, false);
      // History retention days is a data lifecycle control: preserved and untouched!
      assert.equal(snapshot.historyRetentionDays, 30);
    });
  });

  describe("5. Preferences Portability (Export & Import)", () => {
    it("exports preferences adhering strictly to the schema format with zero credentials", async () => {
      await setAppSetting("appearance.theme_mode", "light");
      await setAppSetting("appearance.density", "compact");
      await setAppSetting("chat.show_timestamps", "true");

      const snapshot = await getAppSettings();
      const json = exportPreferencesToJson(snapshot);
      const parsed = JSON.parse(json);

      assert.equal(parsed.format, PREFERENCES_SCHEMA_FORMAT);
      assert.equal(parsed.version, PREFERENCES_SCHEMA_VERSION);
      assert.equal(parsed.appName, "Nano Route");
      assert.equal(parsed.preferences["appearance.theme_mode"], "light");
      assert.equal(parsed.preferences["appearance.density"], "compact");
      assert.equal(parsed.preferences["chat.show_timestamps"], "true");

      // Verify ZERO secrets or keys exist in the exported file
      const rawText = json.toLowerCase();
      assert.ok(!rawText.includes("api_key"));
      assert.ok(!rawText.includes("secret"));
      assert.ok(!rawText.includes("password"));
      assert.ok(!rawText.includes("bearer"));
    });

    it("validates and imports a valid preferences file", async () => {
      const validPayload = {
        format: PREFERENCES_SCHEMA_FORMAT,
        version: PREFERENCES_SCHEMA_VERSION,
        exportedAt: Date.now(),
        appName: "Nano Route",
        preferences: {
          "appearance.theme_mode": "light",
          "appearance.density": "compact",
          "chat.show_timestamps": "true",
          "notifications.toast_duration_ms": "8000",
        },
      };

      const result = await importPreferencesFromJson(JSON.stringify(validPayload));
      assert.equal(result.success, true);
      assert.equal(result.appliedCount, 4);
      assert.equal(result.errors.length, 0);

      const snapshot = await getAppSettings();
      assert.equal(snapshot.themeMode, "light");
      assert.equal(snapshot.density, "compact");
      assert.equal(snapshot.chatShowTimestamps, true);
      assert.equal(snapshot.notificationToastDurationMs, 8000);
    });

    it("rejects unsupported format or corrupted JSON without mutating state", async () => {
      const corruptPayload = {
        format: "unknown-hacked-format",
        preferences: { "appearance.theme_mode": "light" },
      };

      const result = await importPreferencesFromJson(JSON.stringify(corruptPayload));
      assert.equal(result.success, false);
      assert.ok(result.errors[0].includes("Unsupported format"));

      const snapshot = await getAppSettings();
      assert.equal(snapshot.themeMode, "dark"); // Unchanged
    });

    it("safely filters out non-whitelisted or dangerous keys during import", async () => {
      const payloadWithInjectedKeys = {
        format: PREFERENCES_SCHEMA_FORMAT,
        version: PREFERENCES_SCHEMA_VERSION,
        exportedAt: Date.now(),
        appName: "Nano Route",
        preferences: {
          "appearance.theme_mode": "light",
          "injected.malicious_script": "alert(1)",
          "db.drop_tables": "TRUE",
          "api.secret_key": "sk-12345",
        },
      };

      const result = await importPreferencesFromJson(JSON.stringify(payloadWithInjectedKeys));
      assert.equal(result.success, true);
      assert.equal(result.appliedCount, 1); // Only the valid appearance key was applied
      assert.equal(result.errors.length, 3); // 3 non-whitelisted keys ignored

      const snapshot = await getAppSettings();
      assert.equal(snapshot.themeMode, "light");
    });
  });
});

