import React from "react";
import { Activity, Clock, Zap, DollarSign } from "lucide-react";
import { Card, Badge } from "../../../components/ui";

export const MetricsOverview: React.FC = () => {
  return (
    <section aria-labelledby="metrics-heading" style={{ marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem" }}>
        <h2
          id="metrics-heading"
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "var(--nr-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: 0,
          }}
        >
          Routing & Telemetry Metrics
        </h2>
        <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)" }}>
          Planned Subsystem (Telemetry Engine)
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {/* Metric 1: Dispatch Latency */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", fontWeight: 500 }}>
              Routing Latency
            </span>
            <Clock style={{ width: "16px", height: "16px", color: "var(--nr-text-muted)" }} />
          </div>
          <div style={{ margin: "0.5rem 0" }}>
            <Badge variant="default" size="sm">
              Not Active
            </Badge>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", margin: "0.5rem 0 0", lineHeight: 1.4 }}>
            Local SLM evaluation and network dispatch latency will be recorded here.
          </p>
        </Card>

        {/* Metric 2: Token Volume */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", fontWeight: 500 }}>
              Token Volume
            </span>
            <Zap style={{ width: "16px", height: "16px", color: "var(--nr-text-muted)" }} />
          </div>
          <div style={{ margin: "0.5rem 0" }}>
            <Badge variant="default" size="sm">
              Not Active
            </Badge>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", margin: "0.5rem 0 0", lineHeight: 1.4 }}>
            Prompt and completion token accounting begins upon provider connection.
          </p>
        </Card>

        {/* Metric 3: Cost Optimization */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", fontWeight: 500 }}>
              Cost Optimization
            </span>
            <DollarSign style={{ width: "16px", height: "16px", color: "var(--nr-text-muted)" }} />
          </div>
          <div style={{ margin: "0.5rem 0" }}>
            <Badge variant="default" size="sm">
              Not Active
            </Badge>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", margin: "0.5rem 0 0", lineHeight: 1.4 }}>
            Cost savings against frontier models calculated during intelligent dispatch.
          </p>
        </Card>

        {/* Metric 4: Route Success Rate */}
        <Card variant="default" padding="md">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", fontWeight: 500 }}>
              Dispatch Success
            </span>
            <Activity style={{ width: "16px", height: "16px", color: "var(--nr-text-muted)" }} />
          </div>
          <div style={{ margin: "0.5rem 0" }}>
            <Badge variant="default" size="sm">
              Not Active
            </Badge>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--nr-text-muted)", margin: "0.5rem 0 0", lineHeight: 1.4 }}>
            Primary route completions vs. automatic fallback dispatches.
          </p>
        </Card>
      </div>
    </section>
  );
};

MetricsOverview.displayName = "MetricsOverview";

