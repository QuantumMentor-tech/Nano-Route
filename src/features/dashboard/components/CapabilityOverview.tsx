import React from "react";
import { Link } from "react-router-dom";
import { Card, Badge } from "../../../components/ui";
import type { CapabilityItem } from "../types";
import { ROUTE_PATHS } from "../../../routes/routePaths";

export const CAPABILITIES: CapabilityItem[] = [
  {
    id: "desktop-core",
    label: "Desktop Shell & Native Core",
    description: "Tauri v2 runtime shell, IPC command bridge, and window management.",
    status: "ready",
    badgeText: "Ready",
    badgeVariant: "success",
  },
  {
    id: "navigation",
    label: "Client Navigation & Router",
    description: "Declarative hash router, sidebar navigation, and route boundary isolation.",
    status: "ready",
    badgeText: "Ready",
    badgeVariant: "success",
  },
  {
    id: "chat-workspace",
    label: "Chat Studio Workspace",
    description: "Multi-turn prompt composition interface and conversation view.",
    status: "available",
    badgeText: "Available",
    badgeVariant: "purple",
    route: ROUTE_PATHS.CHAT,
  },
  {
    id: "local-slm",
    label: "Local SLM Inference",
    description: "On-device quantized Small Language Model router execution (DirectML/GGUF).",
    status: "ready",
    badgeText: "Active",
    badgeVariant: "success",
    route: ROUTE_PATHS.SETTINGS,
  },
  {
    id: "ai-providers",
    label: "External AI Providers",
    description: "Unified client integrations for Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, and Mistral.",
    status: "ready",
    badgeText: "Ready",
    badgeVariant: "success",
    route: ROUTE_PATHS.SETTINGS,
  },
  {
    id: "routing-engine",
    label: "Intelligent Routing Engine",
    description: "Multi-factor scoring algorithm evaluating latency, cost, and task capability.",
    status: "ready",
    badgeText: "Active",
    badgeVariant: "success",
    route: ROUTE_PATHS.CHAT,
  },
  {
    id: "telemetry",
    label: "Telemetry & Operational Analytics",
    description: "Read-only local routing activity, outcome distributions, confidence buckets, and provider/model insights.",
    status: "ready",
    badgeText: "Active",
    badgeVariant: "success",
    route: ROUTE_PATHS.DASHBOARD,
  },
];

export const CapabilityOverview: React.FC = () => {
  return (
    <section aria-labelledby="capability-heading" style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
        <h2
          id="capability-heading"
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--nr-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
          }}
        >
          System Capabilities
        </h2>
        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>
          Implementation Status Baseline
        </span>
      </div>

      <Card variant="default" padding="none">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {CAPABILITIES.map((cap, idx) => (
            <div
              key={cap.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.875rem 1.25rem",
                borderBottom:
                  idx < CAPABILITIES.length - 1
                    ? "1px solid var(--nr-border-subtle)"
                    : "none",
                gap: "0.75rem",
              }}
            >
              <div style={{ flex: 1, minWidth: "220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "var(--nr-text-primary)",
                    }}
                  >
                    {cap.label}
                  </span>
                  {cap.route && (
                    <Link
                      to={cap.route}
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--nr-accent-purple)",
                        textDecoration: "none",
                      }}
                    >
                      View
                    </Link>
                  )}
                </div>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--nr-text-secondary)",
                    margin: "0.125rem 0 0",
                    lineHeight: 1.4,
                  }}
                >
                  {cap.description}
                </p>
              </div>

              <div>
                <Badge variant={cap.badgeVariant} size="sm">
                  {cap.badgeText}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
};

CapabilityOverview.displayName = "CapabilityOverview";

