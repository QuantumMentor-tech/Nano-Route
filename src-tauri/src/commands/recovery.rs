// ============================================================================
// Nano Route - Disaster Recovery & Backup IPC Commands
// File: src-tauri/src/commands/recovery.rs
// ============================================================================
// Native Tauri command handlers for Step 53 Disaster Recovery:
// - cmd_create_backup: Create verified snapshot with SHA-256 and manifest
// - cmd_preview_restore: Preflight checks, schema compatibility & warnings
// - cmd_restore_backup: Staged restore with pre-restore safety snapshot
// - cmd_list_backups: Discover local verified backups
// ============================================================================

use crate::domain::recovery::{
    BackupManifest, CreateBackupRequest, CreateBackupResult, RestoreBackupRequest,
    RestoreBackupResult, RestorePreview,
};
use crate::state::AppState;
use std::fs::{self, File};
use std::io::Read;
use tauri::State;

/// Creates a new verified SQLite backup with manifest and integrity checks.
#[tauri::command]
pub async fn cmd_create_backup(
    request: CreateBackupRequest,
    state: State<'_, AppState>,
) -> Result<CreateBackupResult, String> {
    state
        .recovery_service
        .create_backup(request)
        .map_err(|e| e.to_string())
}

/// Previews a restore operation for a given backup ID.
#[tauri::command]
pub async fn cmd_preview_restore(
    backup_id: String,
    state: State<'_, AppState>,
) -> Result<RestorePreview, String> {
    state
        .recovery_service
        .preview_restore(&backup_id)
        .map_err(|e| e.to_string())
}

/// Executes staged restoration of a backup.
#[tauri::command]
pub async fn cmd_restore_backup(
    request: RestoreBackupRequest,
    state: State<'_, AppState>,
) -> Result<RestoreBackupResult, String> {
    state
        .recovery_service
        .restore_backup(request)
        .map_err(|e| e.to_string())
}

/// Discovers and lists all local backup manifests.
#[tauri::command]
pub async fn cmd_list_backups(
    state: State<'_, AppState>,
) -> Result<Vec<BackupManifest>, String> {
    let backup_dir = state
        .recovery_service
        .resolve_backup_dir()
        .map_err(|e| e.to_string())?;

    let mut manifests = Vec::new();

    if let Ok(entries) = fs::read_dir(backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.to_string_lossy().ends_with(".manifest.json") {
                if let Ok(mut file) = File::open(&path) {
                    let mut content = String::new();
                    if file.read_to_string(&mut content).is_ok() {
                        if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&content) {
                            manifests.push(manifest);
                        }
                    }
                }
            }
        }
    }

    // Sort newest first
    manifests.sort_by(|a, b| b.created_at_ms.cmp(&a.created_at_ms));

    Ok(manifests)
}

