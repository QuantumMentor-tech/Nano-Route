/**
//! Nano Route — Step 42 Execution Outcome & Retry/Failover Analysis
//! File: src/features/telemetry/components/TelemetryOutcomeSection.tsx
//!
//! Renders canonical execution outcome distributions with exact counts and
//! percentages alongside authoritative failover activity and unknown-honest
//! retry status.
*/

import React from "react";
import { GitBranch, PieChart } from "lucide-react";
import type {
  TelemetryOutcomeSummary,
  TelemetryRetryFailoverSummary,
} from "../types";

export interface TelemetryOutcomeSectionProps {
  outcomes: TelemetryOutcomeSummary[];
  retryFailover: TelemetryRetryFailoverSummary;
  totalRequests: number;
}

function outcomeColor(outcome: string): string {
  switch (outcome.toLowerCase()) {
    case "success":
      return "#4ade80";
    case "failure":
      return "#f87171";
    case "cancelled":
      return "#fbbf24";
    case "timeout":
      return "#fb923c";
    case "rate_limited":
      return "#c084fc";
    case "unavailable":
      return "#ef4444";
    case "fallback":
      return "#38bdf8";
    default:
      return "#71717a";
  }
}

export const TelemetryOutcomeSection: React.FC<
  TelemetryOutcomeSectionProps
> = ({ outcomes, retryFailover, totalRequests }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "1rem",
      }}
    >
      {/* Left Card: Execution Outcome Distribution */}
      <section
        aria-labelledby="telemetry-outcome-heading"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "1rem 1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <h3
            id="telemetry-outcome-heading"
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #f4f4f5)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <PieChart
              size={15}
              style={{ color: "var(--nr-accent-blue, #38bdf8)" }}
              aria-hidden="true"
            />
            <span>Execution Outcome Distribution</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Exact counts and percentages across{" "}
            {totalRequests.toLocaleString()} recorded{" "}
            {totalRequests === 1 ? "observation" : "observations"}
          </p>
        </div>

        {outcomes.length === 0 ? (
          <div
            role="status"
            style={{
              padding: "1.35rem 1rem",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px dashed var(--nr-border-default, #27272a)",
              color: "var(--nr-text-muted, #71717a)",
              fontSize: "0.8rem",
            }}
          >
            No execution outcomes recorded in this filter scope.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
            {outcomes.map((item) => {
              const pct = item.percentageOfTotal ?? 0;
              const barColor = outcomeColor(item.outcome);
              return (
                <div
                  key={item.outcome}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.79rem",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        color: "var(--nr-text-primary, #f4f4f5)",
                        fontWeight: 500,
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "9999px",
                          backgroundColor: barColor,
                        }}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </span>
                    <span style={{ color: "var(--nr-text-secondary, #a1a1aa)" }}>
                      {item.count.toLocaleString()}
                      {item.percentageOfTotal !== null
                        ? ` (${item.percentageOfTotal.toFixed(1)}%)`
                        : ""}
                    </span>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "9999px",
                      backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(2, pct))}%`,
                        height: "100%",
                        backgroundColor: barColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right Card: Failover & Retry Operational Activity */}
      <section
        aria-labelledby="telemetry-resilience-heading"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "1rem 1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div>
          <h3
            id="telemetry-resilience-heading"
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #f4f4f5)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <GitBranch
              size={15}
              style={{ color: "var(--nr-accent-purple, #a855f7)" }}
              aria-hidden="true"
            />
            <span>Failover & Retry Operational Signals</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Authoritative resilience observations from persisted telemetry records
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: "0.6rem",
          }}
        >
          <div
            style={{
              padding: "0.65rem 0.8rem",
              borderRadius: "8px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "var(--nr-text-muted, #71717a)" }}>
              Executions Involving Failover
            </div>
            <div
              style={{
                marginTop: "0.2rem",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {retryFailover.failoverDataAvailable
                ? retryFailover.failoverInvolvedCount.toLocaleString()
                : "No records"}
            </div>
          </div>

          <div
            style={{
              padding: "0.65rem 0.8rem",
              borderRadius: "8px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "var(--nr-text-muted, #71717a)" }}>
              Fallback Outcomes (Success / Fail)
            </div>
            <div
              style={{
                marginTop: "0.2rem",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {retryFailover.failoverDataAvailable
                ? `${retryFailover.fallbackSuccessCount.toLocaleString()} / ${retryFailover.fallbackFailureCount.toLocaleString()}`
                : "No records"}
            </div>
          </div>

          <div
            style={{
              padding: "0.65rem 0.8rem",
              borderRadius: "8px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "var(--nr-text-muted, #71717a)" }}>
              Rate-Limited / Timeout Outcomes
            </div>
            <div
              style={{
                marginTop: "0.2rem",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {retryFailover.failoverDataAvailable
                ? `${retryFailover.rateLimitedOutcomeCount.toLocaleString()} / ${retryFailover.timeoutOutcomeCount.toLocaleString()}`
                : "No records"}
            </div>
          </div>

          <div
            style={{
              padding: "0.65rem 0.8rem",
              borderRadius: "8px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
            }}
          >
            <div style={{ fontSize: "0.72rem", color: "var(--nr-text-muted, #71717a)" }}>
              In-Attempt Retry Count
            </div>
            <div
              style={{
                marginTop: "0.2rem",
                fontSize: "0.86rem",
                fontWeight: 600,
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              {retryFailover.retryDataAvailable &&
              retryFailover.retryExecutionCount !== null
                ? retryFailover.retryExecutionCount.toLocaleString()
                : "Retry data unavailable"}
            </div>
            <div
              style={{
                marginTop: "0.15rem",
                fontSize: "0.68rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              Not stored as a column in telemetry_records
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

