//! Application Metadata IPC Commands
//! Thin boundary delegating to the application AppService.

use tauri::State;
use crate::domain::AppInfo;
use crate::state::AppState;

/// Retrieves application metadata and runtime environment info.
#[tauri::command]
pub fn cmd_get_app_info(state: State<'_, AppState>) -> Result<AppInfo, String> {
    Ok(state.app_service.get_app_info())
}

