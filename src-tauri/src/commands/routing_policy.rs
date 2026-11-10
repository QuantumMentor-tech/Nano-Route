// ============================================================================
// Nano Route - Routing Policy Tauri IPC Commands
// File: src-tauri/src/commands/routing_policy.rs
// ============================================================================
// Exposes final route selection, manual model override validation, and
// policy configuration management to the Tauri frontend.
// Strictly decoupled from provider HTTP networking and streaming execution.
// ============================================================================

use tauri::State;

use crate::analysis::types::TaskAnalysisResult;
use crate::routing::policy::config::RoutingPolicyConfig;
use crate::routing::policy::types::{
    ManualRouteOverride, OverrideValidationResult, RoutingDecision, RoutingPolicyRequest,
};
use crate::state::AppState;

/// Evaluates routing policy over candidate scores, resolving the final route and ordered fallback plan.
#[tauri::command]
pub async fn cmd_evaluate_routing_policy(
    request: RoutingPolicyRequest,
    state: State<'_, AppState>,
) -> Result<RoutingDecision, String> {
    state
        .routing_policy_engine
        .evaluate_route(request)
        .map_err(|e| e.to_string())
}

/// Retrieves the active routing policy configuration snapshot.
#[tauri::command]
pub async fn cmd_get_routing_policy_config(
    state: State<'_, AppState>,
) -> Result<RoutingPolicyConfig, String> {
    Ok(state.routing_policy_engine.get_config())
}

/// Updates the routing policy configuration parameters after strict validation.
#[tauri::command]
pub async fn cmd_update_routing_policy_config(
    config: RoutingPolicyConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .routing_policy_engine
        .update_config(config)
        .map_err(|e| e.to_string())
}

/// Directly validates a proposed manual route override against catalog and capability constraints.
#[tauri::command]
pub async fn cmd_validate_manual_override(
    override_request: ManualRouteOverride,
    task_analysis: Option<TaskAnalysisResult>,
    state: State<'_, AppState>,
) -> Result<OverrideValidationResult, String> {
    Ok(state
        .routing_policy_engine
        .validate_override(&override_request, task_analysis.as_ref()))
}

