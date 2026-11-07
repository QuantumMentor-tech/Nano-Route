// ============================================================================
// Nano Route - Provider & Model Registry Tauri Commands
// File: src-tauri/src/commands/registry.rs
// ============================================================================
// Thin command handlers for querying static provider and model descriptors
// and resolving effective configurations. Plaintext credentials are strictly absent.
// ============================================================================

use tauri::State;
use crate::errors::AppError;
use crate::providers::descriptor::{
    EffectiveProviderDescriptor, HistoricalModelReference, ProviderDescriptor,
};
use crate::providers::identity::ProviderId;
use crate::providers::models::ProviderModel;
use crate::state::AppState;

/// Lists all registered provider descriptors in canonical catalog order.
#[tauri::command]
pub async fn cmd_list_registered_providers(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderDescriptor>, String> {
    Ok(state
        .provider_registry
        .list_providers()
        .into_iter()
        .cloned()
        .collect())
}

/// Retrieves a specific provider descriptor by ID.
#[tauri::command]
pub async fn cmd_get_registered_provider(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ProviderDescriptor>, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    Ok(state.provider_registry.get_provider(&pid).cloned())
}

/// Lists models registered under a specific provider, or all models if provider_id is omitted.
#[tauri::command]
pub async fn cmd_list_registered_models(
    provider_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ProviderModel>, String> {
    if let Some(id_str) = provider_id {
        let pid = ProviderId::new(&id_str)
            .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", id_str, e)).to_string())?;

        Ok(state
            .provider_registry
            .list_models_for_provider(&pid)
            .into_iter()
            .cloned()
            .collect())
    } else {
        Ok(state
            .provider_registry
            .list_all_models()
            .into_iter()
            .cloned()
            .collect())
    }
}

/// Retrieves a specific model descriptor by provider ID and model ID.
#[tauri::command]
pub async fn cmd_get_registered_model(
    provider_id: String,
    model_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ProviderModel>, String> {
    let pid = ProviderId::new(&provider_id)
        .map_err(|e| AppError::InvalidInput(format!("Invalid provider ID '{}': {}", provider_id, e)).to_string())?;

    Ok(state.provider_registry.get_model(&pid, &model_id).cloned())
}

/// Resolves effective configurations for all registered providers, combining static
/// catalog facts with persisted user preferences and credential status.
#[tauri::command]
pub async fn cmd_resolve_effective_providers(
    state: State<'_, AppState>,
) -> Result<Vec<EffectiveProviderDescriptor>, String> {
    let preferences = state
        .provider_preferences
        .list_provider_configurations()
        .map_err(|e| e.to_string())?;

    Ok(state
        .provider_registry
        .resolve_all_effective_providers(&preferences))
}

/// Resolves a historical model reference safely without failing if absent from active registry.
#[tauri::command]
pub async fn cmd_resolve_historical_model(
    provider_id: String,
    model_id: String,
    state: State<'_, AppState>,
) -> Result<HistoricalModelReference, String> {
    Ok(state
        .provider_registry
        .resolve_historical_model(&provider_id, &model_id))
}

