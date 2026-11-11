/**
//! Nano Route — User Chat Message Bubble
//! File: src/features/chat/components/UserMessage.tsx
//!
//! Distinctive visual presentation for user prompts in the conversation timeline.
*/

import React, { useState, useCallback } from "react";
import { Check, Copy, User } from "lucide-react";
import type { ChatMessage } from "../types";

export interface UserMessageProps {
  message: ChatMessage;
  className?: string;
}

export const UserMessage: React.FC<UserMessageProps> = ({
  message,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message.content);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  }, [message.content]);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`nr-user-message-container ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        margin: "1rem 0",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.35rem",
          fontSize: "0.75rem",
          color: "var(--nr-text-muted, #71717a)",
        }}
      >
        <span>{formattedTime}</span>
        <span style={{ fontWeight: 600, color: "var(--nr-text-secondary, #a1a1aa)" }}>You</span>
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: "var(--nr-accent-purple, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <User style={{ width: "12px", height: "12px" }} />
        </div>
      </div>

      <div
        style={{
          position: "relative",
          maxWidth: "80%",
          padding: "0.875rem 1.125rem",
          borderRadius: "var(--nr-radius-lg, 8px) var(--nr-radius-lg, 8px) 0 var(--nr-radius-lg, 8px)",
          backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
          border: "1px solid var(--nr-border-default, #27272a)",
          color: "var(--nr-text-primary, #ffffff)",
          fontSize: "0.9375rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
        }}
      >
        {message.content}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "0.35rem",
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Prompt copied to clipboard" : "Copy prompt"}
            title="Copy prompt"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.15rem 0.35rem",
              fontSize: "0.7rem",
              color: copied ? "var(--nr-status-success, #10b981)" : "var(--nr-text-muted, #71717a)",
              borderRadius: "var(--nr-radius-sm, 4px)",
              transition: "color 0.15s ease",
            }}
          >
            {copied ? (
              <>
                <Check style={{ width: "11px", height: "11px" }} />
                <span>Copied</span>
              </>
            ) : (
              <Copy style={{ width: "11px", height: "11px" }} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

