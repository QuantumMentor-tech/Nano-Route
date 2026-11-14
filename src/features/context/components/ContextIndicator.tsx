/**
 * Nano Route — Context Indicator Component
 * File: src/features/context/components/ContextIndicator.tsx
 *
 * Implements Step 76:
 * - Compact, accessible token headroom badge
 * - Non-color-dependent cues (icons + text + ARIA role)
 * - Screen-reader announcements for context headroom
 * - Interactive click handler for Context Review modal
 */

import React from "react";
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from "lucide-react";
import type { ContextPreflightEvaluation } from "../types.ts";

export interface ContextIndicatorProps {
  evaluation: ContextPreflightEvaluation | null;
  onOpenContextReview?: () => void;
  className?: string;
}

export const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  evaluation,
  onOpenContextReview,
  className = "",
}) => {
  if (!evaluation) {
    return null;
  }

  const {
    classification,
    limits,
    totalRequiredTokens,
    percentUsed,
    availableOutputCapacity,
  } = evaluation;

  // Format token counts cleanly (e.g. "1.2k", "128k", "2M")
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
    }
    return tokens.toString();
  };

  let icon = <CheckCircle2 style={{ width: "13px", height: "13px", color: "var(--nr-status-success, #22c55e)" }} />;
  let badgeColor = "rgba(34, 197, 94, 0.15)";
  let borderColor = "rgba(34, 197, 94, 0.3)";
  let textColor = "var(--nr-text-secondary, #a1a1aa)";
  let label = "Context Safe";

  if (classification === "NEAR_LIMIT") {
    icon = <AlertTriangle style={{ width: "13px", height: "13px", color: "var(--nr-status-warning, #eab308)" }} />;
    badgeColor = "rgba(234, 179, 8, 0.15)";
    borderColor = "rgba(234, 179, 8, 0.35)";
    textColor = "var(--nr-status-warning, #eab308)";
    label = "Near Context Limit";
  } else if (classification === "EXCEEDS_LIMIT") {
    icon = <AlertOctagon style={{ width: "13px", height: "13px", color: "var(--nr-status-error, #ef4444)" }} />;
    badgeColor = "rgba(239, 68, 68, 0.15)";
    borderColor = "rgba(239, 68, 68, 0.35)";
    textColor = "var(--nr-status-error, #ef4444)";
    label = "Context Limit Exceeded";
  } else if (classification === "UNKNOWN") {
    icon = <HelpCircle style={{ width: "13px", height: "13px", color: "var(--nr-text-muted, #71717a)" }} />;
    badgeColor = "rgba(113, 113, 122, 0.15)";
    borderColor = "rgba(113, 113, 122, 0.3)";
    textColor = "var(--nr-text-muted, #71717a)";
    label = "Unverified Limit";
  }

  const tokenText =
    limits.contextWindow > 0
      ? `~${formatTokens(totalRequiredTokens)} / ${formatTokens(limits.contextWindow)} (${percentUsed.toFixed(0)}%)`
      : `~${formatTokens(totalRequiredTokens)} tokens`;

  const ariaDescription = `Estimated context: approximately ${totalRequiredTokens.toLocaleString()} tokens of a ${limits.contextWindow.toLocaleString()} token limit. ${label}.`;

  return (
    <button
      type="button"
      onClick={onOpenContextReview}
      aria-label={ariaDescription}
      title={`Context: ${tokenText} • Available output: ~${formatTokens(availableOutputCapacity)} tokens • Click to review`}
      className={`nr-context-indicator ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.5rem",
        borderRadius: "var(--nr-radius-sm, 4px)",
        backgroundColor: badgeColor,
        border: `1px solid ${borderColor}`,
        color: textColor,
        fontSize: "0.75rem",
        fontWeight: 500,
        cursor: onOpenContextReview ? "pointer" : "default",
        transition: "all 0.15s ease",
      }}
    >
      {icon}
      <span>{tokenText}</span>
    </button>
  );
};

