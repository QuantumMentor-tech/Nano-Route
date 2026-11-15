/**
 * Nano Route — Privacy & Data Governance Center Test Suite
 * File: src/features/privacy-center/__tests__/privacyCenter.test.ts
 *
 * Implements Step 88 Verification:
 * - Data inventory normalization and sensitivity classification
 * - Secret boundary protection and zero-leak invariants
 * - Feature-by-feature local vs remote transmission disclosures
 * - Retention visibility and storage semantics disclosures
 * - Export and Reset scope verification
 * - Diagnostics evaluation and posture derivation
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  assemblePrivacyCenterSnapshot,
  buildNormalizedInventory,
  computePrivacyDiagnostics,
  verifyZeroSecretsExposed,
  AUTHORITATIVE_DATA_FLOW_DISCLOSURES,
  AUTHORITATIVE_EXPORT_RESET_DISCLOSURE,
} from "../engine.ts";
import type {
  DataInventorySnapshot,
  RetentionPolicyConfig,
} from "../../../services/ipc/types.ts";
import type { PrivacyCenterSnapshot } from "../types.ts";

describe("Privacy & Data Governance Center (Step 88)", () => {
  describe("1. Data Inventory Normalization & Classification", () => {
    it("builds fallback baseline inventory when snapshot is null", () => {
      const inventory = buildNormalizedInventory(null);
      assert.ok(inventory.length >= 7, "Must contain at least 7 primary data categories");

      const chatSessions = inventory.find((i) => i.id === "chat_sessions");
      assert.ok(chatSessions);
      assert.equal(chatSessions?.classification, "USER_CONTENT");
      assert.equal(chatSessions?.dataFlow, "LOCAL_ONLY");

      const credentials = inventory.find((i) => i.id === "credentials");
      assert.ok(credentials);
      assert.equal(credentials?.classification, "SECRET");
      assert.equal(credentials?.isExportable, false);

      const telemetry = inventory.find((i) => i.id === "telemetry");
      assert.ok(telemetry);
      assert.equal(telemetry?.classification, "OPERATIONAL");
      assert.equal(telemetry?.dataFlow, "OPERATIONAL_METADATA");
    });

    it("normalizes live snapshot items with accurate sensitivity classes", () => {
      const mockSnapshot: DataInventorySnapshot = {
        generatedAtMs: Date.now(),
        databasePath: "C:\\Users\\User\\AppData\\Local\\NanoRoute\\nanoroute.db",
        storageSemanticsNote: "SQLite logical deletion",
        providerBoundaryNote: "External provider policy applies post-transmission",
        items: [
          {
            storeId: "sessions",
            displayName: "Chat Sessions",
            tableOrLocation: "sessions",
            category: "user_content",
            deletionPolicy: "user_only",
            recordCount: 15,
            containsSensitiveData: false,
            includedInRetentionCleanup: true,
            includedInFullWipe: true,
            description: "Active conversation threads",
          },
          {
            storeId: "credentials",
            displayName: "Provider Credentials",
            tableOrLocation: "Windows DPAPI",
            category: "secret",
            deletionPolicy: "credential_sensitive",
            recordCount: 3,
            containsSensitiveData: true,
            includedInRetentionCleanup: false,
            includedInFullWipe: true,
            description: "Encrypted API keys",
          },
          {
            storeId: "telemetry",
            displayName: "Operational Telemetry",
            tableOrLocation: "telemetry_events",
            category: "operational_telemetry",
            deletionPolicy: "retention_eligible",
            recordCount: 420,
            containsSensitiveData: false,
            includedInRetentionCleanup: true,
            includedInFullWipe: true,
            description: "Latency and cost logs",
          },
        ],
        credentials: [
          {
            providerId: "anthropic",
            isActive: true,
            hasCredential: true,
            updatedAt: Date.now(),
          },
        ],
        totalUserSessions: 15,
        totalUserMessages: 45,
        totalTelemetryRecords: 420,
        totalSearchIndexEntries: 60,
        totalConfiguredCredentials: 1,
        totalAppSettings: 25,
        activeExecutionsCount: 0,
      };

      const inventory = buildNormalizedInventory(mockSnapshot);
      assert.equal(inventory.length, 3);

      const secretItem = inventory.find((i) => i.id === "credentials");
      assert.ok(secretItem);
      assert.equal(secretItem?.classification, "SECRET");
      assert.equal(secretItem?.isExportable, false);

      const telemetryItem = inventory.find((i) => i.id === "telemetry");
      assert.ok(telemetryItem);
      assert.equal(telemetryItem?.classification, "OPERATIONAL");
      assert.equal(telemetryItem?.dataFlow, "OPERATIONAL_METADATA");
    });
  });

  describe("2. Secret Boundary & Zero Plaintext Isolation", () => {
    it("ensures zero secrets are marked as exportable in the snapshot", async () => {
      const snapshot = await assemblePrivacyCenterSnapshot();
      assert.ok(snapshot.inventory.length > 0);

      const isValid = verifyZeroSecretsExposed(snapshot);
      assert.equal(isValid, true, "Snapshot must guarantee zero secrets are exportable");

      const secretItems = snapshot.inventory.filter((i) => i.classification === "SECRET");
      for (const item of secretItems) {
        assert.equal(
          item.isExportable,
          false,
          `Secret ${item.id} must never be marked exportable`
        );
      }
    });

    it("detects secret leak violation if a secret is maliciously marked exportable", () => {
      const maliciousSnapshot: PrivacyCenterSnapshot = {
        generatedAtMs: Date.now(),
        posture: "LOCAL_FIRST",
        inventory: [
          {
            id: "leaked_secret",
            name: "Leaked Key",
            dataCategory: "secret",
            classification: "SECRET",
            dataFlow: "LOCAL_ONLY",
            storageLocationDescription: "Plaintext",
            retentionDescription: "Indefinite",
            recordCount: 1,
            isDeletable: true,
            isExportable: true, // VIOLATION!
            isUserSelectableInRequest: false,
            description: "Corrupted exportability",
          },
        ],
        flows: [],
        diagnostics: {
          credentialProtectionOk: true,
          secretIsolationOk: false,
          telemetryContentExcluded: true,
          diagnosticsSanitized: true,
          retentionConfigured: false,
          localFirstIntegrityOk: true,
          unresolvedWarningsCount: 0,
          unresolvedCriticalCount: 1,
          posture: "ATTENTION_REQUIRED",
          findings: ["Critical: Secret exportable"],
        },
        retention: {
          historyRetentionEnabled: false,
          historyRetentionDays: 30,
          telemetryRetentionEnabled: false,
          telemetryRetentionDays: 30,
          pinnedSessionsExcluded: true,
          cleanupConfirmationRequired: true,
          storageSemanticsDisclosure: "note",
          providerBoundaryDisclosure: "note",
        },
        exportReset: AUTHORITATIVE_EXPORT_RESET_DISCLOSURE,
        storageSemanticsNote: "note",
        providerBoundaryNote: "note",
        totalRecordsCount: 1,
        sensitiveCategoriesCount: 1,
        secretsProtectedCount: 1,
      };

      const isValid = verifyZeroSecretsExposed(maliciousSnapshot);
      assert.equal(isValid, false, "Must detect violation when a secret is marked exportable");
    });
  });

  describe("3. Data Flow Disclosures & Transmission Boundaries", () => {
    it("contains authoritative disclosures for all core Nano Route features", () => {
      const expectedFeatures = [
        "chat_messages",
        "drafts",
        "attachments",
        "private_notes",
        "bookmarks_highlights",
        "context_collections",
        "credentials",
        "telemetry",
        "diagnostics",
        "connectivity",
      ];

      for (const feat of expectedFeatures) {
        const found = AUTHORITATIVE_DATA_FLOW_DISCLOSURES.find((f) => f.featureId === feat);
        assert.ok(found, `Must have data flow disclosure for feature '${feat}'`);
        assert.ok(found?.localBehavior.length > 10, "Local behavior must be clearly documented");
        assert.ok(found?.transmissionTrigger.length > 5, "Transmission trigger must be specified");
        assert.ok(found?.neverTransmittedNote.length > 10, "Never transmitted note must be specified");
      }
    });

    it("verifies drafts, notes, and bookmarks are documented as local-first", () => {
      const drafts = AUTHORITATIVE_DATA_FLOW_DISCLOSURES.find((f) => f.featureId === "drafts");
      assert.ok(drafts?.localBehavior.includes("Autosaved to local"));
      assert.ok(drafts?.neverTransmittedNote.includes("Draft content never leaves the computer"));

      const notes = AUTHORITATIVE_DATA_FLOW_DISCLOSURES.find((f) => f.featureId === "private_notes");
      assert.ok(notes?.neverTransmittedNote.includes("Notes remain 100% local"));

      const bookmarks = AUTHORITATIVE_DATA_FLOW_DISCLOSURES.find(
        (f) => f.featureId === "bookmarks_highlights"
      );
      assert.equal(bookmarks?.remoteDestination, "None (Strictly Local).");
    });

    it("verifies telemetry is documented with zero user content", () => {
      const telemetry = AUTHORITATIVE_DATA_FLOW_DISCLOSURES.find((f) => f.featureId === "telemetry");
      assert.ok(telemetry?.neverTransmittedNote.includes("Zero prompt content"));
      assert.equal(telemetry?.remoteDestination, "None (Strictly Local).");
    });
  });

  describe("4. Retention & Housekeeping Disclosures", () => {
    it("assembles retention summary matching application policy config", async () => {
      const customRetention: RetentionPolicyConfig = {
        historyRetentionEnabled: true,
        historyRetentionDays: 60,
        excludePinnedSessions: true,
        telemetryRetentionEnabled: true,
        telemetryRetentionDays: 14,
        cleanupConfirmationRequired: true,
      };

      const snapshot = await assemblePrivacyCenterSnapshot({
        retentionOverride: customRetention,
      });

      assert.equal(snapshot.retention.historyRetentionEnabled, true);
      assert.equal(snapshot.retention.historyRetentionDays, 60);
      assert.equal(snapshot.retention.telemetryRetentionEnabled, true);
      assert.equal(snapshot.retention.telemetryRetentionDays, 14);
      assert.equal(snapshot.retention.pinnedSessionsExcluded, true);

      // Verifies storage disclosures are present
      assert.ok(snapshot.retention.storageSemanticsDisclosure.includes("SQLite free-page reuse"));
      assert.ok(
        snapshot.retention.providerBoundaryDisclosure.includes("external AI providers are governed")
      );
    });
  });

  describe("5. Export & Reset Governance", () => {
    it("discloses exportable categories and strict secret exclusions", () => {
      const disclosure = AUTHORITATIVE_EXPORT_RESET_DISCLOSURE;
      assert.ok(disclosure.exportableCategories.includes("Chat Sessions & Full Histories"));
      assert.ok(disclosure.exportableCategories.includes("Private Notes"));
      assert.ok(disclosure.exportableCategories.includes("Context Collections & Reference Packs"));

      assert.ok(
        disclosure.strictlyExcludedFromExport.includes("Provider API Keys (DPAPI Protected)")
      );
      assert.ok(
        disclosure.strictlyExcludedFromExport.includes("Plaintext Authentication Tokens")
      );
    });

    it("covers the authoritative Step 69 reset scopes", () => {
      const scopes = AUTHORITATIVE_EXPORT_RESET_DISCLOSURE.availableResetScopes;
      const scopeIds = scopes.map((s) => s.id);

      assert.ok(scopeIds.includes("RESET_PREFERENCES"));
      assert.ok(scopeIds.includes("RESET_WORKSPACE"));
      assert.ok(scopeIds.includes("REMOVE_PROVIDER_CREDENTIAL"));
      assert.ok(scopeIds.includes("CLEAR_SELECTED_USER_DATA"));
      assert.ok(scopeIds.includes("FULL_LOCAL_DATA_RESET"));
      assert.ok(scopeIds.includes("FACTORY_RESET"));
    });
  });

  describe("6. Diagnostics & Privacy Posture Derivation", () => {
    it("evaluates posture as LOCAL_FIRST under standard conditions", () => {
      const inventory = buildNormalizedInventory(null);
      const retention: RetentionPolicyConfig = {
        historyRetentionEnabled: false,
        historyRetentionDays: 30,
        excludePinnedSessions: true,
        telemetryRetentionEnabled: false,
        telemetryRetentionDays: 30,
        cleanupConfirmationRequired: true,
      };

      const diagnostics = computePrivacyDiagnostics(inventory, retention);
      assert.equal(diagnostics.posture, "LOCAL_FIRST");
      assert.equal(diagnostics.credentialProtectionOk, true);
      assert.equal(diagnostics.secretIsolationOk, true);
      assert.equal(diagnostics.telemetryContentExcluded, true);
      assert.equal(diagnostics.unresolvedCriticalCount, 0);
    });

    it("flags posture as ATTENTION_REQUIRED if a secret is marked exportable", () => {
      const compromisedInventory = [
        {
          id: "credentials",
          name: "API Keys",
          dataCategory: "secret" as const,
          classification: "SECRET" as const,
          dataFlow: "LOCAL_ONLY" as const,
          storageLocationDescription: "DPAPI",
          retentionDescription: "Indefinite",
          recordCount: 2,
          isDeletable: true,
          isExportable: true, // Invariant violation
          isUserSelectableInRequest: false,
          description: "Keys",
        },
      ];

      const retention: RetentionPolicyConfig = {
        historyRetentionEnabled: false,
        historyRetentionDays: 30,
        excludePinnedSessions: true,
        telemetryRetentionEnabled: false,
        telemetryRetentionDays: 30,
        cleanupConfirmationRequired: true,
      };

      const diagnostics = computePrivacyDiagnostics(compromisedInventory, retention);
      assert.equal(diagnostics.posture, "ATTENTION_REQUIRED");
      assert.equal(diagnostics.secretIsolationOk, false);
      assert.equal(diagnostics.unresolvedCriticalCount, 1);
    });
  });
});
