import React from "react";
import { CheckCircle2, Sparkles, MessageSquare, Settings, ArrowRight } from "lucide-react";

export interface CompletionStepProps {
  onOpenChat: () => void;
  onOpenSettings: () => void;
}

export const CompletionStep: React.FC<CompletionStepProps> = ({
  onOpenChat,
  onOpenSettings,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <div
          style={{
            display: "inline-flex",
            padding: "1rem",
            borderRadius: "50%",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            color: "var(--nr-status-success)",
            marginBottom: "1rem",
          }}
        >
          <Sparkles size={36} />
        </div>
        <h3
          id="onboarding-step-heading"
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--nr-text-primary)",
          }}
        >
          You're Ready to Use Nano Route!
        </h3>
        <p
          style={{
            margin: "0 auto",
            maxWidth: "480px",
            fontSize: "0.9375rem",
            color: "var(--nr-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Initial setup is complete. Nano Route is operational and ready to evaluate prompts locally, calculate token savings, and route queries seamlessly.
        </p>
      </div>

      <div
        style={{
          padding: "1rem",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--nr-border-default)",
          borderRadius: "var(--nr-radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "0.625rem",
          fontSize: "0.8125rem",
        }}
      >
        <span style={{ fontWeight: 600, color: "var(--nr-text-primary)" }}>Setup Summary:</span>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--nr-status-success)" }}>
          <CheckCircle2 size={14} />
          <span>Local SQLite database initialized with WAL journaling</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--nr-status-success)" }}>
          <CheckCircle2 size={14} />
          <span>Windows DPAPI credential encryption vault operational</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--nr-status-success)" }}>
          <CheckCircle2 size={14} />
          <span>Default routing mode: Balanced (Quality / Latency / Cost)</span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "1rem",
          marginTop: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={onOpenChat}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: "var(--nr-accent-purple)",
            color: "#fff",
            border: "none",
            borderRadius: "var(--nr-radius-md)",
            fontWeight: 600,
            fontSize: "0.9375rem",
            cursor: "pointer",
            boxShadow: "0 0 12px rgba(139, 92, 246, 0.3)",
          }}
        >
          <MessageSquare size={16} />
          <span>Start Chatting</span>
          <ArrowRight size={16} />
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.25rem",
            backgroundColor: "rgba(255, 255, 255, 0.05)",
            color: "var(--nr-text-secondary)",
            border: "1px solid var(--nr-border-default)",
            borderRadius: "var(--nr-radius-md)",
            fontWeight: 500,
            fontSize: "0.875rem",
            cursor: "pointer",
          }}
        >
          <Settings size={15} />
          <span>Open Settings</span>
        </button>
      </div>
    </div>
  );
};
