// ============================================================================
// Nano Route - History Explorer Tauri IPC Commands
// File: src-tauri/src/commands/history.rs
// ============================================================================
// Narrowly-scoped IPC command handlers for historical conversation browsing,
// local lexical search, filter option discovery, and transactional bulk deletion.
// Strictly read/local-persistence only; zero SLM or provider execution paths.
// ============================================================================

use crate::domain::{
    BulkDeleteResult, HistoryFilter, HistoryFilterOptions, HistoryPage, HistorySearchRequest,
    HistorySearchResponse, HistorySortMode,
};
use crate::state::AppState;
use tauri::State;

/// Lists paginated historical conversations with aggregate message counts and filters.
#[tauri::command]
pub async fn cmd_list_history_sessions(
    filter: Option<HistoryFilter>,
    sort: Option<HistorySortMode>,
    limit: Option<u32>,
    offset: Option<u32>,
    query_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<HistoryPage, String> {
    state
        .history_service
        .list_history(filter, sort, limit, offset, query_id)
        .map_err(|e| e.to_string())
}

/// Searches local conversation history titles and message contents deterministically.
#[tauri::command]
pub async fn cmd_search_history(
    request: HistorySearchRequest,
    state: State<'_, AppState>,
) -> Result<HistorySearchResponse, String> {
    state
        .history_service
        .search_history(request)
        .map_err(|e| e.to_string())
}

/// Retrieves distinct historical provider and model identifiers stored in chat messages.
#[tauri::command]
pub async fn cmd_get_history_filter_options(
    state: State<'_, AppState>,
) -> Result<HistoryFilterOptions, String> {
    state
        .history_service
        .get_filter_options()
        .map_err(|e| e.to_string())
}

/// Atomically deletes a bounded batch of selected historical sessions (with CASCADE & FTS sync).
#[tauri::command]
pub async fn cmd_delete_history_sessions_bulk(
    session_ids: Vec<String>,
    state: State<'_, AppState>,
) -> Result<BulkDeleteResult, String> {
    state
        .history_service
        .delete_sessions_bulk(session_ids)
        .map_err(|e| e.to_string())
}

/// Deterministic recovery command to rebuild the local search index from authoritative rows.
#[tauri::command]
pub async fn cmd_rebuild_history_search_index(
    state: State<'_, AppState>,
) -> Result<u64, String> {
    state
        .history_service
        .rebuild_search_index()
        .map_err(|e| e.to_string())
}

