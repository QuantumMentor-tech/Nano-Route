/**
//! Nano Route — System Chat Message Bubble
//! File: src/features/chat/components/SystemMessage.tsx
//!
//! Compact, centered visual representation for system notices and orchestration events.
*/

import React from "react";
import { Info } from "lucide-react";
import type { ChatMessage } from "../types";

export interface SystemMessageProps {
  message: ChatMessage;
  className?: string;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({
  message,
  className = "",
}) => {
  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`nr-system-message-container ${className}`}
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        margin: "0.75rem 0",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "var(--nr-radius-full, 9999px)",
          backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
          border: "1px solid var(--nr-border-subtle, #1f222b)",
          color: "var(--nr-text-secondary, #a1a1aa)",
          fontSize: "0.75rem",
          maxWidth: "85%",
          textAlign: "center",
        }}
      >
        <Info style={{ width: "13px", height: "13px", color: "var(--nr-status-info, #38bdf8)", flexShrink: 0 }} />
        <span>{message.content}</span>
        <span style={{ color: "var(--nr-text-muted, #71717a)", fontSize: "0.7rem" }}>
          {formattedTime}
        </span>
      </div>
    </div>
  );
};

