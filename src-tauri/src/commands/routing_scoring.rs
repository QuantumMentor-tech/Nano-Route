// ============================================================================
// Nano Route - Routing Scoring Tauri IPC Commands
// File: src-tauri/src/commands/routing_scoring.rs
// ============================================================================
// Exposes candidate eligibility evaluation, normalized multi-criteria scoring,
// and scoring diagnostics to the Tauri frontend.
// Strictly decoupled from final routing dispatch and policy selection (Step 30).
// ============================================================================

use tauri::State;

use crate::routing::scoring::types::{
    RoutingScoreRequest, RoutingScoreResult, RoutingScoringStatus,
};
use crate::routing::scoring::weights::RoutingScoringWeights;
use crate::state::AppState;

/// Evaluates hard eligibility and computes normalized [0.0, 1.0] multi-dimensional
/// suitability scores for candidate models against a Task Analysis Result.
#[tauri::command]
pub async fn cmd_score_routing_candidates(
    request: RoutingScoreRequest,
    state: State<'_, AppState>,
) -> Result<RoutingScoreResult, String> {
    state
        .routing_scoring_engine
        .score_candidates(request)
        .map_err(|e| e.to_string())
}

/// Queries current diagnostic status and registered candidate counts of the scoring engine.
#[tauri::command]
pub async fn cmd_get_routing_scoring_status(
    state: State<'_, AppState>,
) -> Result<RoutingScoringStatus, String> {
    Ok(state.routing_scoring_engine.get_status())
}

/// Retrieves the active scoring weights applied during candidate evaluation.
#[tauri::command]
pub async fn cmd_get_scoring_weights(
    state: State<'_, AppState>,
) -> Result<RoutingScoringWeights, String> {
    Ok(state.routing_scoring_engine.get_weights())
}

/// Updates the scoring weights after enforcing strict validation invariants.
#[tauri::command]
pub async fn cmd_update_scoring_weights(
    weights: RoutingScoringWeights,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .routing_scoring_engine
        .update_weights(weights)
        .map_err(|e| e.to_string())
}

