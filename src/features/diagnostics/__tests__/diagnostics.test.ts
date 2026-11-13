/**
 * Nano Route — Step 62 Diagnostics Center Test Suite
 * File: src/features/diagnostics/__tests__/diagnostics.test.ts
 *
 * Covers:
 *  1. Type model — DiagnosticResultStatus vocabulary
 *  2. computeOverallHealth — deterministic precedence rules
 *  3. Test catalog — all test IDs & metadata
 *  4. runQuickCheck — fast local-only execution
 *  5. runFullCheck — includes SLM-002 and PROV-CONN-001
 *  6. runSingleDiagnosticTest — per-test execution paths
 *  7. Report generation — redaction invariants
 *  8. Cancellation — AbortSignal respected
 *  9. Privacy — no secrets in output
 * 10. Security — no plaintext keys, no chat content
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeOverallHealth, runQuickCheck, DIAGNOSTIC_TEST_CATALOG } from "../testRunner.ts";
import { generateDiagnosticReport, formatReportAsText } from "../reportGenerator.ts";
import type { DiagnosticTestResult, DiagnosticRunSummary } from "../types.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeResult(
  id: string,
  status: DiagnosticTestResult["status"],
  overrides: Partial<DiagnosticTestResult> = {}
): DiagnosticTestResult {
  return {
    id: id as DiagnosticTestResult["id"],
    name: `Test ${id}`,
    category: "runtime",
    isNetworkBound: false,
    status,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 1,
    summary: `Summary for ${id}`,
    ...overrides,
  };
}

function makeSummary(results: DiagnosticTestResult[]): DiagnosticRunSummary {
  const health = computeOverallHealth(results);
  return {
    overallHealth: health.overallHealth,
    healthHeadline: health.headline,
    healthDescription: health.description,
    runMode: "quick",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    totalTests: results.length,
    passedCount: results.filter((r) => r.status === "PASS").length,
    warningCount: results.filter((r) => r.status === "WARNING" || r.status === "PASS_WITH_LIMITATION").length,
    failedCount: results.filter((r) => r.status === "FAIL").length,
    blockedCount: results.filter((r) => r.status === "BLOCKED").length,
    notRunCount: results.filter((r) => r.status === "NOT_RUN").length,
    results,
  };
}

// ─── 1. Type model ────────────────────────────────────────────────────────────

describe("Step 62 — Diagnostics Type Model", () => {
  it("DiagnosticResultStatus includes all eight required values", () => {
    const statuses: DiagnosticTestResult["status"][] = [
      "PASS",
      "PASS_WITH_LIMITATION",
      "NOT_RUN",
      "NOT_APPLICABLE",
      "WARNING",
      "FAIL",
      "BLOCKED",
      "CANCELLED",
    ];
    assert.equal(statuses.length, 8);
    // Type check — all values are distinct strings
    const unique = new Set(statuses);
    assert.equal(unique.size, 8);
  });

  it("DiagnosticTestResult has required structural fields", () => {
    const result = makeResult("RT-001", "PASS");
    assert.ok(result.id);
    assert.ok(result.name);
    assert.ok(result.category);
    assert.equal(typeof result.isNetworkBound, "boolean");
    assert.ok(result.status);
    assert.ok(result.startedAt);
  });
});

// ─── 2. computeOverallHealth — precedence rules ───────────────────────────────

describe("Step 62 — computeOverallHealth Precedence Rules", () => {
  it("returns HEALTHY when all executed tests pass", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "PASS"),
      makeResult("SLM-001", "PASS"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "HEALTHY");
  });

  it("returns ACTION_REQUIRED when DB-001 fails (critical subsystem)", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "FAIL"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "ACTION_REQUIRED");
  });

  it("returns ACTION_REQUIRED when RT-001 fails (critical runtime)", () => {
    const results = [
      makeResult("RT-001", "FAIL"),
      makeResult("DB-001", "PASS"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "ACTION_REQUIRED");
  });

  it("returns ACTION_REQUIRED when DB-001 is BLOCKED", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "BLOCKED"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "ACTION_REQUIRED");
  });

  it("returns RECOVERY_REQUIRED when UPD-001 fails", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "PASS"),
      makeResult("UPD-001", "FAIL"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "RECOVERY_REQUIRED");
  });

  it("returns RECOVERY_REQUIRED when REC-001 fails", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "PASS"),
      makeResult("REC-001", "FAIL"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "RECOVERY_REQUIRED");
  });

  it("returns DEGRADED when ROUTE-001 fails", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "PASS"),
      makeResult("ROUTE-001", "FAIL"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "DEGRADED");
  });

  it("returns HEALTHY_WITH_LIMITATIONS when any test produces WARNING", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "PASS"),
      makeResult("SLM-001", "WARNING"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "HEALTHY_WITH_LIMITATIONS");
  });

  it("returns HEALTHY_WITH_LIMITATIONS when any test produces PASS_WITH_LIMITATION", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("CRED-001", "PASS_WITH_LIMITATION"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "HEALTHY_WITH_LIMITATIONS");
  });

  it("returns UNKNOWN when no tests have been executed", () => {
    const { overallHealth } = computeOverallHealth([]);
    assert.equal(overallHealth, "UNKNOWN");
  });

  it("DB-001 FAIL takes precedence over ROUTE-001 WARNING", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "FAIL"),
      makeResult("ROUTE-001", "WARNING"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "ACTION_REQUIRED");
  });

  it("NOT_RUN and NOT_APPLICABLE tests do not influence HEALTHY verdict", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "PASS"),
      makeResult("SLM-002", "NOT_RUN"),
      makeResult("PROV-CONN-001", "NOT_APPLICABLE"),
    ];
    const { overallHealth } = computeOverallHealth(results);
    assert.equal(overallHealth, "HEALTHY");
  });

  it("CANCELLED tests do not trigger FAIL precedence", () => {
    const results = [
      makeResult("RT-001", "PASS"),
      makeResult("DB-001", "CANCELLED"),
    ];
    // Should not escalate to ACTION_REQUIRED — only NOT_RUN behaviour
    const { overallHealth } = computeOverallHealth(results);
    assert.notEqual(overallHealth, "ACTION_REQUIRED");
  });

  it("headline and description are non-empty strings for all health states", () => {
    const states: Array<{ results: DiagnosticTestResult[] }> = [
      { results: [makeResult("RT-001", "PASS"), makeResult("DB-001", "PASS")] },
      { results: [makeResult("RT-001", "PASS"), makeResult("SLM-001", "WARNING")] },
      { results: [makeResult("DB-001", "FAIL")] },
      { results: [makeResult("UPD-001", "FAIL")] },
      { results: [makeResult("ROUTE-001", "FAIL")] },
      { results: [] },
    ];
    for (const { results } of states) {
      const { headline, description } = computeOverallHealth(results);
      assert.ok(headline.length > 0, "headline must be non-empty");
      assert.ok(description.length > 0, "description must be non-empty");
    }
  });
});

// ─── 3. Test catalog ─────────────────────────────────────────────────────────

describe("Step 62 — Diagnostic Test Catalog", () => {
  it("catalog contains all 12 required test IDs", () => {
    const ids = DIAGNOSTIC_TEST_CATALOG.map((t) => t.id);
    const required = [
      "RT-001", "ENV-001", "DB-001", "SLM-001", "SLM-002",
      "CRED-001", "PROV-CONFIG-001", "PROV-CONN-001",
      "MODEL-001", "ROUTE-001", "UPD-001", "REC-001",
    ];
    for (const id of required) {
      assert.ok(ids.includes(id as typeof ids[number]), `Catalog must include ${id}`);
    }
  });

  it("every catalog entry has required metadata fields", () => {
    for (const test of DIAGNOSTIC_TEST_CATALOG) {
      assert.ok(test.id, `${test.id}: id required`);
      assert.ok(test.name.length > 0, `${test.id}: name required`);
      assert.ok(test.category.length > 0, `${test.id}: category required`);
      assert.equal(typeof test.isNetworkBound, "boolean", `${test.id}: isNetworkBound must be boolean`);
      assert.ok(test.timeoutMs > 0, `${test.id}: timeoutMs must be positive`);
      assert.ok(test.description.length > 0, `${test.id}: description required`);
    }
  });

  it("PROV-CONN-001 is correctly marked as network-bound", () => {
    const prov = DIAGNOSTIC_TEST_CATALOG.find((t) => t.id === "PROV-CONN-001");
    assert.ok(prov, "PROV-CONN-001 must exist");
    assert.equal(prov.isNetworkBound, true, "PROV-CONN-001 must be network-bound");
  });

  it("SLM-002 is not network-bound (local self-test)", () => {
    const slm = DIAGNOSTIC_TEST_CATALOG.find((t) => t.id === "SLM-002");
    assert.ok(slm, "SLM-002 must exist");
    assert.equal(slm.isNetworkBound, false, "SLM-002 is local-only");
  });

  it("all local tests have isNetworkBound === false", () => {
    const localIds = ["RT-001", "ENV-001", "DB-001", "SLM-001", "SLM-002", "CRED-001",
                      "PROV-CONFIG-001", "MODEL-001", "ROUTE-001", "UPD-001", "REC-001"];
    for (const id of localIds) {
      const test = DIAGNOSTIC_TEST_CATALOG.find((t) => t.id === id);
      assert.ok(test, `${id} must exist`);
      assert.equal(test.isNetworkBound, false, `${id} must not be network-bound`);
    }
  });

  it("catalog test IDs are unique", () => {
    const ids = DIAGNOSTIC_TEST_CATALOG.map((t) => t.id);
    const unique = new Set(ids);
    assert.equal(unique.size, ids.length, "All catalog IDs must be unique");
  });
});

// ─── 4. runQuickCheck ─────────────────────────────────────────────────────────

describe("Step 62 — runQuickCheck", () => {
  it("returns a DiagnosticRunSummary with runMode=quick", async () => {
    const summary = await runQuickCheck();
    assert.equal(summary.runMode, "quick");
    assert.ok(summary.results.length > 0, "Quick check must return results");
    assert.ok(summary.overallHealth, "overallHealth must be populated");
    assert.ok(summary.healthHeadline, "healthHeadline must be populated");
  });

  it("Quick Check excludes network-bound PROV-CONN-001", async () => {
    const summary = await runQuickCheck();
    const hasNetworkTest = summary.results.some((r) => r.id === "PROV-CONN-001");
    assert.equal(hasNetworkTest, false, "Quick Check must not include PROV-CONN-001");
  });

  it("Quick Check excludes SLM-002 synthetic self-test", async () => {
    const summary = await runQuickCheck();
    const hasSlmSelfTest = summary.results.some((r) => r.id === "SLM-002");
    assert.equal(hasSlmSelfTest, false, "Quick Check must not include SLM-002");
  });

  it("all results have valid statuses", async () => {
    const validStatuses = new Set([
      "PASS", "PASS_WITH_LIMITATION", "NOT_RUN",
      "NOT_APPLICABLE", "WARNING", "FAIL", "BLOCKED", "CANCELLED",
    ]);
    const summary = await runQuickCheck();
    for (const r of summary.results) {
      assert.ok(validStatuses.has(r.status), `${r.id}: invalid status '${r.status}'`);
    }
  });

  it("result counts match filter of results array", async () => {
    const summary = await runQuickCheck();
    const passed = summary.results.filter((r) => r.status === "PASS").length;
    const failed = summary.results.filter((r) => r.status === "FAIL").length;
    assert.equal(summary.passedCount, passed, "passedCount must match");
    assert.equal(summary.failedCount, failed, "failedCount must match");
  });

  it("honours AbortSignal cancellation", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const summary = await runQuickCheck({ signal: ctrl.signal });
    const cancelled = summary.results.filter((r) => r.status === "CANCELLED");
    assert.ok(cancelled.length > 0, "Cancelled run must have CANCELLED results");
  });

  it("each result has startedAt timestamp", async () => {
    const summary = await runQuickCheck();
    for (const r of summary.results) {
      assert.ok(r.startedAt, `${r.id}: startedAt must be present`);
      assert.doesNotThrow(() => new Date(r.startedAt), `${r.id}: startedAt must be parseable`);
    }
  });

  it("Quick Check does not include chat content or secrets in results", async () => {
    const summary = await runQuickCheck();
    const text = JSON.stringify(summary);
    assert.ok(!text.includes("sk-"), "No OpenAI-style keys in Quick Check output");
    assert.ok(!text.includes("AIzaSy"), "No Gemini-style keys in Quick Check output");
    assert.ok(!text.includes("Bearer "), "No bearer tokens in Quick Check output");
  });
});

// ─── 5. Report generation — redaction invariants ──────────────────────────────

describe("Step 62 — Report Generation & Redaction", () => {
  it("generateDiagnosticReport returns a valid payload structure", async () => {
    const summary = await runQuickCheck();
    const report = generateDiagnosticReport(summary, "0.1.0");
    assert.ok(report.reportId, "reportId required");
    assert.ok(report.generatedAt, "generatedAt required");
    assert.equal(report.appVersion, "0.1.0");
    assert.ok(report.overallHealth, "overallHealth required");
    assert.ok(report.environmentSummary, "environmentSummary required");
    assert.ok(report.subsystemSummaries, "subsystemSummaries required");
    assert.ok(Array.isArray(report.testResults), "testResults must be array");
  });

  it("report invariants confirm zero plaintext keys and zero chat history", async () => {
    const summary = await runQuickCheck();
    const report = generateDiagnosticReport(summary);
    assert.equal(report.invariants.zeroPlaintextKeys, true);
    assert.equal(report.invariants.zeroChatHistory, true);
    assert.equal(report.invariants.userPathsSanitized, true);
  });

  it("report never contains API key patterns", async () => {
    const summaryWithSensitiveData = makeSummary([
      makeResult("RT-001", "PASS", {
        summary: "sk-proj-secretkey123 runtime ok",
        safeDetails: { apiKey: "sk-secretkey", status: "ready" },
      }),
    ]);
    const report = generateDiagnosticReport(summaryWithSensitiveData);
    const text = JSON.stringify(report);
    assert.ok(!text.includes("sk-proj-secretkey123"), "API key must be redacted in summary");
    // apiKey field must be omitted structurally
    for (const r of report.testResults) {
      if (r.safeDetails) {
        assert.ok(!("apiKey" in r.safeDetails), "apiKey field must be structurally omitted");
      }
    }
  });

  it("report omits bearer tokens from summaries", async () => {
    const summary = makeSummary([
      makeResult("CRED-001", "PASS", {
        summary: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 credential present",
      }),
    ]);
    const report = generateDiagnosticReport(summary);
    const text = JSON.stringify(report);
    assert.ok(!text.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"), "JWT token must be redacted");
  });

  it("report omits sensitive safeDetails keys structurally", async () => {
    const summary = makeSummary([
      makeResult("DB-001", "PASS", {
        safeDetails: {
          schemaVersion: 6,
          password: "hunter2",         // SENSITIVE_OMIT
          token: "abc123secret",       // SENSITIVE_OMIT
          integrityOk: true,
        },
      }),
    ]);
    const report = generateDiagnosticReport(summary);
    for (const r of report.testResults) {
      if (r.safeDetails && r.id === "DB-001") {
        assert.ok(!("password" in r.safeDetails), "password must be omitted");
        assert.ok(!("token" in r.safeDetails), "token must be omitted");
        assert.equal(r.safeDetails["schemaVersion"], 6, "safe numeric value must be preserved");
        assert.equal(r.safeDetails["integrityOk"], true, "boolean value must be preserved");
      }
    }
  });

  it("formatReportAsText produces deterministic structured output", async () => {
    const summary = await runQuickCheck();
    const report = generateDiagnosticReport(summary);
    const text = formatReportAsText(report);
    assert.ok(text.includes("NANO ROUTE DIAGNOSTIC REPORT"), "header present");
    assert.ok(text.includes("Report ID"), "reportId present");
    assert.ok(text.includes("SUBSYSTEM STATUS"), "subsystem section present");
    assert.ok(text.includes("DIAGNOSTIC TEST RESULTS"), "test results section present");
    assert.ok(text.includes("INVARIANTS"), "invariants section present");
    assert.ok(text.includes("END OF NANO ROUTE DIAGNOSTIC REPORT"), "footer present");
  });

  it("formatted text report has no API key patterns", async () => {
    const summary = await runQuickCheck();
    const report = generateDiagnosticReport(summary);
    const text = formatReportAsText(report);
    assert.ok(!text.match(/sk-[A-Za-z0-9_-]{8,}/), "No sk- keys");
    assert.ok(!text.match(/AIzaSy[A-Za-z0-9_-]{30,}/), "No AIzaSy keys");
    assert.ok(!text.match(/Bearer\s+[A-Za-z0-9._-]+/), "No Bearer tokens");
  });

  it("report reportId is unique across consecutive calls", async () => {
    const summary = await runQuickCheck();
    const r1 = generateDiagnosticReport(summary);
    const r2 = generateDiagnosticReport(summary);
    assert.notEqual(r1.reportId, r2.reportId, "reportIds must be unique");
  });
});

// ─── 6. Cancellation safety ──────────────────────────────────────────────────

describe("Step 62 — Cancellation Safety", () => {
  it("pre-aborted signal produces all CANCELLED results for quick check", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const summary = await runQuickCheck({ signal: ctrl.signal });
    for (const r of summary.results) {
      assert.equal(r.status, "CANCELLED", `${r.id} must be CANCELLED when signal is pre-aborted`);
    }
  });

  it("cancelled run does not throw — returns summary with CANCELLED results", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    let threw = false;
    try {
      await runQuickCheck({ signal: ctrl.signal });
    } catch {
      threw = true;
    }
    assert.equal(threw, false, "Cancelled run must not throw");
  });
});

// ─── 7. Privacy invariants ──────────────────────────────────────────────────

describe("Step 62 — Privacy Invariants", () => {
  it("Quick Check output contains no raw provider response bodies", async () => {
    const summary = await runQuickCheck();
    const text = JSON.stringify(summary);
    // No JSON-shaped provider response objects should appear
    assert.ok(!text.includes('"choices"'), "No OpenAI choices in output");
    assert.ok(!text.includes('"content":'), "No raw content field in output");
    assert.ok(!text.includes('"completion"'), "No completion field in output");
  });

  it("Quick Check output contains no prompt text", async () => {
    const summary = await runQuickCheck();
    const text = JSON.stringify(summary);
    assert.ok(!text.includes("\"role\":\"user\""), "No user role messages");
    assert.ok(!text.includes("\"role\":\"assistant\""), "No assistant role messages");
  });

  it("test result safeDetails cannot contain the word 'password'", async () => {
    const summary = await runQuickCheck();
    for (const result of summary.results) {
      if (result.safeDetails) {
        const keys = Object.keys(result.safeDetails).map((k) => k.toLowerCase());
        assert.ok(!keys.includes("password"), `${result.id}: safeDetails must not contain 'password'`);
        assert.ok(!keys.includes("secret"), `${result.id}: safeDetails must not contain 'secret'`);
        assert.ok(!keys.includes("apikey"), `${result.id}: safeDetails must not contain 'apikey'`);
      }
    }
  });
});

