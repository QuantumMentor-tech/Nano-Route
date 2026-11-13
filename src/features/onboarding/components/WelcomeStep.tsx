import React from "react";
import { Cpu, ShieldCheck, Zap } from "lucide-react";

export const WelcomeStep: React.FC = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
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
          Welcome to Nano Route
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            color: "var(--nr-text-secondary)",
          }}
        >
          The intelligent hybrid AI desktop router for Windows. Nano Route analyzes your prompts locally using an on-device Small Language Model (SLM) to route each query to the optimal model based on complexity, speed, and cost.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <div
          style={{
            padding: "1rem",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--nr-border-default)",
            borderRadius: "var(--nr-radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--nr-accent-purple)" }}>
            <Cpu size={18} />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Local First Routing</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
            Zero-latency local SLM evaluates query complexity before any network call is initiated.
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--nr-border-default)",
            borderRadius: "var(--nr-radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--nr-accent-blue)" }}>
            <ShieldCheck size={18} />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Windows DPAPI Vault</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
            Provider API keys are encrypted via Windows DPAPI. Zero plaintext keys are ever saved to disk or logged.
          </p>
        </div>

        <div
          style={{
            padding: "1rem",
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--nr-border-default)",
            borderRadius: "var(--nr-radius-lg)",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--nr-status-success)" }}>
            <Zap size={18} />
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>Cost & Latency Savings</span>
          </div>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
            Simple questions stay local or use fast mini models; difficult reasoning escalates to frontier models.
          </p>
        </div>
      </div>
    </div>
  );
};
