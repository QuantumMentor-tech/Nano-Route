// ============================================================================
// Nano Route - Database Diagnostic Commands
// File: src-tauri/src/commands/database.rs
// ============================================================================
// Boundary command providing safe database health diagnostics to IPC consumers.
// Exposes operational status without accepting or executing arbitrary SQL.
// ============================================================================

use crate::state::AppState;
use crate::storage::DatabaseHealthReport;
use tauri::State;

/// Queries the health and integrity report of the SQLite database.
#[tauri::command]
pub async fn cmd_get_database_health(
    state: State<'_, AppState>,
) -> Result<DatabaseHealthReport, String> {
    state
        .database_manager
        .health_check()
        .map_err(|e| e.to_string())
}

