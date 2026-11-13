/**
 * Step 58 — Production Incident Response & Crash Diagnostics Test Suite
 * File: src/features/maintenance/__tests__/incidentResponseDiagnostics.test.ts
 *
 * Validates incident classification, severity calculation, privacy-preserving
 * support evidence generation, secret redaction, and incident documentation integrity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  calculateIncidentSeverity,
  generateSupportEvidenceBundle,
} from "../incidentDiagnostics.ts";

describe("Step 58 Production Incident Response & Crash Diagnostics", () => {
  // ==========================================================================
  // 1. INCIDENT TAXONOMY & SEVERITY MODEL
  // ==========================================================================
  describe("1. Incident Taxonomy & Severity Scoring", () => {
    it("escalates active security compromise to SEV-1 regardless of category", () => {
      const severity = calculateIncidentSeverity({
        category: "CAT_M_SECURITY_SUPPLY_CHAIN",
        impactsAllUsers: false,
        dataLossRisk: false,
        securityCompromise: true,
        workaroundAvailable: false,
      });
      assert.equal(severity, "SEV-1");
    });

    it("evaluates fatal startup failure impacting all users as SEV-1 when no workaround exists", () => {
      const severity = calculateIncidentSeverity({
        category: "CAT_B_STARTUP_FAILURE",
        impactsAllUsers: true,
        dataLossRisk: false,
        securityCompromise: false,
        workaroundAvailable: false,
      });
      assert.equal(severity, "SEV-1");
    });

    it("evaluates database corruption as SEV-2 when contained with rollback workaround", () => {
      const severity = calculateIncidentSeverity({
        category: "CAT_G_DATABASE_CORRUPTION",
        impactsAllUsers: false,
        dataLossRisk: true,
        securityCompromise: false,
        workaroundAvailable: true,
      });
      assert.equal(severity, "SEV-2");
    });

    it("evaluates provider drift or router cascades with local SLM fallback as SEV-3", () => {
      const severity = calculateIncidentSeverity({
        category: "CAT_D_PROVIDER_DRIFT_OUTAGE",
        impactsAllUsers: false,
        dataLossRisk: false,
        securityCompromise: false,
        workaroundAvailable: true,
      });
      assert.equal(severity, "SEV-3");
    });

    it("evaluates minor UI formatting or non-blocking glitches as SEV-4", () => {
      const severity = calculateIncidentSeverity({
        category: "CAT_C_RUNTIME_EXCEPTION",
        impactsAllUsers: false,
        dataLossRisk: false,
        securityCompromise: false,
        workaroundAvailable: true,
      });
      assert.equal(severity, "SEV-4");
    });
  });

  // ==========================================================================
  // 2. PRIVACY-PRESERVING SUPPORT EVIDENCE & REDACTION
  // ==========================================================================
  describe("2. Support Evidence Bundling & Secret Redaction", () => {
    it("redacts API keys, tokens, DPAPI hints, and Windows user paths from diagnostic logs", () => {
      const rawLogs = [
        "Connecting to https://api.openai.com with Bearer sk-proj-1234567890abcdef12345678",
        "Loading Gemini credentials with AIzaSyD987654321012345678901234567890",
        "Error accessing database at C:\\Users\\Engineer\\AppData\\Local\\Nano Route\\nano_route.db",
      ];

      const rawConfig = {
        theme: "dark",
        apiToken: "secret_value_12345",
        configuredEndpoint: "https://api.groq.com/openai/v1",
        cacheDirectory: "C:\\Users\\Engineer\\AppData\\Local\\Nano Route\\cache",
      };

      const bundle = generateSupportEvidenceBundle({
        category: "CAT_D_PROVIDER_DRIFT_OUTAGE",
        severity: "SEV-3",
        appVersion: "0.1.0",
        rawLogs,
        rawConfig,
        startupMarkerState: {
          cleanShutdownPrior: true,
          consecutiveCrashCount: 0,
        },
      });

      assert.ok(bundle.bundleId.startsWith("diag_"));
      assert.equal(bundle.invariantsVerified.zeroPlaintextKeys, true);
      assert.equal(bundle.invariantsVerified.pathsSanitized, true);

      // Verify log sanitization
      for (const log of bundle.sanitizedLogs) {
        assert.ok(!log.includes("sk-proj-"));
        assert.ok(!log.includes("AIzaSy"));
        assert.ok(!log.includes("C:\\Users\\Engineer"));
        assert.ok(log.includes("[REDACTED_SECRET]") || log.includes("[REDACTED_PATH]"));
      }

      // Verify config sanitization
      assert.equal(bundle.sanitizedConfigSnapshot.apiToken, "[REDACTED_SECRET]");
      assert.ok(!String(bundle.sanitizedConfigSnapshot.cacheDirectory).includes("C:\\Users\\Engineer"));
      assert.equal(bundle.sanitizedConfigSnapshot.theme, "dark");
    });

    it("verifies startup marker evaluation accurately reflects crash state", () => {
      const bundle = generateSupportEvidenceBundle({
        category: "CAT_A_CRASH_TERMINATION",
        severity: "SEV-2",
        appVersion: "0.1.0",
        rawLogs: ["Panic unwinding during async runtime initialization"],
        rawConfig: {},
        startupMarkerState: {
          cleanShutdownPrior: false,
          consecutiveCrashCount: 2,
        },
      });

      assert.equal(bundle.startupMarkerState?.cleanShutdownPrior, false);
      assert.equal(bundle.startupMarkerState?.consecutiveCrashCount, 2);
    });
  });

  // ==========================================================================
  // 3. INCIDENT DOCUMENTATION & POLICY SUITE
  // ==========================================================================
  describe("3. Incident Response Documentation Consistency", () => {
    const expectedDocs = [
      "NANO_ROUTE_INCIDENT_RESPONSE_POLICY.md",
      "NANO_ROUTE_INCIDENT_SEVERITY_MODEL.md",
      "NANO_ROUTE_INCIDENT_TEMPLATE.md",
      "NANO_ROUTE_ROOT_CAUSE_GUIDE.md",
      "NANO_ROUTE_SUPPORT_DIAGNOSTICS.md",
      "NANO_ROUTE_CORRECTIVE_ACTIONS.md",
      "NANO_ROUTE_INCIDENT_TEST_STRATEGY.md",
      "NANO_ROUTE_STEP_58_COMPLETION_REPORT.md",
    ];

    it("ensures all 8 authoritative incident response documents exist in docs/incidents/", () => {
      const incidentsDir = path.resolve(process.cwd(), "docs/incidents");
      assert.ok(fs.existsSync(incidentsDir), "docs/incidents/ directory must exist");

      for (const doc of expectedDocs) {
        const filePath = path.join(incidentsDir, doc);
        assert.ok(fs.existsSync(filePath), `Document ${doc} must exist in docs/incidents/`);
        const content = fs.readFileSync(filePath, "utf-8");
        assert.ok(content.length > 200, `Document ${doc} must contain meaningful content`);
      }
    });
  });
});
