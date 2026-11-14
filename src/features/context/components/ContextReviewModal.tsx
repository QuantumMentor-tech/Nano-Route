/**
 * Nano Route — Context Review & Safe Reduction Modal
 * File: src/features/context/components/ContextReviewModal.tsx
 *
 * Implements Step 76:
 * - Transparent inspection of included versus excluded messages
 * - Deterministic, non-destructive context reduction controls
 * - Invariant: Zero deletion of SQLite chat history!
 */

import React, { useState } from "react";
import {
  Layers,
  X,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import type { ContextPreflightEvaluation, ContextReductionMode } from "../types.ts";
import { createContextReductionPlan } from "../engine.ts";

export interface ContextReviewModalProps {
  isOpen: boolean;
  evaluation: ContextPreflightEvaluation | null;
  historyMessages: Array<{ id?: string; content: string; sender?: string }>;
  currentPrompt: string;
  systemPrompt?: string;
  onClose: () => void;
  onApplyReductionMode?: (mode: ContextReductionMode, windowSize: number) => void;
  onStartNewChat?: () => void;
}

export const ContextReviewModal: React.FC<ContextReviewModalProps> = ({
  isOpen,
  evaluation,
  historyMessages,
  currentPrompt,
  systemPrompt,
  onClose,
  onApplyReductionMode,
  onStartNewChat,
}) => {
  const [selectedMode, setSelectedMode] = useState<ContextReductionMode>("RECENT_WINDOW");
  const [windowSize, setWindowSize] = useState<number>(10);

  if (!isOpen || !evaluation) return null;

  const plan = createContextReductionPlan(
    historyMessages,
    currentPrompt,
    systemPrompt,
    evaluation.limits.contextWindow,
    selectedMode,
    windowSize
  );

  const handleApply = () => {
    if (onApplyReductionMode) {
      onApplyReductionMode(selectedMode, windowSize);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="context-review-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Layers style={{ width: "18px", height: "18px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <h2
              id="context-review-title"
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #ffffff)",
                margin: 0,
              }}
            >
              Context Window & Request Size
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close context review"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-muted, #71717a)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "4px",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: "1.25rem", overflowY: "auto", maxHeight: "70vh" }}>
          {/* Status Banner */}
          {evaluation.warningNotice && (
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                padding: "0.75rem 1rem",
                borderRadius: "var(--nr-radius-md, 6px)",
                backgroundColor:
                  evaluation.classification === "EXCEEDS_LIMIT"
                    ? "rgba(239, 68, 68, 0.15)"
                    : "rgba(234, 179, 8, 0.15)",
                border: `1px solid ${
                  evaluation.classification === "EXCEEDS_LIMIT"
                    ? "rgba(239, 68, 68, 0.35)"
                    : "rgba(234, 179, 8, 0.35)"
                }`,
                color:
                  evaluation.classification === "EXCEEDS_LIMIT"
                    ? "var(--nr-status-error, #ef4444)"
                    : "var(--nr-status-warning, #eab308)",
                fontSize: "0.8125rem",
                marginBottom: "1rem",
              }}
            >
              <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
              <div>{evaluation.warningNotice}</div>
            </div>
          )}

          {/* Model Context Stats */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--nr-radius-md, 6px)",
                backgroundColor: "var(--nr-bg-base, #0d0f14)",
                border: "1px solid var(--nr-border-default, #27272a)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
                Selected Model
              </div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                {evaluation.limits.displayName}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)", marginTop: "2px" }}>
                Limit: {evaluation.limits.contextWindow.toLocaleString()} tokens
              </div>
            </div>

            <div
              style={{
                padding: "0.75rem",
                borderRadius: "var(--nr-radius-md, 6px)",
                backgroundColor: "var(--nr-bg-base, #0d0f14)",
                border: "1px solid var(--nr-border-default, #27272a)",
              }}
            >
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
                Estimated Request Context
              </div>
              <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                ~{evaluation.totalRequiredTokens.toLocaleString()} tokens
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)", marginTop: "2px" }}>
                {evaluation.percentUsed.toFixed(0)}% of model capacity
              </div>
            </div>
          </div>

          {/* Non-Destructive Reduction Options */}
          <div style={{ marginBottom: "1rem" }}>
            <label
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #ffffff)",
                marginBottom: "0.5rem",
              }}
            >
              Context Selection Mode
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "var(--nr-radius-md, 6px)",
                  backgroundColor:
                    selectedMode === "RECENT_WINDOW"
                      ? "rgba(168, 85, 247, 0.1)"
                      : "var(--nr-bg-base, #0d0f14)",
                  border: `1px solid ${
                    selectedMode === "RECENT_WINDOW"
                      ? "var(--nr-accent-purple, #a855f7)"
                      : "var(--nr-border-default, #27272a)"
                  }`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="reductionMode"
                  value="RECENT_WINDOW"
                  checked={selectedMode === "RECENT_WINDOW"}
                  onChange={() => setSelectedMode("RECENT_WINDOW")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                    Recent Messages Window (Recommended)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #a1a1aa)", marginTop: "2px" }}>
                    Transmits the most recent {windowSize} messages. Older conversation turns remain permanently in History.
                  </div>
                  {selectedMode === "RECENT_WINDOW" && (
                    <div style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}>Window:</span>
                      <select
                        value={windowSize}
                        onChange={(e) => setWindowSize(Number(e.target.value))}
                        style={{
                          backgroundColor: "var(--nr-bg-surface, #14171f)",
                          color: "var(--nr-text-primary, #ffffff)",
                          border: "1px solid var(--nr-border-default, #27272a)",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          padding: "0.2rem 0.4rem",
                        }}
                      >
                        <option value={5}>Last 5 messages</option>
                        <option value={10}>Last 10 messages</option>
                        <option value={20}>Last 20 messages</option>
                        <option value={50}>Last 50 messages</option>
                      </select>
                    </div>
                  )}
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "var(--nr-radius-md, 6px)",
                  backgroundColor:
                    selectedMode === "FULL_HISTORY"
                      ? "rgba(168, 85, 247, 0.1)"
                      : "var(--nr-bg-base, #0d0f14)",
                  border: `1px solid ${
                    selectedMode === "FULL_HISTORY"
                      ? "var(--nr-accent-purple, #a855f7)"
                      : "var(--nr-border-default, #27272a)"
                  }`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="reductionMode"
                  value="FULL_HISTORY"
                  checked={selectedMode === "FULL_HISTORY"}
                  onChange={() => setSelectedMode("FULL_HISTORY")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                    Full Conversation (All Messages)
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #a1a1aa)", marginTop: "2px" }}>
                    Sends all {historyMessages.length} past messages in the current session.
                  </div>
                </div>
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "var(--nr-radius-md, 6px)",
                  backgroundColor:
                    selectedMode === "PROTECTED_ONLY"
                      ? "rgba(168, 85, 247, 0.1)"
                      : "var(--nr-bg-base, #0d0f14)",
                  border: `1px solid ${
                    selectedMode === "PROTECTED_ONLY"
                      ? "var(--nr-accent-purple, #a855f7)"
                      : "var(--nr-border-default, #27272a)"
                  }`,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="reductionMode"
                  value="PROTECTED_ONLY"
                  checked={selectedMode === "PROTECTED_ONLY"}
                  onChange={() => setSelectedMode("PROTECTED_ONLY")}
                  style={{ marginTop: "3px" }}
                />
                <div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                    Current Prompt Only
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #a1a1aa)", marginTop: "2px" }}>
                    Omits past turns from this request completely while keeping all history preserved in SQLite.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Explanation Callout */}
          <div
            style={{
              padding: "0.75rem",
              borderRadius: "var(--nr-radius-md, 6px)",
              backgroundColor: "rgba(168, 85, 247, 0.05)",
              border: "1px dashed rgba(168, 85, 247, 0.3)",
              fontSize: "0.75rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <ShieldCheck style={{ width: "16px", height: "16px", color: "var(--nr-accent-purple, #a855f7)", flexShrink: 0 }} />
            <span>{plan.explanation}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--nr-border-default, #27272a)",
            backgroundColor: "var(--nr-bg-base, #0d0f14)",
          }}
        >
          {onStartNewChat && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartNewChat();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.75rem",
                borderRadius: "var(--nr-radius-sm, 4px)",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "transparent",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              <Sparkles style={{ width: "14px", height: "14px" }} />
              Start New Chat
            </button>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "var(--nr-radius-sm, 4px)",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "transparent",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "var(--nr-radius-sm, 4px)",
                border: "none",
                backgroundColor: "var(--nr-accent-purple, #a855f7)",
                color: "#ffffff",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Apply Context Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
