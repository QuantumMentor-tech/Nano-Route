//! Health Check IPC Commands
//! Thin boundary delegating to the application HealthService.

use tauri::State;
use crate::domain::HealthReport;
use crate::state::AppState;

/// Legacy smoke-test IPC command.
/// Preserves backward compatibility with existing frontend health-checks.
#[tauri::command]
pub fn cmd_health_check(state: State<'_, AppState>) -> String {
    state.health_service.check_health_string()
}

/// Structured health report IPC command.
#[tauri::command]
pub fn cmd_get_health(state: State<'_, AppState>) -> Result<HealthReport, String> {
    Ok(state.health_service.check_health())
}
