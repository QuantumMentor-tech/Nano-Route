/**
//! Nano Route — Step 43 Token Usage, Actual Cost & Routing Savings Summary Section
//! File: src/features/telemetry/components/TelemetryFinancialSummarySection.tsx
//!
//! Renders:
//! 1. Token Usage Summary Cards (Input, Output, Total Billed Tokens, Logical vs Physical Attempts)
//! 2. Financial & Cost Summary Cards (Actual Spend, Avg Cost/Request, Cost per 1K/1M Tokens, Coverage)
//! 3. Actual vs. Baseline & Routing Savings Comparison Panel (with explicit provenance,
//!    negative-savings honesty, and all-time cumulative savings).
*/

import React from "react";
import { Coins, DollarSign, Scale, TrendingDown } from "lucide-react";
import {
  formatCompactTokens,
  formatExactTokens,
  formatUsdCurrency,
} from "../../../services/ipc/pricing.ts";
import type { TelemetryFinancialAnalytics } from "../types.ts";

export interface TelemetryFinancialSummarySectionProps {
  analytics: TelemetryFinancialAnalytics;
  dateRangeLabel: string;
}

export const TelemetryFinancialSummarySection: React.FC<
  TelemetryFinancialSummarySectionProps
> = ({ analytics, dateRangeLabel }) => {
  const {
    tokenSummary,
    actualCostSummary,
    baselineSummary,
    savingsSummary,
    coverage,
  } = analytics;

  const renderProvenanceBadge = (
    label: string,
    tone: "exact" | "estimated" | "unavailable"
  ) => {
    const colors =
      tone === "exact"
        ? {
            bg: "rgba(34, 197, 94, 0.14)",
            border: "rgba(34, 197, 94, 0.35)",
            text: "#4ade80",
          }
        : tone === "estimated"
        ? {
            bg: "rgba(168, 85, 247, 0.16)",
            border: "rgba(168, 85, 247, 0.4)",
            text: "#c084fc",
          }
        : {
            bg: "rgba(113, 113, 122, 0.16)",
            border: "rgba(113, 113, 122, 0.35)",
            text: "#a1a1aa",
          };

    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "0.14rem 0.45rem",
          borderRadius: "999px",
          fontSize: "0.68rem",
          fontWeight: 600,
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          color: colors.text,
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <section
      aria-labelledby="telemetry-financial-summary-heading"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* 1. Token Usage & Financial Spend Cards */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "1rem 1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
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
              id="telemetry-financial-summary-heading"
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
              <Coins
                size={15}
                style={{ color: "var(--nr-accent-purple, #a855f7)" }}
                aria-hidden="true"
              />
              <span>Token Usage & Financial Spend · {dateRangeLabel}</span>
            </h3>
            <p
              style={{
                margin: "0.18rem 0 0",
                fontSize: "0.75rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              Authoritative local token burn and recorded execution costs in USD (never extrapolated from missing data)
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.55rem",
              fontSize: "0.74rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            <span>
              Logical requests:{" "}
              <strong>{tokenSummary.logicalRequestCount.toLocaleString()}</strong>
            </span>
            <span>·</span>
            <span>
              Physical attempts:{" "}
              <strong>{tokenSummary.physicalAttemptCount.toLocaleString()}</strong>
            </span>
            {tokenSummary.duplicateOrIntermediateEventsExcluded > 0 && (
              <>
                <span>·</span>
                <span title="Intermediate stream snapshots or correlated non-execution routing events excluded to prevent double-counting">
                  Deduplicated lifecycle events:{" "}
                  {tokenSummary.duplicateOrIntermediateEventsExcluded.toLocaleString()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 8-Card Grid: 4 Token Cards + 4 Cost Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Total Tokens */}
          <div
            title={
              tokenSummary.totalTokens !== null
                ? `Exact total tokens (records with both input & output recorded): ${formatExactTokens(
                    tokenSummary.totalTokens
                  )}`
                : "Total tokens unavailable"
            }
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Total Billed Tokens
              </span>
              {renderProvenanceBadge(
                tokenSummary.totalTokens !== null ? "Derived sum" : "Unavailable",
                tokenSummary.totalTokens !== null ? "exact" : "unavailable"
              )}
            </div>
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatCompactTokens(tokenSummary.totalTokens)}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {tokenSummary.totalTokens !== null
                ? `${formatExactTokens(tokenSummary.totalTokens)} exact (${
                    tokenSummary.bothTokensAvailableCount
                  }/${tokenSummary.physicalAttemptCount} attempts)`
                : "Requires both input and output token counts"}
            </div>
          </div>

          {/* Input / Prompt Tokens */}
          <div
            title={
              tokenSummary.totalInputTokens !== null
                ? `Exact input tokens: ${formatExactTokens(
                    tokenSummary.totalInputTokens
                  )}`
                : "Input tokens unavailable"
            }
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Input / Prompt Tokens
              </span>
              {renderProvenanceBadge(
                tokenSummary.totalInputTokens !== null
                  ? "Recorded"
                  : "Unavailable",
                tokenSummary.totalInputTokens !== null ? "exact" : "unavailable"
              )}
            </div>
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "var(--nr-accent-blue, #38bdf8)",
              }}
            >
              {formatCompactTokens(tokenSummary.totalInputTokens)}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {tokenSummary.totalInputTokens !== null
                ? `${formatExactTokens(tokenSummary.totalInputTokens)} exact (${
                    tokenSummary.inputTokensAvailableCount
                  } attempts)`
                : "No recorded prompt token counts"}
            </div>
          </div>

          {/* Output / Completion Tokens */}
          <div
            title={
              tokenSummary.totalOutputTokens !== null
                ? `Exact output tokens: ${formatExactTokens(
                    tokenSummary.totalOutputTokens
                  )}`
                : "Output tokens unavailable"
            }
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Output / Completion Tokens
              </span>
              {renderProvenanceBadge(
                tokenSummary.totalOutputTokens !== null
                  ? "Recorded"
                  : "Unavailable",
                tokenSummary.totalOutputTokens !== null ? "exact" : "unavailable"
              )}
            </div>
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "var(--nr-accent-purple, #a855f7)",
              }}
            >
              {formatCompactTokens(tokenSummary.totalOutputTokens)}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {tokenSummary.totalOutputTokens !== null
                ? `${formatExactTokens(tokenSummary.totalOutputTokens)} exact (${
                    tokenSummary.outputTokensAvailableCount
                  } attempts)`
                : "No recorded completion token counts"}
            </div>
          </div>

          {/* Actual Spend */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Actual Spend ({actualCostSummary.currency})
              </span>
              {renderProvenanceBadge(
                actualCostSummary.costAvailabilityState === "exact"
                  ? "Recorded"
                  : "Unavailable",
                actualCostSummary.costAvailabilityState === "exact"
                  ? "exact"
                  : "unavailable"
              )}
            </div>
            <div
              style={{
                fontSize: "1.3rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatUsdCurrency(actualCostSummary.totalActualCostUsd, {
                unavailableLabel: "Cost unavailable",
              })}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {actualCostSummary.eligibleAttemptCount > 0
                ? `${actualCostSummary.eligibleAttemptCount} cost-recorded attempts (${actualCostSummary.zeroCostAttemptCount} at $0.00)`
                : "No cost-attributed records in selected range"}
            </div>
          </div>

          {/* Average Cost per Request */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Avg Cost per Request
              </span>
              <DollarSign
                size={13}
                style={{ color: "var(--nr-text-muted, #71717a)" }}
                aria-hidden="true"
              />
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatUsdCurrency(
                actualCostSummary.averageCostPerLogicalRequestUsd,
                { unavailableLabel: "Cost unavailable" }
              )}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {actualCostSummary.averageCostPerAttemptUsd !== null
                ? `Per attempt: ${formatUsdCurrency(
                    actualCostSummary.averageCostPerAttemptUsd
                  )} (${actualCostSummary.eligibleLogicalRequestCount} logical reqs)`
                : "Requires eligible cost-recorded executions"}
            </div>
          </div>

          {/* Cost per 1K / 1M Tokens */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Weighted Cost / 1M Tokens
              </span>
              {renderProvenanceBadge(
                actualCostSummary.costPerMillionTokensUsd !== null
                  ? "Derived"
                  : "Unavailable",
                actualCostSummary.costPerMillionTokensUsd !== null
                  ? "exact"
                  : "unavailable"
              )}
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatUsdCurrency(actualCostSummary.costPerMillionTokensUsd, {
                unavailableLabel: "Cost per token unavailable",
              })}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {actualCostSummary.costPerThousandTokensUsd !== null
                ? `${formatUsdCurrency(
                    actualCostSummary.costPerThousandTokensUsd
                  )} per 1K tokens (${formatCompactTokens(
                    actualCostSummary.costPerTokenCompatibleTotalTokens
                  )} compatible tokens)`
                : "Requires records with both cost and nonzero total tokens"}
            </div>
          </div>

          {/* Cost & Token Data Coverage */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
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
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.74rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Cost Data Coverage
              </span>
              <span
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "var(--nr-accent-blue, #38bdf8)",
                }}
              >
                {coverage.costCoveragePercent !== null
                  ? `${coverage.costCoveragePercent.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
            <div
              style={{
                fontSize: "1.2rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {coverage.costCoveragePercent !== null
                ? `${coverage.costCoveragePercent.toFixed(1)}%`
                : "No eligible attempts"}
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {coverage.costCoverageCount}/{coverage.totalPhysicalAttempts} attempts with cost · Token coverage:{" "}
              {coverage.tokenCoveragePercent !== null
                ? `${coverage.tokenCoveragePercent.toFixed(1)}%`
                : "N/A"}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Actual vs. Baseline & Routing Savings Comparison Panel */}
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "1rem 1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
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
              <Scale
                size={15}
                style={{ color: "var(--nr-accent-blue, #38bdf8)" }}
                aria-hidden="true"
              />
              <span>
                Actual vs. Baseline & Estimated Routing Savings · {dateRangeLabel}
              </span>
            </h3>
            <p
              style={{
                margin: "0.18rem 0 0",
                fontSize: "0.75rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              Baseline: <strong>{baselineSummary.baselineProviderDisplayName}</strong> /{" "}
              <code>{baselineSummary.baselineModelId}</code>{" "}
              {baselineSummary.pricingVersionUsed
                ? `(pricing version: ${baselineSummary.pricingVersionUsed})`
                : "(pricing version unavailable)"}
            </p>
          </div>

          {renderProvenanceBadge(
            savingsSummary.savingsState === "estimated"
              ? "Estimated (Method B)"
              : "Savings unavailable",
            savingsSummary.savingsState === "estimated"
              ? "estimated"
              : "unavailable"
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {/* Eligible Actual Cost */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <span
              style={{
                fontSize: "0.73rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              Actual Routed Cost (Savings-Eligible)
            </span>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatUsdCurrency(savingsSummary.eligibleActualCostUsd, {
                unavailableLabel: "Unavailable",
              })}
            </div>
            <span
              style={{
                fontSize: "0.71rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {savingsSummary.eligibleRecordCount} savings-eligible attempts
            </span>
          </div>

          {/* Baseline Cost */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <span
              style={{
                fontSize: "0.73rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              Hypothetical Baseline Cost
            </span>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatUsdCurrency(savingsSummary.baselineCostUsd, {
                unavailableLabel: "Baseline unavailable",
              })}
            </div>
            <span
              style={{
                fontSize: "0.71rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {baselineSummary.baselineAvailable
                ? `Same ${savingsSummary.eligibleRecordCount} eligible workloads`
                : "No authoritative pricing for baseline model"}
            </span>
          </div>

          {/* Estimated Routing Savings / Difference vs Baseline */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <span
              style={{
                fontSize: "0.73rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <TrendingDown size={13} aria-hidden="true" />
              <span>
                {savingsSummary.comparisonStatus === "above_baseline"
                  ? "Difference vs. Baseline (Above Baseline)"
                  : "Estimated Routing Savings"}
              </span>
            </span>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color:
                  savingsSummary.comparisonStatus === "below_baseline"
                    ? "#4ade80"
                    : savingsSummary.comparisonStatus === "above_baseline"
                    ? "#fbbf24"
                    : "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              {formatUsdCurrency(savingsSummary.estimatedSavingsUsd, {
                allowSigned: true,
                unavailableLabel: "Savings unavailable",
              })}
            </div>
            <span
              style={{
                fontSize: "0.71rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {savingsSummary.savingsPercent !== null
                ? `${savingsSummary.savingsPercent > 0 ? "+" : ""}${savingsSummary.savingsPercent.toFixed(
                    1
                  )}% vs. baseline (${
                    savingsSummary.comparisonStatus === "above_baseline"
                      ? "routed spend exceeded baseline"
                      : savingsSummary.comparisonStatus === "below_baseline"
                      ? "below baseline"
                      : "at baseline"
                  })`
                : "Percentage unavailable (zero or missing baseline)"}
            </span>
          </div>

          {/* All-Time Cumulative Estimated Savings */}
          <div
            style={{
              padding: "0.85rem",
              borderRadius: "10px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
            }}
          >
            <span
              style={{
                fontSize: "0.73rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              Cumulative Savings · All-Time
            </span>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "var(--nr-accent-purple, #a855f7)",
              }}
            >
              {formatUsdCurrency(savingsSummary.allTimeEstimatedSavingsUsd, {
                allowSigned: true,
                unavailableLabel: "Savings unavailable",
              })}
            </div>
            <span
              style={{
                fontSize: "0.71rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {savingsSummary.allTimeSavingsPercent !== null
                ? `${savingsSummary.allTimeSavingsPercent.toFixed(1)}% across ${
                    savingsSummary.allTimeEligibleRecordCount
                  } eligible all-time attempts`
                : `${savingsSummary.ineligibleRecordCount} ineligible in current view`}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

