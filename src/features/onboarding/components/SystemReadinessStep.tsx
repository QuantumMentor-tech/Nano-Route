import React from "react";
import { CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react";
import type { SystemReadinessReport, SubsystemReadinessItem } from "../types";

export interface SystemReadinessStepProps {
  report: SystemReadinessReport;
}

export const SystemReadinessStep: React.FC<SystemReadinessStepProps> = ({ report }) => {
  const items: SubsystemReadinessItem[] = [
    report.database,
    report.localSlm,
    report.providerRegistry,
    report.credentialsVault,
    report.modelRegistry,
    report.routingEngine,
  ];

  const renderStatusBadge = (item: SubsystemReadinessItem) => {
    switch (item.status) {
      case "ready":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              color: "var(--nr-status-success)",
            }}
          >
            <CheckCircle2 size={13} />
            Ready
          </span>
        );
      case "not_configured":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "var(--nr-status-warning)",
            }}
          >
            <AlertCircle size={13} />
            Optional / Unconfigured
          </span>
        );
      case "needs_attention":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(245, 158, 11, 0.15)",
              color: "var(--nr-status-warning)",
            }}
          >
            <AlertCircle size={13} />
            Needs Attention
          </span>
        );
      case "initializing":
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(59, 130, 246, 0.15)",
              color: "var(--nr-accent-blue)",
            }}
          >
            <Clock size={13} />
            Initializing
          </span>
        );
      case "unavailable":
      default:
        return (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.25rem 0.625rem",
              borderRadius: "9999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "var(--nr-status-error)",
            }}
          >
            <XCircle size={13} />
            Unavailable
          </span>
        );
    }
  };

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
          System Readiness Check
        </h3>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--nr-text-secondary)" }}>
          Nano Route inspects your local desktop environment to ensure native storage, credential isolation, and routing components are operational.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: "0.875rem 1rem",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--nr-border-default)",
              borderRadius: "var(--nr-radius-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.displayName}</span>
                {item.isMandatory ? (
                  <span style={{ fontSize: "0.6875rem", color: "var(--nr-text-disabled)" }}>
                    (Required)
                  </span>
                ) : (
                  <span style={{ fontSize: "0.6875rem", color: "var(--nr-text-disabled)" }}>
                    (Optional)
                  </span>
                )}
              </div>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                {item.details}
              </p>
            </div>
            {renderStatusBadge(item)}
          </div>
        ))}
      </div>
    </div>
  );
};

