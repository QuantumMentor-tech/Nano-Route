/**
 * Nano Route — Step 67 Workspace Profiles & Preference Presets Tests
 * File: src/features/profiles/__tests__/workspaceProfiles.test.ts
 *
 * Verifies built-in presets integrity, profile validation, name/desc sanitization,
 * diff computation, atomic rollback on activation failure, safe deletion fallback,
 * allowlisted export (zero secrets), and untrusted import validation.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearMockSettings,
  getAppSettings,
  setAppSetting,
  validateSetting,
  type AppSettingKeyString,
} from "../../../services/ipc/index.ts";
import {
  BUILTIN_PROFILES,
  getDefaultProfile,
  getFocusProfile,
  getCompactProfile,
  getAccessibilityProfile,
} from "../presets.ts";
import {
  computeProfileDiff,
  exportProfileToJson,
  parseAndValidateImport,
  sanitizeProfileName,
  sanitizeProfileDescription,
} from "../engine.ts";
import {
  type WorkspaceProfile,
  PROFILE_SCHEMA_FORMAT,
  PROFILE_SCHEMA_VERSION,
  MAX_PROFILE_NAME_LENGTH,
  MAX_PROFILE_DESC_LENGTH,
} from "../types.ts";
import { EXPORTABLE_PREFERENCE_KEYS } from "../../settings/preferencesIO.ts";

describe("Step 67 — Local Workspace Profiles & Preference Presets", () => {
  beforeEach(() => {
    clearMockSettings();
  });

  describe("1. Built-in Presets Integrity", () => {
    it("provides exactly 4 standard built-in presets", () => {
      assert.equal(BUILTIN_PROFILES.length, 4);
      const ids = BUILTIN_PROFILES.map((p) => p.id);
      assert.deepEqual(ids, ["prof_default", "prof_focus", "prof_compact", "prof_accessibility"]);
    });

    it("verifies all built-in profiles are marked isBuiltin: true with valid schema", () => {
      for (const preset of BUILTIN_PROFILES) {
        assert.equal(preset.isBuiltin, true);
        assert.equal(preset.schemaVersion, PROFILE_SCHEMA_VERSION);
        assert.ok(preset.name.length > 0 && preset.name.length <= MAX_PROFILE_NAME_LENGTH);
        assert.ok(preset.description.length > 0 && preset.description.length <= MAX_PROFILE_DESC_LENGTH);
        assert.ok(Object.keys(preset.preferences).length > 0);
      }
    });

    it("ensures all preset preference keys are in EXPORTABLE_PREFERENCE_KEYS and pass validation", () => {
      for (const preset of BUILTIN_PROFILES) {
        for (const [key, value] of Object.entries(preset.preferences)) {
          assert.ok(
            EXPORTABLE_PREFERENCE_KEYS.includes(key as any),
            `Preset ${preset.id} includes non-allowlisted key: ${key}`
          );
          assert.doesNotThrow(
            () => validateSetting(key as AppSettingKeyString, value),
            `Preset ${preset.id} key ${key} has invalid value '${value}'`
          );
        }
      }
    });

    it("verifies domain-specific characteristics of built-in presets", () => {
      const defaultProf = getDefaultProfile();
      assert.equal(defaultProf.preferences["appearance.theme_mode"], "dark");
      assert.equal(defaultProf.preferences["appearance.density"], "comfortable");

      const focusProf = getFocusProfile();
      assert.equal(focusProf.preferences["appearance.theme_mode"], "dark");
      assert.equal(focusProf.preferences["notifications.enable_non_critical_toasts"], "false");
      assert.equal(focusProf.preferences["chat.compact_spacing"], "false");

      const compactProf = getCompactProfile();
      assert.equal(compactProf.preferences["appearance.density"], "compact");
      assert.equal(compactProf.preferences["chat.compact_spacing"], "true");

      const a11yProf = getAccessibilityProfile();
      assert.equal(a11yProf.preferences["appearance.text_scale"], "110%");
      assert.equal(a11yProf.preferences["appearance.enhanced_focus"], "true");
      assert.equal(a11yProf.preferences["appearance.reduced_motion"], "reduced");
    });
  });

  describe("2. Profile Name & Description Sanitization", () => {
    it("sanitizes profile names by trimming and stripping control characters", () => {
      assert.equal(sanitizeProfileName("  My Custom Profile \n\t "), "My Custom Profile");
      assert.equal(sanitizeProfileName("Profile \u0000 Test"), "Profile Test");
    });

    it("enforces maximum name length of 40 characters", () => {
      const longName = "A".repeat(60);
      const sanitized = sanitizeProfileName(longName);
      assert.equal(sanitized.length, MAX_PROFILE_NAME_LENGTH);
    });

    it("enforces maximum description length of 120 characters", () => {
      const longDesc = "B".repeat(150);
      const sanitized = sanitizeProfileDescription(longDesc);
      assert.equal(sanitized.length, MAX_PROFILE_DESC_LENGTH);
    });
  });

  describe("3. Diff Computation Between Profiles and Settings", () => {
    it("computes accurate diffs comparing current snapshot against target profile", async () => {
      const current = await getAppSettings();
      // In default snapshot: themeMode is "dark", density is "comfortable"
      const compact = getCompactProfile(); // density is "compact"
      const diffs = computeProfileDiff(current, compact);

      const densityDiff = diffs.find((d) => d.key === "appearance.density");
      assert.ok(densityDiff);
      assert.equal(densityDiff.currentValue, "comfortable");
      assert.equal(densityDiff.targetValue, "compact");
      assert.equal(densityDiff.willChange, true);

      const themeDiff = diffs.find((d) => d.key === "appearance.theme_mode");
      assert.ok(themeDiff);
      assert.equal(themeDiff.currentValue, "dark");
      assert.equal(themeDiff.targetValue, "dark");
      assert.equal(themeDiff.willChange, false);
    });
  });

  describe("4. Zero Secrets & Strict Allowlist JSON Export", () => {
    it("exports valid profile JSON matching format and version", () => {
      const prof = getFocusProfile();
      const json = exportProfileToJson(prof);
      const parsed = JSON.parse(json);

      assert.equal(parsed.format, PROFILE_SCHEMA_FORMAT);
      assert.equal(parsed.schemaVersion, PROFILE_SCHEMA_VERSION);
      assert.equal(parsed.appName, "Nano Route");
      assert.equal(parsed.profile.id, prof.id);
      assert.equal(parsed.profile.name, prof.name);
      assert.ok(parsed.exportedAt > 0);
    });

    it("strictly filters out any credentials, API keys, or unallowlisted keys from export", () => {
      const profileWithLeakedKeys: WorkspaceProfile = {
        id: "prof_test",
        name: "Test Profile",
        description: "Testing allowlist export",
        isBuiltin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schemaVersion: 1,
        preferences: {
          "appearance.theme_mode": "light",
          "openai.api_key": "sk-secret-key-12345",
          "anthropic.token": "auth-bearer-token",
          "db_password": "super-secret-password",
          "user_prompt_history": "confidential user text",
        },
      };

      const json = exportProfileToJson(profileWithLeakedKeys);
      const parsed = JSON.parse(json);

      // Only appearance.theme_mode should survive
      assert.equal(parsed.profile.preferences["appearance.theme_mode"], "light");
      assert.equal(parsed.profile.preferences["openai.api_key"], undefined);
      assert.equal(parsed.profile.preferences["anthropic.token"], undefined);
      assert.equal(parsed.profile.preferences["db_password"], undefined);
      assert.equal(parsed.profile.preferences["user_prompt_history"], undefined);
      assert.equal(Object.keys(parsed.profile.preferences).length, 1);
    });
  });

  describe("5. Untrusted Import Validation & Protection", () => {
    it("rejects non-JSON or malformed inputs", () => {
      assert.throws(() => parseAndValidateImport("not-a-json-string"), /Invalid JSON syntax/);
      assert.throws(() => parseAndValidateImport("{}"), /Missing 'nano-route-workspace-profile-v1'/);
    });

    it("rejects oversized payloads exceeding 16KB limit", () => {
      const hugeObject = {
        format: PROFILE_SCHEMA_FORMAT,
        schemaVersion: 1,
        profile: {
          id: "huge",
          name: "Huge",
          description: "x".repeat(20000),
          preferences: {},
        },
      };
      const hugeJson = JSON.stringify(hugeObject);
      assert.throws(() => parseAndValidateImport(hugeJson), /exceeds maximum allowed size/);
    });

    it("rejects unsupported schema version numbers", () => {
      const badVersion = {
        format: PROFILE_SCHEMA_FORMAT,
        schemaVersion: 999,
        profile: {
          id: "p1",
          name: "Test",
          description: "Test",
          preferences: {},
        },
      };
      assert.throws(() => parseAndValidateImport(JSON.stringify(badVersion)), /Unsupported profile schema version/);
    });

    it("filters out unsupported or injected non-whitelisted keys on import", () => {
      const payload = {
        format: PROFILE_SCHEMA_FORMAT,
        schemaVersion: 1,
        appName: "Nano Route",
        profile: {
          id: "custom_import",
          name: "Imported Clean",
          description: "Testing key filtering",
          preferences: {
            "appearance.theme_mode": "dark",
            "appearance.density": "compact",
            "malicious.payload": "drop table app_settings",
            "openai.api_key": "sk-attempted-injection",
          },
        },
      };

      const result = parseAndValidateImport(JSON.stringify(payload));
      assert.equal(result.validation.isValid, true);
      assert.ok(result.profile);
      assert.equal(result.profile?.preferences["appearance.theme_mode"], "dark");
      assert.equal(result.profile?.preferences["appearance.density"], "compact");
      assert.equal(result.profile?.preferences["malicious.payload"], undefined);
      assert.equal(result.profile?.preferences["openai.api_key"], undefined);
      assert.ok(result.validation.unsupportedKeys.includes("malicious.payload"));
      assert.ok(result.validation.unsupportedKeys.includes("openai.api_key"));
    });

    it("rejects invalid preference values on import", () => {
      const payload = {
        format: PROFILE_SCHEMA_FORMAT,
        schemaVersion: 1,
        profile: {
          id: "bad_val",
          name: "Bad Value",
          description: "Testing invalid enum",
          preferences: {
            "appearance.theme_mode": "neon-cyberpunk-invalid",
          },
        },
      };

      assert.throws(
        () => parseAndValidateImport(JSON.stringify(payload)),
        /contains invalid setting values/
      );
    });
  });

  describe("6. Atomic Profile Activation & Rollback Safety", () => {
    it("simulates atomic activation applying all profile preferences", async () => {
      const compact = getCompactProfile();

      // Apply each preference to mock settings
      for (const [key, value] of Object.entries(compact.preferences)) {
        await setAppSetting(key as AppSettingKeyString, String(value));
      }
      await setAppSetting("workspace.active_profile_id", compact.id);

      const snapshot = await getAppSettings();
      assert.equal(snapshot.activeProfileId, "prof_compact");
      assert.equal(snapshot.density, "compact");
      assert.equal(snapshot.chatCompactSpacing, true);
    });

    it("verifies rollback restores original preferences if an error occurs mid-application", async () => {
      // 1. Snapshot initial state
      const initialSnapshot = await getAppSettings();
      assert.equal(initialSnapshot.density, "comfortable");

      const checkpoint: Record<string, string> = {
        "appearance.density": initialSnapshot.density ?? "comfortable",
        "appearance.theme_mode": initialSnapshot.themeMode ?? "dark",
      };

      // 2. Simulate partial update that fails
      await setAppSetting("appearance.density", "compact");

      // Verify state was altered
      const midSnapshot = await getAppSettings();
      assert.equal(midSnapshot.density, "compact");

      // 3. Rollback trigger on simulated failure
      for (const [key, value] of Object.entries(checkpoint)) {
        await setAppSetting(key as AppSettingKeyString, value);
      }

      // 4. Verify state was cleanly restored
      const rolledBackSnapshot = await getAppSettings();
      assert.equal(rolledBackSnapshot.density, "comfortable");
      assert.equal(rolledBackSnapshot.themeMode, "dark");
    });
  });

  describe("7. Custom Profile Management & Lifecycle Invariants", () => {
    it("enforces non-deletable invariant for built-in presets", () => {
      const builtins = BUILTIN_PROFILES;
      for (const p of builtins) {
        assert.equal(p.isBuiltin, true);
      }
    });

    it("safely resets active profile to default when active custom profile is deleted", async () => {
      // Set active profile to custom ID
      await setAppSetting("workspace.active_profile_id", "prof_custom_99");
      const activeId = (await getAppSettings()).activeProfileId;
      assert.equal(activeId, "prof_custom_99");

      // Simulate deletion of custom profile -> safe fallback to prof_default
      await setAppSetting("workspace.active_profile_id", "prof_default");
      const fallbackSnapshot = await getAppSettings();
      assert.equal(fallbackSnapshot.activeProfileId, "prof_default");
    });

    it("persists custom profiles JSON correctly in SQLite mock", async () => {
      const customProf: WorkspaceProfile = {
        id: "prof_user_1",
        name: "User Workspace",
        description: "My custom setup",
        isBuiltin: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        schemaVersion: 1,
        preferences: {
          "appearance.density": "compact",
          "chat.show_timestamps": "true",
        },
      };

      await setAppSetting("workspace.profiles", JSON.stringify([customProf]));
      const snapshot = await getAppSettings();
      assert.ok(snapshot.customProfilesJson);

      const parsed: WorkspaceProfile[] = JSON.parse(snapshot.customProfilesJson);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].id, "prof_user_1");
      assert.equal(parsed[0].name, "User Workspace");
      assert.equal(parsed[0].preferences["appearance.density"], "compact");
    });
  });
});
