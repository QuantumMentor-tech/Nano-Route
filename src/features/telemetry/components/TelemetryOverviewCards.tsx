/**
//! Nano Route — Step 42 Telemetry Overview Metric Cards
//! File: src/features/telemetry/components/TelemetryOverviewCards.tsx
//!
//! Renders the 5 primary operational summary cards: Total Routed Requests,
//! Successful Executions (with operational success ratio), Failed Executions,
//! Cancelled Executions, and Telemetry Metadata Completeness.
//! Never fabricates trends or displays 0% when denominator is zero.
*/

import React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type {
  TelemetryCompletenessSummary,
  TelemetryDashboardSummary,
} from "../types";

export interface TelemetryOverviewCardsProps {
  summary: TelemetryDashboardSummary;
  completeness: TelemetryCompletenessSummary;
}

export const TelemetryOverviewCards: React.FC<TelemetryOverviewCardsProps> = ({
  summary,
  completeness,
}) => {
  const successRatioText =
    summary.terminalExecutions > 0 && summary.successRatePercent !== null
      ? `${summary.successRatePercent.toFixed(1)}% of ${summary.terminalExecutions.toLocaleString()} terminal executions`
      : "No completed executions";

  const completenessValueText =
    completeness.totalRecords > 0 &&
    completeness.completeMetadataPercent !== null
      ? `${completeness.completeMetadataPercent.toFixed(1)}%`
      : "Not available";

  const completenessDetailText =
    completeness.totalRecords > 0
      ? `${completeness.completeMetadataCount.toLocaleString()} of ${completeness.totalRecords.toLocaleString()} records include full routing metadata`
      : "No telemetry records in scope";

  const cards = [
    {
      id: "total-requests",
      label: "Total Routed Requests",
      value: summary.totalRoutedRequests.toLocaleString(),
      detail:
        summary.fallbackExecutions > 0
          ? `Includes ${summary.fallbackExecutions.toLocaleString()} failover ${
              summary.fallbackExecutions === 1 ? "event" : "events"
            }`
          : "Authoritative telemetry observations in scope",
      icon: Activity,
      accentColor: "var(--nr-accent-purple, #a855f7)",
    },
    {
      id: "successful-executions",
      label: "Successful Executions",
      value: summary.successfulExecutions.toLocaleString(),
      detail: successRatioText,
      icon: CheckCircle2,
      accentColor: "#4ade80",
    },
    {
      id: "failed-executions",
      label: "Failed Executions",
      value: summary.failedExecutions.toLocaleString(),
      detail:
        summary.terminalExecutions > 0
          ? "Terminal provider, timeout, or rate-limit failures"
          : "No terminal executions recorded",
      icon: AlertTriangle,
      accentColor: "#f87171",
    },
    {
      id: "cancelled-executions",
      label: "Cancelled Executions",
      value: summary.cancelledExecutions.toLocaleString(),
      detail: "Explicitly cancelled before completion",
      icon: XCircle,
      accentColor: "#fbbf24",
    },
    {
      id: "telemetry-completeness",
      label: "Routing Metadata Coverage",
      value: completenessValueText,
      detail: completenessDetailText,
      icon: ShieldCheck,
      accentColor: "var(--nr-accent-blue, #38bdf8)",
    },
  ];

  return (
    <section aria-label="Operational summary metrics">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "0.85rem",
        }}
      >
        {cards.map((card) => {
          const IconComponent = card.icon;
          return (
            <div
              key={card.id}
              style={{
                borderRadius: "12px",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface, #111318)",
                padding: "0.95rem 1.05rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "0.45rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 500,
                    color: "var(--nr-text-secondary, #a1a1aa)",
                  }}
                >
                  {card.label}
                </span>
                <IconComponent
                  size={15}
                  style={{ color: card.accentColor, flexShrink: 0 }}
                  aria-hidden="true"
                />
              </div>

              <div
                style={{
                  fontSize: "1.45rem",
                  fontWeight: 700,
                  color: "var(--nr-text-primary, #f4f4f5)",
                  letterSpacing: "-0.02em",
                }}
              >
                {card.value}
              </div>

              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--nr-text-muted, #71717a)",
                  lineHeight: 1.4,
                }}
              >
                {card.detail}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

