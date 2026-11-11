/**
//! Nano Route — Empty No Session Selected State
//! File: src/features/chat/components/EmptyNoSessionState.tsx
//!
//! Visual placeholder displayed when no active session is selected in the workspace.
*/

import React from "react";
import { MessageSquare, Plus } from "lucide-react";

export interface EmptyNoSessionStateProps {
  onCreateSession: () => void | Promise<void>;
  className?: string;
}

export const EmptyNoSessionState: React.FC<EmptyNoSessionStateProps> = ({
  onCreateSession,
  className = "",
}) => {
  return (
    <div
      className={`nr-empty-no-session ${className}`}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "52px",
          height: "52px",
          borderRadius: "50%",
          backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
          border: "1px solid var(--nr-border-default, #27272a)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--nr-text-muted, #71717a)",
          marginBottom: "1rem",
        }}
      >
        <MessageSquare style={{ width: "24px", height: "24px" }} />
      </div>

      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 600,
          color: "var(--nr-text-primary, #ffffff)",
          margin: 0,
        }}
      >
        No conversation selected
      </h3>

      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--nr-text-secondary, #a1a1aa)",
          marginTop: "0.5rem",
          marginBottom: "1.5rem",
          maxWidth: "360px",
          lineHeight: 1.5,
        }}
      >
        Choose an existing conversation from the sidebar or start a new chat session.
      </p>

      <button
        type="button"
        onClick={() => void onCreateSession()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 1rem",
          backgroundColor: "var(--nr-accent-purple, #7c3aed)",
          color: "#ffffff",
          border: "none",
          borderRadius: "var(--nr-radius-md, 6px)",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background-color 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--nr-accent-purple-hover, #6d28d9)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--nr-accent-purple, #7c3aed)";
        }}
      >
        <Plus style={{ width: "16px", height: "16px" }} />
        <span>Create New Chat</span>
      </button>
    </div>
  );
};

