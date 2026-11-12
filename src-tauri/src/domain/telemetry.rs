// ============================================================================
// Nano Route - Telemetry Domain Models & Step 42 Dashboard DTOs
// File: src-tauri/src/domain/telemetry.rs
// ============================================================================
// Core business entities and value objects for operational observation.
// Preserves normalized telemetry facts without sensitive prompts or secrets.
// ============================================================================

use serde::{Deserialize, Serialize};

/// High-level categories of observable operational events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryEventType {
    RoutingDecision,
    ProviderExecution,
    StreamLifecycle,
    FallbackTransition,
    SystemEvent,
}

#[allow(non_upper_case_globals)]
impl TelemetryEventType {
    /// Alias used by intent/task analysis telemetry producers.
    pub const Routing: Self = Self::RoutingDecision;

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::RoutingDecision => "routing_decision",
            Self::ProviderExecution => "provider_execution",
            Self::StreamLifecycle => "stream_lifecycle",
            Self::FallbackTransition => "fallback_transition",
            Self::SystemEvent => "system_event",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "routing_decision" | "routing" => Ok(Self::RoutingDecision),
            "provider_execution" => Ok(Self::ProviderExecution),
            "stream_lifecycle" => Ok(Self::StreamLifecycle),
            "fallback_transition" => Ok(Self::FallbackTransition),
            "system_event" => Ok(Self::SystemEvent),
            other => Err(format!(
                "Invalid event type '{}'. Allowed: routing_decision, provider_execution, stream_lifecycle, fallback_transition, system_event",
                other
            )),
        }
    }
}

/// Normalized operational outcome classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryOutcome {
    Success,
    Failure,
    Cancelled,
    Timeout,
    RateLimited,
    Unavailable,
    Fallback,
}

#[allow(non_upper_case_globals)]
impl TelemetryOutcome {
    pub const Succeeded: Self = Self::Success;
    pub const Failed: Self = Self::Failure;

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Failure => "failure",
            Self::Cancelled => "cancelled",
            Self::Timeout => "timeout",
            Self::RateLimited => "rate_limited",
            Self::Unavailable => "unavailable",
            Self::Fallback => "fallback",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "success" | "succeeded" => Ok(Self::Success),
            "failure" | "failed" => Ok(Self::Failure),
            "cancelled" => Ok(Self::Cancelled),
            "timeout" => Ok(Self::Timeout),
            "rate_limited" => Ok(Self::RateLimited),
            "unavailable" => Ok(Self::Unavailable),
            "fallback" => Ok(Self::Fallback),
            other => Err(format!(
                "Invalid outcome '{}'. Allowed: success, failure, cancelled, timeout, rate_limited, unavailable, fallback",
                other
            )),
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            Self::Success => "Success",
            Self::Failure => "Failure",
            Self::Cancelled => "Cancelled",
            Self::Timeout => "Timeout",
            Self::RateLimited => "Rate Limited",
            Self::Unavailable => "Provider Unavailable",
            Self::Fallback => "Fallback Transition",
        }
    }
}

/// Resolves a canonical provider identifier into a human-readable display name
/// and indicates whether the provider is a known built-in catalog provider.
pub fn resolve_provider_display_name(provider_id: Option<&str>) -> (String, String, bool) {
    match provider_id.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        None => ("unrecorded".to_string(), "Not recorded".to_string(), true),
        Some(raw) => {
            let lower = raw.to_lowercase();
            match lower.as_str() {
                "openai" => ("openai".to_string(), "OpenAI".to_string(), false),
                "anthropic" => ("anthropic".to_string(), "Anthropic".to_string(), false),
                "gemini" | "google" => (lower, "Google Gemini".to_string(), false),
                "deepseek" => ("deepseek".to_string(), "DeepSeek".to_string(), false),
                "groq" => ("groq".to_string(), "Groq".to_string(), false),
                "mistral" => ("mistral".to_string(), "Mistral AI".to_string(), false),
                "local" | "local_slm" => (lower, "Local SLM".to_string(), false),
                _ => (raw.to_string(), raw.to_string(), true),
            }
        }
    }
}

/// A durable, structured operational telemetry observation record.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryRecord {
    pub id: String,
    pub event_type: TelemetryEventType,
    pub occurred_at: i64,
    pub session_id: Option<String>,
    pub message_id: Option<String>,
    pub task_id: Option<String>,
    pub stream_id: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub outcome: TelemetryOutcome,
    pub error_code: Option<String>,
    pub latency_ms: Option<u64>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cost_usd: Option<f64>,
    pub confidence: Option<f64>,
    pub routing_reason: Option<String>,
}

/// Filter criteria for querying operational telemetry records.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFilter {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub session_id: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub event_type: Option<TelemetryEventType>,
    pub outcome: Option<TelemetryOutcome>,
}

/// Aggregated operational metrics computed across filtered telemetry facts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryAggregateReport {
    pub total_events: u64,
    pub successful_events: u64,
    pub failed_events: u64,
    pub total_prompt_tokens: u64,
    pub total_completion_tokens: u64,
    pub total_cost_usd: f64,
    pub avg_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

// ============================================================================
// Step 42: Telemetry Dashboard Snapshot & Aggregate DTOs
// ============================================================================

/// Time bucket granularity for routing activity time-series charts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TelemetryTimeBucket {
    Hour,
    Day,
}

impl Default for TelemetryTimeBucket {
    fn default() -> Self {
        Self::Day
    }
}

/// Authoritative filter criteria for the Step 42 & Step 43 Telemetry Dashboard snapshot.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryDashboardFilters {
    pub start_time: Option<i64>,
    pub end_time: Option<i64>,
    pub time_bucket: Option<TelemetryTimeBucket>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub outcome: Option<String>,
    pub event_type: Option<TelemetryEventType>,
    pub query_id: Option<String>,
    pub baseline_provider_id: Option<String>,
    pub baseline_model_id: Option<String>,
}

/// High-level operational summary metrics for the filtered telemetry scope.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryDashboardSummary {
    pub total_routed_requests: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub cancelled_executions: u64,
    pub fallback_executions: u64,
    pub terminal_executions: u64,
    pub success_rate_percent: Option<f64>,
}

/// Bounded time-series bucket point for routing activity over time.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryTimeSeriesPoint {
    pub bucket_start_ms: i64,
    pub bucket_label: String,
    pub request_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub cancelled_count: u64,
}

/// Per-provider operational activity summary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryProviderSummary {
    pub provider_id: String,
    pub display_name: String,
    pub is_historical_or_unrecorded: bool,
    pub request_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub cancelled_count: u64,
    pub percentage_of_total: Option<f64>,
}

/// Per-model operational activity summary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryModelSummary {
    pub provider_id: String,
    pub provider_display_name: String,
    pub model_id: String,
    pub is_historical_or_unrecorded: bool,
    pub request_count: u64,
    pub success_count: u64,
    pub failure_count: u64,
    pub cancelled_count: u64,
    pub percentage_of_total: Option<f64>,
}

/// Outcome distribution slice with exact counts and optional percentage.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryOutcomeSummary {
    pub outcome: String,
    pub label: String,
    pub count: u64,
    pub percentage_of_total: Option<f64>,
}

/// Authoritative retry and failover operational summary.
/// Preserves unknown-data honesty: retry count is marked unavailable because
/// `telemetry_records` does not store a per-record retry counter column.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryRetryFailoverSummary {
    pub failover_data_available: bool,
    pub failover_involved_count: u64,
    pub fallback_success_count: u64,
    pub fallback_failure_count: u64,
    pub timeout_outcome_count: u64,
    pub rate_limited_outcome_count: u64,
    pub retry_data_available: bool,
    pub retry_execution_count: Option<u64>,
}

/// Single histogram bucket for recorded SLM classifier confidence in `[0.0, 1.0]`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryConfidenceBucket {
    pub bucket_key: String,
    pub label: String,
    pub min_inclusive: f64,
    pub max_inclusive: f64,
    pub count: u64,
    pub percentage_of_available: Option<f64>,
}

/// Distribution of recorded SLM confidence scores across the filtered scope.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryConfidenceDistribution {
    pub available_count: u64,
    pub missing_count: u64,
    pub min_confidence: Option<f64>,
    pub max_confidence: Option<f64>,
    pub buckets: Vec<TelemetryConfidenceBucket>,
}

/// Data completeness & telemetry integrity indicators across the filtered scope.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryCompletenessSummary {
    pub total_records: u64,
    pub provider_recorded_count: u64,
    pub provider_recorded_percent: Option<f64>,
    pub model_recorded_count: u64,
    pub model_recorded_percent: Option<f64>,
    pub outcome_recorded_count: u64,
    pub outcome_recorded_percent: Option<f64>,
    pub routing_reason_recorded_count: u64,
    pub routing_reason_recorded_percent: Option<f64>,
    pub confidence_recorded_count: u64,
    pub confidence_recorded_percent: Option<f64>,
    pub session_correlation_count: u64,
    pub session_correlation_percent: Option<f64>,
    pub complete_metadata_count: u64,
    pub complete_metadata_percent: Option<f64>,
    pub incomplete_records_count: u64,
    pub earliest_record_at_ms: Option<i64>,
    pub latest_record_at_ms: Option<i64>,
}

/// Available provider filter option discovered from persisted telemetry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryProviderOption {
    pub provider_id: String,
    pub display_name: String,
    pub is_historical: bool,
}

/// Available model filter option discovered from persisted telemetry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryModelOption {
    pub provider_id: Option<String>,
    pub model_id: String,
}

/// Distinct filter options available across the local telemetry ledger.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFilterOptionsDto {
    pub providers: Vec<TelemetryProviderOption>,
    pub models: Vec<TelemetryModelOption>,
    pub outcomes: Vec<String>,
}

/// Coherent single-request snapshot for the Step 42 & Step 43 Telemetry Dashboard.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryDashboardSnapshot {
    pub query_id: Option<String>,
    pub generated_at_ms: i64,
    pub applied_filters: TelemetryDashboardFilters,
    pub filter_options: TelemetryFilterOptionsDto,
    pub summary: TelemetryDashboardSummary,
    pub time_series: Vec<TelemetryTimeSeriesPoint>,
    pub provider_distribution: Vec<TelemetryProviderSummary>,
    pub model_distribution: Vec<TelemetryModelSummary>,
    pub outcome_distribution: Vec<TelemetryOutcomeSummary>,
    pub retry_failover: TelemetryRetryFailoverSummary,
    pub confidence_distribution: TelemetryConfidenceDistribution,
    pub completeness: TelemetryCompletenessSummary,
    pub financial_analytics: TelemetryFinancialAnalytics,
    pub performance_analytics: TelemetryPerformanceAnalytics,
}

// ============================================================================
// Step 43: Token Usage, Cost Analytics & Routing Savings Engine Contracts
// ============================================================================

/// Provenance of normalized token usage data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenDataSource {
    Recorded,
    Unavailable,
}

impl Default for TokenDataSource {
    fn default() -> Self {
        Self::Unavailable
    }
}

/// Availability and certainty state for cost metrics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CostAvailabilityState {
    Exact,
    Derived,
    Estimated,
    Unavailable,
    NotApplicable,
}

impl Default for CostAvailabilityState {
    fn default() -> Self {
        Self::Unavailable
    }
}

/// Savings comparison state relative to the configured baseline.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SavingsComparisonStatus {
    BelowBaseline,
    AtBaseline,
    AboveBaseline,
    Unavailable,
}

impl Default for SavingsComparisonStatus {
    fn default() -> Self {
        Self::Unavailable
    }
}

/// Summary of normalized token consumption across the filtered scope.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryTokenSummary {
    pub logical_request_count: u64,
    pub physical_attempt_count: u64,
    pub duplicate_or_intermediate_events_excluded: u64,
    pub input_tokens_available_count: u64,
    pub output_tokens_available_count: u64,
    pub both_tokens_available_count: u64,
    pub missing_token_records_count: u64,
    pub total_input_tokens: Option<u64>,
    pub total_output_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub token_data_source: TokenDataSource,
}

/// Summary of recorded actual execution spend across the filtered scope.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryActualCostSummary {
    pub currency: String,
    pub cost_availability_state: CostAvailabilityState,
    pub eligible_attempt_count: u64,
    pub eligible_logical_request_count: u64,
    pub missing_cost_attempt_count: u64,
    pub zero_cost_attempt_count: u64,
    pub total_actual_cost_usd: Option<f64>,
    pub average_cost_per_logical_request_usd: Option<f64>,
    pub average_cost_per_attempt_usd: Option<f64>,
    pub cost_per_thousand_tokens_usd: Option<f64>,
    pub cost_per_million_tokens_usd: Option<f64>,
    pub cost_per_token_compatible_record_count: u64,
    pub cost_per_token_compatible_total_tokens: u64,
}

/// Baseline model and versioned pricing metadata used for savings comparison.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryBaselineSummary {
    pub baseline_provider_id: String,
    pub baseline_provider_display_name: String,
    pub baseline_model_id: String,
    pub baseline_model_display_name: String,
    pub methodology: String,
    pub methodology_label: String,
    pub pricing_version_used: Option<String>,
    pub pricing_versions_used: Vec<String>,
    pub baseline_available: bool,
    pub baseline_cost_usd: Option<f64>,
}

/// Routing savings summary comparing actual routed cost against the token-equivalent baseline.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySavingsSummary {
    pub savings_state: CostAvailabilityState,
    pub comparison_status: SavingsComparisonStatus,
    pub eligible_record_count: u64,
    pub ineligible_record_count: u64,
    pub missing_token_data_count: u64,
    pub missing_actual_cost_count: u64,
    pub missing_baseline_pricing_count: u64,
    pub eligible_actual_cost_usd: Option<f64>,
    pub baseline_cost_usd: Option<f64>,
    pub estimated_savings_usd: Option<f64>,
    pub savings_percent: Option<f64>,
    pub all_time_eligible_record_count: u64,
    pub all_time_actual_cost_usd: Option<f64>,
    pub all_time_baseline_cost_usd: Option<f64>,
    pub all_time_estimated_savings_usd: Option<f64>,
    pub all_time_savings_percent: Option<f64>,
}

/// Time-series point for token usage trend charts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryTokenTrendPoint {
    pub bucket_start_ms: i64,
    pub bucket_label: String,
    pub attempt_count: u64,
    pub token_eligible_count: u64,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
}

/// Time-series point for actual cost, baseline cost, and savings trend charts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryCostTrendPoint {
    pub bucket_start_ms: i64,
    pub bucket_label: String,
    pub attempt_count: u64,
    pub cost_eligible_count: u64,
    pub actual_cost_usd: Option<f64>,
    pub savings_eligible_count: u64,
    pub baseline_cost_usd: Option<f64>,
    pub estimated_savings_usd: Option<f64>,
}

/// Per-provider token usage breakdown.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryProviderTokenSummary {
    pub provider_id: String,
    pub display_name: String,
    pub is_historical_or_unrecorded: bool,
    pub attempt_count: u64,
    pub logical_request_count: u64,
    pub token_eligible_count: u64,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub share_of_total_tokens_percent: Option<f64>,
}

/// Per-model token usage breakdown.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryModelTokenSummary {
    pub provider_id: String,
    pub provider_display_name: String,
    pub model_id: String,
    pub is_historical_or_unrecorded: bool,
    pub attempt_count: u64,
    pub logical_request_count: u64,
    pub token_eligible_count: u64,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub share_of_total_tokens_percent: Option<f64>,
}

/// Per-provider cost & savings breakdown.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryProviderCostSummary {
    pub provider_id: String,
    pub display_name: String,
    pub is_historical_or_unrecorded: bool,
    pub attempt_count: u64,
    pub cost_eligible_count: u64,
    pub actual_cost_usd: Option<f64>,
    pub average_cost_per_eligible_attempt_usd: Option<f64>,
    pub total_tokens: Option<u64>,
    pub share_of_total_cost_percent: Option<f64>,
    pub savings_eligible_count: u64,
    pub eligible_actual_cost_usd: Option<f64>,
    pub baseline_cost_usd: Option<f64>,
    pub estimated_savings_usd: Option<f64>,
    pub savings_percent: Option<f64>,
}

/// Per-model cost & savings breakdown.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryModelCostSummary {
    pub provider_id: String,
    pub provider_display_name: String,
    pub model_id: String,
    pub is_historical_or_unrecorded: bool,
    pub attempt_count: u64,
    pub cost_eligible_count: u64,
    pub actual_cost_usd: Option<f64>,
    pub average_cost_per_eligible_attempt_usd: Option<f64>,
    pub total_tokens: Option<u64>,
    pub share_of_total_cost_percent: Option<f64>,
    pub savings_eligible_count: u64,
    pub eligible_actual_cost_usd: Option<f64>,
    pub baseline_cost_usd: Option<f64>,
    pub estimated_savings_usd: Option<f64>,
    pub savings_percent: Option<f64>,
}

/// Coverage and data completeness indicators for token, cost, and savings analytics.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFinancialCoverageSummary {
    pub total_physical_attempts: u64,
    pub total_logical_requests: u64,
    pub token_coverage_count: u64,
    pub token_coverage_percent: Option<f64>,
    pub cost_coverage_count: u64,
    pub cost_coverage_percent: Option<f64>,
    pub baseline_pricing_coverage_count: u64,
    pub baseline_pricing_coverage_percent: Option<f64>,
    pub savings_coverage_count: u64,
    pub savings_coverage_percent: Option<f64>,
    pub complete_financial_analytics_count: u64,
    pub complete_financial_analytics_percent: Option<f64>,
}

/// Export-ready row structure preserving full numeric precision (Section 68).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFinancialExportRow {
    pub bucket_start_ms: i64,
    pub provider_id: String,
    pub model_id: String,
    pub attempt_count: u64,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
    pub actual_cost_usd: Option<f64>,
    pub baseline_cost_usd: Option<f64>,
    pub estimated_savings_usd: Option<f64>,
}

/// Complete Step 43 Token Usage, Cost Analytics & Routing Savings Snapshot.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryFinancialAnalytics {
    pub query_id: Option<String>,
    pub generated_at_ms: i64,
    pub currency: String,
    pub token_summary: TelemetryTokenSummary,
    pub actual_cost_summary: TelemetryActualCostSummary,
    pub baseline_summary: TelemetryBaselineSummary,
    pub savings_summary: TelemetrySavingsSummary,
    pub token_trend: Vec<TelemetryTokenTrendPoint>,
    pub cost_trend: Vec<TelemetryCostTrendPoint>,
    pub provider_token_breakdown: Vec<TelemetryProviderTokenSummary>,
    pub model_token_breakdown: Vec<TelemetryModelTokenSummary>,
    pub provider_cost_breakdown: Vec<TelemetryProviderCostSummary>,
    pub model_cost_breakdown: Vec<TelemetryModelCostSummary>,
    pub coverage: TelemetryFinancialCoverageSummary,
    pub export_rows: Vec<TelemetryFinancialExportRow>,
}

// ============================================================================
// Step 44: Latency, Execution Performance & Benchmark Analytics Contracts
// ============================================================================

/// Provenance classification for latency statistics (Section 13).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LatencyProvenanceState {
    Recorded,
    Derived,
    Unavailable,
    NotApplicable,
}

impl Default for LatencyProvenanceState {
    fn default() -> Self {
        Self::Unavailable
    }
}

/// Sample sufficiency state for percentile reporting (Section 22, 72, 101).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LatencySampleSufficiency {
    Empty,
    Limited,
    Sufficient,
}

impl Default for LatencySampleSufficiency {
    fn default() -> Self {
        Self::Empty
    }
}

/// Headline latency & performance summary across valid execution attempts (Sections 16–22).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLatencySummary {
    pub population_label: String,
    pub metric_semantics_label: String,
    pub percentile_methodology: String,
    pub total_eligible_executions: u64,
    pub measured_executions: u64,
    pub missing_latency_count: u64,
    pub invalid_latency_count: u64,
    pub latency_coverage_percent: Option<f64>,
    pub sample_sufficiency: LatencySampleSufficiency,
    pub provenance: LatencyProvenanceState,
    pub average_latency_ms: Option<f64>,
    pub median_latency_ms: Option<f64>,
    pub p25_latency_ms: Option<f64>,
    pub p50_latency_ms: Option<f64>,
    pub p75_latency_ms: Option<f64>,
    pub p90_latency_ms: Option<f64>,
    pub p95_latency_ms: Option<f64>,
    pub p99_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

/// Single bin in the latency distribution histogram (Sections 23, 24).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLatencyHistogramBucket {
    pub bucket_key: String,
    pub label: String,
    pub min_bound_ms: u64,
    pub max_bound_ms: Option<u64>,
    pub count: u64,
    pub percentage: Option<f64>,
}

/// Complete latency distribution histogram across measured executions.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLatencyHistogram {
    pub measured_sample_count: u64,
    pub buckets: Vec<TelemetryLatencyHistogramBucket>,
}

/// Time-series latency trend bucket (Section 25).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLatencyTrendPoint {
    pub bucket_start_ms: i64,
    pub bucket_label: String,
    pub eligible_count: u64,
    pub measured_count: u64,
    pub average_latency_ms: Option<f64>,
    pub median_latency_ms: Option<f64>,
    pub p95_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

/// Per-provider latency & percentile breakdown (Sections 26, 28, 66, 87).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryProviderLatencySummary {
    pub provider_id: String,
    pub display_name: String,
    pub is_historical_or_unrecorded: bool,
    pub total_eligible_count: u64,
    pub measured_count: u64,
    pub coverage_percent: Option<f64>,
    pub sample_sufficiency: LatencySampleSufficiency,
    pub average_latency_ms: Option<f64>,
    pub median_latency_ms: Option<f64>,
    pub p25_latency_ms: Option<f64>,
    pub p75_latency_ms: Option<f64>,
    pub p90_latency_ms: Option<f64>,
    pub p95_latency_ms: Option<f64>,
    pub p99_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

/// Per-model latency & percentile breakdown (Sections 27, 28, 66, 88).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryModelLatencySummary {
    pub provider_id: String,
    pub provider_display_name: String,
    pub model_id: String,
    pub is_historical_or_unrecorded: bool,
    pub total_eligible_count: u64,
    pub measured_count: u64,
    pub coverage_percent: Option<f64>,
    pub sample_sufficiency: LatencySampleSufficiency,
    pub average_latency_ms: Option<f64>,
    pub median_latency_ms: Option<f64>,
    pub p25_latency_ms: Option<f64>,
    pub p75_latency_ms: Option<f64>,
    pub p90_latency_ms: Option<f64>,
    pub p95_latency_ms: Option<f64>,
    pub p99_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

/// Latency distribution grouped by canonical execution outcome (Sections 47–51, 86).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryOutcomeLatencySummary {
    pub outcome: String,
    pub display_label: String,
    pub total_count: u64,
    pub measured_count: u64,
    pub average_latency_ms: Option<f64>,
    pub median_latency_ms: Option<f64>,
    pub p95_latency_ms: Option<f64>,
    pub min_latency_ms: Option<u64>,
    pub max_latency_ms: Option<u64>,
}

/// Local routing overhead & SLM classification latency summary (Sections 40, 41, 78, 79).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryRoutingOverheadSummary {
    pub total_routing_events: u64,
    pub measured_routing_events: u64,
    pub provenance: LatencyProvenanceState,
    pub average_routing_latency_ms: Option<f64>,
    pub median_routing_latency_ms: Option<f64>,
    pub p95_routing_latency_ms: Option<f64>,
    pub min_routing_latency_ms: Option<u64>,
    pub max_routing_latency_ms: Option<u64>,
    pub slm_classification_provenance: LatencyProvenanceState,
    pub slm_classification_note: String,
}

/// Streaming execution performance & TTFT availability summary (Sections 35–38, 80, 81).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryStreamingPerformanceSummary {
    pub total_streaming_executions: u64,
    pub measured_streaming_completion_count: u64,
    pub completion_provenance: LatencyProvenanceState,
    pub average_stream_completion_latency_ms: Option<f64>,
    pub median_stream_completion_latency_ms: Option<f64>,
    pub p95_stream_completion_latency_ms: Option<f64>,
    pub min_stream_completion_latency_ms: Option<u64>,
    pub max_stream_completion_latency_ms: Option<u64>,
    pub ttft_measured_count: u64,
    pub average_ttft_ms: Option<f64>,
    pub median_ttft_ms: Option<f64>,
    pub ttft_provenance: LatencyProvenanceState,
    pub ttft_methodology_note: String,
}

/// Logical request vs. physical attempt & retry/failover latency analysis (Sections 44–46, 84).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLogicalLatencySummary {
    pub total_logical_requests: u64,
    pub measured_logical_requests: u64,
    pub single_attempt_logical_requests: u64,
    pub multi_attempt_logical_requests: u64,
    pub single_attempt_median_latency_ms: Option<f64>,
    pub single_attempt_average_latency_ms: Option<f64>,
    pub single_attempt_p95_latency_ms: Option<f64>,
    pub multi_attempt_median_latency_ms: Option<f64>,
    pub multi_attempt_average_latency_ms: Option<f64>,
    pub multi_attempt_p95_latency_ms: Option<f64>,
    pub logical_cumulative_median_latency_ms: Option<f64>,
    pub logical_cumulative_average_latency_ms: Option<f64>,
    pub logical_cumulative_p95_latency_ms: Option<f64>,
    pub logical_cumulative_min_latency_ms: Option<u64>,
    pub logical_cumulative_max_latency_ms: Option<u64>,
    pub initial_attempt_measured_count: u64,
    pub initial_attempt_median_latency_ms: Option<f64>,
    pub initial_attempt_average_latency_ms: Option<f64>,
    pub retry_or_failover_attempt_measured_count: u64,
    pub retry_or_failover_attempt_median_latency_ms: Option<f64>,
    pub retry_or_failover_attempt_average_latency_ms: Option<f64>,
}

/// Compact performance data quality & completeness summary (Sections 52, 53, 89).
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryLatencyDataQualitySummary {
    pub total_eligible_records: u64,
    pub valid_latency_records: u64,
    pub missing_latency_records: u64,
    pub invalid_latency_records: u64,
    pub duplicate_or_intermediate_events_excluded: u64,
    pub coverage_percent: Option<f64>,
    pub distinct_providers_count: u64,
    pub distinct_models_count: u64,
    pub earliest_measured_at_ms: Option<i64>,
    pub latest_measured_at_ms: Option<i64>,
}

/// Complete Step 44 Latency, Execution Performance & Benchmark Analytics Snapshot.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryPerformanceAnalytics {
    pub query_id: Option<String>,
    pub generated_at_ms: i64,
    pub summary: TelemetryLatencySummary,
    pub distribution: TelemetryLatencyHistogram,
    pub time_series: Vec<TelemetryLatencyTrendPoint>,
    pub provider_breakdown: Vec<TelemetryProviderLatencySummary>,
    pub model_breakdown: Vec<TelemetryModelLatencySummary>,
    pub outcome_breakdown: Vec<TelemetryOutcomeLatencySummary>,
    pub routing_overhead: TelemetryRoutingOverheadSummary,
    pub streaming_performance: TelemetryStreamingPerformanceSummary,
    pub logical_vs_physical: TelemetryLogicalLatencySummary,
    pub data_quality: TelemetryLatencyDataQualitySummary,
}
