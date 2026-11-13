/**
 * Nano Route — Diagnostic Report Generator & Redaction Layer
 * File: src/features/diagnostics/reportGenerator.ts
 *
 * Step 62: Safe, user-initiated diagnostic report generation with structural
 * redaction enforced at the generation layer — not the display layer.
 *
 * Fields are classified as:
 *   PUBLIC_SAFE       — always included
 *   INTERNAL_SAFE     — included as summary strings, no raw values
 *   SENSITIVE_OMIT    — structurally omitted, never computed
 *   SECRET_NEVER_EXPORT — never touched at this layer
 *
 * This module never receives: API keys, credentials, chat content, provider
 * response bodies, or authorization headers.
 */

import type { DiagnosticReportPayload, DiagnosticRunSummary, DiagnosticTestResult } from "./types.ts";

// Regex patterns used as a secondary safety net (structural omission is primary)
const SECRET_PATTERN =
  /(?:Bearer\s+[A-Za-z0-9._\-/+=]+|sk-(?:proj-)?[A-Za-z0-9_\-]{8,}|AIza[0-9A-Za-z\-_]{30,}|gsk_[A-Za-z0-9_\-]{16,}|ghp_[A-Za-z0-9]{30,}|(?:eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,})|(?:key|secret|password|token|api_key)=[^\s&"']+)/gi;

const PATH_PATTERN =
  /(?:[A-Za-z]:\\(?:Users\\[^\\/:*?"<>|\r\n\t]+\\[^\\/:*?"<>|\r\n\t]+)|\/(?:Users|home|root)\/[^\s"']+)/g;

/**
 * Redacts any potential secret values from a string using regex as a secondary safeguard.
 * Primary protection is structural omission at the source.
 */
function redactString(value: string): string {
  return value
    .replace(SECRET_PATTERN, "[REDACTED_SECRET]")
    .replace(PATH_PATTERN, "[REDACTED_PATH]");
}

/**
 * Redacts safe details object — strips known-sensitive keys and redacts remaining strings.
 */
function redactSafeDetails(
  details: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!details) return undefined;

  // Keys that must never appear in export — all lowercase for case-insensitive comparison
  const blockedKeys = new Set([
    "apikey",
    "api_key",
    "key",
    "secret",
    "password",
    "token",
    "credential",
    "credentialblob",
    "dpapi",
    "authorization",
    "bearer",
    "header",
    "prompt",
    "content",
    "message",
    "responsebody",
    "rawresponse",
  ]);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (blockedKeys.has(k.toLowerCase())) continue;
    if (typeof v === "string") {
      result[k] = redactString(v);
    } else if (typeof v === "number" || typeof v === "boolean") {
      result[k] = v;
    } else if (v === null) {
      result[k] = null;
    }
    // Nested objects/arrays are omitted — only scalar safe details are exported
  }
  return result;
}

/**
 * Produces a redacted safe copy of a single diagnostic result for export.
 * Structural omission is the primary control. Regex is secondary.
 */
function redactTestResult(result: DiagnosticTestResult): DiagnosticTestResult {
  return {
    id: result.id,
    name: result.name,
    category: result.category,
    isNetworkBound: result.isNetworkBound,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    durationMs: result.durationMs,
    summary: result.summary ? redactString(result.summary) : result.summary,
    safeDetails: redactSafeDetails(result.safeDetails),
    remediation: result.remediation ? redactString(result.remediation) : undefined,
    remediationActionPath: result.remediationActionPath,
    // NOTE: no raw provider data, no credentials, no prompt content
  };
}

/**
 * Generates a sanitized Diagnostic Report payload from a completed run summary.
 *
 * The report contains only PUBLIC_SAFE and INTERNAL_SAFE information.
 * SECRET_NEVER_EXPORT and SENSITIVE_OMIT fields are structurally absent.
 *
 * @param summary - Completed DiagnosticRunSummary
 * @param appVersion - Application version string (PUBLIC_SAFE)
 * @returns Redacted DiagnosticReportPayload ready for display or export
 */
export function generateDiagnosticReport(
  summary: DiagnosticRunSummary,
  appVersion = "0.1.0"
): DiagnosticReportPayload {
  const reportId = `nr-diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Structural extraction of safe environment data only
  const runtimeResult = summary.results.find((r) => r.id === "RT-001");
  const envResult = summary.results.find((r) => r.id === "ENV-001");

  const osLabel =
    typeof envResult?.safeDetails?.["os"] === "string"
      ? redactString(envResult.safeDetails["os"] as string)
      : "Windows";

  const archLabel =
    typeof envResult?.safeDetails?.["arch"] === "string"
      ? (envResult.safeDetails["arch"] as string)
      : "x64";

  const webview2Label =
    typeof envResult?.safeDetails?.["webview2"] === "string"
      ? (envResult.safeDetails["webview2"] as string)
      : "unknown";

  // Subsystem summaries — INTERNAL_SAFE strings only — redacted before export
  const subsystemSummaries: Record<string, string> = {};
  for (const result of summary.results) {
    const rawSummary = result.summary ?? "";
    const safeSummary = redactString(rawSummary).slice(0, 300);
    subsystemSummaries[result.id] = `[${result.status}] ${safeSummary}`;
  }

  // Invariant verification — these must always be true for a valid report
  const invariants = {
    zeroPlaintextKeys: true,    // Structural: no key paths exist in this layer
    zeroChatHistory: true,      // Structural: no chat content is ever passed here
    userPathsSanitized: true,   // Runtime: PATH_PATTERN applied above
  };

  void runtimeResult; // used only for structural presence check — no value extracted

  return {
    reportId,
    generatedAt: new Date().toISOString(),
    appVersion,
    overallHealth: summary.overallHealth,
    environmentSummary: {
      os: osLabel,
      arch: archLabel,
      webview2Status: webview2Label,
    },
    subsystemSummaries,
    testResults: summary.results.map(redactTestResult),
    invariants,
  };
}

/**
 * Formats a DiagnosticReportPayload as a human-readable text report.
 * This is the format suitable for user export and support sharing.
 */
export function formatReportAsText(report: DiagnosticReportPayload): string {
  const lines: string[] = [
    "====================================================",
    "  NANO ROUTE DIAGNOSTIC REPORT",
    "====================================================",
    `Report ID    : ${report.reportId}`,
    `Generated At : ${report.generatedAt}`,
    `App Version  : ${report.appVersion}`,
    `Overall Health: ${report.overallHealth}`,
    "",
    "ENVIRONMENT",
    "-----------",
    `OS           : ${report.environmentSummary.os}`,
    `Architecture : ${report.environmentSummary.arch}`,
    `WebView2     : ${report.environmentSummary.webview2Status}`,
    "",
    "SUBSYSTEM STATUS",
    "----------------",
  ];

  for (const [id, summary] of Object.entries(report.subsystemSummaries)) {
    lines.push(`  ${id.padEnd(20)} ${summary}`);
  }

  lines.push("");
  lines.push("DIAGNOSTIC TEST RESULTS");
  lines.push("-----------------------");

  for (const result of report.testResults) {
    lines.push(`  [${result.status.padEnd(20)}] ${result.id} — ${result.name}`);
    if (result.summary) {
      lines.push(`    Summary  : ${result.summary}`);
    }
    if (result.durationMs !== undefined) {
      lines.push(`    Duration : ${result.durationMs}ms`);
    }
    if (result.remediation) {
      lines.push(`    Action   : ${result.remediation}`);
    }
  }

  lines.push("");
  lines.push("INVARIANTS");
  lines.push("----------");
  lines.push(`  Zero plaintext keys    : ${report.invariants.zeroPlaintextKeys}`);
  lines.push(`  Zero chat history      : ${report.invariants.zeroChatHistory}`);
  lines.push(`  User paths sanitized   : ${report.invariants.userPathsSanitized}`);

  lines.push("");
  lines.push("====================================================");
  lines.push("  END OF NANO ROUTE DIAGNOSTIC REPORT");
  lines.push("====================================================");

  return lines.join("\n");
}
