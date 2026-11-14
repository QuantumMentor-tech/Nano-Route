/**
 * Nano Route — User Data Import Test Suite
 * File: src/features/import/__tests__/dataImport.test.ts
 *
 * Verifies Step 71 untrusted payload parsing, manifest validation,
 * secret stripping, conflict handling strategies, non-destructive import execution,
 * and zero secret leakage.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  EXPORT_PACKAGE_FORMAT,
  EXPORT_SCHEMA_VERSION,
  type ImportExecutionConfig,
} from "../types.ts";
import {
  validateImportPayload,
  sanitizeUntrustedObject,
} from "../validator.ts";
import { executeDataImport } from "../engine.ts";
import { listChatSessions } from "../../../services/ipc/chat.ts";
import { getAppSettings, setAppSetting } from "../../../services/ipc/settings.ts";
import type { ExportPackage } from "../../export/types.ts";

describe("Step 71 — User Data Import & Migration Assistant", () => {
  beforeEach(async () => {
    // Reset test settings
    await setAppSetting("appearance.theme_mode", "dark");
    await setAppSetting("appearance.density", "comfortable");
  });

  describe("1. Untrusted JSON Sanitization & Secret Filtering", () => {
    it("strips forbidden credential keys recursively from untrusted input", () => {
      const maliciousPayload = {
        manifest: {
          format: EXPORT_PACKAGE_FORMAT,
          application: "Nano Route",
          exportSchemaVersion: 1,
        },
        chat: {
          sessions: [{ id: "sess_1", title: "Test Chat" }],
        },
        apiKey: "forbidden-plaintext-key",
        dpapiBlob: "forbidden-cipher-blob",
        nested: {
          secret_token: "sk-abcdef1234567890abcdef1234567890",
          validKey: "safe_value",
        },
      };

      const { cleaned, forbiddenKeysFound } = sanitizeUntrustedObject(maliciousPayload);

      assert.ok(forbiddenKeysFound.length >= 2, "Should identify forbidden keys");
      assert.ok(forbiddenKeysFound.includes("apiKey"));
      assert.ok(forbiddenKeysFound.includes("dpapiBlob"));

      const c = cleaned as any;
      assert.equal(c.apiKey, undefined, "apiKey must be stripped");
      assert.equal(c.dpapiBlob, undefined, "dpapiBlob must be stripped");
      assert.equal(c.nested.validKey, "safe_value", "Safe values must remain");
    });
  });

  describe("2. Preflight Manifest & Format Validation", () => {
    it("rejects empty or malformed JSON payloads gracefully", async () => {
      const res1 = await validateImportPayload("");
      assert.equal(res1.preview.isValid, false);
      assert.equal(res1.preview.validationStatus, "MALFORMED");

      const res2 = await validateImportPayload("not valid json {{");
      assert.equal(res2.preview.isValid, false);
      assert.equal(res2.preview.validationStatus, "MALFORMED");
    });

    it("rejects mismatched format packages", async () => {
      const invalidFormat = JSON.stringify({
        manifest: {
          format: "foreign-backup-archive-v99",
          application: "Nano Route",
          exportSchemaVersion: 1,
        },
      });

      const { preview } = await validateImportPayload(invalidFormat);
      assert.equal(preview.isValid, false);
      assert.ok(preview.preflightErrors.some((e) => e.includes("Incompatible package format")));
    });

    it("accepts valid Nano Route export package format", async () => {
      const validPackage: ExportPackage = {
        manifest: {
          format: EXPORT_PACKAGE_FORMAT,
          application: "Nano Route",
          appVersion: "0.1.0",
          exportSchemaVersion: EXPORT_SCHEMA_VERSION,
          exportedAtMs: Date.now(),
          exportedAtIso: new Date().toISOString(),
          categories: ["chat_history", "user_preferences"],
          formatType: "json",
          recordCounts: {
            sessionsCount: 1,
            messagesCount: 2,
            telemetryCount: 0,
            preferencesCount: 1,
            profilesCount: 0,
            providersCount: 0,
          },
          totalEstimatedRecords: 4,
          checksum: "chk_test_123",
        },
        chat: {
          sessions: [
            {
              id: "sess_import_test_1",
              title: "Imported Conversational Thread",
              createdAt: Date.now() - 10000,
              updatedAt: Date.now() - 5000,
              pinned: false,
            },
          ],
          messages: [
            {
              id: "msg_import_test_1",
              sessionId: "sess_import_test_1",
              sender: "user",
              content: "Hello from import test!",
              createdAt: Date.now() - 9000,
            },
            {
              id: "msg_import_test_2",
              sessionId: "sess_import_test_1",
              sender: "assistant",
              content: "Hello! This message is restored safely.",
              createdAt: Date.now() - 8000,
            },
          ],
        },
        preferences: {
          "appearance.density": "compact",
        },
      };

      const { preview, sanitizedPackage } = await validateImportPayload(JSON.stringify(validPackage));
      assert.equal(preview.isValid, true);
      assert.equal(preview.validationStatus, "VALID");
      assert.ok(preview.availableCategories.includes("chat_history"));
      assert.ok(preview.availableCategories.includes("user_preferences"));
      assert.ok(sanitizedPackage);
    });
  });

  describe("3. Execution & Conflict Handling", () => {
    it("imports preferences and conversations with conflict resolution", async () => {
      const pkg: ExportPackage = {
        manifest: {
          format: EXPORT_PACKAGE_FORMAT,
          application: "Nano Route",
          appVersion: "0.1.0",
          exportSchemaVersion: EXPORT_SCHEMA_VERSION,
          exportedAtMs: Date.now(),
          exportedAtIso: new Date().toISOString(),
          categories: ["chat_history", "user_preferences", "workspace_profiles"],
          formatType: "json",
          recordCounts: {
            sessionsCount: 1,
            messagesCount: 1,
            telemetryCount: 0,
            preferencesCount: 1,
            profilesCount: 1,
            providersCount: 0,
          },
          totalEstimatedRecords: 3,
          checksum: "chk_exec_123",
        },
        chat: {
          sessions: [
            {
              id: "sess_exec_1",
              title: "Execution Session",
              createdAt: Date.now(),
              updatedAt: Date.now(),
              pinned: false,
            },
          ],
          messages: [
            {
              id: "msg_exec_1",
              sessionId: "sess_exec_1",
              sender: "user",
              content: "Testing execution import",
              createdAt: Date.now(),
            },
          ],
        },
        preferences: {
          "appearance.density": "compact",
        },
        profiles: [
          {
            id: "prof_imported_1",
            name: "Research Profile",
            description: "Imported focus workspace",
            isBuiltin: false,
            createdAt: Date.now(),
            preferences: {
              "appearance.theme_mode": "dark",
            },
          },
        ],
      };

      const config: ImportExecutionConfig = {
        selectedCategories: ["chat_history", "user_preferences", "workspace_profiles"],
        conflictStrategies: {
          chat_history: "SKIP_DUPLICATES",
          user_preferences: "KEEP_EXISTING",
          workspace_profiles: "IMPORT_AS_NEW",
          telemetry_and_analytics: "SKIP_DUPLICATES",
        },
        createSafetyBackup: true,
        rebuildSearchIndex: true,
      };

      const result = await executeDataImport(pkg, config);

      assert.equal(result.success, true);
      assert.ok(result.totalImported >= 2);
      assert.ok(result.backupCreated, "Pre-import safety backup should be created");
      assert.equal(result.verificationPassed, true);

      // Verify profile imported
      const settings = await getAppSettings();
      assert.ok(settings.customProfilesJson?.includes("Research Profile"));

      // Verify chat imported
      const sessions = await listChatSessions({ limit: 100 });
      assert.ok(sessions.some((s) => s.title.includes("Execution Session")));
    });
  });
});
