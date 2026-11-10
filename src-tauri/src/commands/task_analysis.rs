// ============================================================================
// Nano Route - Task Analysis Tauri IPC Commands
// File: src-tauri/src/commands/task_analysis.rs
// ============================================================================
// Exposes local multidimensional task analysis (complexity, domain, capabilities)
// to the Tauri frontend. Strictly provider-neutral.
// ============================================================================

use tauri::State;

use crate::analysis::types::{TaskAnalysisRequest, TaskAnalysisResult, TaskAnalyzerStatus};
use crate::state::AppState;

/// Executes local multidimensional task analysis over a user request.
/// Returns complexity, domain taxonomy, and task capability requirements.
#[tauri::command]
pub async fn cmd_analyze_task(
    request: TaskAnalysisRequest,
    state: State<'_, AppState>,
) -> Result<TaskAnalysisResult, String> {
    state
        .task_analyzer
        .analyze(request, None)
        .await
        .map_err(|e| e.to_string())
}

/// Queries operational status and supported taxonomies of the task analyzer.
#[tauri::command]
pub async fn cmd_get_task_analyzer_status(
    state: State<'_, AppState>,
) -> Result<TaskAnalyzerStatus, String> {
    Ok(state.task_analyzer.get_status())
}

