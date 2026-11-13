import React from "react";
import { Gauge, Sliders } from "lucide-react";

export const RoutingReadinessStep: React.FC = () => {
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
          Routing Configuration & Preferences
        </h3>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--nr-text-secondary)" }}>
          When you submit a prompt, Nano Route evaluates intent, required context, and token complexity locally before selecting a provider. You retain complete control over routing policies.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <div
          style={{
            padding: "1rem",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--nr-border-default)",
            borderRadius: "var(--nr-radius-lg)",
            display: "flex",
            gap: "0.875rem",
          }}
        >
          <Gauge size={22} style={{ color: "var(--nr-accent-purple)", flexShrink: 0, marginTop: "0.125rem" }} />
          <div>
            <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
              Automatic Multi-Factor Routing (Default: Balanced)
            </h4>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
              Balances quality, latency, and cost automatically. Fast code snippets and general inquiries use rapid or local models; complex multi-turn logic routes to frontier reasoning engines.
            </p>
          </div>
        </div>

        <div
          style={{
            padding: "1rem",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--nr-border-default)",
            borderRadius: "var(--nr-radius-lg)",
            display: "flex",
            gap: "0.875rem",
          }}
        >
          <Sliders size={22} style={{ color: "var(--nr-accent-blue)", flexShrink: 0, marginTop: "0.125rem" }} />
          <div>
            <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
              Manual Routing Override
            </h4>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
              Prefer a specific model? You can lock Nano Route to any provider or model anytime directly from the Chat Studio or Settings Workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
