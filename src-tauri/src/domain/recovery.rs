// ============================================================================
// Nano Route - Disaster Recovery, Backup & Continuity Domain Types
// File: src-tauri/src/domain/recovery.rs
// ============================================================================
// Authoritative domain contracts for Step 53:
// - Local Data Classification & Inventory
// - Backup Types & Manifest Metadata
// - Validation & Integrity Verification
// - Staged Non-Destructive Restore Workflow
// - Rollback & Crash Recovery Safety
// ============================================================================

use serde::{Deserialize, Serialize};

/// Current backup format specification version.
pub const CURRENT_BACKUP_FORMAT_VERSION: u32 = 1;

/// Classification tiers of persistent data (Step 53, Section 6).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RecoveryDataTier {
    /// Chat sessions, messages, irreplaceable user-authored settings.
    Tier1IrreplaceableUser,
    /// DPAPI-protected provider credentials (machine & OS-user bound).
    Tier2SecuritySensitive,
    /// FTS5 search index, caches, derived analytics aggregations.
    Tier3DerivedRebuildable,
    /// Binaries, models, static configuration schemas.
    Tier4ReproducibleStatic,
}

/// Scope of backup creation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupScope {
    /// Full persistent local user database.
    FullDatabase,
    /// Portable application settings and provider preferences (zero secrets).
    ConfigurationOnly,
    /// Temporary safety snapshot taken immediately before risky operations.
    SafetySnapshot,
}

/// Verification status of a backup artifact.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupValidationStatus {
    Unverified,
    Valid,
    Corrupted,
    IncompatibleSchema,
    IncompatibleAppVersion,
    MissingManifest,
}

/// Authoritative metadata manifest accompanying each backup artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub backup_id: String,
    pub backup_format_version: u32,
    pub application_name: String,
    pub application_version: String,
    pub database_schema_version: i64,
    pub backup_scope: BackupScope,
    pub created_at_ms: i64,
    pub artifact_filename: String,
    pub artifact_size_bytes: u64,
    pub sha256_checksum: String,
    pub sessions_count: usize,
    pub messages_count: usize,
    pub telemetry_records_count: usize,
    pub contains_dpapi_blob: bool,
    pub platform: String,
    pub architecture: String,
}

/// Detailed validation report for a backup artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupValidationReport {
    pub status: BackupValidationStatus,
    pub is_valid: bool,
    pub error_message: Option<String>,
    pub manifest: Option<BackupManifest>,
    pub computed_sha256: Option<String>,
    pub expected_sha256: Option<String>,
    pub checksum_matches: bool,
    pub schema_compatible: bool,
    pub requires_migration: bool,
}

/// Request to create a user-initiated or automated backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupRequest {
    pub scope: BackupScope,
    pub note: Option<String>,
}

/// Result of creating a backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBackupResult {
    pub success: bool,
    pub backup_id: String,
    pub backup_path: String,
    pub manifest: BackupManifest,
    pub validation: BackupValidationReport,
}

/// Pre-flight preview before restoring a backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestorePreview {
    pub can_proceed: bool,
    pub rejection_reason: Option<String>,
    pub manifest: BackupManifest,
    pub current_app_version: String,
    pub current_schema_version: i64,
    pub target_schema_version: i64,
    pub requires_migration: bool,
    pub safety_snapshot_path: Option<String>,
    pub warning_notice: String,
}

/// Request to restore from an existing backup artifact.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupRequest {
    pub backup_id: String,
    pub confirmation_token: String,
}

/// Result of restoring a backup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupResult {
    pub success: bool,
    pub backup_id: String,
    pub restored_sessions_count: usize,
    pub restored_messages_count: usize,
    pub restored_telemetry_count: usize,
    pub restored_schema_version: i64,
    pub safety_snapshot_created: String,
    pub fts_rebuilt: bool,
    pub error_message: Option<String>,
}

