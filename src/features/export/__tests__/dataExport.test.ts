/**
 * Nano Route — User Data Export & Privacy Portability Test Suite
 * File: src/features/export/__tests__/dataExport.test.ts
 *
 * Verifies Step 70 export catalog allowlists, CSV formula injection defense,
 * secret leak detection, selective category serialization, and non-destructive read invariants.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  type ExportCategory,
  EXPORT_PACKAGE_FORMAT,
  EXPORT_SCHEMA_VERSION,
} from "../types.ts";
import {
  EXPORT_CATEGORIES_CATALOG,
  LOCAL_DATA_INVENTORY_MAP,
} from "../catalog.ts";
import {
  sanitizeCsvCell,
  formatRecordsToCsv,
} from "../csvSanitizer.ts";
import {
  executeDataExport,
  scanForSecretLeaks,
} from "../engine.ts";
import {
  setAppSetting,
  getAppSettings,
} from "../../../services/ipc/settings.ts";
import {
  saveProviderCredential,
  listProviderCredentialStatuses,
} from "../../../services/ipc/credentials.ts";

describe("Step 70 — User Data Export & Privacy Portability", () => {
  beforeEach(async () => {
    // Seed default settings
    await setAppSetting("appearance.theme_mode", "dark");
    await setAppSetting("appearance.density", "comfortable");
    await setAppSetting("routing.preference_mode", "quality");
  });

  describe("1. Catalog & Data Classification Specifications", () => {
    const categories: ExportCategory[] = [
      "chat_history",
      "user_preferences",
      "workspace_profiles",
      "telemetry_and_analytics",
      "provider_registry_metadata",
    ];

    it("defines all 5 exportable categories in the authoritative catalog", () => {
      for (const cat of categories) {
        const desc = EXPORT_CATEGORIES_CATALOG[cat];
        assert.ok(desc, `Missing descriptor for category ${cat}`);
        assert.equal(desc.category, cat);
        assert.ok(desc.displayName.length > 0);
        assert.ok(desc.shortDescription.length > 0);
        assert.ok(Array.isArray(desc.includedFields));
        assert.ok(Array.isArray(desc.excludedFields));
      }
    });

    it("verifies accurate data classifications and sensitivity labels", () => {
      assert.equal(EXPORT_CATEGORIES_CATALOG.chat_history.classification, "USER_CONTENT");
      assert.equal(EXPORT_CATEGORIES_CATALOG.chat_history.hasUserContent, true);
      assert.ok(EXPORT_CATEGORIES_CATALOG.chat_history.warningNotice?.includes("personal prompt"));

      assert.equal(EXPORT_CATEGORIES_CATALOG.user_preferences.classification, "USER_CONFIGURATION");
      assert.equal(EXPORT_CATEGORIES_CATALOG.workspace_profiles.classification, "USER_CONFIGURATION");
      assert.equal(EXPORT_CATEGORIES_CATALOG.telemetry_and_analytics.classification, "ANALYTICS_DATA");
      assert.equal(EXPORT_CATEGORIES_CATALOG.provider_registry_metadata.classification, "METADATA_ONLY");
    });

    it("explicitly documents unexportable secret entities in local data inventory", () => {
      const credEntity = LOCAL_DATA_INVENTORY_MAP.find((e) => e.entityName.includes("API Keys"));
      assert.ok(credEntity);
      assert.equal(credEntity.classification, "SECRET");
      assert.equal(credEntity.isExportable, false);
      assert.ok(credEntity.notes.includes("STRICTLY FORBIDDEN"));
    });
  });

  describe("2. CSV Sanitizer & Formula Injection Protection", () => {
    it("sanitizes formula injection triggers by prefixing with a single quote", () => {
      assert.equal(sanitizeCsvCell("=SUM(A1:A10)"), "'=SUM(A1:A10)");
      assert.equal(sanitizeCsvCell("+cmd|' /C calc'!A0"), "'+cmd|' /C calc'!A0");
      assert.equal(sanitizeCsvCell("-100"), "'-100");
      assert.equal(sanitizeCsvCell("@malicious_macro"), "'@malicious_macro");
      assert.equal(sanitizeCsvCell("\tleading_tab"), "'\tleading_tab");
      assert.equal(sanitizeCsvCell("\rleading_cr"), "\"'\rleading_cr\"");
    });

    it("leaves safe plain text and numbers without formula triggers unaltered", () => {
      assert.equal(sanitizeCsvCell("Normal Chat Message"), "Normal Chat Message");
      assert.equal(sanitizeCsvCell("12345"), "12345");
      assert.equal(sanitizeCsvCell(""), "");
      assert.equal(sanitizeCsvCell(null), "");
    });

    it("properly quotes and escapes commas, existing double quotes, and newlines", () => {
      assert.equal(sanitizeCsvCell('Hello, "World"'), '"Hello, ""World"""');
      assert.equal(sanitizeCsvCell("Line 1\nLine 2"), '"Line 1\nLine 2"');
    });

    it("formats records into valid sanitized CSV with headers", () => {
      const records = [
        { id: "1", title: "Test Session", formula: "=1+1" },
        { id: "2", title: 'Quotes "Here"', formula: "Safe Value" },
      ];
      const headers = [
        { key: "id" as const, label: "ID" },
        { key: "title" as const, label: "Title" },
        { key: "formula" as const, label: "Formula" },
      ];

      const csv = formatRecordsToCsv(headers, records);
      assert.ok(csv.includes("ID,Title,Formula\r\n"));
      assert.ok(csv.includes("1,Test Session,'=1+1\r\n"));
      assert.ok(csv.includes('2,"Quotes ""Here""",Safe Value\r\n'));
    });
  });

  describe("3. Secret Leak Scanner", () => {
    it("detects forbidden secret keys in JSON strings", () => {
      const payloadWithKey = JSON.stringify({ api_key: "secret123" });
      const scan1 = scanForSecretLeaks(payloadWithKey);
      assert.equal(scan1.hasLeak, true);
      assert.ok(scan1.matchedKeys.includes("api_key"));

      const payloadWithToken = JSON.stringify({ token: "bearer_xyz" });
      const scan2 = scanForSecretLeaks(payloadWithToken);
      assert.equal(scan2.hasLeak, true);

      const payloadWithOpenAiPattern = JSON.stringify({ val: "sk-1234567890123456789012" });
      const scan3 = scanForSecretLeaks(payloadWithOpenAiPattern);
      assert.equal(scan3.hasLeak, true);
    });

    it("verifies safe payload passes scanning without false positives", () => {
      const safePayload = JSON.stringify({
        format: EXPORT_PACKAGE_FORMAT,
        sessions: [{ id: "sess_1", title: "Safe Chat" }],
        preferences: { "appearance.theme_mode": "dark" },
      });
      const scan = scanForSecretLeaks(safePayload);
      assert.equal(scan.hasLeak, false);
      assert.equal(scan.matchedKeys.length, 0);
    });
  });

  describe("4. Selective Export Execution & Verification", () => {
    it("exports preferences and workspace profiles without leaking credentials", async () => {
      // Seed a credential to verify it is NEVER exported
      await saveProviderCredential({
        providerId: "openai",
        apiKey: "sk-test-super-secret-key-12345",
      });

      const result = await executeDataExport({
        categories: ["user_preferences", "workspace_profiles"],
        format: "json",
      });

      assert.equal(result.success, true);
      assert.equal(result.status, "COMPLETED");
      assert.equal(result.verificationPassed, true);
      assert.equal(result.manifest.format, EXPORT_PACKAGE_FORMAT);
      assert.equal(result.manifest.exportSchemaVersion, EXPORT_SCHEMA_VERSION);

      // Verify preferences are present
      assert.ok(result.packageData.preferences);
      assert.equal(result.packageData.preferences["appearance.theme_mode"], "dark");

      // Verify credentials are absent
      const serialized = result.serializedJson ?? "";
      assert.ok(!serialized.includes("sk-test-super-secret"));
      assert.ok(!serialized.includes("apiKey"));
      assert.ok(!serialized.includes("dpapi"));
    });

    it("exports chat history and produces CSV files when requested", async () => {
      const result = await executeDataExport({
        categories: ["chat_history", "telemetry_and_analytics"],
        format: "json_and_csv",
      });

      assert.equal(result.success, true);
      assert.equal(result.status, "COMPLETED");
      assert.ok(result.csvFiles);
      assert.ok("messages.csv" in result.csvFiles);
      assert.ok("sessions.csv" in result.csvFiles);
      assert.ok(result.manifest.categories.includes("chat_history"));
      assert.ok(result.manifest.categories.includes("telemetry_and_analytics"));
      assert.ok(result.manifest.checksum.startsWith("chk_"));
    });

    it("strictly preserves source database records without mutation or deletion", async () => {
      const preSettings = await getAppSettings();
      const preCreds = await listProviderCredentialStatuses();

      const result = await executeDataExport({
        categories: [
          "chat_history",
          "user_preferences",
          "workspace_profiles",
          "telemetry_and_analytics",
          "provider_registry_metadata",
        ],
        format: "json",
      });

      assert.equal(result.success, true);

      // Verify post-export state is identical
      const postSettings = await getAppSettings();
      assert.equal(postSettings.themeMode, preSettings.themeMode);
      assert.equal(postSettings.routingPreferenceMode, preSettings.routingPreferenceMode);

      const postCreds = await listProviderCredentialStatuses();
      assert.equal(postCreds.length, preCreds.length);
    });
  });
});
