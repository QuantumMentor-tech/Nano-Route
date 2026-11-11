/**
//! Nano Route — Empty Chat State (Active Conversation with 0 Messages)
//! File: src/features/chat/components/EmptyChatState.tsx
//!
//! Greeting screen with starter prompt suggestions and keyboard shortcut hints.
*/

import React from "react";
import { Sparkles, Terminal, Cpu, ShieldCheck } from "lucide-react";

export interface EmptyChatStateProps {
  onSelectSuggestion?: (suggestion: string) => void;
  className?: string;
}

const STARTER_PROMPTS = [
  {
    icon: Cpu,
    title: "Explain Concept",
    prompt: "Explain how on-device SLM routing works and why local privacy matters.",
  },
  {
    icon: Terminal,
    title: "Rust System Code",
    prompt: "Write a high-performance Rust function to stream JSON chunks with zero-copy parsing.",
  },
  {
    icon: Sparkles,
    title: "Architecture Analysis",
    prompt: "Compare monolithic vs microservice architectures for local desktop AI systems.",
  },
  {
    icon: ShieldCheck,
    title: "Security Best Practices",
    prompt: "What are the security advantages of Windows DPAPI for encrypting API keys?",
  },
];

export const EmptyChatState: React.FC<EmptyChatStateProps> = ({
  onSelectSuggestion,
  className = "",
}) => {
  return (
    <div
      className={`nr-empty-chat-state ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        maxWidth: "680px",
        margin: "auto",
        textAlign: "center",
        padding: "2rem 1rem",
      }}
    >
      {/* Icon / Brand mark */}
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "var(--nr-radius-lg, 8px)",
          backgroundColor: "var(--nr-accent-purple-subtle, rgba(124, 58, 237, 0.12))",
          border: "1px solid var(--nr-accent-purple-border, rgba(124, 58, 237, 0.35))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--nr-accent-purple, #7c3aed)",
          marginBottom: "1rem",
        }}
      >
        <Sparkles style={{ width: "24px", height: "24px" }} />
      </div>

      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "var(--nr-text-primary, #ffffff)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}
      >
        How can Nano Route assist you today?
      </h2>

      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--nr-text-secondary, #a1a1aa)",
          marginTop: "0.5rem",
          marginBottom: "1.75rem",
          maxWidth: "480px",
          lineHeight: 1.5,
        }}
      >
        Send a prompt below to begin. The local SLM routing engine analyzes complexity and
        dispatches your request to the optimal model.
      </p>

      {/* Suggested Prompt Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "0.75rem",
          width: "100%",
        }}
      >
        {STARTER_PROMPTS.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onSelectSuggestion?.(item.prompt)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0.875rem 1rem",
                borderRadius: "var(--nr-radius-md, 6px)",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                border: "1px solid var(--nr-border-default, #27272a)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--nr-border-focus, #7c3aed)";
                e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-hover, #1f232e)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--nr-border-default, #27272a)";
                e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-elevated, #181b22)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #ffffff)",
                  marginBottom: "0.25rem",
                }}
              >
                <Icon style={{ width: "14px", height: "14px", color: "var(--nr-accent-purple, #7c3aed)" }} />
                <span>{item.title}</span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--nr-text-muted, #71717a)",
                  lineHeight: 1.4,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {item.prompt}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

