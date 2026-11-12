// ============================================================================
// Nano Route - Step 45 Data Lifecycle, Audit, Retention & Privacy IPC Commands
// File: src-tauri/src/commands/privacy.rs
// ============================================================================
// Narrow, purpose-built IPC command handlers for local data inventory,
// SQLite integrity & consistency auditing, safe repair, retention policies,
// dry-run cleanup previews, transactional cleanup execution, and explicit
// Full Local Data Wipe.
//
// Security Boundary:
// - Never accepts arbitrary SQL strings or filesystem paths.
// - Never returns plaintext or encrypted credential material.
// ============================================================================

use crate::domain::{
    AuditCheckMode, CleanupExecutionRequest, CleanupOperationResult, CleanupPreviewRequest,
    CleanupPreviewResult, DataAuditReport, DataInventorySnapshot, FullWipePreviewResult,
    FullWipeReport, FullWipeRequest, RetentionPolicyConfig, SafeRepairAction, SafeRepairResult,
};
use crate::state::AppState;
use tauri::State;

/// Retrieves the complete local data inventory and classification model.
#[tauri::command]
pub async fn cmd_get_data_inventory(
    state: State<'_, AppState>,
) -> Result<DataInventorySnapshot, String> {
    state
        .data_lifecycle_service
        .get_data_inventory()
        .map_err(|e| e.to_string())
}

/// Executes a read-only Quick or Full Integrity & Privacy Audit.
#[tauri::command]
pub async fn cmd_run_data_audit(
    mode: Option<AuditCheckMode>,
    state: State<'_, AppState>,
) -> Result<DataAuditReport, String> {
    state
        .data_lifecycle_service
        .run_data_audit(mode.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Executes a deterministic, non-destructive safe repair operation (e.g. FTS5 search index rebuild).
#[tauri::command]
pub async fn cmd_run_safe_data_repair(
    action: Option<SafeRepairAction>,
    state: State<'_, AppState>,
) -> Result<SafeRepairResult, String> {
    state
        .data_lifecycle_service
        .run_safe_repair(action.unwrap_or(SafeRepairAction::RebuildSearchIndex))
        .map_err(|e| e.to_string())
}

/// Retrieves the configured local retention policy (Disabled by default).
#[tauri::command]
pub async fn cmd_get_retention_policy(
    state: State<'_, AppState>,
) -> Result<RetentionPolicyConfig, String> {
    state
        .data_lifecycle_service
        .get_retention_policy()
        .map_err(|e| e.to_string())
}

/// Validates and updates the local retention policy.
#[tauri::command]
pub async fn cmd_update_retention_policy(
    policy: RetentionPolicyConfig,
    state: State<'_, AppState>,
) -> Result<RetentionPolicyConfig, String> {
    state
        .data_lifecycle_service
        .update_retention_policy(policy)
        .map_err(|e| e.to_string())
}

/// Computes a read-only dry-run preview of a targeted or retention cleanup operation.
#[tauri::command]
pub async fn cmd_preview_data_cleanup(
    request: CleanupPreviewRequest,
    state: State<'_, AppState>,
) -> Result<CleanupPreviewResult, String> {
    state
        .data_lifecycle_service
        .preview_cleanup(request)
        .map_err(|e| e.to_string())
}

/// Runs a controlled, transactional cleanup operation with post-cleanup verification.
#[tauri::command]
pub async fn cmd_run_data_cleanup(
    request: CleanupExecutionRequest,
    state: State<'_, AppState>,
) -> Result<CleanupOperationResult, String> {
    state
        .data_lifecycle_service
        .execute_cleanup(request)
        .map_err(|e| e.to_string())
}

/// Computes a read-only preview of a Full Local Data Wipe.
#[tauri::command]
pub async fn cmd_preview_full_data_wipe(
    state: State<'_, AppState>,
) -> Result<FullWipePreviewResult, String> {
    state
        .data_lifecycle_service
        .preview_full_wipe()
        .map_err(|e| e.to_string())
}

/// Runs an explicit, high-security Full Local Data Wipe requiring confirmation token "DELETE".
#[tauri::command]
pub async fn cmd_run_full_data_wipe(
    request: FullWipeRequest,
    state: State<'_, AppState>,
) -> Result<FullWipeReport, String> {
    state
        .data_lifecycle_service
        .execute_full_wipe(request)
        .map_err(|e| e.to_string())
}

