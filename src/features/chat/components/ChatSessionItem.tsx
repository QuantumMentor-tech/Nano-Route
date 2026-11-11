/**
//! Nano Route — Chat Session Sidebar Item
//! File: src/features/chat/components/ChatSessionItem.tsx
//!
//! Interactive session card displaying conversation title, active highlight,
//! pin indicator, and quick actions.
*/

import React from "react";
import { MessageSquare, Pin, Trash2 } from "lucide-react";
import type { ChatSession } from "../types";

export interface ChatSessionItemProps {
  session: ChatSession;
  isActive: boolean;
  onSelect: (sessionId: string) => void;
  onTogglePin: (sessionId: string, pinned: boolean) => void;
  onDeleteRequest: (session: ChatSession) => void;
  className?: string;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;

  return new Date(timestamp).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export const ChatSessionItem: React.FC<ChatSessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onTogglePin,
  onDeleteRequest,
  className = "",
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(session.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(session.id);
        }
      }}
      aria-selected={isActive}
      className={`nr-chat-session-item ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.5rem 0.75rem",
        margin: "0.2rem 0.5rem",
        borderRadius: "var(--nr-radius-md, 6px)",
        backgroundColor: isActive
          ? "var(--nr-bg-surface-elevated, #181b22)"
          : "transparent",
        border: isActive
          ? "1px solid var(--nr-accent-purple-border, rgba(124, 58, 237, 0.35))"
          : "1px solid transparent",
        cursor: "pointer",
        outline: "none",
        transition: "all 0.15s ease",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-hover, #1f232e)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = "transparent";
        }
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          minWidth: 0,
          flex: 1,
        }}
      >
        <MessageSquare
          style={{
            width: "14px",
            height: "14px",
            color: isActive
              ? "var(--nr-accent-purple, #7c3aed)"
              : "var(--nr-text-muted, #71717a)",
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: "0.8125rem",
              fontWeight: isActive ? 600 : 400,
              color: isActive
                ? "var(--nr-text-primary, #ffffff)"
                : "var(--nr-text-secondary, #a1a1aa)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={session.title}
          >
            {session.title}
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--nr-text-muted, #71717a)",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              marginTop: "0.1rem",
            }}
          >
            <span>{formatRelativeTime(session.updatedAt)}</span>
            {session.pinned && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.2rem",
                  color: "var(--nr-accent-purple, #7c3aed)",
                }}
              >
                • <Pin style={{ width: "9px", height: "9px", fill: "currentColor" }} /> Pinned
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons (Pin / Delete) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.2rem",
          opacity: isActive ? 1 : 0.6,
          transition: "opacity 0.15s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(session.id, !session.pinned);
          }}
          aria-label={session.pinned ? "Unpin session" : "Pin session"}
          title={session.pinned ? "Unpin" : "Pin to top"}
          style={{
            background: "transparent",
            border: "none",
            color: session.pinned
              ? "var(--nr-accent-purple, #7c3aed)"
              : "var(--nr-text-muted, #71717a)",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "var(--nr-radius-sm, 4px)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Pin
            style={{
              width: "12px",
              height: "12px",
              fill: session.pinned ? "currentColor" : "none",
            }}
          />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRequest(session);
          }}
          aria-label="Delete session"
          title="Delete session"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--nr-text-muted, #71717a)",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "var(--nr-radius-sm, 4px)",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--nr-status-error, #ef4444)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--nr-text-muted, #71717a)";
          }}
        >
          <Trash2 style={{ width: "12px", height: "12px" }} />
        </button>
      </div>
    </div>
  );
};

