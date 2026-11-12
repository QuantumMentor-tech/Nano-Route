// ============================================================================
// Nano Route - Telemetry Audit, Data Cleanup, Retention & Privacy Domain Models
// File: src-tauri/src/domain/privacy.rs
// ============================================================================
// Authoritative domain contracts for Step 45:
// - Local Data Inventory & Classification
// - Database Health, Integrity Audit & Orphan Detection
// - Safe Non-Destructive Repair
// - Retention Policy Configuration & Validation
// - Cleanup Dry-Run Preview, Execution & Verification
// - Full Local Data Wipe & Post-Wipe Verification
//
// Security & Privacy Invariants:
// - Never exposes plaintext API keys or encrypted DPAPI BLOBs.
// - Never exposes raw conversation message content in audit or cleanup reports.
// - Strictly local-only; zero external network or cloud dependencies.
// ============================================================================

use serde::{Deserialize, Serialize};

/// Canonical classification of local persistent data categories (Section 5).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DataCategory {
    UserContent,
    Secret,
    OperationalTelemetry,
    Configuration,
    SearchIndex,
    ApplicationMetadata,
}

/// Canonical deletion policy governing how a local dataset may be cleaned or wiped (Section 6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeletionPolicy {
    UserOnly,
    RetentionEligible,
    Rebuildable,
    CredentialSensitive,
    SelectivelyDeletable,
    SystemOwned,
}

/// Safe non-secret credential inventory summary (Section 74).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeCredentialInventoryItem {
    pub provider_id: String,
    pub is_active: bool,
    pub has_credential: bool,
    pub updated_at: i64,
}

/// Inventory descriptor and live row count for a single local dataset (Section 7).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataInventoryItem {
    pub store_id: String,
    pub display_name: String,
    pub table_or_location: String,
    pub category: DataCategory,
    pub deletion_policy: DeletionPolicy,
    pub record_count: u64,
    pub contains_sensitive_data: bool,
    pub included_in_retention_cleanup: bool,
    pub included_in_full_wipe: bool,
    pub description: String,
}

/// Complete snapshot of local persistent data stores and safe credential metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataInventorySnapshot {
    pub generated_at_ms: i64,
    pub database_path: String,
    pub storage_semantics_note: String,
    pub provider_boundary_note: String,
    pub items: Vec<DataInventoryItem>,
    pub credentials: Vec<SafeCredentialInventoryItem>,
    pub total_user_sessions: u64,
    pub total_user_messages: u64,
    pub total_telemetry_records: u64,
    pub total_search_index_entries: u64,
    pub total_configured_credentials: u64,
    pub total_app_settings: u64,
    pub active_executions_count: u64,
}

/// Canonical database & telemetry audit health states (Section 24).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditHealthState {
    Healthy,
    HealthyWithWarnings,
    NeedsAttention,
    Corrupted,
    Unavailable,
}

/// Audit execution depth (Section 66).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuditCheckMode {
    Quick,
    Full,
}

impl Default for AuditCheckMode {
    fn default() -> Self {
        Self::Quick
    }
}

/// Structured warning or finding discovered during a read-only audit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataAuditFinding {
    pub code: String,
    pub severity: String, // "info" | "warning" | "error"
    pub category: String,
    pub message: String,
    pub affected_count: u64,
    pub safe_repair_available: bool,
}

/// Orphan and cross-table referential audit counts (Section 22).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanAuditSummary {
    pub orphaned_messages_count: u64,
    pub empty_sessions_count: u64,
    pub expected_search_index_entries: u64,
    pub actual_search_index_entries: u64,
    pub search_index_mismatch_count: u64,
    pub search_index_in_sync: bool,
    pub unlinked_session_telemetry_count: u64,
}

/// Telemetry consistency and anomaly counts (Section 23).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetryConsistencyAuditSummary {
    pub total_records_checked: u64,
    pub missing_timestamp_count: u64,
    pub future_timestamp_anomaly_count: u64,
    pub negative_latency_count: u64,
    pub negative_token_count: u64,
    pub negative_cost_count: u64,
    pub invalid_confidence_count: u64,
    pub missing_provider_or_model_count: u64,
}

/// Complete read-only audit report (Section 25).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataAuditReport {
    pub audited_at_ms: i64,
    pub mode: AuditCheckMode,
    pub duration_ms: u64,
    pub health_state: AuditHealthState,
    pub sqlite_integrity_ok: bool,
    pub sqlite_integrity_message: String,
    pub foreign_keys_ok: bool,
    pub foreign_key_violations_count: u64,
    pub schema_version: i64,
    pub expected_schema_version: i64,
    pub wal_enabled: bool,
    pub orphan_summary: OrphanAuditSummary,
    pub telemetry_consistency: TelemetryConsistencyAuditSummary,
    pub invalid_settings_count: u64,
    pub credential_records_valid: bool,
    pub privacy_isolation_verified: bool,
    pub findings: Vec<DataAuditFinding>,
}

/// Safe, non-destructive repair actions (Section 27).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SafeRepairAction {
    RebuildSearchIndex,
    RemoveOrphanedRecordsAndRebuildIndex,
}

/// Result of a safe repair operation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeRepairResult {
    pub executed_at_ms: i64,
    pub duration_ms: u64,
    pub action: SafeRepairAction,
    pub search_index_entries_rebuilt: u64,
    pub orphaned_messages_removed: u64,
    pub verification_passed: bool,
    pub message: String,
}

/// User-configurable local retention policy (Section 10).
/// Defaults to disabled so Nano Route never deletes user data unless explicitly enabled.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetentionPolicyConfig {
    pub history_retention_enabled: bool,
    pub history_retention_days: u32,
    pub exclude_pinned_sessions: bool,
    pub telemetry_retention_enabled: bool,
    pub telemetry_retention_days: u32,
    pub cleanup_confirmation_required: bool,
}

impl Default for RetentionPolicyConfig {
    fn default() -> Self {
        Self {
            history_retention_enabled: false,
            history_retention_days: 30,
            exclude_pinned_sessions: true,
            telemetry_retention_enabled: false,
            telemetry_retention_days: 30,
            cleanup_confirmation_required: true,
        }
    }
}

/// Target scope for preview or cleanup operations (Sections 16–20).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanupTargetScope {
    TelemetryOnly,
    HistoryOnly,
    RetentionPolicy,
    SearchIndexRebuild,
}

/// Request payload for dry-run cleanup preview (Section 50).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPreviewRequest {
    pub scope: CleanupTargetScope,
    pub older_than_days: Option<u32>,
    pub exclude_pinned_sessions: Option<bool>,
    pub delete_all_in_scope: Option<bool>,
}

/// Read-only dry-run preview result before cleanup execution (Section 51).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPreviewResult {
    pub generated_at_ms: i64,
    pub scope: CleanupTargetScope,
    pub cutoff_timestamp_ms: Option<i64>,
    pub older_than_days: Option<u32>,
    pub exclude_pinned_sessions: bool,
    pub eligible_sessions_count: u64,
    pub eligible_messages_count: u64,
    pub eligible_telemetry_records_count: u64,
    pub affected_search_index_entries_count: u64,
    pub excluded_pinned_sessions_count: u64,
    pub skipped_active_sessions_count: u64,
    pub skipped_future_timestamp_count: u64,
    pub preserves_credentials: bool,
    pub preserves_settings: bool,
    pub summary_message: String,
}

/// Request payload for executing a controlled cleanup operation (Section 53).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecutionRequest {
    pub scope: CleanupTargetScope,
    pub older_than_days: Option<u32>,
    pub exclude_pinned_sessions: Option<bool>,
    pub delete_all_in_scope: Option<bool>,
    pub confirmed: bool,
}

/// Post-cleanup or post-wipe verification status (Section 61).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CleanupVerificationStatus {
    Verified,
    VerifiedWithWarnings,
    VerificationFailed,
}

/// Structured report returned after a cleanup operation (Section 62).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupOperationResult {
    pub operation_id: String,
    pub scope: CleanupTargetScope,
    pub started_at_ms: i64,
    pub completed_at_ms: i64,
    pub duration_ms: u64,
    pub deleted_sessions_count: u64,
    pub deleted_messages_count: u64,
    pub deleted_telemetry_records_count: u64,
    pub rebuilt_search_index_entries_count: u64,
    pub excluded_pinned_sessions_count: u64,
    pub skipped_active_sessions_count: u64,
    pub skipped_future_timestamp_count: u64,
    pub remaining_sessions_count: u64,
    pub remaining_messages_count: u64,
    pub remaining_telemetry_records_count: u64,
    pub remaining_search_index_entries_count: u64,
    pub verification_status: CleanupVerificationStatus,
    pub storage_note: String,
    pub warnings: Vec<String>,
}

/// Read-only preview of what a Full Local Data Wipe will remove (Section 33).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullWipePreviewResult {
    pub generated_at_ms: i64,
    pub sessions_to_delete: u64,
    pub messages_to_delete: u64,
    pub telemetry_records_to_delete: u64,
    pub search_index_entries_to_delete: u64,
    pub app_settings_to_reset: u64,
    pub provider_credentials_to_delete: u64,
    pub configured_provider_ids: Vec<String>,
    pub active_executions_count: u64,
    pub can_proceed: bool,
    pub block_reason: Option<String>,
    pub required_confirmation_token: String,
    pub provider_boundary_warning: String,
}

/// High-security request payload for executing a Full Local Data Wipe (Section 32).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullWipeRequest {
    pub confirmation_token: String,
    pub confirmed: bool,
    pub include_credentials: Option<bool>,
    pub include_settings: Option<bool>,
}

/// Structured post-wipe verification report (Section 36).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FullWipeReport {
    pub operation_id: String,
    pub started_at_ms: i64,
    pub completed_at_ms: i64,
    pub duration_ms: u64,
    pub deleted_sessions_count: u64,
    pub deleted_messages_count: u64,
    pub deleted_telemetry_records_count: u64,
    pub cleared_search_index_entries_count: u64,
    pub reset_settings_count: u64,
    pub deleted_credentials_count: u64,
    pub remaining_sessions_count: u64,
    pub remaining_messages_count: u64,
    pub remaining_telemetry_records_count: u64,
    pub remaining_search_index_entries_count: u64,
    pub remaining_credentials_count: u64,
    pub verification_status: CleanupVerificationStatus,
    pub storage_note: String,
}

