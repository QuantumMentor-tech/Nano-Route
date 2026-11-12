/**
//! Nano Route — Step 42 Routing Activity Time-Series Chart
//! File: src/features/telemetry/components/TelemetryActivityChart.tsx
//!
//! Renders a bounded, accessible time-series bar visualization of routed
//! request activity (broken down by success, failure, and cancellation) along
//! with an accessible tabular equivalent for screen readers and keyboard inspection.
*/

import React, { useState } from "react";
import { BarChart3, Table2 } from "lucide-react";
import { formatTimeSeriesBucketLabel } from "../timestamp";
import type {
  TelemetryTimeBucket,
  TelemetryTimeSeriesPoint,
} from "../types";

export interface TelemetryActivityChartProps {
  points: TelemetryTimeSeriesPoint[];
  timeBucket: TelemetryTimeBucket;
}

export const TelemetryActivityChart: React.FC<TelemetryActivityChartProps> = ({
  points,
  timeBucket,
}) => {
  const [showTable, setShowTable] = useState(false);

  const maxCount = points.reduce(
    (acc, p) => Math.max(acc, p.requestCount),
    0
  );
  const totalRequests = points.reduce((acc, p) => acc + p.requestCount, 0);

  return (
    <section
      aria-labelledby="telemetry-activity-heading"
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
            id="telemetry-activity-heading"
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
            <BarChart3
              size={15}
              style={{ color: "var(--nr-accent-purple, #a855f7)" }}
              aria-hidden="true"
            />
            <span>Routing Activity Over Time</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Aggregated by {timeBucket === "hour" ? "hour" : "day"} ·{" "}
            {totalRequests.toLocaleString()} total{" "}
            {totalRequests === 1 ? "request" : "requests"} across{" "}
            {points.length} {points.length === 1 ? "bucket" : "buckets"}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            flexWrap: "wrap",
          }}
        >
          {/* Non-color-only semantic legend */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.65rem",
              fontSize: "0.72rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: "#4ade80",
                }}
                aria-hidden="true"
              />
              <span>Success</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: "#f87171",
                }}
                aria-hidden="true"
              />
              <span>Failed</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "2px",
                  backgroundColor: "#fbbf24",
                }}
                aria-hidden="true"
              />
              <span>Cancelled</span>
            </span>
          </div>

          {points.length > 0 && (
            <button
              type="button"
              aria-pressed={showTable}
              onClick={() => setShowTable((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.32rem",
                padding: "0.3rem 0.6rem",
                borderRadius: "6px",
                fontSize: "0.73rem",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                border: "1px solid var(--nr-border-default, #27272a)",
                color: "var(--nr-text-secondary, #a1a1aa)",
                cursor: "pointer",
              }}
            >
              <Table2 size={12} aria-hidden="true" />
              <span>{showTable ? "Show chart" : "Show table"}</span>
            </button>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div
          role="status"
          style={{
            padding: "1.75rem 1rem",
            textAlign: "center",
            borderRadius: "8px",
            border: "1px dashed var(--nr-border-default, #27272a)",
            color: "var(--nr-text-muted, #71717a)",
            fontSize: "0.8rem",
          }}
        >
          No time-series routing activity recorded for the selected filters.
        </div>
      ) : showTable ? (
        <div style={{ overflowX: "auto" }}>
          <table
            aria-label="Routing activity time-series table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.78rem",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--nr-border-default, #27272a)",
                  color: "var(--nr-text-muted, #71717a)",
                }}
              >
                <th style={{ padding: "0.45rem 0.6rem" }}>Time Bucket</th>
                <th style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                  Total Requests
                </th>
                <th style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                  Success
                </th>
                <th style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                  Failed
                </th>
                <th style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                  Cancelled
                </th>
              </tr>
            </thead>
            <tbody>
              {points.map((pt) => (
                <tr
                  key={pt.bucketStartMs}
                  style={{
                    borderBottom: "1px solid var(--nr-border-subtle, #1f222b)",
                    color: "var(--nr-text-primary, #f4f4f5)",
                  }}
                >
                  <td style={{ padding: "0.45rem 0.6rem" }}>
                    {formatTimeSeriesBucketLabel(pt.bucketStartMs, timeBucket)}
                  </td>
                  <td style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                    {pt.requestCount.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                    {pt.successCount.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                    {pt.failureCount.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.45rem 0.6rem", textAlign: "right" }}>
                    {pt.cancelledCount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          role="img"
          aria-label={`Routing activity chart with ${points.length} ${timeBucket} buckets totaling ${totalRequests} requests`}
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.4rem",
            minHeight: "152px",
            padding: "0.75rem 0.5rem 0.35rem",
            overflowX: "auto",
            borderRadius: "8px",
            backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
            border: "1px solid var(--nr-border-subtle, #1f222b)",
          }}
        >
          {points.map((pt) => {
            const label = formatTimeSeriesBucketLabel(
              pt.bucketStartMs,
              timeBucket
            );
            const totalHeightPct =
              maxCount > 0 ? Math.max(8, (pt.requestCount / maxCount) * 100) : 8;
            const succPct =
              pt.requestCount > 0 ? (pt.successCount / pt.requestCount) * 100 : 0;
            const failPct =
              pt.requestCount > 0 ? (pt.failureCount / pt.requestCount) * 100 : 0;
            const cancPct =
              pt.requestCount > 0
                ? (pt.cancelledCount / pt.requestCount) * 100
                : 0;

            return (
              <div
                key={pt.bucketStartMs}
                title={`${label}: ${pt.requestCount} requests (Success: ${pt.successCount}, Failed: ${pt.failureCount}, Cancelled: ${pt.cancelledCount})`}
                style={{
                  flex: "1 1 28px",
                  minWidth: "28px",
                  maxWidth: "64px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--nr-text-secondary, #a1a1aa)",
                  }}
                >
                  {pt.requestCount}
                </span>

                <div
                  style={{
                    width: "100%",
                    height: "96px",
                    display: "flex",
                    alignItems: "flex-end",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: `${totalHeightPct}%`,
                      borderRadius: "4px 4px 2px 2px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      backgroundColor: "rgba(168, 85, 247, 0.35)",
                    }}
                  >
                    {cancPct > 0 && (
                      <div
                        style={{
                          height: `${cancPct}%`,
                          backgroundColor: "#fbbf24",
                        }}
                      />
                    )}
                    {failPct > 0 && (
                      <div
                        style={{
                          height: `${failPct}%`,
                          backgroundColor: "#f87171",
                        }}
                      />
                    )}
                    {succPct > 0 && (
                      <div
                        style={{
                          height: `${succPct}%`,
                          backgroundColor: "#4ade80",
                        }}
                      />
                    )}
                  </div>
                </div>

                <span
                  style={{
                    fontSize: "0.66rem",
                    color: "var(--nr-text-muted, #71717a)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

