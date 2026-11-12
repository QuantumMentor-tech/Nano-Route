/**
//! Nano Route — Step 43 Token Usage & Cost/Savings Time-Series Trend Charts
//! File: src/features/telemetry/components/TelemetryTokenCostTrendsSection.tsx
//!
//! Renders:
//! 1. Token Usage Trend Chart (Input vs Output stacked bars + exact tooltips + accessible table)
//! 2. Cost & Savings Trend Chart (Actual Cost vs Baseline Cost + Savings + accessible table)
*/

import React from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import {
  formatCompactTokens,
  formatExactTokens,
  formatUsdCurrency,
} from "../../../services/ipc/pricing.ts";
import { formatTimeSeriesBucketLabel } from "../timestamp.ts";
import type {
  TelemetryCostTrendPoint,
  TelemetryTimeBucket,
  TelemetryTokenTrendPoint,
} from "../types.ts";

export interface TelemetryTokenCostTrendsSectionProps {
  tokenTrend: TelemetryTokenTrendPoint[];
  costTrend: TelemetryCostTrendPoint[];
  timeBucket: TelemetryTimeBucket;
}

export const TelemetryTokenCostTrendsSection: React.FC<
  TelemetryTokenCostTrendsSectionProps
> = ({ tokenTrend, costTrend, timeBucket }) => {
  const maxTotalTokens = Math.max(
    1,
    ...tokenTrend.map(
      (pt) => pt.totalTokens ?? (pt.inputTokens ?? 0) + (pt.outputTokens ?? 0)
    )
  );

  const maxCostUsd = Math.max(
    0.000001,
    ...costTrend.map((pt) =>
      Math.max(pt.actualCostUsd ?? 0, pt.baselineCostUsd ?? 0)
    )
  );

  const firstTokenPt = tokenTrend[0];
  const lastTokenPt = tokenTrend[tokenTrend.length - 1];
  const tokenAccessibleSummary =
    firstTokenPt && lastTokenPt
      ? `Token trend across ${tokenTrend.length} ${timeBucket} buckets from ${formatTimeSeriesBucketLabel(
          firstTokenPt.bucketStartMs,
          timeBucket
        )} (${formatCompactTokens(firstTokenPt.totalTokens)}) to ${formatTimeSeriesBucketLabel(
          lastTokenPt.bucketStartMs,
          timeBucket
        )} (${formatCompactTokens(lastTokenPt.totalTokens)}).`
      : "No token trend data in the selected period.";

  const firstCostPt = costTrend[0];
  const lastCostPt = costTrend[costTrend.length - 1];
  const costAccessibleSummary =
    firstCostPt && lastCostPt
      ? `Cost trend across ${costTrend.length} ${timeBucket} buckets from ${formatTimeSeriesBucketLabel(
          firstCostPt.bucketStartMs,
          timeBucket
        )} (${formatUsdCurrency(firstCostPt.actualCostUsd)}) to ${formatTimeSeriesBucketLabel(
          lastCostPt.bucketStartMs,
          timeBucket
        )} (${formatUsdCurrency(lastCostPt.actualCostUsd)}).`
      : "No cost trend data in the selected period.";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        gap: "1rem",
      }}
    >
      {/* 1. Token Usage Trend Chart */}
      <section
        aria-labelledby="telemetry-token-trend-heading"
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
            gap: "0.5rem",
          }}
        >
          <div>
            <h3
              id="telemetry-token-trend-heading"
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
                style={{ color: "var(--nr-accent-blue, #38bdf8)" }}
                aria-hidden="true"
              />
              <span>Token Burn Trend ({timeBucket === "hour" ? "Hourly" : "Daily"})</span>
            </h3>
            <p
              style={{
                margin: "0.18rem 0 0",
                fontSize: "0.74rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {tokenAccessibleSummary}
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "0.72rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: "#38bdf8",
                }}
              />
              Input Tokens
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: "#a855f7",
                }}
              />
              Output Tokens
            </span>
          </div>
        </div>

        {tokenTrend.length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              fontSize: "0.8rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            No token activity recorded in this time window.
          </div>
        ) : (
          <>
            <div
              role="img"
              aria-label={tokenAccessibleSummary}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "0.35rem",
                height: "140px",
                padding: "0.5rem 0.25rem 0",
                overflowX: "auto",
              }}
            >
              {tokenTrend.map((pt) => {
                const inTok = pt.inputTokens ?? 0;
                const outTok = pt.outputTokens ?? 0;
                const tot = pt.totalTokens ?? inTok + outTok;
                const heightPct = Math.max(4, Math.round((tot / maxTotalTokens) * 100));
                const inShare = tot > 0 ? Math.round((inTok / tot) * 100) : 50;
                const outShare = 100 - inShare;
                const label = formatTimeSeriesBucketLabel(pt.bucketStartMs, timeBucket);

                return (
                  <div
                    key={pt.bucketStartMs}
                    title={`${label}\nInput tokens: ${formatExactTokens(
                      pt.inputTokens
                    )}\nOutput tokens: ${formatExactTokens(
                      pt.outputTokens
                    )}\nTotal tokens: ${formatExactTokens(pt.totalTokens)}`}
                    style={{
                      flex: "1 1 24px",
                      minWidth: "20px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.3rem",
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "28px",
                        height: `${heightPct}%`,
                        borderRadius: "4px 4px 2px 2px",
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        backgroundColor: "rgba(63, 63, 70, 0.25)",
                      }}
                    >
                      <div
                        style={{
                          height: `${outShare}%`,
                          backgroundColor: "#a855f7",
                        }}
                      />
                      <div
                        style={{
                          height: `${inShare}%`,
                          backgroundColor: "#38bdf8",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "0.64rem",
                        color: "var(--nr-text-muted, #71717a)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "56px",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <details style={{ fontSize: "0.74rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
              <summary style={{ cursor: "pointer" }}>
                Accessible tabular token trend ({tokenTrend.length} buckets)
              </summary>
              <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #27272a" }}>
                      <th style={{ padding: "0.35rem" }}>Bucket</th>
                      <th style={{ padding: "0.35rem" }}>Attempts</th>
                      <th style={{ padding: "0.35rem" }}>Input Tokens</th>
                      <th style={{ padding: "0.35rem" }}>Output Tokens</th>
                      <th style={{ padding: "0.35rem" }}>Total Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenTrend.map((pt) => (
                      <tr key={pt.bucketStartMs} style={{ borderBottom: "1px solid #1f222b" }}>
                        <td style={{ padding: "0.35rem" }}>
                          {formatTimeSeriesBucketLabel(pt.bucketStartMs, timeBucket)}
                        </td>
                        <td style={{ padding: "0.35rem" }}>{pt.attemptCount}</td>
                        <td style={{ padding: "0.35rem" }}>{formatExactTokens(pt.inputTokens)}</td>
                        <td style={{ padding: "0.35rem" }}>{formatExactTokens(pt.outputTokens)}</td>
                        <td style={{ padding: "0.35rem" }}>{formatExactTokens(pt.totalTokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      {/* 2. Cost & Savings Trend Chart */}
      <section
        aria-labelledby="telemetry-cost-trend-heading"
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
            gap: "0.5rem",
          }}
        >
          <div>
            <h3
              id="telemetry-cost-trend-heading"
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
              <TrendingUp
                size={15}
                style={{ color: "#4ade80" }}
                aria-hidden="true"
              />
              <span>
                Actual Cost vs. Baseline Trend ({timeBucket === "hour" ? "Hourly" : "Daily"})
              </span>
            </h3>
            <p
              style={{
                margin: "0.18rem 0 0",
                fontSize: "0.74rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {costAccessibleSummary}
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.75rem",
              fontSize: "0.72rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: "#38bdf8",
                }}
              />
              Actual Cost
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: "rgba(168, 85, 247, 0.55)",
                }}
              />
              Baseline Cost
            </span>
          </div>
        </div>

        {costTrend.length === 0 ? (
          <div
            style={{
              padding: "1.5rem",
              textAlign: "center",
              fontSize: "0.8rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            No cost trend data recorded in this time window.
          </div>
        ) : (
          <>
            <div
              role="img"
              aria-label={costAccessibleSummary}
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "0.45rem",
                height: "140px",
                padding: "0.5rem 0.25rem 0",
                overflowX: "auto",
              }}
            >
              {costTrend.map((pt) => {
                const act = pt.actualCostUsd ?? 0;
                const base = pt.baselineCostUsd ?? 0;
                const actPct = Math.max(4, Math.round((act / maxCostUsd) * 100));
                const basePct = Math.max(4, Math.round((base / maxCostUsd) * 100));
                const label = formatTimeSeriesBucketLabel(pt.bucketStartMs, timeBucket);

                return (
                  <div
                    key={pt.bucketStartMs}
                    title={`${label}\nActual cost: ${formatUsdCurrency(
                      pt.actualCostUsd
                    )}\nBaseline cost: ${formatUsdCurrency(
                      pt.baselineCostUsd,
                      { unavailableLabel: "Baseline unavailable" }
                    )}\nEstimated savings: ${formatUsdCurrency(
                      pt.estimatedSavingsUsd,
                      { allowSigned: true, unavailableLabel: "Savings unavailable" }
                    )}`}
                    style={{
                      flex: "1 1 28px",
                      minWidth: "24px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.3rem",
                      height: "100%",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        maxWidth: "32px",
                        height: "100%",
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "center",
                        gap: "3px",
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          height: `${actPct}%`,
                          backgroundColor: "#38bdf8",
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                      <div
                        style={{
                          flex: 1,
                          height: `${basePct}%`,
                          backgroundColor: "rgba(168, 85, 247, 0.55)",
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "0.64rem",
                        color: "var(--nr-text-muted, #71717a)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: "56px",
                      }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            <details style={{ fontSize: "0.74rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
              <summary style={{ cursor: "pointer" }}>
                Accessible tabular cost & savings trend ({costTrend.length} buckets)
              </summary>
              <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #27272a" }}>
                      <th style={{ padding: "0.35rem" }}>Bucket</th>
                      <th style={{ padding: "0.35rem" }}>Actual Cost</th>
                      <th style={{ padding: "0.35rem" }}>Baseline Cost</th>
                      <th style={{ padding: "0.35rem" }}>Estimated Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costTrend.map((pt) => (
                      <tr key={pt.bucketStartMs} style={{ borderBottom: "1px solid #1f222b" }}>
                        <td style={{ padding: "0.35rem" }}>
                          {formatTimeSeriesBucketLabel(pt.bucketStartMs, timeBucket)}
                        </td>
                        <td style={{ padding: "0.35rem" }}>
                          {formatUsdCurrency(pt.actualCostUsd)}
                        </td>
                        <td style={{ padding: "0.35rem" }}>
                          {formatUsdCurrency(pt.baselineCostUsd, {
                            unavailableLabel: "Baseline unavailable",
                          })}
                        </td>
                        <td style={{ padding: "0.35rem" }}>
                          {formatUsdCurrency(pt.estimatedSavingsUsd, {
                            allowSigned: true,
                            unavailableLabel: "Savings unavailable",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>
    </div>
  );
};

