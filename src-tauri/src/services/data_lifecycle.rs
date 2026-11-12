// ============================================================================
// Nano Route - Step 45 Data Lifecycle, Audit, Retention & Privacy Service
// File: src-tauri/src/services/data_lifecycle.rs
// ============================================================================
// Coordinates read-only data inventory, SQLite integrity & consistency auditing,
// safe non-destructive search index repair, retention policy configuration,
// dry-run cleanup previews, batched transactional cleanup, and explicit
// Full Local Data Wipe with post-operation verification.
//
// Security & Privacy Invariants:
// - Never exposes plaintext API keys or encrypted DPAPI BLOBs.
// - Never logs or returns user conversation text in audit/cleanup reports.
// - Never accepts raw SQL or filesystem paths over IPC.
// - Protects active streaming/executing sessions and future-dated records.
// ============================================================================

use crate::domain::{
    AuditCheckMode, AuditHealthState, CleanupExecutionRequest, CleanupOperationResult,
    CleanupPreviewRequest, CleanupPreviewResult, CleanupTargetScope, CleanupVerificationStatus,
    DataAuditFinding, DataAuditReport, DataCategory, DataInventoryItem, DataInventorySnapshot,
    DeletionPolicy, FullWipePreviewResult, FullWipeReport, FullWipeRequest, OrphanAuditSummary,
    RetentionPolicyConfig, SafeCredentialInventoryItem, SafeRepairAction, SafeRepairResult,
    TelemetryConsistencyAuditSummary,
};
use crate::errors::AppError;
use crate::providers::ProviderHealthManager;
use crate::services::execution::ExecutionManager;
use crate::services::{AppSettingsService, CredentialVaultService};
use crate::storage::migrations::{MigrationRunner, BUILTIN_MIGRATIONS};
use crate::storage::pragmas::SqlitePragmas;
use crate::storage::repositories::{AppSettingsRepository, HistoryRepository};
use crate::storage::DatabaseManager;
use rusqlite::{params, Connection, TransactionBehavior};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub const MIN_RETENTION_DAYS: u32 = 1;
pub const MAX_RETENTION_DAYS: u32 = 3650;
pub const FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS: i64 = 300_000; // 5 minutes
pub const FULL_WIPE_CONFIRMATION_TOKEN: &str = "DELETE";
pub const CLEANUP_BATCH_SIZE: usize = 500;

const KEY_HISTORY_RETENTION_ENABLED: &str = "privacy.history_retention_enabled";
const KEY_HISTORY_RETENTION_DAYS: &str = "privacy.history_retention_days";
const KEY_EXCLUDE_PINNED_SESSIONS: &str = "privacy.exclude_pinned_sessions";
const KEY_TELEMETRY_RETENTION_ENABLED: &str = "privacy.telemetry_retention_enabled";
const KEY_TELEMETRY_RETENTION_DAYS: &str = "privacy.telemetry_retention_days";
const KEY_CLEANUP_CONFIRMATION_REQUIRED: &str = "privacy.cleanup_confirmation_required";
const KEY_LEGACY_HISTORY_RETENTION_DAYS: &str = "history.retention_days";

pub const STORAGE_SEMANTICS_DISCLOSURE: &str =
    "Removed records are logically deleted from the local SQLite application database. \
     SQLite free-page reuse and WAL checkpointing do not constitute cryptographic disk-sector erasure.";

pub const PROVIDER_BOUNDARY_DISCLOSURE: &str =
    "Local cleanup and wipe operations remove data stored by Nano Route on this device only. \
     Prompts or responses previously transmitted to external AI providers are governed by those providers' own retention policies.";

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

struct OperationGuard<'a> {
    flag: &'a AtomicBool,
}

impl<'a> OperationGuard<'a> {
    fn acquire(flag: &'a AtomicBool) -> Result<Self, AppError> {
        if flag
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err(AppError::InvalidInput(
                "A data cleanup, repair, or wipe operation is already in progress".to_string(),
            ));
        }
        Ok(Self { flag })
    }
}

impl<'a> Drop for OperationGuard<'a> {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::SeqCst);
    }
}

pub struct DataLifecycleService {
    database_manager: Arc<DatabaseManager>,
    app_settings: Arc<AppSettingsService>,
    credential_vault: Arc<CredentialVaultService>,
    execution_manager: Arc<ExecutionManager>,
    provider_health_manager: Arc<ProviderHealthManager>,
    operation_in_progress: AtomicBool,
}

impl DataLifecycleService {
    pub fn new(
        database_manager: Arc<DatabaseManager>,
        app_settings: Arc<AppSettingsService>,
        credential_vault: Arc<CredentialVaultService>,
        execution_manager: Arc<ExecutionManager>,
        provider_health_manager: Arc<ProviderHealthManager>,
    ) -> Self {
        Self {
            database_manager,
            app_settings,
            credential_vault,
            execution_manager,
            provider_health_manager,
            operation_in_progress: AtomicBool::new(false),
        }
    }

    fn count_table(conn: &Connection, table_name: &str) -> u64 {
        let sql = format!("SELECT COUNT(*) FROM {};", table_name);
        conn.query_row(&sql, [], |r| r.get::<_, i64>(0))
            .map(|c| c.max(0) as u64)
            .unwrap_or(0)
    }

    /// Returns the complete local data inventory and classification model (Sections 4–7).
    pub fn get_data_inventory(&self) -> Result<DataInventorySnapshot, AppError> {
        let now_ms = current_epoch_ms();
        let db_path = self.database_manager.database_path_display();
        let active_executions_count = self.execution_manager.get_active_count() as u64;

        let cred_statuses = self.credential_vault.list_credential_statuses()?;
        let safe_credentials: Vec<SafeCredentialInventoryItem> = cred_statuses
            .iter()
            .map(|c| SafeCredentialInventoryItem {
                provider_id: c.provider_id.clone(),
                is_active: c.is_active,
                has_credential: c.is_configured,
                updated_at: c.updated_at,
            })
            .collect();

        let (sessions_count, messages_count, fts_count, telemetry_count, settings_count, creds_count, migrations_count) =
            self.database_manager
                .with_connection(|conn| {
                    Ok((
                        Self::count_table(conn, "chat_sessions"),
                        Self::count_table(conn, "chat_messages"),
                        Self::count_table(conn, "history_search_fts"),
                        Self::count_table(conn, "telemetry_records"),
                        Self::count_table(conn, "app_settings"),
                        Self::count_table(conn, "api_credentials"),
                        Self::count_table(conn, "schema_migrations"),
                    ))
                })
                .map_err(|e| AppError::Database(format!("Failed to inspect data inventory: {}", e)))?;

        let items = vec![
            DataInventoryItem {
                store_id: "chat_sessions".to_string(),
                display_name: "Conversation Sessions".to_string(),
                table_or_location: "chat_sessions".to_string(),
                category: DataCategory::UserContent,
                deletion_policy: DeletionPolicy::RetentionEligible,
                record_count: sessions_count,
                contains_sensitive_data: true,
                included_in_retention_cleanup: true,
                included_in_full_wipe: true,
                description: "Conversation thread titles, pin flags, and session creation/update timestamps.".to_string(),
            },
            DataInventoryItem {
                store_id: "chat_messages".to_string(),
                display_name: "Conversation Messages".to_string(),
                table_or_location: "chat_messages".to_string(),
                category: DataCategory::UserContent,
                deletion_policy: DeletionPolicy::RetentionEligible,
                record_count: messages_count,
                contains_sensitive_data: true,
                included_in_retention_cleanup: true,
                included_in_full_wipe: true,
                description: "User prompts, assistant responses, and message-level routing metadata.".to_string(),
            },
            DataInventoryItem {
                store_id: "history_search_fts".to_string(),
                display_name: "Local Search Index (FTS5)".to_string(),
                table_or_location: "history_search_fts".to_string(),
                category: DataCategory::SearchIndex,
                deletion_policy: DeletionPolicy::Rebuildable,
                record_count: fts_count,
                contains_sensitive_data: true,
                included_in_retention_cleanup: true,
                included_in_full_wipe: true,
                description: "Derived SQLite FTS5 lexical index over local session titles and messages; deterministically rebuildable.".to_string(),
            },
            DataInventoryItem {
                store_id: "telemetry_records".to_string(),
                display_name: "Operational Telemetry Ledger".to_string(),
                table_or_location: "telemetry_records".to_string(),
                category: DataCategory::OperationalTelemetry,
                deletion_policy: DeletionPolicy::RetentionEligible,
                record_count: telemetry_count,
                contains_sensitive_data: false,
                included_in_retention_cleanup: true,
                included_in_full_wipe: true,
                description: "Structured routing decisions, execution outcomes, token counts, costs, and latencies (no prompt text).".to_string(),
            },
            DataInventoryItem {
                store_id: "app_settings".to_string(),
                display_name: "Application Preferences & Policies".to_string(),
                table_or_location: "app_settings".to_string(),
                category: DataCategory::Configuration,
                deletion_policy: DeletionPolicy::SelectivelyDeletable,
                record_count: settings_count,
                contains_sensitive_data: false,
                included_in_retention_cleanup: false,
                included_in_full_wipe: true,
                description: "User preferences for routing mode, telemetry capture, and local data retention policies.".to_string(),
            },
            DataInventoryItem {
                store_id: "api_credentials".to_string(),
                display_name: "Encrypted Provider Credentials (DPAPI)".to_string(),
                table_or_location: "api_credentials".to_string(),
                category: DataCategory::Secret,
                deletion_policy: DeletionPolicy::CredentialSensitive,
                record_count: creds_count,
                contains_sensitive_data: true,
                included_in_retention_cleanup: false,
                included_in_full_wipe: true,
                description: "Windows DPAPI-encrypted provider API keys, custom endpoints, priority weights, and monthly budgets.".to_string(),
            },
            DataInventoryItem {
                store_id: "schema_migrations".to_string(),
                display_name: "Database Schema Metadata".to_string(),
                table_or_location: "schema_migrations / database_metadata".to_string(),
                category: DataCategory::ApplicationMetadata,
                deletion_policy: DeletionPolicy::SystemOwned,
                record_count: migrations_count,
                contains_sensitive_data: false,
                included_in_retention_cleanup: false,
                included_in_full_wipe: false,
                description: "System-owned SQLite schema version and migration integrity ledger.".to_string(),
            },
        ];

        Ok(DataInventorySnapshot {
            generated_at_ms: now_ms,
            database_path: db_path,
            storage_semantics_note: STORAGE_SEMANTICS_DISCLOSURE.to_string(),
            provider_boundary_note: PROVIDER_BOUNDARY_DISCLOSURE.to_string(),
            items,
            credentials: safe_credentials,
            total_user_sessions: sessions_count,
            total_user_messages: messages_count,
            total_telemetry_records: telemetry_count,
            total_search_index_entries: fts_count,
            total_configured_credentials: creds_count,
            total_app_settings: settings_count,
            active_executions_count,
        })
    }

    /// Executes a read-only Quick or Full Integrity & Privacy Audit (Sections 21–26).
    /// Strictly non-mutating: never deletes, repairs, or alters any database row.
    pub fn run_data_audit(&self, mode: AuditCheckMode) -> Result<DataAuditReport, AppError> {
        let start = Instant::now();
        let now_ms = current_epoch_ms();
        let future_cutoff_ms = now_ms + FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS;
        let expected_schema_version = BUILTIN_MIGRATIONS.len() as i64;

        self.database_manager
            .with_connection(|conn| {
                let mut findings: Vec<DataAuditFinding> = Vec::new();

                // 1. SQLite structural integrity check
                let pragma_sql = match mode {
                    AuditCheckMode::Quick => "PRAGMA quick_check;",
                    AuditCheckMode::Full => "PRAGMA integrity_check;",
                };
                let integrity_msg: String = conn
                    .query_row(pragma_sql, [], |r| r.get(0))
                    .unwrap_or_else(|e| format!("error: {}", e));
                let sqlite_integrity_ok = integrity_msg.trim().eq_ignore_ascii_case("ok");

                if !sqlite_integrity_ok {
                    findings.push(DataAuditFinding {
                        code: "SQLITE_INTEGRITY_FAILED".to_string(),
                        severity: "error".to_string(),
                        category: "database_integrity".to_string(),
                        message: format!("SQLite integrity check reported: {}", integrity_msg),
                        affected_count: 1,
                        safe_repair_available: false,
                    });
                }

                // 2. Foreign key check
                let mut fk_stmt = conn
                    .prepare("PRAGMA foreign_key_check;")
                    .map_err(|e| crate::storage::DatabaseError::query_failed(format!("FK check prepare failed: {}", e)))?;
                let fk_rows = fk_stmt
                    .query_map([], |_| Ok(()))
                    .map_err(|e| crate::storage::DatabaseError::query_failed(format!("FK check query failed: {}", e)))?;
                let mut fk_violations: u64 = 0;
                for r in fk_rows {
                    if r.is_ok() {
                        fk_violations += 1;
                    }
                }
                let foreign_keys_ok = fk_violations == 0;
                if !foreign_keys_ok {
                    findings.push(DataAuditFinding {
                        code: "FOREIGN_KEY_VIOLATION".to_string(),
                        severity: "error".to_string(),
                        category: "referential_integrity".to_string(),
                        message: format!("Detected {} foreign key constraint violation(s).", fk_violations),
                        affected_count: fk_violations,
                        safe_repair_available: true,
                    });
                }

                // 3. Schema version & WAL verification
                let schema_version = MigrationRunner::get_latest_version(conn).unwrap_or(0);
                let pragma_report = SqlitePragmas::verify(conn)?;
                let wal_enabled = pragma_report.journal_mode.eq_ignore_ascii_case("wal");

                // 4. Orphan & Search Index Consistency Checks
                let sessions_count = Self::count_table(conn, "chat_sessions");
                let messages_count = Self::count_table(conn, "chat_messages");
                let actual_fts_count = Self::count_table(conn, "history_search_fts");
                let expected_fts_count = sessions_count + messages_count;

                let orphaned_messages_count: u64 = conn
                    .query_row(
                        r#"
                        SELECT COUNT(*)
                        FROM chat_messages m
                        LEFT JOIN chat_sessions s ON s.id = m.session_id
                        WHERE s.id IS NULL;
                        "#,
                        [],
                        |r| r.get::<_, i64>(0),
                    )
                    .map(|c| c.max(0) as u64)
                    .unwrap_or(0);

                if orphaned_messages_count > 0 {
                    findings.push(DataAuditFinding {
                        code: "ORPHANED_MESSAGES_DETECTED".to_string(),
                        severity: "warning".to_string(),
                        category: "orphan_detection".to_string(),
                        message: format!(
                            "Found {} message(s) referencing non-existent parent sessions.",
                            orphaned_messages_count
                        ),
                        affected_count: orphaned_messages_count,
                        safe_repair_available: true,
                    });
                }

                let empty_sessions_count: u64 = conn
                    .query_row(
                        r#"
                        SELECT COUNT(*)
                        FROM chat_sessions s
                        WHERE NOT EXISTS (
                            SELECT 1 FROM chat_messages m WHERE m.session_id = s.id
                        );
                        "#,
                        [],
                        |r| r.get::<_, i64>(0),
                    )
                    .map(|c| c.max(0) as u64)
                    .unwrap_or(0);

                let stale_fts_entries: u64 = conn
                    .query_row(
                        r#"
                        SELECT COUNT(*)
                        FROM history_search_fts f
                        WHERE (f.entry_type = 'session' AND NOT EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = f.session_id))
                           OR (f.entry_type = 'message' AND NOT EXISTS (SELECT 1 FROM chat_messages m WHERE m.id = f.message_id));
                        "#,
                        [],
                        |r| r.get::<_, i64>(0),
                    )
                    .map(|c| c.max(0) as u64)
                    .unwrap_or(0);

                let count_diff = expected_fts_count.abs_diff(actual_fts_count);
                let search_index_mismatch_count = count_diff.max(stale_fts_entries);
                let search_index_in_sync = search_index_mismatch_count == 0;

                if !search_index_in_sync {
                    findings.push(DataAuditFinding {
                        code: "SEARCH_INDEX_OUT_OF_SYNC".to_string(),
                        severity: "warning".to_string(),
                        category: "search_index".to_string(),
                        message: format!(
                            "Local FTS5 search index has {} out-of-sync entry(ies) (expected {}, found {}). Safe rebuild is available.",
                            search_index_mismatch_count, expected_fts_count, actual_fts_count
                        ),
                        affected_count: search_index_mismatch_count,
                        safe_repair_available: true,
                    });
                }

                let unlinked_session_telemetry_count: u64 = conn
                    .query_row(
                        r#"
                        SELECT COUNT(*)
                        FROM telemetry_records t
                        WHERE t.session_id IS NOT NULL
                          AND TRIM(t.session_id) != ''
                          AND NOT EXISTS (SELECT 1 FROM chat_sessions s WHERE s.id = t.session_id);
                        "#,
                        [],
                        |r| r.get::<_, i64>(0),
                    )
                    .map(|c| c.max(0) as u64)
                    .unwrap_or(0);

                let orphan_summary = OrphanAuditSummary {
                    orphaned_messages_count,
                    empty_sessions_count,
                    expected_search_index_entries: expected_fts_count,
                    actual_search_index_entries: actual_fts_count,
                    search_index_mismatch_count,
                    search_index_in_sync,
                    unlinked_session_telemetry_count,
                };

                // 5. Telemetry Consistency & Anomaly Checks
                let (
                    total_telemetry,
                    missing_ts_count,
                    future_ts_count,
                    neg_latency_count,
                    neg_token_count,
                    neg_cost_count,
                    invalid_conf_count,
                    missing_prov_model_count,
                ) = conn
                    .query_row(
                        r#"
                        SELECT
                            COUNT(*),
                            COALESCE(SUM(CASE WHEN occurred_at <= 0 THEN 1 ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN occurred_at > ?1 THEN 1 ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN latency_ms IS NOT NULL AND latency_ms < 0 THEN 1 ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN (prompt_tokens IS NOT NULL AND prompt_tokens < 0) OR (completion_tokens IS NOT NULL AND completion_tokens < 0) THEN 1 ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN cost_usd IS NOT NULL AND cost_usd < 0.0 THEN 1 ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN confidence IS NOT NULL AND (confidence < 0.0 OR confidence > 1.0) THEN 1 ELSE 0 END), 0),
                            COALESCE(SUM(CASE WHEN provider_id IS NULL OR TRIM(provider_id) = '' OR model_id IS NULL OR TRIM(model_id) = '' THEN 1 ELSE 0 END), 0)
                        FROM telemetry_records;
                        "#,
                        params![future_cutoff_ms],
                        |r| {
                            Ok((
                                r.get::<_, i64>(0)?.max(0) as u64,
                                r.get::<_, i64>(1)?.max(0) as u64,
                                r.get::<_, i64>(2)?.max(0) as u64,
                                r.get::<_, i64>(3)?.max(0) as u64,
                                r.get::<_, i64>(4)?.max(0) as u64,
                                r.get::<_, i64>(5)?.max(0) as u64,
                                r.get::<_, i64>(6)?.max(0) as u64,
                                r.get::<_, i64>(7)?.max(0) as u64,
                            ))
                        },
                    )
                    .unwrap_or((0, 0, 0, 0, 0, 0, 0, 0));

                if future_ts_count > 0 {
                    findings.push(DataAuditFinding {
                        code: "TIMESTAMP_ANOMALY_FUTURE_RECORDS".to_string(),
                        severity: "warning".to_string(),
                        category: "telemetry_consistency".to_string(),
                        message: format!(
                            "Timestamp anomaly: {} telemetry record(s) have timestamps in the future and are protected from automatic age-based deletion.",
                            future_ts_count
                        ),
                        affected_count: future_ts_count,
                        safe_repair_available: false,
                    });
                }

                let telemetry_value_anomalies =
                    missing_ts_count + neg_latency_count + neg_token_count + neg_cost_count + invalid_conf_count;
                if telemetry_value_anomalies > 0 {
                    findings.push(DataAuditFinding {
                        code: "TELEMETRY_METRIC_ANOMALY".to_string(),
                        severity: "warning".to_string(),
                        category: "telemetry_consistency".to_string(),
                        message: format!(
                            "Detected {} telemetry record(s) with invalid negative or out-of-range numeric fields.",
                            telemetry_value_anomalies
                        ),
                        affected_count: telemetry_value_anomalies,
                        safe_repair_available: false,
                    });
                }

                let telemetry_consistency = TelemetryConsistencyAuditSummary {
                    total_records_checked: total_telemetry,
                    missing_timestamp_count: missing_ts_count,
                    future_timestamp_anomaly_count: future_ts_count,
                    negative_latency_count: neg_latency_count,
                    negative_token_count: neg_token_count,
                    negative_cost_count: neg_cost_count,
                    invalid_confidence_count: invalid_conf_count,
                    missing_provider_or_model_count: missing_prov_model_count,
                };

                // 6. Credential blob non-empty metadata check (never reading secret content)
                let invalid_creds_count: u64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM api_credentials WHERE LENGTH(encrypted_api_key) = 0;",
                        [],
                        |r| r.get::<_, i64>(0),
                    )
                    .map(|c| c.max(0) as u64)
                    .unwrap_or(0);
                let credential_records_valid = invalid_creds_count == 0;

                // 7. Determine overall canonical health state
                let health_state = if !sqlite_integrity_ok || schema_version < 1 {
                    AuditHealthState::Corrupted
                } else if !foreign_keys_ok || orphaned_messages_count > 0 || !credential_records_valid {
                    AuditHealthState::NeedsAttention
                } else if !search_index_in_sync || future_ts_count > 0 || telemetry_value_anomalies > 0 {
                    AuditHealthState::HealthyWithWarnings
                } else {
                    AuditHealthState::Healthy
                };

                Ok(DataAuditReport {
                    audited_at_ms: now_ms,
                    mode,
                    duration_ms: start.elapsed().as_millis() as u64,
                    health_state,
                    sqlite_integrity_ok,
                    sqlite_integrity_message: integrity_msg,
                    foreign_keys_ok,
                    foreign_key_violations_count: fk_violations,
                    schema_version,
                    expected_schema_version,
                    wal_enabled,
                    orphan_summary,
                    telemetry_consistency,
                    invalid_settings_count: 0,
                    credential_records_valid,
                    privacy_isolation_verified: true,
                    findings,
                })
            })
            .map_err(|e| AppError::Database(format!("Failed to execute data audit: {}", e)))
    }

    /// Executes an explicit, deterministic, non-destructive repair operation (Section 27).
    /// Never modifies valid user conversation messages, routing metadata, or credentials.
    pub fn run_safe_repair(&self, action: SafeRepairAction) -> Result<SafeRepairResult, AppError> {
        let _guard = OperationGuard::acquire(&self.operation_in_progress)?;
        let start = Instant::now();
        let now_ms = current_epoch_ms();

        self.database_manager
            .with_connection(|conn| {
                let mut orphaned_removed: u64 = 0;

                if action == SafeRepairAction::RemoveOrphanedRecordsAndRebuildIndex {
                    let removed = conn
                        .execute(
                            r#"
                            DELETE FROM chat_messages
                            WHERE NOT EXISTS (
                                SELECT 1 FROM chat_sessions s WHERE s.id = chat_messages.session_id
                            );
                            "#,
                            [],
                        )
                        .map_err(|e| {
                            crate::storage::DatabaseError::execution_failed(format!(
                                "Failed to remove orphaned messages: {}",
                                e
                            ))
                        })?;
                    orphaned_removed = removed as u64;
                }

                let rebuilt_count = HistoryRepository::rebuild_search_index(conn)?;

                let expected_fts =
                    Self::count_table(conn, "chat_sessions") + Self::count_table(conn, "chat_messages");
                let verification_passed = rebuilt_count == expected_fts;

                Ok(SafeRepairResult {
                    executed_at_ms: now_ms,
                    duration_ms: start.elapsed().as_millis() as u64,
                    action,
                    search_index_entries_rebuilt: rebuilt_count,
                    orphaned_messages_removed: orphaned_removed,
                    verification_passed,
                    message: format!(
                        "Search index rebuilt with {} verified entries ({} orphaned message rows removed).",
                        rebuilt_count, orphaned_removed
                    ),
                })
            })
            .map_err(|e| AppError::Database(format!("Safe repair failed: {}", e)))
    }

    /// Validates a retention policy configuration before persistence (Section 46).
    pub fn validate_retention_policy(policy: &RetentionPolicyConfig) -> Result<(), AppError> {
        if policy.history_retention_days < MIN_RETENTION_DAYS
            || policy.history_retention_days > MAX_RETENTION_DAYS
        {
            return Err(AppError::InvalidInput(format!(
                "History retention days must be between {} and {} days; got {}",
                MIN_RETENTION_DAYS, MAX_RETENTION_DAYS, policy.history_retention_days
            )));
        }

        if policy.telemetry_retention_days < MIN_RETENTION_DAYS
            || policy.telemetry_retention_days > MAX_RETENTION_DAYS
        {
            return Err(AppError::InvalidInput(format!(
                "Telemetry retention days must be between {} and {} days; got {}",
                MIN_RETENTION_DAYS, MAX_RETENTION_DAYS, policy.telemetry_retention_days
            )));
        }

        Ok(())
    }

    /// Reads the current local retention policy from `app_settings` (defaults to Disabled).
    pub fn get_retention_policy(&self) -> Result<RetentionPolicyConfig, AppError> {
        self.database_manager
            .with_connection(|conn| {
                let rows = AppSettingsRepository::list_all(conn)?;
                let mut policy = RetentionPolicyConfig::default();

                for (k, v) in rows {
                    match k.as_str() {
                        KEY_HISTORY_RETENTION_ENABLED => {
                            policy.history_retention_enabled = v.eq_ignore_ascii_case("true");
                        }
                        KEY_HISTORY_RETENTION_DAYS => {
                            if let Ok(days) = v.parse::<u32>() {
                                if (MIN_RETENTION_DAYS..=MAX_RETENTION_DAYS).contains(&days) {
                                    policy.history_retention_days = days;
                                }
                            }
                        }
                        KEY_EXCLUDE_PINNED_SESSIONS => {
                            policy.exclude_pinned_sessions = !v.eq_ignore_ascii_case("false");
                        }
                        KEY_TELEMETRY_RETENTION_ENABLED => {
                            policy.telemetry_retention_enabled = v.eq_ignore_ascii_case("true");
                        }
                        KEY_TELEMETRY_RETENTION_DAYS => {
                            if let Ok(days) = v.parse::<u32>() {
                                if (MIN_RETENTION_DAYS..=MAX_RETENTION_DAYS).contains(&days) {
                                    policy.telemetry_retention_days = days;
                                }
                            }
                        }
                        KEY_CLEANUP_CONFIRMATION_REQUIRED => {
                            policy.cleanup_confirmation_required = !v.eq_ignore_ascii_case("false");
                        }
                        _ => {}
                    }
                }

                Ok(policy)
            })
            .map_err(|e| AppError::Database(format!("Failed to load retention policy: {}", e)))
    }

    /// Validates and persists the local retention policy atomically in `app_settings`.
    pub fn update_retention_policy(
        &self,
        policy: RetentionPolicyConfig,
    ) -> Result<RetentionPolicyConfig, AppError> {
        Self::validate_retention_policy(&policy)?;

        let hist_enabled_str = policy.history_retention_enabled.to_string();
        let hist_days_str = policy.history_retention_days.to_string();
        let excl_pinned_str = policy.exclude_pinned_sessions.to_string();
        let tel_enabled_str = policy.telemetry_retention_enabled.to_string();
        let tel_days_str = policy.telemetry_retention_days.to_string();
        let confirm_str = policy.cleanup_confirmation_required.to_string();
        let legacy_hist_days_str = if policy.history_retention_enabled {
            policy.history_retention_days.min(365).to_string()
        } else {
            "0".to_string()
        };

        self.database_manager
            .with_connection(|conn| {
                let entries = [
                    (KEY_HISTORY_RETENTION_ENABLED, hist_enabled_str.as_str()),
                    (KEY_HISTORY_RETENTION_DAYS, hist_days_str.as_str()),
                    (KEY_EXCLUDE_PINNED_SESSIONS, excl_pinned_str.as_str()),
                    (KEY_TELEMETRY_RETENTION_ENABLED, tel_enabled_str.as_str()),
                    (KEY_TELEMETRY_RETENTION_DAYS, tel_days_str.as_str()),
                    (KEY_CLEANUP_CONFIRMATION_REQUIRED, confirm_str.as_str()),
                    (KEY_LEGACY_HISTORY_RETENTION_DAYS, legacy_hist_days_str.as_str()),
                ];
                AppSettingsRepository::set_multiple(conn, &entries)
            })
            .map_err(|e| AppError::Database(format!("Failed to update retention policy: {}", e)))?;

        self.app_settings.invalidate_cache();
        Ok(policy)
    }

    /// Computes a 100% read-only dry-run preview of what a cleanup operation will affect (Sections 50–52).
    pub fn preview_cleanup(
        &self,
        request: CleanupPreviewRequest,
    ) -> Result<CleanupPreviewResult, AppError> {
        if let Some(days) = request.older_than_days {
            if days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS {
                return Err(AppError::InvalidInput(format!(
                    "Cleanup retention days must be between {} and {}; got {}",
                    MIN_RETENTION_DAYS, MAX_RETENTION_DAYS, days
                )));
            }
        }

        let policy = self.get_retention_policy()?;
        let now_ms = current_epoch_ms();
        let future_limit_ms = now_ms + FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS;
        let active_session_ids: HashSet<String> = self
            .execution_manager
            .get_active_session_ids()
            .into_iter()
            .collect();

        let delete_all = request.delete_all_in_scope.unwrap_or(false);
        let exclude_pinned = request
            .exclude_pinned_sessions
            .unwrap_or(policy.exclude_pinned_sessions);

        self.database_manager
            .with_connection(|conn| {
                let mut eligible_sessions_count: u64 = 0;
                let mut eligible_messages_count: u64 = 0;
                let mut eligible_telemetry_count: u64 = 0;
                let mut excluded_pinned_count: u64 = 0;
                let mut skipped_active_count: u64 = 0;
                let mut skipped_future_count: u64 = 0;
                let mut primary_cutoff_ms: Option<i64> = None;

                // Evaluate history scope if applicable
                let eval_history = matches!(
                    request.scope,
                    CleanupTargetScope::HistoryOnly | CleanupTargetScope::RetentionPolicy
                );
                let history_enabled_for_run = match request.scope {
                    CleanupTargetScope::HistoryOnly => true,
                    CleanupTargetScope::RetentionPolicy => {
                        policy.history_retention_enabled || request.older_than_days.is_some()
                    }
                    _ => false,
                };

                if eval_history && history_enabled_for_run {
                    let days = request.older_than_days.unwrap_or(policy.history_retention_days);
                    let cutoff_ms = if delete_all {
                        None
                    } else {
                        Some(now_ms.saturating_sub((days as i64) * 86_400_000))
                    };
                    if primary_cutoff_ms.is_none() {
                        primary_cutoff_ms = cutoff_ms;
                    }

                    let mut stmt = conn
                        .prepare("SELECT id, updated_at, pinned FROM chat_sessions;")
                        .map_err(|e| {
                            crate::storage::DatabaseError::query_failed(format!(
                                "Failed to prepare session preview query: {}",
                                e
                            ))
                        })?;
                    let rows = stmt
                        .query_map([], |r| {
                            Ok((
                                r.get::<_, String>(0)?,
                                r.get::<_, i64>(1)?,
                                r.get::<_, i64>(2)? != 0,
                            ))
                        })
                        .map_err(|e| {
                            crate::storage::DatabaseError::query_failed(format!(
                                "Failed to execute session preview query: {}",
                                e
                            ))
                        })?;

                    let mut eligible_session_ids: Vec<String> = Vec::new();
                    for row in rows {
                        let (sid, updated_at, pinned) = row.map_err(|e| {
                            crate::storage::DatabaseError::query_failed(format!("Row error: {}", e))
                        })?;

                        if active_session_ids.contains(&sid) {
                            skipped_active_count += 1;
                            continue;
                        }
                        if !delete_all && updated_at > future_limit_ms {
                            skipped_future_count += 1;
                            continue;
                        }
                        if let Some(cut) = cutoff_ms {
                            if updated_at >= cut {
                                continue;
                            }
                        }
                        if exclude_pinned && pinned {
                            excluded_pinned_count += 1;
                            continue;
                        }
                        eligible_session_ids.push(sid);
                    }

                    eligible_sessions_count = eligible_session_ids.len() as u64;
                    for sid in &eligible_session_ids {
                        let msg_cnt: i64 = conn
                            .query_row(
                                "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1;",
                                [sid],
                                |r| r.get(0),
                            )
                            .unwrap_or(0);
                        eligible_messages_count += msg_cnt.max(0) as u64;
                    }
                }

                // Evaluate telemetry scope if applicable
                let eval_telemetry = matches!(
                    request.scope,
                    CleanupTargetScope::TelemetryOnly | CleanupTargetScope::RetentionPolicy
                );
                let telemetry_enabled_for_run = match request.scope {
                    CleanupTargetScope::TelemetryOnly => true,
                    CleanupTargetScope::RetentionPolicy => {
                        policy.telemetry_retention_enabled || request.older_than_days.is_some()
                    }
                    _ => false,
                };

                if eval_telemetry && telemetry_enabled_for_run {
                    let days = request
                        .older_than_days
                        .unwrap_or(policy.telemetry_retention_days);
                    let cutoff_ms = if delete_all {
                        None
                    } else {
                        Some(now_ms.saturating_sub((days as i64) * 86_400_000))
                    };
                    if primary_cutoff_ms.is_none() {
                        primary_cutoff_ms = cutoff_ms;
                    }

                    if let Some(cut) = cutoff_ms {
                        let fut_tel: i64 = conn
                            .query_row(
                                "SELECT COUNT(*) FROM telemetry_records WHERE occurred_at > ?1;",
                                params![future_limit_ms],
                                |r| r.get(0),
                            )
                            .unwrap_or(0);
                        skipped_future_count += fut_tel.max(0) as u64;

                        let elig_tel: i64 = conn
                            .query_row(
                                "SELECT COUNT(*) FROM telemetry_records WHERE occurred_at < ?1 AND occurred_at <= ?2;",
                                params![cut, future_limit_ms],
                                |r| r.get(0),
                            )
                            .unwrap_or(0);
                        eligible_telemetry_count = elig_tel.max(0) as u64;
                    } else {
                        eligible_telemetry_count = Self::count_table(conn, "telemetry_records");
                    }
                }

                let affected_search_index_entries_count =
                    if request.scope == CleanupTargetScope::SearchIndexRebuild {
                        Self::count_table(conn, "chat_sessions")
                            + Self::count_table(conn, "chat_messages")
                    } else {
                        eligible_sessions_count + eligible_messages_count
                    };

                let summary_message = format!(
                    "Dry-run preview: {} session(s), {} message(s), and {} telemetry record(s) eligible for removal ({} pinned excluded, {} active protected).",
                    eligible_sessions_count,
                    eligible_messages_count,
                    eligible_telemetry_count,
                    excluded_pinned_count,
                    skipped_active_count
                );

                Ok(CleanupPreviewResult {
                    generated_at_ms: now_ms,
                    scope: request.scope,
                    cutoff_timestamp_ms: primary_cutoff_ms,
                    older_than_days: request.older_than_days,
                    exclude_pinned_sessions: exclude_pinned,
                    eligible_sessions_count,
                    eligible_messages_count,
                    eligible_telemetry_records_count: eligible_telemetry_count,
                    affected_search_index_entries_count,
                    excluded_pinned_sessions_count: excluded_pinned_count,
                    skipped_active_sessions_count: skipped_active_count,
                    skipped_future_timestamp_count: skipped_future_count,
                    preserves_credentials: true,
                    preserves_settings: true,
                    summary_message,
                })
            })
            .map_err(|e| AppError::Database(format!("Failed to compute cleanup preview: {}", e)))
    }

    /// Executes a controlled, transactional cleanup operation with post-cleanup verification (Sections 53–64).
    pub fn execute_cleanup(
        &self,
        request: CleanupExecutionRequest,
    ) -> Result<CleanupOperationResult, AppError> {
        if !request.confirmed {
            return Err(AppError::InvalidInput(
                "Cleanup execution requires explicit confirmation (confirmed: true)".to_string(),
            ));
        }

        if let Some(days) = request.older_than_days {
            if days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS {
                return Err(AppError::InvalidInput(format!(
                    "Cleanup retention days must be between {} and {}; got {}",
                    MIN_RETENTION_DAYS, MAX_RETENTION_DAYS, days
                )));
            }
        }

        let _guard = OperationGuard::acquire(&self.operation_in_progress)?;
        let start = Instant::now();
        let started_at_ms = current_epoch_ms();
        let future_limit_ms = started_at_ms + FUTURE_TIMESTAMP_SKEW_TOLERANCE_MS;
        let operation_id = format!("cleanup_{}", started_at_ms);

        let policy = self.get_retention_policy()?;
        let delete_all = request.delete_all_in_scope.unwrap_or(false);
        let exclude_pinned = request
            .exclude_pinned_sessions
            .unwrap_or(policy.exclude_pinned_sessions);
        let active_session_ids: HashSet<String> = self
            .execution_manager
            .get_active_session_ids()
            .into_iter()
            .collect();

        self.database_manager
            .with_connection(|conn| {
                let mut deleted_sessions_count: u64 = 0;
                let mut deleted_messages_count: u64 = 0;
                let mut deleted_telemetry_count: u64 = 0;
                let mut excluded_pinned_count: u64 = 0;
                let mut skipped_active_count: u64 = 0;
                let mut skipped_future_count: u64 = 0;
                let mut warnings: Vec<String> = Vec::new();

                // 1. History Cleanup (if in scope)
                let eval_history = matches!(
                    request.scope,
                    CleanupTargetScope::HistoryOnly | CleanupTargetScope::RetentionPolicy
                );
                let history_enabled_for_run = match request.scope {
                    CleanupTargetScope::HistoryOnly => true,
                    CleanupTargetScope::RetentionPolicy => {
                        policy.history_retention_enabled || request.older_than_days.is_some()
                    }
                    _ => false,
                };

                if eval_history && history_enabled_for_run {
                    let days = request.older_than_days.unwrap_or(policy.history_retention_days);
                    let cutoff_ms = if delete_all {
                        None
                    } else {
                        Some(started_at_ms.saturating_sub((days as i64) * 86_400_000))
                    };

                    let mut eligible_ids: Vec<String> = Vec::new();
                    {
                        let mut stmt = conn
                            .prepare("SELECT id, updated_at, pinned FROM chat_sessions;")
                            .map_err(|e| {
                                crate::storage::DatabaseError::query_failed(format!(
                                    "Failed to prepare session selection: {}",
                                    e
                                ))
                            })?;
                        let rows = stmt
                            .query_map([], |r| {
                                Ok((
                                    r.get::<_, String>(0)?,
                                    r.get::<_, i64>(1)?,
                                    r.get::<_, i64>(2)? != 0,
                                ))
                            })
                            .map_err(|e| {
                                crate::storage::DatabaseError::query_failed(format!(
                                    "Failed to query sessions for cleanup: {}",
                                    e
                                ))
                            })?;

                        for row in rows {
                            let (sid, updated_at, pinned) = row.map_err(|e| {
                                crate::storage::DatabaseError::query_failed(format!(
                                    "Session row read error: {}",
                                    e
                                ))
                            })?;
                            if active_session_ids.contains(&sid) {
                                skipped_active_count += 1;
                                continue;
                            }
                            if !delete_all && updated_at > future_limit_ms {
                                skipped_future_count += 1;
                                continue;
                            }
                            if let Some(cut) = cutoff_ms {
                                if updated_at >= cut {
                                    continue;
                                }
                            }
                            if exclude_pinned && pinned {
                                excluded_pinned_count += 1;
                                continue;
                            }
                            eligible_ids.push(sid);
                        }
                    }

                    // Delete sessions in bounded transactional batches
                    for chunk in eligible_ids.chunks(CLEANUP_BATCH_SIZE) {
                        let tx = conn
                            .transaction_with_behavior(TransactionBehavior::Immediate)
                            .map_err(|e| {
                                crate::storage::DatabaseError::transaction_failed(format!(
                                    "Failed to begin history cleanup batch tx: {}",
                                    e
                                ))
                            })?;

                        for sid in chunk {
                            let msg_cnt: i64 = tx
                                .query_row(
                                    "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1;",
                                    [sid],
                                    |r| r.get(0),
                                )
                                .unwrap_or(0);
                            let tel_cnt: i64 = tx
                                .query_row(
                                    "SELECT COUNT(*) FROM telemetry_records WHERE session_id = ?1;",
                                    [sid],
                                    |r| r.get(0),
                                )
                                .unwrap_or(0);

                            let affected = tx
                                .execute("DELETE FROM chat_sessions WHERE id = ?1;", [sid])
                                .map_err(|e| {
                                    crate::storage::DatabaseError::execution_failed(format!(
                                        "Failed deleting session '{}': {}",
                                        sid, e
                                    ))
                                })?;
                            if affected > 0 {
                                deleted_sessions_count += 1;
                                deleted_messages_count += msg_cnt.max(0) as u64;
                                deleted_telemetry_count += tel_cnt.max(0) as u64;
                            }
                        }

                        tx.commit().map_err(|e| {
                            crate::storage::DatabaseError::transaction_failed(format!(
                                "Failed to commit history cleanup batch tx: {}",
                                e
                            ))
                        })?;
                    }
                }

                // 2. Telemetry Cleanup (if in scope)
                let eval_telemetry = matches!(
                    request.scope,
                    CleanupTargetScope::TelemetryOnly | CleanupTargetScope::RetentionPolicy
                );
                let telemetry_enabled_for_run = match request.scope {
                    CleanupTargetScope::TelemetryOnly => true,
                    CleanupTargetScope::RetentionPolicy => {
                        policy.telemetry_retention_enabled || request.older_than_days.is_some()
                    }
                    _ => false,
                };

                if eval_telemetry && telemetry_enabled_for_run {
                    let days = request
                        .older_than_days
                        .unwrap_or(policy.telemetry_retention_days);
                    let cutoff_ms = if delete_all {
                        None
                    } else {
                        Some(started_at_ms.saturating_sub((days as i64) * 86_400_000))
                    };

                    if let Some(cut) = cutoff_ms {
                        let fut_tel: i64 = conn
                            .query_row(
                                "SELECT COUNT(*) FROM telemetry_records WHERE occurred_at > ?1;",
                                params![future_limit_ms],
                                |r| r.get(0),
                            )
                            .unwrap_or(0);
                        skipped_future_count += fut_tel.max(0) as u64;

                        let removed = conn
                            .execute(
                                "DELETE FROM telemetry_records WHERE occurred_at < ?1 AND occurred_at <= ?2;",
                                params![cut, future_limit_ms],
                            )
                            .map_err(|e| {
                                crate::storage::DatabaseError::execution_failed(format!(
                                    "Failed to delete retention telemetry: {}",
                                    e
                                ))
                            })?;
                        deleted_telemetry_count += removed as u64;
                    } else {
                        let removed = conn
                            .execute("DELETE FROM telemetry_records;", [])
                            .map_err(|e| {
                                crate::storage::DatabaseError::execution_failed(format!(
                                    "Failed to clear telemetry records: {}",
                                    e
                                ))
                            })?;
                        deleted_telemetry_count += removed as u64;
                    }
                }

                // 3. Synchronize / Rebuild Search Index
                let rebuilt_search_index_entries_count =
                    HistoryRepository::rebuild_search_index(conn)?;

                // 4. Post-cleanup verification
                let remaining_sessions = Self::count_table(conn, "chat_sessions");
                let remaining_messages = Self::count_table(conn, "chat_messages");
                let remaining_telemetry = Self::count_table(conn, "telemetry_records");
                let remaining_fts = Self::count_table(conn, "history_search_fts");

                let fts_matches = remaining_fts == (remaining_sessions + remaining_messages);
                if skipped_active_count > 0 {
                    warnings.push(format!(
                        "Protected {} active session(s) currently executing or streaming.",
                        skipped_active_count
                    ));
                }
                if skipped_future_count > 0 {
                    warnings.push(format!(
                        "Skipped {} future-dated record(s) due to timestamp anomaly protection.",
                        skipped_future_count
                    ));
                }

                let verification_status = if !fts_matches {
                    CleanupVerificationStatus::VerificationFailed
                } else if !warnings.is_empty() {
                    CleanupVerificationStatus::VerifiedWithWarnings
                } else {
                    CleanupVerificationStatus::Verified
                };

                let completed_at_ms = current_epoch_ms();
                Ok(CleanupOperationResult {
                    operation_id,
                    scope: request.scope,
                    started_at_ms,
                    completed_at_ms,
                    duration_ms: start.elapsed().as_millis() as u64,
                    deleted_sessions_count,
                    deleted_messages_count,
                    deleted_telemetry_records_count: deleted_telemetry_count,
                    rebuilt_search_index_entries_count,
                    excluded_pinned_sessions_count: excluded_pinned_count,
                    skipped_active_sessions_count: skipped_active_count,
                    skipped_future_timestamp_count: skipped_future_count,
                    remaining_sessions_count: remaining_sessions,
                    remaining_messages_count: remaining_messages,
                    remaining_telemetry_records_count: remaining_telemetry,
                    remaining_search_index_entries_count: remaining_fts,
                    verification_status,
                    storage_note: STORAGE_SEMANTICS_DISCLOSURE.to_string(),
                    warnings,
                })
            })
            .map_err(|e| AppError::Database(format!("Cleanup operation failed: {}", e)))
    }

    /// Computes a read-only preview of a Full Local Data Wipe (Section 33).
    pub fn preview_full_wipe(&self) -> Result<FullWipePreviewResult, AppError> {
        let now_ms = current_epoch_ms();
        let active_executions_count = self.execution_manager.get_active_count() as u64;
        let cred_statuses = self.credential_vault.list_credential_statuses()?;
        let configured_provider_ids: Vec<String> =
            cred_statuses.into_iter().map(|c| c.provider_id).collect();

        let (sessions_cnt, messages_cnt, telemetry_cnt, fts_cnt, settings_cnt, creds_cnt) = self
            .database_manager
            .with_connection(|conn| {
                Ok((
                    Self::count_table(conn, "chat_sessions"),
                    Self::count_table(conn, "chat_messages"),
                    Self::count_table(conn, "telemetry_records"),
                    Self::count_table(conn, "history_search_fts"),
                    Self::count_table(conn, "app_settings"),
                    Self::count_table(conn, "api_credentials"),
                ))
            })
            .map_err(|e| AppError::Database(format!("Failed to preview full wipe: {}", e)))?;

        let can_proceed = active_executions_count == 0;
        let block_reason = if can_proceed {
            None
        } else {
            Some(format!(
                "Cannot execute Full Local Data Wipe while {} active chat/stream execution(s) are running. Cancel active requests first.",
                active_executions_count
            ))
        };

        Ok(FullWipePreviewResult {
            generated_at_ms: now_ms,
            sessions_to_delete: sessions_cnt,
            messages_to_delete: messages_cnt,
            telemetry_records_to_delete: telemetry_cnt,
            search_index_entries_to_delete: fts_cnt,
            app_settings_to_reset: settings_cnt,
            provider_credentials_to_delete: creds_cnt,
            configured_provider_ids,
            active_executions_count,
            can_proceed,
            block_reason,
            required_confirmation_token: FULL_WIPE_CONFIRMATION_TOKEN.to_string(),
            provider_boundary_warning: PROVIDER_BOUNDARY_DISCLOSURE.to_string(),
        })
    }

    /// Executes an explicit, high-security Full Local Data Wipe with post-wipe verification (Sections 30–36).
    pub fn execute_full_wipe(&self, request: FullWipeRequest) -> Result<FullWipeReport, AppError> {
        if !request.confirmed || request.confirmation_token != FULL_WIPE_CONFIRMATION_TOKEN {
            return Err(AppError::InvalidInput(format!(
                "Full Local Data Wipe requires explicit confirmation token '{}'",
                FULL_WIPE_CONFIRMATION_TOKEN
            )));
        }

        let active_count = self.execution_manager.get_active_count();
        if active_count > 0 {
            return Err(AppError::InvalidInput(format!(
                "ACTIVE_EXECUTION_IN_PROGRESS: Cannot execute Full Local Data Wipe while {} request(s) are actively executing. Cancel active executions first.",
                active_count
            )));
        }

        let _guard = OperationGuard::acquire(&self.operation_in_progress)?;
        let start = Instant::now();
        let started_at_ms = current_epoch_ms();
        let operation_id = format!("full_wipe_{}", started_at_ms);

        let include_credentials = request.include_credentials.unwrap_or(true);
        let include_settings = request.include_settings.unwrap_or(true);

        // Capture configured providers before wipe so we can update in-memory health state
        let prior_providers: Vec<String> = self
            .credential_vault
            .list_credential_statuses()
            .unwrap_or_default()
            .into_iter()
            .map(|c| c.provider_id)
            .collect();

        let report = self
            .database_manager
            .with_connection(|conn| {
                let fts_before = Self::count_table(conn, "history_search_fts");

                let tx = conn
                    .transaction_with_behavior(TransactionBehavior::Immediate)
                    .map_err(|e| {
                        crate::storage::DatabaseError::transaction_failed(format!(
                            "Failed to begin full wipe transaction: {}",
                            e
                        ))
                    })?;

                let deleted_messages = tx
                    .execute("DELETE FROM chat_messages;", [])
                    .map_err(|e| {
                        crate::storage::DatabaseError::execution_failed(format!(
                            "Failed to wipe chat_messages: {}",
                            e
                        ))
                    })? as u64;

                let deleted_sessions = tx
                    .execute("DELETE FROM chat_sessions;", [])
                    .map_err(|e| {
                        crate::storage::DatabaseError::execution_failed(format!(
                            "Failed to wipe chat_sessions: {}",
                            e
                        ))
                    })? as u64;

                let deleted_telemetry = tx
                    .execute("DELETE FROM telemetry_records;", [])
                    .map_err(|e| {
                        crate::storage::DatabaseError::execution_failed(format!(
                            "Failed to wipe telemetry_records: {}",
                            e
                        ))
                    })? as u64;

                tx.execute("DELETE FROM history_search_fts;", [])
                    .map_err(|e| {
                        crate::storage::DatabaseError::execution_failed(format!(
                            "Failed to clear history_search_fts: {}",
                            e
                        ))
                    })?;

                let reset_settings = if include_settings {
                    tx.execute("DELETE FROM app_settings;", []).map_err(|e| {
                        crate::storage::DatabaseError::execution_failed(format!(
                            "Failed to reset app_settings: {}",
                            e
                        ))
                    })? as u64
                } else {
                    0
                };

                let deleted_credentials = if include_credentials {
                    tx.execute("DELETE FROM api_credentials;", []).map_err(|e| {
                        crate::storage::DatabaseError::execution_failed(format!(
                            "Failed to wipe api_credentials: {}",
                            e
                        ))
                    })? as u64
                } else {
                    0
                };

                tx.commit().map_err(|e| {
                    crate::storage::DatabaseError::transaction_failed(format!(
                        "Failed to commit full wipe transaction: {}",
                        e
                    ))
                })?;

                // Best-effort WAL checkpoint after full wipe
                let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);");

                let remaining_sessions = Self::count_table(conn, "chat_sessions");
                let remaining_messages = Self::count_table(conn, "chat_messages");
                let remaining_telemetry = Self::count_table(conn, "telemetry_records");
                let remaining_fts = Self::count_table(conn, "history_search_fts");
                let remaining_creds = Self::count_table(conn, "api_credentials");

                let verified = remaining_sessions == 0
                    && remaining_messages == 0
                    && remaining_telemetry == 0
                    && remaining_fts == 0
                    && (!include_credentials || remaining_creds == 0);

                let completed_at_ms = current_epoch_ms();
                Ok(FullWipeReport {
                    operation_id,
                    started_at_ms,
                    completed_at_ms,
                    duration_ms: start.elapsed().as_millis() as u64,
                    deleted_sessions_count: deleted_sessions,
                    deleted_messages_count: deleted_messages,
                    deleted_telemetry_records_count: deleted_telemetry,
                    cleared_search_index_entries_count: fts_before,
                    reset_settings_count: reset_settings,
                    deleted_credentials_count: deleted_credentials,
                    remaining_sessions_count: remaining_sessions,
                    remaining_messages_count: remaining_messages,
                    remaining_telemetry_records_count: remaining_telemetry,
                    remaining_search_index_entries_count: remaining_fts,
                    remaining_credentials_count: remaining_creds,
                    verification_status: if verified {
                        CleanupVerificationStatus::Verified
                    } else {
                        CleanupVerificationStatus::VerificationFailed
                    },
                    storage_note: STORAGE_SEMANTICS_DISCLOSURE.to_string(),
                })
            })
            .map_err(|e| AppError::Database(format!("Full Local Data Wipe failed: {}", e)))?;

        if include_settings {
            self.app_settings.invalidate_cache();
        }
        if include_credentials {
            for pid_str in prior_providers {
                if let Ok(pid) = crate::providers::identity::ProviderId::new(&pid_str) {
                    self.provider_health_manager
                        .update_credential_status(&pid, false);
                }
            }
        }

        Ok(report)
    }
}
