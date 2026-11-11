/**
//! Nano Route — Model Routing Badge Component
//! File: src/features/chat/components/ModelBadge.tsx
//!
//! Visual indicator for routed provider, model, latency, and token consumption
//! metadata attached to an assistant response.
*/

import React from "react";
import { Cpu, Zap } from "lucide-react";
import type { ChatMessageMetadata } from "../types";

export interface ModelBadgeProps {
  metadata?: Partial<ChatMessageMetadata> | null;
  className?: string;
}

export const ModelBadge: React.FC<ModelBadgeProps> = ({
  metadata,
  className = "",
}) => {
  if (!metadata || (!metadata.routedProvider && !metadata.routedModel)) {
    return null;
  }

  const provider = metadata.routedProvider || "Unknown";
  const model = metadata.routedModel || "Default";
  const latency = metadata.latencyMs ? `${metadata.latencyMs}ms` : null;
  const tokens =
    metadata.completionTokens && metadata.completionTokens > 0
      ? `${metadata.completionTokens} tok`
      : null;

  return (
    <div
      className={`nr-model-badge ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.2rem 0.5rem",
        fontSize: "0.75rem",
        borderRadius: "var(--nr-radius-full, 9999px)",
        backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
        border: "1px solid var(--nr-border-subtle, #1f222b)",
        color: "var(--nr-text-secondary, #a1a1aa)",
        userSelect: "none",
      }}
    >
      <Cpu style={{ width: "12px", height: "12px", color: "var(--nr-accent-purple, #7c3aed)" }} />
      <span style={{ fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
        {provider}
      </span>
      <span style={{ color: "var(--nr-border-strong, #3f3f46)" }}>/</span>
      <span>{model}</span>

      {(latency || tokens) && (
        <>
          <span style={{ color: "var(--nr-border-strong, #3f3f46)" }}>•</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.2rem",
              color: "var(--nr-text-muted, #71717a)",
              fontSize: "0.7rem",
            }}
          >
            {latency && (
              <>
                <Zap style={{ width: "10px", height: "10px" }} />
                <span>{latency}</span>
              </>
            )}
            {latency && tokens && <span>•</span>}
            {tokens && <span>{tokens}</span>}
          </span>
        </>
      )}
    </div>
  );
};

