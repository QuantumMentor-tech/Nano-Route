//! Nano Route — Core Domain Models
//!
//! Responsibility:
//! - Pure domain entities, values, and business contracts.
//! - Pure, portable business logic independent of UI, SQLite, and network clients.
//! - Must NOT depend on Tauri WebView, rusqlite, or reqwest directly.

pub mod app_info;
pub mod chat;
pub mod credentials;
pub mod health;
pub mod history;
pub mod license;
pub mod privacy;
pub mod settings;
pub mod telemetry;

pub use app_info::AppInfo;
pub use license::LicenseInfo;
pub use chat::{ChatConversation, ChatMessage, ChatMessageMetadata, ChatSession, MessageSender};
pub use credentials::{DecryptedProviderCredential, EncryptedCredentialRecord, ProviderCredentialStatus};
pub use health::{CoreStatus, HealthReport, SubsystemHealth};
pub use history::{
    BulkDeleteResult, HistoryFilter, HistoryFilterOptions, HistoryMatchType,
    HistoryMessageMatchPreview, HistoryPage, HistoryPageInfo, HistoryPagination,
    HistorySearchEngine, HistorySearchRequest, HistorySearchResponse, HistorySearchResult,
    HistorySessionDto, HistorySortMode,
};
pub use privacy::{
    AuditCheckMode, AuditHealthState, CleanupExecutionRequest, CleanupOperationResult,
    CleanupPreviewRequest, CleanupPreviewResult, CleanupTargetScope, CleanupVerificationStatus,
    DataAuditFinding, DataAuditReport, DataCategory, DataInventoryItem, DataInventorySnapshot,
    DeletionPolicy, FullWipePreviewResult, FullWipeReport, FullWipeRequest, OrphanAuditSummary,
    RetentionPolicyConfig, SafeCredentialInventoryItem, SafeRepairAction, SafeRepairResult,
    TelemetryConsistencyAuditSummary,
};
pub use settings::{
    AppSettingKey, AppSettingsSnapshot, RoutingPreferenceMode, UpdateProviderPreferencesInput,
};
pub use telemetry::{
    resolve_provider_display_name, CostAvailabilityState, LatencyProvenanceState,
    LatencySampleSufficiency, SavingsComparisonStatus, TelemetryActualCostSummary,
    TelemetryAggregateReport, TelemetryBaselineSummary, TelemetryCompletenessSummary,
    TelemetryConfidenceBucket, TelemetryConfidenceDistribution, TelemetryCostTrendPoint,
    TelemetryDashboardFilters, TelemetryDashboardSnapshot, TelemetryDashboardSummary,
    TelemetryEventType, TelemetryFilter, TelemetryFilterOptionsDto, TelemetryFinancialAnalytics,
    TelemetryFinancialCoverageSummary, TelemetryFinancialExportRow, TelemetryLatencyDataQualitySummary,
    TelemetryLatencyHistogram, TelemetryLatencyHistogramBucket, TelemetryLatencySummary,
    TelemetryLatencyTrendPoint, TelemetryLogicalLatencySummary, TelemetryModelCostSummary,
    TelemetryModelLatencySummary, TelemetryModelOption, TelemetryModelSummary,
    TelemetryModelTokenSummary, TelemetryOutcome, TelemetryOutcomeLatencySummary,
    TelemetryOutcomeSummary, TelemetryPerformanceAnalytics, TelemetryProviderCostSummary,
    TelemetryProviderLatencySummary, TelemetryProviderOption, TelemetryProviderSummary,
    TelemetryProviderTokenSummary, TelemetryRecord, TelemetryRetryFailoverSummary,
    TelemetryRoutingOverheadSummary, TelemetrySavingsSummary, TelemetryStreamingPerformanceSummary,
    TelemetryTimeBucket, TelemetryTimeSeriesPoint, TelemetryTokenSummary, TelemetryTokenTrendPoint,
    TokenDataSource,
};
