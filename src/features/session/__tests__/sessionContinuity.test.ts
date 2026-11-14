/**
 * Nano Route — Step 68 Workspace Session Continuity & State Restoration Tests
 * File: src/features/session/__tests__/sessionContinuity.test.ts
 *
 * Verifies state classification, route allowlist validation, query sanitization,
 * snapshot serialization/deserialization, corrupted payload recovery,
 * startup precedence, crash marker management, and zero-secrets security invariants.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  clearMockSettings,
  getAppSettings,
  setAppSetting,
  validateSetting,
} from "../../../services/ipc/index.ts";
import {
  SESSION_SCHEMA_FORMAT,
  SESSION_SCHEMA_VERSION,
  MAX_SESSION_PAYLOAD_BYTES,
  type WorkspaceSessionSnapshot,
} from "../types.ts";
import { STATE_CLASSIFICATION_CATALOG } from "../catalog.ts";
import {
  ROUTE_ALLOWLIST,
  SAFE_DEFAULT_ROUTE,
  validateSafeRoute,
  serializeSessionSnapshot,
  parseAndValidateSessionSnapshot,
  resolveStartupRoute,
} from "../engine.ts";

describe("Step 68 — Workspace Session Continuity & Safe State Restoration", () => {
  beforeEach(() => {
    clearMockSettings();
  });

  describe("1. State Classification Catalog Integrity", () => {
    it("contains exhaustive entries covering all 5 architectural state categories", () => {
      const categories = new Set(STATE_CLASSIFICATION_CATALOG.map((c) => c.classification));
      assert.ok(categories.has("PERSISTENT_PREFERENCE"));
      assert.ok(categories.has("SESSION_STATE"));
      assert.ok(categories.has("DERIVED_STATE"));
      assert.ok(categories.has("TRANSIENT_RUNTIME_STATE"));
      assert.ok(categories.has("FORBIDDEN_TO_RESTORE"));
    });

    it("verifies all catalog entries declare required audit fields", () => {
      for (const entry of STATE_CLASSIFICATION_CATALOG) {
        assert.ok(entry.field.length > 0);
        assert.ok(entry.type.length > 0);
        assert.ok(entry.purpose.length > 0);
        assert.ok(entry.source.length > 0);
        assert.ok(entry.persistenceRule.length > 0);
        assert.ok(entry.restorationRule.length > 0);
        assert.ok(entry.fallback.length > 0);
      }
    });

    it("ensures transient and forbidden entries strictly prohibit persistence", () => {
      const forbidden = STATE_CLASSIFICATION_CATALOG.filter(
        (c) => c.classification === "FORBIDDEN_TO_RESTORE" || c.classification === "TRANSIENT_RUNTIME_STATE"
      );
      for (const item of forbidden) {
        assert.ok(
          item.persistenceRule.includes("NEVER") || item.persistenceRule.includes("DEDICATED"),
          `Item ${item.field} does not explicitly prohibit session persistence: ${item.persistenceRule}`
        );
      }
    });
  });

  describe("2. Route Allowlisting & Query Parameter Sanitization", () => {
    it("validates all standard application routes", () => {
      for (const route of ROUTE_ALLOWLIST) {
        assert.equal(validateSafeRoute(route), route);
      }
    });

    it("rejects non-allowlisted routes and falls back to safe default", () => {
      assert.equal(validateSafeRoute("/admin"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute("/unknown/deep/path"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute(""), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute(null), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute(undefined), SAFE_DEFAULT_ROUTE);
    });

    it("strictly blocks external URLs, script injections, and dangerous schemes", () => {
      assert.equal(validateSafeRoute("javascript:alert(1)"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute("data:text/html,<script>alert(1)</script>"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute("https://evil.com/phish"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute("http://localhost:8080/exploit"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute("/chat?<script>alert(1)</script>"), SAFE_DEFAULT_ROUTE);
      assert.equal(validateSafeRoute("/settings?eval(1)"), SAFE_DEFAULT_ROUTE);
    });

    it("sanitizes safe query parameters for supported routes", () => {
      // Valid settings tabs
      assert.equal(validateSafeRoute("/settings?tab=profiles"), "/settings?tab=profiles");
      assert.equal(validateSafeRoute("/settings?tab=appearance"), "/settings?tab=appearance");
      assert.equal(validateSafeRoute("/settings?tab=invalid_tab_name"), "/settings");

      // Valid help articles
      assert.equal(validateSafeRoute("/help?article=what-is-nano-route"), "/help?article=what-is-nano-route");
      assert.equal(validateSafeRoute("/help?article=bad<tag>"), "/help");

      // Valid chat sessions
      assert.equal(validateSafeRoute("/chat?session=sess_12345"), "/chat?session=sess_12345");
    });
  });

  describe("3. Snapshot Serialization & Size Boundaries", () => {
    it("serializes valid session snapshot matching schema format and version", () => {
      const snapshot: Partial<WorkspaceSessionSnapshot> = {
        route: "/history",
        activeProfileId: "prof_compact",
        sidebarCollapsed: true,
      };

      const jsonStr = serializeSessionSnapshot(snapshot);
      const parsed = JSON.parse(jsonStr);

      assert.equal(parsed.format, SESSION_SCHEMA_FORMAT);
      assert.equal(parsed.schemaVersion, SESSION_SCHEMA_VERSION);
      assert.equal(parsed.route, "/history");
      assert.equal(parsed.activeProfileId, "prof_compact");
      assert.equal(parsed.sidebarCollapsed, true);
      assert.ok(parsed.savedAt > 0);
    });

    it("enforces maximum payload limit of 8KB", () => {
      const hugeSnapshot: Partial<WorkspaceSessionSnapshot> = {
        route: "/chat",
        historyFilter: "X".repeat(10000), // Exceeds 8KB
      };

      assert.throws(
        () => serializeSessionSnapshot(hugeSnapshot),
        /exceeds limit of 8192 bytes/
      );
    });
  });

  describe("4. Untrusted Snapshot Parsing & Corruption Handling", () => {
    it("gracefully flags empty or non-string inputs", () => {
      assert.equal(parseAndValidateSessionSnapshot("").isValid, false);
      assert.equal(parseAndValidateSessionSnapshot("   ").isValid, false);
      assert.equal(parseAndValidateSessionSnapshot(null).isValid, false);
    });

    it("gracefully catches malformed JSON syntax without throwing", () => {
      const result = parseAndValidateSessionSnapshot("{ malformed: json, ");
      assert.equal(result.isValid, false);
      assert.equal(result.snapshot, null);
      assert.ok(result.error?.includes("Invalid JSON syntax"));
    });

    it("rejects oversized payloads before processing", () => {
      const hugeStr = " ".repeat(MAX_SESSION_PAYLOAD_BYTES + 10);
      const result = parseAndValidateSessionSnapshot(hugeStr);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes("exceeds maximum allowed size"));
    });

    it("rejects unknown format envelope strings", () => {
      const wrongEnvelope = JSON.stringify({
        format: "unknown-desktop-session-v9",
        schemaVersion: 1,
        route: "/chat",
      });
      const result = parseAndValidateSessionSnapshot(wrongEnvelope);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes("Unsupported format envelope"));
    });

    it("rejects future unsupported schema versions", () => {
      const futureVersion = JSON.stringify({
        format: SESSION_SCHEMA_FORMAT,
        schemaVersion: 999,
        route: "/chat",
      });
      const result = parseAndValidateSessionSnapshot(futureVersion);
      assert.equal(result.isValid, false);
      assert.ok(result.error?.includes("Unsupported future schema version 999"));
    });

    it("successfully parses valid session snapshot and sanitizes route", () => {
      const validPayload = JSON.stringify({
        format: SESSION_SCHEMA_FORMAT,
        schemaVersion: 1,
        savedAt: 1731580000000,
        route: "/settings?tab=general",
        activeProfileId: "prof_focus",
        sidebarCollapsed: false,
      });

      const result = parseAndValidateSessionSnapshot(validPayload);
      assert.equal(result.isValid, true);
      assert.ok(result.snapshot);
      assert.equal(result.snapshot?.route, "/settings?tab=general");
      assert.equal(result.snapshot?.activeProfileId, "prof_focus");
      assert.equal(result.snapshot?.sidebarCollapsed, false);
    });
  });

  describe("5. Startup Precedence & Route Resolution", () => {
    it("prefers mandatory onboarding over any session route", () => {
      const precedence = resolveStartupRoute({
        isOnboardingMandatory: true,
        restorePreviousSession: true,
        sessionSnapshot: {
          format: SESSION_SCHEMA_FORMAT,
          schemaVersion: 1,
          savedAt: Date.now(),
          route: "/chat",
        },
      });

      assert.equal(precedence.targetRoute, SAFE_DEFAULT_ROUTE);
      assert.ok(precedence.reason.includes("Onboarding"));
    });

    it("respects user preference when session restore is opted out", () => {
      const precedence = resolveStartupRoute({
        isOnboardingMandatory: false,
        restorePreviousSession: false,
        userStartupPreference: "chat",
        sessionSnapshot: {
          format: SESSION_SCHEMA_FORMAT,
          schemaVersion: 1,
          savedAt: Date.now(),
          route: "/history",
        },
      });

      assert.equal(precedence.targetRoute, "/chat");
      assert.ok(precedence.reason.includes("disabled by user preference"));
    });

    it("safely resets to Dashboard if crash occurred on complex settings route", () => {
      const precedence = resolveStartupRoute({
        isOnboardingMandatory: false,
        restorePreviousSession: true,
        lastExitStatus: "unexpected_exit",
        sessionSnapshot: {
          format: SESSION_SCHEMA_FORMAT,
          schemaVersion: 1,
          savedAt: Date.now(),
          route: "/settings?tab=providers",
        },
      });

      assert.equal(precedence.targetRoute, SAFE_DEFAULT_ROUTE);
      assert.ok(precedence.reason.includes("Recovered from unexpected exit"));
    });

    it("restores safe session route when clean exit occurred", () => {
      const precedence = resolveStartupRoute({
        isOnboardingMandatory: false,
        restorePreviousSession: true,
        lastExitStatus: "clean_exit",
        sessionSnapshot: {
          format: SESSION_SCHEMA_FORMAT,
          schemaVersion: 1,
          savedAt: Date.now(),
          route: "/history",
        },
      });

      assert.equal(precedence.targetRoute, "/history");
      assert.ok(precedence.reason.includes("Restored from previous session snapshot"));
    });
  });

  describe("6. Exit Status Marker & Crash Lifecycle", () => {
    it("validates setting for workspace.last_exit_status", () => {
      assert.equal(validateSetting("workspace.last_exit_status", "clean_exit"), "clean_exit");
      assert.equal(validateSetting("workspace.last_exit_status", "unexpected_exit"), "unexpected_exit");
      assert.equal(validateSetting("workspace.last_exit_status", "startup_recovery"), "startup_recovery");
      assert.equal(validateSetting("workspace.last_exit_status", "unknown"), "unknown");

      assert.throws(() => validateSetting("workspace.last_exit_status", "corrupted_marker"), /Invalid exit status/);
    });

    it("tracks exit status transitions across mock settings", async () => {
      // 1. App startup arms marker to unexpected_exit
      await setAppSetting("workspace.last_exit_status", "unexpected_exit");
      let snapshot = await getAppSettings();
      assert.equal(snapshot.lastExitStatus, "unexpected_exit");

      // 2. Normal shutdown disarms marker to clean_exit
      await setAppSetting("workspace.last_exit_status", "clean_exit");
      snapshot = await getAppSettings();
      assert.equal(snapshot.lastExitStatus, "clean_exit");
    });
  });

  describe("7. Zero Secrets & Non-Sensitive Boundary Invariant", () => {
    it("confirms session snapshots contain zero credentials or decrypted tokens", () => {
      const sampleSnapshot: WorkspaceSessionSnapshot = {
        format: SESSION_SCHEMA_FORMAT,
        schemaVersion: 1,
        savedAt: Date.now(),
        route: "/chat",
        activeProfileId: "prof_default",
      };

      const serialized = serializeSessionSnapshot(sampleSnapshot);
      assert.ok(!serialized.includes("api_key"));
      assert.ok(!serialized.includes("token"));
      assert.ok(!serialized.includes("secret"));
      assert.ok(!serialized.includes("password"));
      assert.ok(!serialized.includes("dpapi"));
    });
  });
});
