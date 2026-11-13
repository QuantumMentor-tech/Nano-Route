import React from "react";
import { Cpu, HardDrive } from "lucide-react";
import type { SubsystemReadinessItem } from "../types";

export interface LocalSlmStepProps {
  slmStatus: SubsystemReadinessItem;
}

export const LocalSlmStep: React.FC<LocalSlmStepProps> = ({ slmStatus }) => {
  const isReady = slmStatus.status === "ready";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h3
          id="onboarding-step-heading"
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "var(--nr-text-primary)",
          }}
        >
          Local SLM Setup & On-Device Engine
        </h3>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--nr-text-secondary)" }}>
          The local Small Language Model (SLM) runs directly on your Windows PC using native ONNX/DirectML runtime. It scores incoming queries for intent, syntax, complexity, and security constraints with zero cloud latency.
        </p>
      </div>

      <div
        style={{
          padding: "1.25rem",
          backgroundColor: isReady ? "rgba(16, 185, 129, 0.05)" : "rgba(245, 158, 11, 0.05)",
          border: `1px solid ${isReady ? "rgba(16, 185, 129, 0.25)" : "rgba(245, 158, 11, 0.25)"}`,
          borderRadius: "var(--nr-radius-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Cpu size={24} style={{ color: isReady ? "var(--nr-status-success)" : "var(--nr-status-warning)" }} />
          <div>
            <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>
              Runtime Model: Llama 3.2 3B (Local)
            </h4>
            <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
              Engine Status: {isReady ? "Loaded & Ready for Inference" : "Offline / Unloaded"}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "0.75rem",
            fontSize: "0.8125rem",
          }}
        >
          <div style={{ padding: "0.75rem", backgroundColor: "rgba(255, 255, 255, 0.02)", borderRadius: "var(--nr-radius-md)" }}>
            <span style={{ color: "var(--nr-text-secondary)" }}>Execution Provider:</span>
            <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>CPU / DirectML</div>
          </div>
          <div style={{ padding: "0.75rem", backgroundColor: "rgba(255, 255, 255, 0.02)", borderRadius: "var(--nr-radius-md)" }}>
            <span style={{ color: "var(--nr-text-secondary)" }}>Context Window:</span>
            <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>8,192 Tokens</div>
          </div>
          <div style={{ padding: "0.75rem", backgroundColor: "rgba(255, 255, 255, 0.02)", borderRadius: "var(--nr-radius-md)" }}>
            <span style={{ color: "var(--nr-text-secondary)" }}>Inference Cost:</span>
            <div style={{ fontWeight: 600, marginTop: "0.25rem", color: "var(--nr-status-success)" }}>$0.00 (Free / Local)</div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "0.875rem",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--nr-border-default)",
          borderRadius: "var(--nr-radius-md)",
          fontSize: "0.8125rem",
          color: "var(--nr-text-secondary)",
        }}
      >
        <HardDrive size={18} style={{ color: "var(--nr-accent-purple)", flexShrink: 0, marginTop: "0.125rem" }} />
        <span>
          Local models are stored in your user profile: <code>%LOCALAPPDATA%\Nano Route\models</code>. They do not send prompts over the internet and remain fully available offline.
        </span>
      </div>
    </div>
  );
};
