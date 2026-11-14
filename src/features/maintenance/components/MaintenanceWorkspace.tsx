/**
 * Nano Route — Data Health Monitoring & Preventive Maintenance UI Component
 * File: src/features/maintenance/components/MaintenanceWorkspace.tsx
 *
 * Implements Step 73 accessible preventive maintenance dashboard:
 * Run Health Evaluation (Quick / Full), view thresholds and findings,
 * trigger approved safe housekeeping actions, and inspect recent maintenance history.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  History,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  type MaintenanceRunSummary,
  type MaintenanceExecutionMode,
  type MaintenanceActionId,
  type MaintenanceActionResult,
  type MaintenanceHistoryEntry,
} from "../types.ts";
import {
  runMaintenanceEvaluation,
  executeMaintenanceAction,
  getMaintenanceHistory,
} from "../engine.ts";
import { MAINTENANCE_ACTIONS_CATALOG } from "../catalog.ts";

export const MaintenanceWorkspace: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [summary, setSummary] = useState<MaintenanceRunSummary | null>(null);
  const [mode, setMode] = useState<MaintenanceExecutionMode>("FULL");
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [lastActionResult, setLastActionResult] = useState<MaintenanceActionResult | null>(null);
  const [historyList, setHistoryList] = useState<readonly MaintenanceHistoryEntry[]>([]);

  const evaluateHealth = useCallback(async (evalMode: MaintenanceExecutionMode) => {
    setIsRunning(true);
    setLastActionResult(null);
    try {
      const res = await runMaintenanceEvaluation(evalMode);
      setSummary(res);
      setHistoryList(getMaintenanceHistory());
    } catch {
      // Handled
    } finally {
      setIsRunning(false);
    }
  }, []);

  useEffect(() => {
    evaluateHealth("FULL");
  }, [evaluateHealth]);

  const handleRunAction = async (actionId: MaintenanceActionId) => {
    setActionInProgress(true);
    try {
      const res = await executeMaintenanceAction(actionId);
      setLastActionResult(res);
      setHistoryList(getMaintenanceHistory());
      // Re-evaluate health to show post-action status
      await evaluateHealth(mode);
    } catch {
      // Handled
    } finally {
      setActionInProgress(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header Info */}
      <div
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.25rem" }}>
            <Sparkles style={{ width: "20px", height: "20px", color: "var(--nr-accent)" }} />
            <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
              Data Health Monitoring & Preventive Maintenance
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>
            Proactive local housekeeping to prevent database fragmentation, clean abandoned temporary staging files, and maintain search index freshness.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as MaintenanceExecutionMode)}
            disabled={isRunning || actionInProgress}
            style={{
              background: "var(--nr-surface)",
              color: "var(--nr-text-primary)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.375rem",
              padding: "0.4rem 0.6rem",
              fontSize: "0.8125rem",
            }}
          >
            <option value="FULL">Full Maintenance Audit</option>
            <option value="QUICK">Quick Health Evaluation</option>
          </select>

          <button
            type="button"
            onClick={() => evaluateHealth(mode)}
            disabled={isRunning || actionInProgress}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 0.875rem",
              background: "var(--nr-accent)",
              border: "none",
              borderRadius: "0.375rem",
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: isRunning || actionInProgress ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw style={{ width: "14px", height: "14px", animation: isRunning ? "spin 1s linear infinite" : "none" }} />
            <span>{isRunning ? "Evaluating..." : "Check Health"}</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {lastActionResult && (
        <div
          role="status"
          style={{
            padding: "1rem 1.25rem",
            borderRadius: "0.5rem",
            background: lastActionResult.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            border: `1px solid ${lastActionResult.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {lastActionResult.success ? (
              <CheckCircle2 style={{ width: "20px", height: "20px", color: "#10b981" }} />
            ) : (
              <AlertCircle style={{ width: "20px", height: "20px", color: "#ef4444" }} />
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                {lastActionResult.message}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                Post-maintenance status: {lastActionResult.followUpStatus}
                {lastActionResult.backupCreated && ` • Pre-action safety backup: ${lastActionResult.backupId}`}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLastActionResult(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-secondary)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      {summary && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "0.875rem",
          }}
        >
          <div
            style={{
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.5rem",
              padding: "1rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Health Assessment</div>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                marginTop: "0.25rem",
                color:
                  summary.overallHealth === "HEALTHY"
                    ? "#10b981"
                    : summary.overallHealth === "MAINTENANCE_RECOMMENDED"
                    ? "#3b82f6"
                    : summary.overallHealth === "ATTENTION_REQUIRED"
                    ? "#f59e0b"
                    : "#ef4444",
              }}
            >
              {summary.overallHealth}
            </div>
          </div>

          <div
            style={{
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.5rem",
              padding: "1rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Checks Completed</div>
            <div style={{ fontSize: "1.125rem", fontWeight: 600, marginTop: "0.25rem" }}>
              {summary.counts.totalChecks} ({summary.counts.healthy} healthy)
            </div>
          </div>

          <div
            style={{
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.5rem",
              padding: "1rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Recommended Housekeeping</div>
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 600,
                marginTop: "0.25rem",
                color: summary.actionableRecommendations.length > 0 ? "var(--nr-accent)" : "var(--nr-text-primary)",
              }}
            >
              {summary.actionableRecommendations.length} action(s) available
            </div>
          </div>
        </div>
      )}

      {/* Actionable Recommendations Area */}
      {summary && summary.actionableRecommendations.length > 0 && (
        <div
          style={{
            background: "var(--nr-surface-card)",
            border: "1px solid rgba(59, 130, 246, 0.3)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Wrench style={{ width: "16px", height: "16px", color: "var(--nr-accent)" }} />
            <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
              Actionable Housekeeping Recommendations
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {summary.actionableRecommendations.map((actionId) => {
              const actionDesc = MAINTENANCE_ACTIONS_CATALOG[actionId];
              if (!actionDesc) return null;

              return (
                <div
                  key={actionId}
                  style={{
                    background: "var(--nr-surface)",
                    borderRadius: "0.5rem",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{actionDesc.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                      {actionDesc.description}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRunAction(actionId)}
                    disabled={actionInProgress}
                    style={{
                      padding: "0.35rem 0.875rem",
                      background: "var(--nr-accent)",
                      border: "none",
                      borderRadius: "0.375rem",
                      color: "#fff",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                    }}
                  >
                    {actionInProgress ? "Running..." : "Execute Action"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Check Findings */}
      <div
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <h3 style={{ margin: "0 0 1rem", fontSize: "0.9375rem", fontWeight: 600 }}>
          Preventive Health Check Status
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          {summary?.findings.map((f) => {
            const isHealthy = f.status === "HEALTHY";
            const isWarn = f.status === "MAINTENANCE_RECOMMENDED" || f.status === "ATTENTION_REQUIRED";

            return (
              <div
                key={f.checkId}
                style={{
                  border: "1px solid var(--nr-border-subtle)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem 1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                  {isHealthy && <CheckCircle2 style={{ width: "16px", height: "16px", color: "#10b981", marginTop: "2px" }} />}
                  {isWarn && <AlertTriangle style={{ width: "16px", height: "16px", color: "#f59e0b", marginTop: "2px" }} />}
                  {!isHealthy && !isWarn && <AlertCircle style={{ width: "16px", height: "16px", color: "#ef4444", marginTop: "2px" }} />}

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.8125rem" }}>{f.name}</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--nr-text-secondary)" }}>({f.domain})</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)", marginTop: "0.15rem" }}>
                      {f.summary}
                    </div>
                  </div>
                </div>

                {f.actionAvailable && f.recommendedActionId && (
                  <button
                    type="button"
                    onClick={() => handleRunAction(f.recommendedActionId!)}
                    disabled={actionInProgress}
                    style={{
                      padding: "0.25rem 0.625rem",
                      background: "rgba(59, 130, 246, 0.1)",
                      border: "1px solid rgba(59, 130, 246, 0.3)",
                      borderRadius: "0.25rem",
                      color: "var(--nr-accent)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: actionInProgress ? "not-allowed" : "pointer",
                    }}
                  >
                    Clean / Optimize
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Maintenance History */}
      {historyList.length > 0 && (
        <div
          style={{
            background: "var(--nr-surface-card)",
            border: "1px solid var(--nr-border-subtle)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <History style={{ width: "16px", height: "16px", color: "var(--nr-text-secondary)" }} />
            <h3 style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>
              Recent Housekeeping History
            </h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {historyList.slice(0, 5).map((h) => (
              <div
                key={h.operationId}
                style={{
                  fontSize: "0.75rem",
                  color: "var(--nr-text-secondary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.35rem 0",
                  borderBottom: "1px solid var(--nr-border-subtle)",
                }}
              >
                <span>{h.safeSummary}</span>
                <span>{new Date(h.timestamp).toLocaleTimeString()} ({h.durationMs}ms)</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
