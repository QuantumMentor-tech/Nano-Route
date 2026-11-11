// ============================================================================
// Nano Route - Routing Explanation Tauri Command
// File: src-tauri/src/commands/routing_explanation.rs
// ============================================================================
// Thin Tauri command handler exposing the read-only routing explanation layer.
// Resolves live explanations from in-memory cache or historical messages from SQLite.
// Strictly read-only: never reruns SLM inference or candidate scoring.
// ============================================================================

use crate::routing::RoutingExplanation;
use crate::state::AppState;
use tauri::State;

/// Retrieves the comprehensive routing explanation for a given assistant message.
#[tauri::command]
pub async fn cmd_get_routing_explanation(
    message_id: String,
    session_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<RoutingExplanation, String> {
    state
        .routing_explanation_service
        .get_explanation(&message_id, session_id.as_deref())
        .map_err(|e| e.to_string())
}

