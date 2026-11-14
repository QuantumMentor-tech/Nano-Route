/**
 * Nano Route — Variant Switcher Component
 * File: src/features/conversation/components/VariantSwitcher.tsx
 *
 * Implements Step 81:
 * - Clean, compact `< 1 / 3 >` navigation badge for assistant messages.
 * - Displays active variant index and total variant count.
 * - Keyboard accessible button controls.
 */

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface VariantSwitcherProps {
  currentIndex: number;
  totalVariants: number;
  onSelectPrevious: () => void;
  onSelectNext: () => void;
  disabled?: boolean;
}

export const VariantSwitcher: React.FC<VariantSwitcherProps> = ({
  currentIndex,
  totalVariants,
  onSelectPrevious,
  onSelectNext,
  disabled = false,
}) => {
  if (totalVariants <= 1) return null;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.2rem",
        backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
        border: "1px solid var(--nr-border-default, #27272a)",
        borderRadius: "var(--nr-radius-sm, 4px)",
        padding: "0.1rem 0.35rem",
        fontSize: "0.7rem",
        color: "var(--nr-text-secondary, #a1a1aa)",
        userSelect: "none",
      }}
      aria-label={`Response variant ${currentIndex} of ${totalVariants}`}
    >
      <button
        type="button"
        onClick={onSelectPrevious}
        disabled={disabled || currentIndex <= 1}
        aria-label="Previous variant"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: currentIndex <= 1 ? "var(--nr-text-disabled, #52525b)" : "var(--nr-text-secondary, #a1a1aa)",
          cursor: currentIndex <= 1 ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <ChevronLeft style={{ width: "12px", height: "12px" }} />
      </button>

      <span style={{ fontWeight: 500 }}>
        {currentIndex} / {totalVariants}
      </span>

      <button
        type="button"
        onClick={onSelectNext}
        disabled={disabled || currentIndex >= totalVariants}
        aria-label="Next variant"
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: currentIndex >= totalVariants ? "var(--nr-text-disabled, #52525b)" : "var(--nr-text-secondary, #a1a1aa)",
          cursor: currentIndex >= totalVariants ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        <ChevronRight style={{ width: "12px", height: "12px" }} />
      </button>
    </div>
  );
};

