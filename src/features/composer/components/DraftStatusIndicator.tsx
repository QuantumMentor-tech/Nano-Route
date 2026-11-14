/**
 * Nano Route — Composer Draft Status Indicator Component
 * File: src/features/composer/components/DraftStatusIndicator.tsx
 *
 * Implements Step 78:
 * - Compact, non-intrusive draft persistence status badge.
 * - Semantic colors matching Nano Route design system.
 * - Screen-reader perceivable accessible text.
 */

import React from "react";
import type { DraftSaveStatus } from "../types.ts";
import { Check, Loader2, AlertCircle, RotateCcw } from "lucide-react";

export interface DraftStatusIndicatorProps {
  status: DraftSaveStatus;
  onClearDraft?: () => void;
  canClear?: boolean;
}

export const DraftStatusIndicator: React.FC<DraftStatusIndicatorProps> = ({
  status,
  onClearDraft,
  canClear = false,
}) => {
  if (status === "IDLE") {
    return null;
  }

  let label = "Saved";
  let icon = <Check style={{ width: "11px", height: "11px", color: "var(--nr-status-success, #22c55e)" }} />;
  let color = "var(--nr-text-muted, #71717a)";

  if (status === "SAVING") {
    label = "Saving...";
    icon = <Loader2 className="nr-spin" style={{ width: "11px", height: "11px", color: "var(--nr-accent-purple, #a855f7)" }} />;
    color = "var(--nr-text-secondary, #a1a1aa)";
  } else if (status === "DIRTY") {
    label = "Unsaved changes";
    icon = <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--nr-status-warning, #f59e0b)" }} />;
    color = "var(--nr-text-muted, #71717a)";
  } else if (status === "RECOVERED") {
    label = "Draft recovered";
    icon = <RotateCcw style={{ width: "11px", height: "11px", color: "var(--nr-accent-cyan, #06b6d4)" }} />;
    color = "var(--nr-accent-cyan, #06b6d4)";
  } else if (status === "ERROR") {
    label = "Save failed";
    icon = <AlertCircle style={{ width: "11px", height: "11px", color: "var(--nr-status-error, #ef4444)" }} />;
    color = "var(--nr-status-error, #ef4444)";
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.7rem",
        color,
        userSelect: "none",
      }}
      aria-live="polite"
      aria-label={`Draft status: ${label}`}
    >
      {icon}
      <span>{label}</span>
      {canClear && onClearDraft && (
        <button
          type="button"
          onClick={onClearDraft}
          aria-label="Discard draft"
          title="Discard current draft"
          style={{
            background: "none",
            border: "none",
            padding: "0 0.2rem",
            color: "var(--nr-text-muted, #71717a)",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: "0.7rem",
          }}
        >
          Discard
        </button>
      )}
    </div>
  );
};

