/**
//! Nano Route — Step 42 Telemetry Dashboard Workspace Coordinator
//! File: src/features/telemetry/components/TelemetryDashboard.tsx
//!
//! Coordinates the complete local Telemetry Dashboard: Header, Filter Bar,
//! Overview Cards, Time-Series Activity Chart, Outcome & Failover Analysis,
//! SLM Confidence Distribution, Provider/Model Activity Tables, and Telemetry
//! Completeness & Integrity.
*/

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  FilterX,
  MessageSquarePlus,
  X,
} from "lucide-react";
import { ROUTE_PATHS } from "../../../routes/routePaths";
import { useTelemetryDashboard } from "../useTelemetryDashboard";
import { TelemetryHeader } from "./TelemetryHeader";
import { TelemetryFilterBar } from "./TelemetryFilterBar";
import { TelemetryOverviewCards } from "./TelemetryOverviewCards";
import { TelemetryActivityChart } from "./TelemetryActivityChart";
import { TelemetryOutcomeSection } from "./TelemetryOutcomeSection";
import { TelemetryConfidenceSection } from "./TelemetryConfidenceSection";
import { TelemetryProviderModelSection } from "./TelemetryProviderModelSection";
import { TelemetryIntegritySection } from "./TelemetryIntegritySection";
import { TelemetryFinancialSummarySection } from "./TelemetryFinancialSummarySection";
import { TelemetryTokenCostTrendsSection } from "./TelemetryTokenCostTrendsSection";
import { TelemetryFinancialBreakdownSection } from "./TelemetryFinancialBreakdownSection";
import { TelemetryFinancialMethodologySection } from "./TelemetryFinancialMethodologySection";
import { TelemetryPerformanceSummarySection } from "./TelemetryPerformanceSummarySection";
import { TelemetryLatencyDistributionTrendSection } from "./TelemetryLatencyDistributionTrendSection";
import { TelemetryLatencyBreakdownSection } from "./TelemetryLatencyBreakdownSection";
import { TelemetryExecutionLifecycleTimingSection } from "./TelemetryExecutionLifecycleTimingSection";

export const TelemetryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const dashboard = useTelemetryDashboard();

  const handleViewHistory = (providerId?: string, modelId?: string) => {
    const params = new URLSearchParams();
    if (providerId && providerId !== "unrecorded") {
      params.set("provider", providerId);
    }
    if (modelId && modelId !== "unrecorded") {
      params.set("model", modelId);
    }
    const qs = params.toString();
    navigate(qs ? `${ROUTE_PATHS.HISTORY}?${qs}` : ROUTE_PATHS.HISTORY);
  };

  const snap = dashboard.snapshot;
  const totalRecords = snap?.summary.totalRoutedRequests ?? 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
      }}
    >
      {/* 1. Dashboard Header */}
      <TelemetryHeader
        dateRangeLabel={dashboard.dateRangeLabel}
        freshnessStatus={dashboard.freshness.status}
        freshnessLabel={dashboard.freshness.label}
        lastUpdatedAtMs={dashboard.lastUpdatedAtMs}
        isStale={dashboard.isStale}
        isRefreshing={dashboard.refreshing}
        onRefresh={dashboard.refresh}
      />

      {/* 2. Filter Bar */}
      <TelemetryFilterBar
        datePreset={dashboard.datePreset}
        onDatePresetChange={dashboard.setDatePreset}
        customDateFrom={dashboard.customDateFrom}
        onCustomDateFromChange={dashboard.setCustomDateFrom}
        customDateTo={dashboard.customDateTo}
        onCustomDateToChange={dashboard.setCustomDateTo}
        providerFilter={dashboard.providerFilter}
        onProviderFilterChange={dashboard.setProviderFilter}
        modelFilter={dashboard.modelFilter}
        onModelFilterChange={dashboard.setModelFilter}
        outcomeFilter={dashboard.outcomeFilter}
        onOutcomeFilterChange={dashboard.setOutcomeFilter}
        eventTypeFilter={dashboard.eventTypeFilter}
        onEventTypeFilterChange={dashboard.setEventTypeFilter}
        filterOptions={
          snap?.filterOptions ?? { providers: [], models: [], outcomes: [] }
        }
        hasActiveFilters={dashboard.hasActiveFilters}
        onResetFilters={dashboard.resetFilters}
        dateRangeValidationError={dashboard.dateRangeValidationError}
      />

      {/* Recoverable Error Banner (preserves last valid snapshot on refresh failure) */}
      {dashboard.error && (
        <div
          role="alert"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            color: "#fca5a5",
            fontSize: "0.82rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{dashboard.error.message}</span>
          </span>

          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => void dashboard.refresh()}
              style={{
                padding: "0.35rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid rgba(252, 165, 165, 0.4)",
                backgroundColor: "transparent",
                color: "#fca5a5",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <button
              type="button"
              aria-label="Dismiss telemetry error"
              onClick={dashboard.clearError}
              style={{
                padding: "0.3rem",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: "#fca5a5",
                cursor: "pointer",
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Initial Loading Skeletons */}
      {dashboard.loading && !snap ? (
        <div
          role="status"
          aria-label="Loading telemetry dashboard"
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "0.85rem",
            }}
          >
            {[0, 1, 2, 3, 4].map((slot) => (
              <div
                key={slot}
                style={{
                  height: "108px",
                  borderRadius: "12px",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  backgroundColor: "var(--nr-bg-surface, #111318)",
                  opacity: 0.7 - slot * 0.08,
                }}
              />
            ))}
          </div>
          <div
            style={{
              height: "220px",
              borderRadius: "12px",
              border: "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: "var(--nr-bg-surface, #111318)",
              opacity: 0.55,
            }}
          />
        </div>
      ) : !snap ? null : totalRecords === 0 ? (
        /* Intentional Empty States (Section 39) */
        <>
          <TelemetryOverviewCards
            summary={snap.summary}
            completeness={snap.completeness}
          />
          {dashboard.hasActiveFilters ? (
            <div
              role="status"
              style={{
                padding: "2.25rem 1.5rem",
                borderRadius: "12px",
                border: "1px dashed var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface, #111318)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <FilterX
                size={32}
                style={{ color: "var(--nr-text-muted, #71717a)" }}
                aria-hidden="true"
              />
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #f4f4f5)",
                }}
              >
                No matching activity
              </h3>
              <p
                style={{
                  margin: 0,
                  maxWidth: "420px",
                  fontSize: "0.84rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  lineHeight: 1.5,
                }}
              >
                No telemetry matches the selected filters.
              </p>
              <button
                type="button"
                onClick={dashboard.resetFilters}
                style={{
                  padding: "0.45rem 0.95rem",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  backgroundColor: "rgba(56, 189, 248, 0.14)",
                  color: "var(--nr-accent-blue, #38bdf8)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  cursor: "pointer",
                }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div
              role="status"
              style={{
                padding: "2.5rem 1.5rem",
                borderRadius: "12px",
                border: "1px dashed var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface, #111318)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <Activity
                size={34}
                style={{ color: "var(--nr-accent-purple, #a855f7)" }}
                aria-hidden="true"
              />
              <h3
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #f4f4f5)",
                }}
              >
                No telemetry yet
              </h3>
              <p
                style={{
                  margin: 0,
                  maxWidth: "440px",
                  fontSize: "0.84rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  lineHeight: 1.5,
                }}
              >
                Nano Route has not recorded routing activity for this period. Start a conversation in Chat Studio to record local routing decisions and execution outcomes.
              </p>
              <button
                type="button"
                onClick={() => navigate(ROUTE_PATHS.CHAT)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.45rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  fontSize: "0.84rem",
                  fontWeight: 500,
                  backgroundColor: "rgba(168, 85, 247, 0.18)",
                  color: "var(--nr-text-primary, #f4f4f5)",
                  border: "1px solid rgba(168, 85, 247, 0.45)",
                  cursor: "pointer",
                }}
              >
                <MessageSquarePlus size={15} aria-hidden="true" />
                <span>Open Chat Studio</span>
              </button>
            </div>
          )}
        </>
      ) : (
        /* Populated Analytics Workspace */
        <>
          <TelemetryOverviewCards
            summary={snap.summary}
            completeness={snap.completeness}
          />

          <TelemetryActivityChart
            points={snap.timeSeries}
            timeBucket={dashboard.timeBucket}
          />

          <TelemetryOutcomeSection
            outcomes={snap.outcomeDistribution}
            retryFailover={snap.retryFailover}
            totalRequests={snap.summary.totalRoutedRequests}
          />

          <TelemetryConfidenceSection
            distribution={snap.confidenceDistribution}
          />

          <TelemetryProviderModelSection
            providers={snap.providerDistribution}
            models={snap.modelDistribution}
            onViewHistory={handleViewHistory}
          />

          {snap.financialAnalytics && (
            <>
              <TelemetryFinancialSummarySection
                analytics={snap.financialAnalytics}
                dateRangeLabel={
                  dashboard.datePreset === "all"
                    ? "All Time"
                    : dashboard.datePreset.toUpperCase()
                }
              />

              <TelemetryTokenCostTrendsSection
                tokenTrend={snap.financialAnalytics.tokenTrend}
                costTrend={snap.financialAnalytics.costTrend}
                timeBucket={dashboard.timeBucket}
              />

              <TelemetryFinancialBreakdownSection
                providerCosts={snap.financialAnalytics.providerCostBreakdown}
                modelCosts={snap.financialAnalytics.modelCostBreakdown}
                providerTokens={snap.financialAnalytics.providerTokenBreakdown}
                modelTokens={snap.financialAnalytics.modelTokenBreakdown}
                onViewHistory={handleViewHistory}
              />

              <TelemetryFinancialMethodologySection
                analytics={snap.financialAnalytics}
              />
            </>
          )}

          {snap.performanceAnalytics && (
            <>
              <TelemetryPerformanceSummarySection
                analytics={snap.performanceAnalytics}
              />

              <TelemetryLatencyDistributionTrendSection
                distribution={snap.performanceAnalytics.distribution}
                timeSeries={snap.performanceAnalytics.timeSeries}
                timeBucket={dashboard.timeBucket}
              />

              <TelemetryLatencyBreakdownSection
                providers={snap.performanceAnalytics.providerBreakdown}
                models={snap.performanceAnalytics.modelBreakdown}
                outcomes={snap.performanceAnalytics.outcomeBreakdown}
                onViewHistory={handleViewHistory}
              />

              <TelemetryExecutionLifecycleTimingSection
                analytics={snap.performanceAnalytics}
              />
            </>
          )}

          <TelemetryIntegritySection completeness={snap.completeness} />
        </>
      )}
    </div>
  );
};

