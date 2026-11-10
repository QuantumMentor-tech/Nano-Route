// ============================================================================
// Nano Route - Provider Health & Capability Tauri Commands
// File: src-tauri/src/commands/provider_health.rs
// ============================================================================
// Strongly-typed command handlers for querying provider runtime health snapshots,
// effective capabilities, preflight request validation, and explicit health probes.
// Contains zero secret credentials, auth headers, prompts, or completion tokens.
// ============================================================================

use tauri::State;

use crate::errors::AppError;
use crate::providers::capabilities::ProviderCapabilities;
use crate::providers::capability_service::RequestRequirements;
use crate::providers::health_manager::current_time_ms;
use crate::providers::health_types::ProviderHealthSnapshot;
use crate::providers::identity::ProviderId;
use crate::providers::preflight::PreflightEvaluation;
use crate::providers::probe::HealthCheckResult;
use crate::state::AppState;

/// Queries the read-safe runtime health snapshot for a specific provider.
#[tauri::command]
pub async fn cmd_get_provider_health(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ProviderHealthSnapshot>, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    let now = current_time_ms();
    Ok(state.provider_health_manager.get_provider_health(&pid, now))
}

/// Queries read-safe runtime health snapshots for all registered providers.
#[tauri::command]
pub async fn cmd_get_all_provider_health(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderHealthSnapshot>, String> {
    let now = current_time_ms();
    Ok(state.provider_health_manager.get_all_provider_health(now))
}

/// Queries effective capabilities for a provider.
#[tauri::command]
pub async fn cmd_get_provider_capabilities(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<ProviderCapabilities, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    state
        .provider_capability_service
        .get_registry_provider_capabilities(&pid)
        .map_err(|e| e.to_string())
}

/// Queries effective capabilities for a specific model under a provider.
#[tauri::command]
pub async fn cmd_get_model_capabilities(
    provider_id: String,
    model_id: String,
    state: State<'_, AppState>,
) -> Result<ProviderCapabilities, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    state
        .provider_capability_service
        .compute_effective_capabilities(&pid, &model_id)
        .map_err(|e| e.to_string())
}

/// Evaluates whether a proposed request can be safely executed by a provider/model pair.
/// Strictly returns Allowed or Blocked(reason); NEVER chooses another provider.
#[tauri::command]
pub async fn cmd_preflight_provider_request(
    provider_id: String,
    model_id: String,
    requirements: RequestRequirements,
    state: State<'_, AppState>,
) -> Result<PreflightEvaluation, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    let now = current_time_ms();
    Ok(state
        .preflight_evaluator
        .evaluate(&pid, &model_id, &requirements, Some(now)))
}

/// Explicitly probes an AI provider's endpoint using a safe, minimal check.
/// Does NOT send user prompt data.
#[tauri::command]
pub async fn cmd_check_provider_health(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<HealthCheckResult, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    Ok(state.provider_health_probe.check_provider_health(&pid).await)
}

