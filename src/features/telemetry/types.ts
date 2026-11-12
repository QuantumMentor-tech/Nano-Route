/**
//! Nano Route — Step 42 Telemetry Dashboard Frontend Types
//! File: src/features/telemetry/types.ts
//!
//! Typed state and filter contracts for the read-only local Telemetry Dashboard.
*/

import type {
  CostAvailabilityState,
  SavingsComparisonStatus,
  TelemetryActualCostSummary,
  TelemetryAggregateReport,
  TelemetryBaselineSummary,
  TelemetryCompletenessSummary,
  TelemetryConfidenceBucket,
  TelemetryConfidenceDistribution,
  TelemetryCostTrendPoint,
  TelemetryDashboardFilters,
  TelemetryDashboardSnapshot,
  TelemetryDashboardSummary,
  TelemetryEventType,
  TelemetryFilter,
  TelemetryFilterOptionsDto,
  TelemetryFinancialAnalytics,
  TelemetryFinancialCoverageSummary,
  TelemetryFinancialExportRow,
  TelemetryModelCostSummary,
  TelemetryModelOption,
  TelemetryModelSummary,
  TelemetryModelTokenSummary,
  TelemetryOutcome,
  TelemetryOutcomeSummary,
  TelemetryProviderCostSummary,
  TelemetryProviderOption,
  TelemetryProviderSummary,
  TelemetryProviderTokenSummary,
  TelemetryRecord,
  TelemetryRetryFailoverSummary,
  TelemetrySavingsSummary,
  TelemetryTimeBucket,
  TelemetryTimeSeriesPoint,
  TelemetryTokenSummary,
  TelemetryTokenTrendPoint,
  TokenDataSource,
  LatencyProvenanceState,
  LatencySampleSufficiency,
  TelemetryLatencySummary,
  TelemetryLatencyHistogramBucket,
  TelemetryLatencyHistogram,
  TelemetryLatencyTrendPoint,
  TelemetryProviderLatencySummary,
  TelemetryModelLatencySummary,
  TelemetryOutcomeLatencySummary,
  TelemetryRoutingOverheadSummary,
  TelemetryStreamingPerformanceSummary,
  TelemetryLogicalLatencySummary,
  TelemetryLatencyDataQualitySummary,
  TelemetryPerformanceAnalytics,
} from "../../services/ipc/types.ts";

export type {
  CostAvailabilityState,
  SavingsComparisonStatus,
  TelemetryActualCostSummary,
  TelemetryAggregateReport,
  TelemetryBaselineSummary,
  TelemetryCompletenessSummary,
  TelemetryConfidenceBucket,
  TelemetryConfidenceDistribution,
  TelemetryCostTrendPoint,
  TelemetryDashboardFilters,
  TelemetryDashboardSnapshot,
  TelemetryDashboardSummary,
  TelemetryEventType,
  TelemetryFilter,
  TelemetryFilterOptionsDto,
  TelemetryFinancialAnalytics,
  TelemetryFinancialCoverageSummary,
  TelemetryFinancialExportRow,
  TelemetryModelCostSummary,
  TelemetryModelOption,
  TelemetryModelSummary,
  TelemetryModelTokenSummary,
  TelemetryOutcome,
  TelemetryOutcomeSummary,
  TelemetryProviderCostSummary,
  TelemetryProviderOption,
  TelemetryProviderSummary,
  TelemetryProviderTokenSummary,
  TelemetryRecord,
  TelemetryRetryFailoverSummary,
  TelemetrySavingsSummary,
  TelemetryTimeBucket,
  TelemetryTimeSeriesPoint,
  TelemetryTokenSummary,
  TelemetryTokenTrendPoint,
  TokenDataSource,
  LatencyProvenanceState,
  LatencySampleSufficiency,
  TelemetryLatencySummary,
  TelemetryLatencyHistogramBucket,
  TelemetryLatencyHistogram,
  TelemetryLatencyTrendPoint,
  TelemetryProviderLatencySummary,
  TelemetryModelLatencySummary,
  TelemetryOutcomeLatencySummary,
  TelemetryRoutingOverheadSummary,
  TelemetryStreamingPerformanceSummary,
  TelemetryLogicalLatencySummary,
  TelemetryLatencyDataQualitySummary,
  TelemetryPerformanceAnalytics,
};

export type TelemetryDatePreset =
  | "all"
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "custom";

export type TelemetryFreshnessStatus =
  | "up_to_date"
  | "updated_recently"
  | "loading"
  | "unavailable"
  | "unknown";

export interface TelemetryDashboardError {
  operation: "initial_load" | "refresh" | "filter";
  message: string;
}

