/**
 * Nano Route — In-App Diagnostics Center
 * File: src/pages/DiagnosticsPage.tsx
 *
 * Step 62: Production-safe diagnostics page integrating the diagnostic test
 * runner, overall health summary, test result cards, SLM self-test,
 * provider connectivity tests, report export, and remediation navigation.
 *
 * Design system: dark obsidian/purple/blue — matches existing application style.
 * Accessibility: keyboard-complete, ARIA live regions, non-color status cues.
 */

import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Info,
  Ban,
  Minus,
} from "lucide-react";

import {
  runQuickCheck,
  runFullCheck,
  runSingleDiagnosticTest,
  computeOverallHealth,
  generateDiagnosticReport,
  formatReportAsText,
} from "../features/diagnostics/index.ts";

import type {
  DiagnosticTestResult,
  DiagnosticRunSummary,
  DiagnosticResultStatus,
  OverallHealthState,
  DiagnosticTestId,
} from "../features/diagnostics/index.ts";

// ─── Status helpers ─────────────────────────────────────────────────────────

function statusIcon(status: DiagnosticResultStatus, size = 16) {
  const cls = `flex-shrink-0`;
  switch (status) {
    case "PASS":
      return <CheckCircle size={size} className={cls} aria-hidden="true" style={{ color: "#4ade80" }} />;
    case "PASS_WITH_LIMITATION":
      return <CheckCircle size={size} className={cls} aria-hidden="true" style={{ color: "#facc15" }} />;
    case "WARNING":
      return <AlertTriangle size={size} className={cls} aria-hidden="true" style={{ color: "#fb923c" }} />;
    case "FAIL":
      return <XCircle size={size} className={cls} aria-hidden="true" style={{ color: "#f87171" }} />;
    case "BLOCKED":
      return <Ban size={size} className={cls} aria-hidden="true" style={{ color: "#a78bfa" }} />;
    case "CANCELLED":
      return <Minus size={size} className={cls} aria-hidden="true" style={{ color: "#94a3b8" }} />;
    case "NOT_RUN":
    case "NOT_APPLICABLE":
      return <Minus size={size} className={cls} aria-hidden="true" style={{ color: "#64748b" }} />;
    default:
      return <Clock size={size} className={cls} aria-hidden="true" style={{ color: "#64748b" }} />;
  }
}

function statusLabel(status: DiagnosticResultStatus): string {
  const labels: Record<DiagnosticResultStatus, string> = {
    PASS: "Pass",
    PASS_WITH_LIMITATION: "Pass with Limitation",
    WARNING: "Warning",
    FAIL: "Fail",
    BLOCKED: "Blocked",
    CANCELLED: "Cancelled",
    NOT_RUN: "Not Run",
    NOT_APPLICABLE: "Not Applicable",
  };
  return labels[status] ?? status;
}

function statusBadgeStyle(status: DiagnosticResultStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
  switch (status) {
    case "PASS":
      return { ...base, background: "rgba(74,222,128,0.12)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" };
    case "PASS_WITH_LIMITATION":
      return { ...base, background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)" };
    case "WARNING":
      return { ...base, background: "rgba(251,146,60,0.12)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.3)" };
    case "FAIL":
      return { ...base, background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" };
    case "BLOCKED":
      return { ...base, background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" };
    default:
      return { ...base, background: "rgba(100,116,139,0.12)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" };
  }
}

function overallHealthColor(health: OverallHealthState): string {
  switch (health) {
    case "HEALTHY": return "#4ade80";
    case "HEALTHY_WITH_LIMITATIONS": return "#facc15";
    case "DEGRADED": return "#fb923c";
    case "ACTION_REQUIRED": return "#f87171";
    case "RECOVERY_REQUIRED": return "#f87171";
    default: return "#94a3b8";
  }
}

function overallHealthIcon(health: OverallHealthState) {
  switch (health) {
    case "HEALTHY":
      return <CheckCircle size={24} aria-hidden="true" style={{ color: "#4ade80" }} />;
    case "HEALTHY_WITH_LIMITATIONS":
      return <AlertTriangle size={24} aria-hidden="true" style={{ color: "#facc15" }} />;
    case "DEGRADED":
    case "ACTION_REQUIRED":
    case "RECOVERY_REQUIRED":
      return <XCircle size={24} aria-hidden="true" style={{ color: "#f87171" }} />;
    default:
      return <Info size={24} aria-hidden="true" style={{ color: "#94a3b8" }} />;
  }
}

// ─── Single test result row ─────────────────────────────────────────────────

interface TestResultRowProps {
  result: DiagnosticTestResult;
  onNavigate: (path: string) => void;
  onRunSingle: (id: DiagnosticTestId) => void;
  isRunning: boolean;
}

const TestResultRow: React.FC<TestResultRowProps> = ({ result, onNavigate, onRunSingle, isRunning }) => {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    (result.safeDetails && Object.keys(result.safeDetails).length > 0) ||
    result.remediation ||
    result.remediationActionPath;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        marginBottom: "8px",
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          cursor: hasDetails ? "pointer" : "default",
        }}
        onClick={() => hasDetails && setExpanded((e) => !e)}
        role={hasDetails ? "button" : undefined}
        aria-expanded={hasDetails ? expanded : undefined}
        aria-label={`${result.name}: ${statusLabel(result.status)}`}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasDetails && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        {/* Expand chevron */}
        {hasDetails ? (
          expanded ? (
            <ChevronDown size={14} aria-hidden="true" style={{ color: "#64748b", flexShrink: 0 }} />
          ) : (
            <ChevronRight size={14} aria-hidden="true" style={{ color: "#64748b", flexShrink: 0 }} />
          )
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} aria-hidden="true" />
        )}

        {/* Status icon */}
        {statusIcon(result.status)}

        {/* Test name */}
        <span style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#e2e8f0" }}>
          {result.name}
        </span>

        {/* Network badge */}
        {result.isNetworkBound && (
          <span
            title="Requires network access"
            aria-label="Network test"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              fontSize: "10px",
              color: "#94a3b8",
              padding: "2px 6px",
              borderRadius: "4px",
              border: "1px solid rgba(148,163,184,0.2)",
            }}
          >
            <Wifi size={10} aria-hidden="true" /> Network
          </span>
        )}

        {/* Status badge */}
        <span style={statusBadgeStyle(result.status)} aria-label={`Status: ${statusLabel(result.status)}`}>
          {statusLabel(result.status)}
        </span>

        {/* Duration */}
        {result.durationMs !== undefined && (
          <span style={{ fontSize: "11px", color: "#64748b", minWidth: "50px", textAlign: "right" }}>
            {result.durationMs}ms
          </span>
        )}

        {/* Re-run button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRunSingle(result.id);
          }}
          disabled={isRunning}
          aria-label={`Re-run ${result.name}`}
          title={`Re-run ${result.name}`}
          style={{
            background: "none",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px",
            padding: "3px 8px",
            cursor: isRunning ? "not-allowed" : "pointer",
            color: "#94a3b8",
            fontSize: "11px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            flexShrink: 0,
          }}
        >
          <RefreshCw size={10} aria-hidden="true" /> Run
        </button>
      </div>

      {/* Summary */}
      {result.summary && (
        <div style={{ padding: "0 16px 10px 54px", fontSize: "12px", color: "#94a3b8" }}>
          {result.summary}
        </div>
      )}

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div
          style={{
            padding: "12px 16px 14px 54px",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          {/* Safe details */}
          {result.safeDetails && Object.keys(result.safeDetails).length > 0 && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Details
              </div>
              <div
                style={{
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: "#94a3b8",
                  lineHeight: 1.6,
                }}
              >
                {Object.entries(result.safeDetails).map(([k, v]) => (
                  <div key={k}>
                    <span style={{ color: "#a78bfa" }}>{k}</span>
                    <span style={{ color: "#475569" }}>: </span>
                    <span style={{ color: "#cbd5e1" }}>{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remediation */}
          {result.remediation && (
            <div style={{ marginBottom: "10px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Recommended Action
              </div>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>{result.remediation}</p>
            </div>
          )}

          {/* Navigate to settings */}
          {result.remediationActionPath && (
            <button
              onClick={() => onNavigate(result.remediationActionPath!)}
              style={{
                marginTop: "6px",
                padding: "6px 14px",
                background: "rgba(139,92,246,0.15)",
                border: "1px solid rgba(139,92,246,0.4)",
                borderRadius: "6px",
                color: "#a78bfa",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Open Settings →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Category section ────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  runtime: "Application Runtime",
  environment: "Windows Environment",
  database: "SQLite Database",
  slm: "Local SLM",
  credentials: "Credential Vault",
  providers: "Providers",
  models: "Model Registry",
  routing: "Routing",
  updater: "Update Subsystem",
  recovery: "Disaster Recovery",
};

// ─── Main Diagnostics Page ───────────────────────────────────────────────────

export const DiagnosticsPage: React.FC = () => {
  const navigate = useNavigate();

  // Run state
  const [summary, setSummary] = useState<DiagnosticRunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [exportedText, setExportedText] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Guard against concurrent runs
  const canStartRun = !isRunning;

  const handleQuickCheck = useCallback(async () => {
    if (!canStartRun) return;
    abortRef.current = new AbortController();
    setIsRunning(true);
    setRunningTestId(null);
    setExportedText(null);
    setExportStatus("idle");
    try {
      const result = await runQuickCheck({ signal: abortRef.current.signal });
      setSummary(result);
    } finally {
      setIsRunning(false);
      setRunningTestId(null);
      abortRef.current = null;
    }
  }, [canStartRun]);

  const handleFullCheck = useCallback(async () => {
    if (!canStartRun) return;
    abortRef.current = new AbortController();
    setIsRunning(true);
    setRunningTestId(null);
    setExportedText(null);
    setExportStatus("idle");
    try {
      const result = await runFullCheck({ signal: abortRef.current.signal });
      setSummary(result);
    } finally {
      setIsRunning(false);
      setRunningTestId(null);
      abortRef.current = null;
    }
  }, [canStartRun]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleRunSingle = useCallback(
    async (testId: DiagnosticTestId) => {
      if (isRunning) return;
      abortRef.current = new AbortController();
      setIsRunning(true);
      setRunningTestId(testId);
      try {
        const result = await runSingleDiagnosticTest(testId, {
          signal: abortRef.current.signal,
        });
        setSummary((prev) => {
          if (!prev) {
            const results = [result];
            const health = computeOverallHealth(results);
            return {
              overallHealth: health.overallHealth,
              healthHeadline: health.headline,
              healthDescription: health.description,
              runMode: "single",
              startedAt: result.startedAt,
              completedAt: result.completedAt ?? new Date().toISOString(),
              totalTests: 1,
              passedCount: result.status === "PASS" ? 1 : 0,
              warningCount: result.status === "WARNING" || result.status === "PASS_WITH_LIMITATION" ? 1 : 0,
              failedCount: result.status === "FAIL" ? 1 : 0,
              blockedCount: result.status === "BLOCKED" ? 1 : 0,
              notRunCount: 0,
              results,
            };
          }
          const updatedResults = prev.results.map((r) => (r.id === testId ? result : r));
          if (!prev.results.find((r) => r.id === testId)) {
            updatedResults.push(result);
          }
          const health = computeOverallHealth(updatedResults);
          return {
            ...prev,
            overallHealth: health.overallHealth,
            healthHeadline: health.headline,
            healthDescription: health.description,
            results: updatedResults,
            passedCount: updatedResults.filter((r) => r.status === "PASS").length,
            warningCount: updatedResults.filter((r) => r.status === "WARNING" || r.status === "PASS_WITH_LIMITATION").length,
            failedCount: updatedResults.filter((r) => r.status === "FAIL").length,
            blockedCount: updatedResults.filter((r) => r.status === "BLOCKED").length,
          };
        });
      } finally {
        setIsRunning(false);
        setRunningTestId(null);
        abortRef.current = null;
      }
    },
    [isRunning]
  );

  const handleGenerateReport = useCallback(async () => {
    if (!summary) return;
    setExportStatus("generating");
    try {
      const report = generateDiagnosticReport(summary);
      const text = formatReportAsText(report);
      setExportedText(text);
      setExportStatus("done");
    } catch {
      setExportStatus("error");
    }
  }, [summary]);

  const handleDownloadReport = useCallback(() => {
    if (!exportedText) return;
    const blob = new Blob([exportedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nano-route-diagnostics-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportedText]);

  // Group results by category
  const groupedResults =
    summary?.results.reduce<Record<string, DiagnosticTestResult[]>>((acc, r) => {
      const cat = r.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(r);
      return acc;
    }, {}) ?? {};

  const categoryOrder = [
    "runtime",
    "environment",
    "database",
    "slm",
    "credentials",
    "providers",
    "models",
    "routing",
    "updater",
    "recovery",
  ];

  return (
    <main
      id="main-content"
      aria-labelledby="diag-page-title"
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "2rem 1.5rem 4rem",
        color: "#e2e8f0",
      }}
    >
      {/* ── Page Header ── */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Activity size={22} aria-hidden="true" style={{ color: "#a78bfa" }} />
          <h1
            id="diag-page-title"
            style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#f1f5f9" }}
          >
            Diagnostics Center
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          Inspect system health, run self-tests, and generate a sanitized support report.
          Diagnostics are read-only and do not modify your configuration or data.
        </p>
      </div>

      {/* ── Action Bar ── */}
      <div
        role="toolbar"
        aria-label="Diagnostic run controls"
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <button
          onClick={handleQuickCheck}
          disabled={!canStartRun}
          aria-label="Run Quick Check — local diagnostics only, no network calls"
          style={{
            padding: "9px 20px",
            background: isRunning ? "rgba(139,92,246,0.1)" : "rgba(139,92,246,0.2)",
            border: "1px solid rgba(139,92,246,0.5)",
            borderRadius: "8px",
            color: isRunning ? "#7c3aed" : "#a78bfa",
            fontWeight: 600,
            fontSize: "13px",
            cursor: canStartRun ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {isRunning && !runningTestId ? (
            <Loader2 size={14} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Activity size={14} aria-hidden="true" />
          )}
          Quick Check
          <span style={{ fontSize: "10px", color: "#7c3aed", fontWeight: 400 }}>Local only</span>
        </button>

        <button
          onClick={handleFullCheck}
          disabled={!canStartRun}
          aria-label="Run Full Check — includes network provider tests"
          style={{
            padding: "9px 20px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "8px",
            color: "#94a3b8",
            fontWeight: 600,
            fontSize: "13px",
            cursor: canStartRun ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {isRunning && !runningTestId ? (
            <Loader2 size={14} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <Wifi size={14} aria-hidden="true" />
          )}
          Full Check
          <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 400 }}>Includes network</span>
        </button>

        {isRunning && (
          <button
            onClick={handleCancel}
            aria-label="Cancel running diagnostic"
            style={{
              padding: "9px 20px",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "8px",
              color: "#f87171",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── Network Disclosure ── */}
      <div
        role="note"
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          padding: "10px 14px",
          background: "rgba(100,116,139,0.08)",
          border: "1px solid rgba(100,116,139,0.15)",
          borderRadius: "8px",
          marginBottom: "1.5rem",
          fontSize: "12px",
          color: "#64748b",
        }}
      >
        <WifiOff size={14} aria-hidden="true" style={{ marginTop: "1px", flexShrink: 0 }} />
        <span>
          <strong style={{ color: "#94a3b8" }}>Quick Check</strong> performs only local inspections — no external requests.{" "}
          <strong style={{ color: "#94a3b8" }}>Full Check</strong> and individual provider tests make explicit outbound
          HTTPS connections to configured provider endpoints. Provider usage may incur cost.
        </span>
      </div>

      {/* ── Running indicator ── */}
      {isRunning && (
        <div
          role="status"
          aria-live="polite"
          aria-label={runningTestId ? `Running test: ${runningTestId}` : "Running diagnostic checks…"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "12px 16px",
            background: "rgba(139,92,246,0.08)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "8px",
            marginBottom: "1.5rem",
            fontSize: "13px",
            color: "#a78bfa",
          }}
        >
          <Loader2 size={16} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
          {runningTestId ? `Running: ${runningTestId}…` : "Running diagnostic checks…"}
        </div>
      )}

      {/* ── Overall Health Banner ── */}
      {summary && !isRunning && (
        <div
          role="region"
          aria-label="Overall health summary"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "20px 24px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${overallHealthColor(summary.overallHealth)}40`,
            borderRadius: "12px",
            marginBottom: "1.5rem",
          }}
        >
          {overallHealthIcon(summary.overallHealth)}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: overallHealthColor(summary.overallHealth),
                marginBottom: "2px",
              }}
            >
              {summary.healthHeadline}
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>{summary.healthDescription}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>
              {summary.runMode === "quick" ? "Quick Check" : summary.runMode === "full" ? "Full Check" : "Targeted"}
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              {summary.passedCount > 0 && (
                <span style={{ fontSize: "12px", color: "#4ade80" }}>{summary.passedCount} pass</span>
              )}
              {summary.warningCount > 0 && (
                <span style={{ fontSize: "12px", color: "#facc15" }}>{summary.warningCount} warn</span>
              )}
              {summary.failedCount > 0 && (
                <span style={{ fontSize: "12px", color: "#f87171" }}>{summary.failedCount} fail</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Test Results by Category ── */}
      {summary && (
        <div role="region" aria-label="Diagnostic test results">
          {categoryOrder
            .filter((cat) => groupedResults[cat]?.length)
            .map((cat) => (
              <div key={cat} style={{ marginBottom: "1.5rem" }}>
                <h2
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: "8px",
                    paddingBottom: "6px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </h2>
                {groupedResults[cat].map((result) => (
                  <TestResultRow
                    key={result.id}
                    result={result}
                    onNavigate={(path) => navigate(path)}
                    onRunSingle={handleRunSingle}
                    isRunning={isRunning}
                  />
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!summary && !isRunning && (
        <div
          role="status"
          style={{
            textAlign: "center",
            padding: "4rem 2rem",
            color: "#475569",
          }}
        >
          <Activity size={40} aria-hidden="true" style={{ marginBottom: "16px", opacity: 0.4 }} />
          <p style={{ margin: 0, fontSize: "14px" }}>
            Run a Quick Check to evaluate system health.
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#334155" }}>
            All checks are local and read-only unless you explicitly run a Full Check.
          </p>
        </div>
      )}

      {/* ── Support Diagnostic Report ── */}
      {summary && !isRunning && (
        <div
          role="region"
          aria-labelledby="report-section-title"
          style={{
            marginTop: "2rem",
            padding: "20px 24px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "12px",
          }}
        >
          <h2
            id="report-section-title"
            style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600, color: "#e2e8f0" }}
          >
            Support Diagnostic Report
          </h2>
          <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#64748b" }}>
            Generate a sanitized report for sharing with support. The report never contains API keys,
            credentials, chat content, or sensitive filesystem paths.
          </p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: exportedText ? "16px" : 0 }}>
            <button
              onClick={handleGenerateReport}
              disabled={exportStatus === "generating"}
              aria-label="Generate sanitized diagnostic report"
              style={{
                padding: "8px 18px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                color: "#94a3b8",
                fontWeight: 500,
                fontSize: "13px",
                cursor: exportStatus === "generating" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {exportStatus === "generating" ? (
                <Loader2 size={14} aria-hidden="true" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Activity size={14} aria-hidden="true" />
              )}
              {exportStatus === "generating" ? "Generating…" : "Generate Report"}
            </button>

            {exportedText && (
              <button
                onClick={handleDownloadReport}
                aria-label="Download diagnostic report as text file"
                style={{
                  padding: "8px 18px",
                  background: "rgba(139,92,246,0.15)",
                  border: "1px solid rgba(139,92,246,0.4)",
                  borderRadius: "8px",
                  color: "#a78bfa",
                  fontWeight: 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Download size={14} aria-hidden="true" />
                Download .txt
              </button>
            )}
          </div>

          {exportStatus === "error" && (
            <p
              role="alert"
              style={{ margin: "10px 0 0", fontSize: "12px", color: "#f87171" }}
            >
              Report generation failed. Please try again or restart the application.
            </p>
          )}

          {exportedText && (
            <div style={{ marginTop: "14px" }}>
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
                Preview — scroll to verify no sensitive data is present before sharing.
              </div>
              <pre
                aria-label="Generated diagnostic report preview"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  padding: "14px",
                  fontSize: "11px",
                  color: "#64748b",
                  fontFamily: "monospace",
                  overflowX: "auto",
                  overflowY: "auto",
                  maxHeight: "280px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {exportedText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Spinner keyframe — inline */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </main>
  );
};

export default DiagnosticsPage;
