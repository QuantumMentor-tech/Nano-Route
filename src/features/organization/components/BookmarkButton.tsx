/**
 * Nano Route — Bookmark Action Toggle Component
 * File: src/features/organization/components/BookmarkButton.tsx
 *
 * Implements Step 82:
 * - Toggle button for message headers to add/remove bookmarks.
 * - Visual filled/unfilled state.
 * - Keyboard accessible with status announcement.
 */

import React from "react";
import { Bookmark } from "lucide-react";

export interface BookmarkButtonProps {
  isBookmarked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({
  isBookmarked,
  onToggle,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={isBookmarked ? "Remove bookmark" : "Bookmark message"}
      title={isBookmarked ? "Remove bookmark" : "Bookmark this message"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        padding: "0.2rem 0.35rem",
        borderRadius: "var(--nr-radius-sm, 4px)",
        cursor: disabled ? "not-allowed" : "pointer",
        color: isBookmarked ? "var(--nr-accent-amber, #f59e0b)" : "var(--nr-text-muted, #71717a)",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !isBookmarked) {
          e.currentTarget.style.color = "var(--nr-text-primary, #ffffff)";
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && !isBookmarked) {
          e.currentTarget.style.color = "var(--nr-text-muted, #71717a)";
        }
      }}
    >
      <Bookmark
        style={{
          width: "12px",
          height: "12px",
          fill: isBookmarked ? "currentColor" : "none",
        }}
      />
    </button>
  );
};

