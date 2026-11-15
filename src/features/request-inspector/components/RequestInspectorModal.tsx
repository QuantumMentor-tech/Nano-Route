/**
 * Nano Route — Request Inspector & Final Submission Review Modal
 * File: src/features/request-inspector/components/RequestInspectorModal.tsx
 *
 * Implements Step 84:
 * - Comprehensive final composition review before network transmission
 * - Progressive disclosure: Summary, Direct Prompt, Context, Attachments, Routing, Preflight, Budget
 * - Pre-submit revalidation to prevent race conditions and stale sends
 * - Safe removal of optional items (e.g. attachments) with instant re-preflight
 * - Obsidian/dark accessible interface
 */

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Paperclip,
  Cpu,
  Coins,
  Send,
  RefreshCw,
  Trash2,
  CheckCircle,
  Lock,
} from "lucide-react";
import type { CanonicalRequestSnapshot, AssembleSnapshotParams } from "../types.ts";
import { assembleRequestSnapshot, revalidateSnapshotBeforeSubmit } from "../engine.ts";
import { CompatibilityCenterTrigger } from "../../provider-compatibility";

export interface RequestInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotParams: AssembleSnapshotParams;
  onConfirmSend: (finalPrompt: string) => void | Promise<void>;
  onRemoveAttachment?: (attachmentId: string) => void;
}

export const RequestInspectorModal: React.FC<RequestInspectorModalProps> = ({
  isOpen,
  onClose,
  snapshotParams,
  onConfirmSend,
  onRemoveAttachment,
}) => {
  const [snapshot, setSnapshot] = useState<CanonicalRequestSnapshot | null>(null);
  const [activeTab, setActiveTab] = useState<"SUMMARY" | "PROMPT" | "CONTEXT" | "ATTACHMENTS" | "PREFLIGHT">("SUMMARY");
  const [isLoading, setIsLoading] = useState(false);
  const [revalidationWarning, setRevalidationWarning] = useState<string | null>(null);

  const loadSnapshot = async () => {
    setIsLoading(true);
    setRevalidationWarning(null);
    try {
      const snap = await assembleRequestSnapshot(snapshotParams);
      setSnapshot(snap);
    } catch {
      // Keep previous snapshot on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSnapshot();
    }
  }, [isOpen, snapshotParams.prompt, snapshotParams.attachments?.length, snapshotParams.providerId, snapshotParams.modelId]);

  if (!isOpen || !snapshot) return null;

  const handleSend = async () => {
    setIsLoading(true);
    try {
      const reval = await revalidateSnapshotBeforeSubmit(snapshot, snapshotParams);
      if (!reval.isValid) {
        setSnapshot(reval.freshSnapshot);
        setRevalidationWarning(`Submission blocked: ${reval.blockReason || "Request is no longer valid."}`);
        setIsLoading(false);
        return;
      }

      if (reval.isStale) {
        setSnapshot(reval.freshSnapshot);
        setRevalidationWarning("Request state changed while inspecting. Please review updated preview before sending.");
        setIsLoading(false);
        return;
      }

      onClose();
      await onConfirmSend(snapshot.fullAssembledPrompt);
    } catch (err: any) {
      setRevalidationWarning(err.message || "Failed to submit request.");
    } finally {
      setIsLoading(false);
    }
  };

  const statusTone = !snapshot.isSubmissible
    ? "BLOCKED"
    : snapshot.warnings.some((w) => w.severity === "WARNING")
    ? "WARNING"
    : "READY";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="req-inspector-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
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
          height: "85vh",
          maxHeight: "720px",
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
            <ShieldCheck style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <div>
              <h2 id="req-inspector-title" style={{ fontSize: "1rem", fontWeight: 600, margin: 0 }}>
                Request Inspector & Preflight Review
              </h2>
              <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                Verified snapshot before provider dispatch
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Status Pill */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.6rem",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                backgroundColor:
                  statusTone === "READY"
                    ? "rgba(16, 185, 129, 0.15)"
                    : statusTone === "WARNING"
                    ? "rgba(245, 158, 11, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                color:
                  statusTone === "READY"
                    ? "#10b981"
                    : statusTone === "WARNING"
                    ? "#fbbf24"
                    : "#ef4444",
                border: `1px solid ${
                  statusTone === "READY"
                    ? "#10b981"
                    : statusTone === "WARNING"
                    ? "#fbbf24"
                    : "#ef4444"
                }`,
              }}
            >
              {statusTone === "READY" && <CheckCircle style={{ width: "12px", height: "12px" }} />}
              {statusTone === "WARNING" && <AlertTriangle style={{ width: "12px", height: "12px" }} />}
              {statusTone === "BLOCKED" && <AlertCircle style={{ width: "12px", height: "12px" }} />}
              <span>{statusTone}</span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close inspector"
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

        {/* Revalidation / Warning Banner if active */}
        {revalidationWarning && (
          <div
            style={{
              padding: "0.6rem 1rem",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              borderBottom: "1px solid #ef4444",
              color: "#fca5a5",
              fontSize: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
            <span>{revalidationWarning}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--nr-border-subtle, #1f222b)",
            backgroundColor: "var(--nr-bg-surface, #14171f)",
            fontSize: "0.75rem",
          }}
        >
          {(
            [
              { key: "SUMMARY", label: "Overview" },
              { key: "PROMPT", label: "Prompt Content" },
              { key: "CONTEXT", label: `Context (${snapshot.contextCollection ? "1" : "0"})` },
              { key: "ATTACHMENTS", label: `Attachments (${snapshot.attachments.length})` },
              { key: "PREFLIGHT", label: "Preflight & Budget" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "0.3rem 0.65rem",
                borderRadius: "4px",
                border: "none",
                backgroundColor: activeTab === tab.key ? "var(--nr-accent-purple, #7c3aed)" : "transparent",
                color: activeTab === tab.key ? "#ffffff" : "var(--nr-text-secondary, #a1a1aa)",
                cursor: "pointer",
                fontWeight: activeTab === tab.key ? 600 : 400,
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {activeTab === "SUMMARY" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Top Metrics Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>Model Target</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.2rem" }}>
                    {snapshot.routing.displayName}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--nr-accent-purple, #c084fc)" }}>
                    {snapshot.routing.mode === "MANUAL" ? "Manual Override" : "Auto SLM Routing"}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>Total Tokens (Est.)</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.2rem" }}>
                    ~{snapshot.totalEstimatedTokens.toLocaleString()}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
                    {snapshot.contextUsagePercent.toFixed(1)}% of window used
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>Estimated Cost</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.2rem" }}>
                    {snapshot.estimatedCostUsd !== null ? `$${snapshot.estimatedCostUsd.toFixed(4)}` : "$0.00"}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
                    {snapshot.budgetPreflight.allowed ? "Within monthly budget" : "Blocked by budget"}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                  }}
                >
                  <div style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>Headroom Capacity</div>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, marginTop: "0.2rem" }}>
                    {snapshot.headroomTokens.toLocaleString()} tokens
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "#10b981" }}>Safe for response</div>
                </div>
              </div>

              {/* Composition Breakdown */}
              <div
                style={{
                  backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                  padding: "0.85rem",
                  borderRadius: "6px",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.25rem" }}>
                  Prompt Composition Tree
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                  <span style={{ color: "var(--nr-text-secondary, #d4d4d8)" }}>• Direct User Prompt</span>
                  <span>{snapshot.directPrompt.length} chars</span>
                </div>
                {snapshot.contextCollection && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--nr-text-secondary, #d4d4d8)" }}>
                      • Context Pack: "{snapshot.contextCollection.name}" ({snapshot.contextCollection.itemCount} items)
                    </span>
                    <span>~{snapshot.contextCollection.estimatedTokens} tokens</span>
                  </div>
                )}
                {snapshot.attachments.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem" }}>
                    <span style={{ color: "var(--nr-text-secondary, #d4d4d8)" }}>
                      • Local Attachments ({snapshot.attachments.length} files)
                    </span>
                    <span>
                      {(snapshot.attachments.reduce((acc, a) => acc + a.sizeBytes, 0) / 1024).toFixed(1)} KB
                    </span>
                  </div>
                )}
              </div>

              {/* Warnings List */}
              {snapshot.warnings.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Active Warnings & Notices</div>
                  {snapshot.warnings.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        padding: "0.6rem 0.75rem",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.5rem",
                        backgroundColor:
                          w.severity === "BLOCKING"
                            ? "rgba(239, 68, 68, 0.12)"
                            : "rgba(245, 158, 11, 0.12)",
                        border: `1px solid ${w.severity === "BLOCKING" ? "#ef4444" : "#f59e0b"}`,
                        color: w.severity === "BLOCKING" ? "#fca5a5" : "#fbbf24",
                      }}
                    >
                      {w.severity === "BLOCKING" ? (
                        <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                      ) : (
                        <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
                      )}
                      <div>
                        <strong>{w.title}:</strong> {w.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "PROMPT" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Full Assembled Prompt Payload</span>
                <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                  {snapshot.fullAssembledPrompt.length} characters
                </span>
              </div>
              <div
                style={{
                  backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "6px",
                  padding: "0.75rem",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  color: "var(--nr-text-secondary, #d4d4d8)",
                  maxHeight: "420px",
                  overflowY: "auto",
                }}
              >
                {snapshot.fullAssembledPrompt || "(Empty prompt)"}
              </div>
            </div>
          )}

          {activeTab === "CONTEXT" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Context Collections & References</div>
              {snapshot.contextCollection ? (
                <div
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    borderRadius: "6px",
                    padding: "0.85rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{snapshot.contextCollection.name}</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                      {snapshot.contextCollection.itemCount} items (~{snapshot.contextCollection.estimatedTokens} tokens)
                    </span>
                  </div>

                  {snapshot.contextCollection.hasSensitiveNotes && (
                    <div
                      style={{
                        padding: "0.4rem 0.6rem",
                        borderRadius: "4px",
                        backgroundColor: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid #f59e0b",
                        fontSize: "0.7rem",
                        color: "#fbbf24",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <Lock style={{ width: "12px", height: "12px" }} />
                      <span>Contains private notes. Note content is included in transmitted context.</span>
                    </div>
                  )}

                  {snapshot.contextCollection.hasStaleReferences && (
                    <div
                      style={{
                        padding: "0.4rem 0.6rem",
                        borderRadius: "4px",
                        backgroundColor: "rgba(239, 68, 68, 0.12)",
                        border: "1px solid #ef4444",
                        fontSize: "0.7rem",
                        color: "#fca5a5",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                    >
                      <AlertCircle style={{ width: "12px", height: "12px" }} />
                      <span>Contains stale references pointing to deleted historical messages.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--nr-text-muted, #71717a)", fontSize: "0.75rem" }}>
                  No Context Collection reference pack is active for this request.
                </div>
              )}
            </div>
          )}

          {activeTab === "ATTACHMENTS" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>Active Local Attachments</div>
              {snapshot.attachments.map((att) => (
                <div
                  key={att.id}
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    borderRadius: "6px",
                    padding: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Paperclip style={{ width: "16px", height: "16px", color: "var(--nr-accent-purple, #a855f7)" }} />
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>{att.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                        {(att.sizeBytes / 1024).toFixed(1)} KB • {att.category} • ~{att.estimatedTokens} tokens
                      </div>
                    </div>
                  </div>
                  {onRemoveAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveAttachment(att.id)}
                      title="Remove attachment from request"
                      style={{
                        backgroundColor: "transparent",
                        border: "none",
                        color: "#ef4444",
                        cursor: "pointer",
                        padding: "0.3rem",
                      }}
                    >
                      <Trash2 style={{ width: "14px", height: "14px" }} />
                    </button>
                  )}
                </div>
              ))}

              {snapshot.attachments.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--nr-text-muted, #71717a)", fontSize: "0.75rem" }}>
                  No local attachments attached to this request.
                </div>
              )}
            </div>
          )}

          {activeTab === "PREFLIGHT" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Context preflight box */}
              <div
                style={{
                  backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "6px",
                  padding: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600 }}>
                  <Cpu style={{ width: "16px", height: "16px", color: "#60a5fa" }} />
                  <span>Step 76 Context Window Preflight</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.75rem" }}>
                  <div>Model Window: {snapshot.contextPreflight.limits.contextWindow.toLocaleString()} tokens</div>
                  <div>Estimated Input: {snapshot.contextPreflight.estimatedInputTokens.toLocaleString()} tokens</div>
                  <div>Output Capacity: {snapshot.contextPreflight.availableOutputCapacity.toLocaleString()} tokens</div>
                  <div>Headroom: {snapshot.contextPreflight.availableHeadroomTokens.toLocaleString()} tokens</div>
                </div>
              </div>

              {/* Budget preflight box */}
              <div
                style={{
                  backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "6px",
                  padding: "0.85rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", fontWeight: 600 }}>
                  <Coins style={{ width: "16px", height: "16px", color: "#fbbf24" }} />
                  <span>Step 75 Provider Budget Guardrails</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.75rem" }}>
                  <div>Current Period Spend: ${snapshot.budgetPreflight.currentSpendUsd.toFixed(2)}</div>
                  <div>
                    Monthly Limit:{" "}
                    {snapshot.budgetPreflight.budgetLimitUsd !== null
                      ? `$${snapshot.budgetPreflight.budgetLimitUsd.toFixed(2)}`
                      : "Unbounded"}
                  </div>
                  <div>Estimated Cost: ${snapshot.estimatedCostUsd?.toFixed(4) || "0.0000"}</div>
                  <div>Status: {snapshot.budgetPreflight.allowed ? "Permitted" : "Blocked"}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--nr-border-default, #27272a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--nr-border-default, #27272a)",
                borderRadius: "4px",
                padding: "0.4rem 0.75rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Return to Edit
            </button>
            <button
              type="button"
              onClick={loadSnapshot}
              disabled={isLoading}
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--nr-border-default, #27272a)",
                borderRadius: "4px",
                padding: "0.4rem 0.75rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.75rem",
                cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              <RefreshCw style={{ width: "12px", height: "12px" }} />
              <span>Refresh</span>
            </button>
            <CompatibilityCenterTrigger
              variant="compact"
              requestRequirements={{
                estimatedInputTokens: snapshot.totalEstimatedTokens,
                requiresImageInput: snapshot.attachments.some((a) => a.isMultimodal),
              }}
            />
          </div>

          <button
            type="button"
            disabled={!snapshot.isSubmissible || isLoading}
            onClick={() => void handleSend()}
            title={
              snapshot.isSubmissible
                ? "Send prompt to model"
                : snapshot.blockingReason || "Cannot submit invalid request"
            }
            style={{
              backgroundColor: snapshot.isSubmissible
                ? "var(--nr-accent-purple, #7c3aed)"
                : "var(--nr-bg-surface-hover, #1f232e)",
              color: snapshot.isSubmissible ? "#ffffff" : "var(--nr-text-disabled, #52525b)",
              border: "none",
              borderRadius: "6px",
              padding: "0.45rem 1.15rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: snapshot.isSubmissible && !isLoading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              transition: "all 0.15s ease",
            }}
          >
            <Send style={{ width: "14px", height: "14px" }} />
            <span>Send Request</span>
          </button>
        </div>
      </div>
    </div>
  );
};
