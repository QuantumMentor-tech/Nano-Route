/**
//! Nano Route — Chat Studio Error State
//! File: src/features/chat/components/ChatErrorState.tsx
//!
//! Actionable error presentation banner with retry and dismiss options.
*/

import React from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import type { ChatError } from "../types";

export interface ChatErrorStateProps {
  error: ChatError;
  onDismiss?: () => void;
  className?: string;
}

export const ChatErrorState: React.FC<ChatErrorStateProps> = ({
  error,
  onDismiss,
  className = "",
}) => {
  return (
    <div
      role="alert"
      className={`nr-chat-error-banner ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        padding: "0.75rem 1rem",
        backgroundColor: "var(--nr-status-error-bg, rgba(239, 68, 68, 0.12))",
        border: "1px solid var(--nr-status-error-border, rgba(239, 68, 68, 0.3))",
        borderRadius: "var(--nr-radius-md, 6px)",
        margin: "0.75rem 1rem",
        fontSize: "0.8125rem",
        color: "var(--nr-text-primary, #ffffff)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
        <AlertCircle
          style={{
            width: "16px",
            height: "16px",
            color: "var(--nr-status-error, #ef4444)",
            flexShrink: 0,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, gap: "0.15rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {error.envelope && (
              <span
                data-testid="error-category-tag"
                style={{
                  fontSize: "0.6875rem",
                  padding: "0.05rem 0.35rem",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  color: "var(--nr-status-error, #ef4444)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.025em",
                }}
              >
                {error.envelope.category.replace(/_/g, " ")}
              </span>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {error.message}
            </span>
          </div>
          {error.envelope?.userAction && error.envelope.userAction !== "none" && (
            <span
              data-testid="error-action-hint"
              style={{
                fontSize: "0.725rem",
                color: "var(--nr-accent-blue, #38bdf8)",
              }}
            >
              Suggested Action: {error.envelope.userAction.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
        {error.retryAction && (
          <button
            type="button"
            onClick={() => void error.retryAction?.()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "transparent",
              border: "1px solid var(--nr-status-error-border, rgba(239, 68, 68, 0.3))",
              borderRadius: "var(--nr-radius-sm, 4px)",
              padding: "0.2rem 0.5rem",
              color: "var(--nr-text-primary, #ffffff)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw style={{ width: "12px", height: "12px" }} />
            <span>Retry</span>
          </button>
        )}

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss error notification"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-muted, #71717a)",
              cursor: "pointer",
              padding: "0.2rem",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X style={{ width: "14px", height: "14px" }} />
          </button>
        )}
      </div>
    </div>
  );
};

