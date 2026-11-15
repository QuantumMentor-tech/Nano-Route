/**
 * Nano Route — Active Request Center Modal Component
 * File: src/features/execution-center/components/ActiveRequestCenterModal.tsx
 *
 * Implements Step 85:
 * - Live inspection of currently active requests and background tasks
 * - Cooperative cancellation controls through Step 35 IPC
 * - Recovery visibility for interrupted or failed operations
 * - Concurrency tracking and bounded recent task history
 * - Accessible Obsidian/dark interface
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Activity,
  AlertCircle,
  Square,
  RotateCcw,
  MessageSquare,
  Paperclip,
  Wrench,
  Clock,
  Layers,
  ArrowRight,
  Trash2,
} from "lucide-react";
import {
  listExecutionTasks,
  getExecutionStats,
  requestTaskCancellation,
  clearTerminalTasks,
  subscribeToExecutionTasks,
} from "../engine.ts";
import type {
  ExecutionTask,
  ExecutionCenterFilter,
  ExecutionStats,
} from "../types.ts";

export interface ActiveRequestCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSession?: (sessionId: string) => void;
  onRetryTask?: (task: ExecutionTask) => void;
}

export const ActiveRequestCenterModal: React.FC<ActiveRequestCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateToSession,
  onRetryTask,
}) => {
  const [filter, setFilter] = useState<ExecutionCenterFilter>("ACTIVE");
  const [tasks, setTasks] = useState<ExecutionTask[]>([]);
  const [stats, setStats] = useState<ExecutionStats>({
    activeCount: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    interruptedCount: 0,
    totalTracked: 0,
  });

  const refreshData = () => {
    setTasks(listExecutionTasks(filter));
    setStats(getExecutionStats());
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshData();
    const unsubscribe = subscribeToExecutionTasks(refreshData);
    return () => unsubscribe();
  }, [isOpen, filter]);

  if (!isOpen) return null;

  const handleCancel = async (taskId: string) => {
    await requestTaskCancellation(taskId);
    refreshData();
  };

  const handleClearRecent = () => {
    clearTerminalTasks();
    refreshData();
  };

  const getStateBadge = (state: ExecutionTask["state"]) => {
    switch (state) {
      case "STREAMING":
      case "ROUTING":
      case "PREPARING":
      case "STARTING":
      case "CONNECTING":
      case "FINALIZING":
        return {
          color: "#60a5fa",
          bg: "rgba(96, 165, 250, 0.15)",
          border: "#60a5fa",
          label: state,
          isActive: true,
        };
      case "COMPLETED":
        return {
          color: "#10b981",
          bg: "rgba(16, 185, 129, 0.15)",
          border: "#10b981",
          label: "COMPLETED",
          isActive: false,
        };
      case "CANCELLED":
        return {
          color: "#a1a1aa",
          bg: "rgba(161, 161, 170, 0.15)",
          border: "#a1a1aa",
          label: "CANCELLED",
          isActive: false,
        };
      case "FAILED":
      case "BLOCKED":
        return {
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.15)",
          border: "#ef4444",
          label: state,
          isActive: false,
        };
      case "INTERRUPTED":
      case "TIMED_OUT":
        return {
          color: "#f59e0b",
          bg: "rgba(245, 158, 11, 0.15)",
          border: "#f59e0b",
          label: state,
          isActive: false,
        };
      case "QUEUED":
      default:
        return {
          color: "#c084fc",
          bg: "rgba(192, 132, 252, 0.15)",
          border: "#c084fc",
          label: state,
          isActive: true,
        };
    }
  };

  const formatElapsed = (task: ExecutionTask) => {
    const start = task.startedAtMs || task.createdAtMs;
    const end = task.completedAtMs || Date.now();
    const durationMs = Math.max(0, end - start);
    if (durationMs < 1000) return `${durationMs}ms`;
    const sec = (durationMs / 1000).toFixed(1);
    return `${sec}s`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="arc-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1300,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          height: "82vh",
          maxHeight: "680px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 30px -5px rgba(0, 0, 0, 0.6)",
          color: "var(--nr-text-primary, #ffffff)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Activity style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h2 id="arc-modal-title" style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
                  Active Request Center
                </h2>
                {stats.activeCount > 0 && (
                  <span
                    style={{
                      padding: "0.15rem 0.5rem",
                      borderRadius: "10px",
                      backgroundColor: "rgba(96, 165, 250, 0.2)",
                      border: "1px solid #60a5fa",
                      color: "#60a5fa",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                    }}
                  >
                    {stats.activeCount} Running
                  </span>
                )}
              </div>
              <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                Execution lifecycle monitoring, concurrency, & cancellation control
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={onClose}
              aria-label="Close Active Request Center"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--nr-text-muted, #71717a)",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              <X style={{ width: "18px", height: "18px" }} />
            </button>
          </div>
        </div>

        {/* Filter Pills & Stats Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.5rem 1.25rem",
            borderBottom: "1px solid var(--nr-border-subtle, #1f222b)",
            backgroundColor: "var(--nr-bg-surface, #14171f)",
            fontSize: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.35rem" }}>
            {(
              [
                { key: "ACTIVE", label: `Active (${stats.activeCount})` },
                { key: "ALL", label: `All Recent (${stats.totalTracked})` },
                { key: "FAILED", label: `Failed (${stats.failedCount})` },
                { key: "INTERRUPTED", label: `Interrupted (${stats.interruptedCount})` },
                { key: "CANCELLED", label: `Cancelled (${stats.cancelledCount})` },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                style={{
                  padding: "0.25rem 0.6rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: filter === f.key ? "var(--nr-accent-purple, #7c3aed)" : "transparent",
                  color: filter === f.key ? "#ffffff" : "var(--nr-text-secondary, #a1a1aa)",
                  cursor: "pointer",
                  fontWeight: filter === f.key ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {tasks.some((t) => ["COMPLETED", "FAILED", "CANCELLED", "INTERRUPTED"].includes(t.state)) && (
            <button
              type="button"
              onClick={handleClearRecent}
              title="Clear completed and terminal tasks from view"
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "var(--nr-text-muted, #71717a)",
                fontSize: "0.7rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
            >
              <Trash2 style={{ width: "12px", height: "12px" }} />
              <span>Clear Recent</span>
            </button>
          )}
        </div>

        {/* Tasks List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {tasks.map((task) => {
            const badge = getStateBadge(task.state);
            return (
              <div
                key={task.taskId}
                style={{
                  backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                  border: `1px solid ${task.error ? "#ef4444" : "var(--nr-border-default, #27272a)"}`,
                  borderRadius: "6px",
                  padding: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {/* Header row */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {task.category === "REQUEST" && <MessageSquare style={{ width: "15px", height: "15px", color: "#60a5fa" }} />}
                    {task.category === "ATTACHMENT_PREPARATION" && <Paperclip style={{ width: "15px", height: "15px", color: "#c084fc" }} />}
                    {task.category === "DIAGNOSTICS" && <Wrench style={{ width: "15px", height: "15px", color: "#fbbf24" }} />}

                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {task.sessionTitle || "Conversational Prompt"}
                    </span>
                    {task.branchId && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          color: "var(--nr-text-muted, #71717a)",
                          display: "flex",
                          alignItems: "center",
                          gap: "0.2rem",
                        }}
                      >
                        <Layers style={{ width: "10px", height: "10px" }} />
                        <span>branch</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {/* Elapsed Time */}
                    <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock style={{ width: "12px", height: "12px" }} />
                      <span>{formatElapsed(task)}</span>
                    </span>

                    {/* Status Badge */}
                    <span
                      style={{
                        padding: "0.15rem 0.5rem",
                        borderRadius: "10px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: badge.color,
                        backgroundColor: badge.bg,
                        border: `1px solid ${badge.border}`,
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>
                </div>

                {/* Progress / Step details */}
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #d4d4d8)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>{task.progress.step}</span>
                  {task.progress.outputTokens !== undefined && (
                    <span style={{ color: "var(--nr-text-muted, #71717a)", fontSize: "0.7rem" }}>
                      {task.progress.outputTokens.toLocaleString()} tokens
                    </span>
                  )}
                </div>

                {/* Model / Provider metadata if resolved */}
                {task.displayName && (
                  <div style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                    Target: <span style={{ color: "var(--nr-text-secondary, #d4d4d8)" }}>{task.displayName}</span>
                    {task.attemptCount > 1 && ` (Attempt ${task.attemptCount})`}
                  </div>
                )}

                {/* Error Banner if failed / interrupted */}
                {task.error && (
                  <div
                    style={{
                      padding: "0.45rem 0.65rem",
                      borderRadius: "4px",
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      border: "1px solid #ef4444",
                      fontSize: "0.75rem",
                      color: "#fca5a5",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <AlertCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                    <span>{task.error.message}</span>
                  </div>
                )}

                {/* Actions Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                  {task.sessionId && onNavigateToSession && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToSession(task.sessionId!);
                        onClose();
                      }}
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid var(--nr-border-default, #27272a)",
                        borderRadius: "4px",
                        padding: "0.25rem 0.55rem",
                        color: "var(--nr-text-secondary, #a1a1aa)",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <span>View Session</span>
                      <ArrowRight style={{ width: "11px", height: "11px" }} />
                    </button>
                  )}

                  {/* Retry button for failed/interrupted */}
                  {(task.state === "FAILED" || task.state === "INTERRUPTED" || task.state === "BLOCKED") && onRetryTask && (
                    <button
                      type="button"
                      onClick={() => {
                        onRetryTask(task);
                        onClose();
                      }}
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid #3b82f6",
                        borderRadius: "4px",
                        padding: "0.25rem 0.55rem",
                        color: "#60a5fa",
                        fontSize: "0.7rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <RotateCcw style={{ width: "11px", height: "11px" }} />
                      <span>Retry</span>
                    </button>
                  )}

                  {/* Cancel button for active tasks */}
                  {badge.isActive && task.cancellable && (
                    <button
                      type="button"
                      disabled={task.isCancelling}
                      onClick={() => handleCancel(task.taskId)}
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid #ef4444",
                        borderRadius: "4px",
                        padding: "0.25rem 0.55rem",
                        color: "#ef4444",
                        fontSize: "0.7rem",
                        cursor: task.isCancelling ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                      }}
                    >
                      <Square style={{ width: "10px", height: "10px", fill: "currentColor" }} />
                      <span>{task.isCancelling ? "Cancelling..." : "Cancel"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--nr-text-muted, #71717a)", fontSize: "0.8rem" }}>
              No tasks matching current filter ({filter.toLowerCase()}).
            </div>
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: "0.6rem 1.25rem",
            borderTop: "1px solid var(--nr-border-default, #27272a)",
            backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.7rem",
            color: "var(--nr-text-muted, #71717a)",
          }}
        >
          <span>
            Concurrency: {stats.activeCount} active request{stats.activeCount === 1 ? "" : "s"}
          </span>
          <span>Zero cloud task sync • 100% local-first monitoring</span>
        </div>
      </div>
    </div>
  );
};
