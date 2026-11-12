/**
//! Nano Route — Step 42 Telemetry Completeness & Integrity Section
//! File: src/features/telemetry/components/TelemetryIntegritySection.tsx
//!
//! Displays field-level telemetry completeness percentages, available vs.
//! incomplete record counts, and earliest/latest observation timestamps.
*/

import React from "react";
import { useNavigate } from "react-router-dom";
import { Database, ShieldCheck } from "lucide-react";
import { ROUTE_PATHS } from "../../../routes/routePaths";
import { formatFullHistoryTimestamp } from "../../history/timestamp";
import type { TelemetryCompletenessSummary } from "../types";

export interface TelemetryIntegritySectionProps {
  completeness: TelemetryCompletenessSummary;
}

export const TelemetryIntegritySection: React.FC<
  TelemetryIntegritySectionProps
> = ({ completeness }) => {
  const navigate = useNavigate();
  const fields = [
    {
      label: "Provider recorded",
      count: completeness.providerRecordedCount,
      percent: completeness.providerRecordedPercent,
    },
    {
      label: "Model recorded",
      count: completeness.modelRecordedCount,
      percent: completeness.modelRecordedPercent,
    },
    {
      label: "Outcome recorded",
      count: completeness.outcomeRecordedCount,
      percent: completeness.outcomeRecordedPercent,
    },
    {
      label: "Routing reason recorded",
      count: completeness.routingReasonRecordedCount,
      percent: completeness.routingReasonRecordedPercent,
    },
    {
      label: "Confidence available",
      count: completeness.confidenceRecordedCount,
      percent: completeness.confidenceRecordedPercent,
    },
    {
      label: "Session correlation present",
      count: completeness.sessionCorrelationCount,
      percent: completeness.sessionCorrelationPercent,
    },
  ];

  return (
    <section
      aria-labelledby="telemetry-integrity-heading"
      style={{
        borderRadius: "12px",
        border: "1px solid var(--nr-border-default, #27272a)",
        backgroundColor: "var(--nr-bg-surface, #111318)",
        padding: "1rem 1.15rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.65rem",
        }}
      >
        <div>
          <h3
            id="telemetry-integrity-heading"
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
            <Database
              size={15}
              style={{ color: "var(--nr-accent-blue, #38bdf8)" }}
              aria-hidden="true"
            />
            <span>Telemetry Completeness & Record Integrity</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Field population ratios computed directly from stored telemetry records
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "0.74rem",
            color: "var(--nr-text-secondary, #a1a1aa)",
          }}
        >
          <span>
            Available records: {completeness.totalRecords.toLocaleString()}
          </span>
          <span>·</span>
          <span>
            Complete records:{" "}
            {completeness.completeMetadataCount.toLocaleString()}
          </span>
          <span>·</span>
          <span>
            Incomplete records:{" "}
            {completeness.incompleteRecordsCount.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={() => navigate(ROUTE_PATHS.SETTINGS)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.28rem 0.65rem",
              borderRadius: "6px",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              backgroundColor: "rgba(56, 189, 248, 0.1)",
              color: "var(--nr-accent-blue, #38bdf8)",
              fontSize: "0.72rem",
              cursor: "pointer",
            }}
          >
            <ShieldCheck size={12} aria-hidden="true" />
            <span>Audit, Retention & Privacy Controls</span>
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: "0.65rem",
        }}
      >
        {fields.map((f) => (
          <div
            key={f.label}
            style={{
              padding: "0.65rem 0.8rem",
              borderRadius: "8px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.76rem",
              }}
            >
              <span style={{ color: "var(--nr-text-primary, #f4f4f5)" }}>
                {f.label}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                {f.percent !== null
                  ? `${f.percent.toFixed(1)}% (${f.count.toLocaleString()})`
                  : "Not available"}
              </span>
            </div>

            <div
              style={{
                width: "100%",
                height: "5px",
                borderRadius: "9999px",
                backgroundColor: "var(--nr-bg-surface, #111318)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, f.percent ?? 0)}%`,
                  height: "100%",
                  backgroundColor: "var(--nr-accent-blue, #38bdf8)",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {completeness.totalRecords > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "1rem",
            fontSize: "0.72rem",
            color: "var(--nr-text-muted, #71717a)",
          }}
        >
          <span>
            Earliest record:{" "}
            {completeness.earliestRecordAtMs
              ? formatFullHistoryTimestamp(completeness.earliestRecordAtMs)
              : "Not recorded"}
          </span>
          <span>
            Latest record:{" "}
            {completeness.latestRecordAtMs
              ? formatFullHistoryTimestamp(completeness.latestRecordAtMs)
              : "Not recorded"}
          </span>
        </div>
      )}
    </section>
  );
};

