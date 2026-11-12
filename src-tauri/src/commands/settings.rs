// ============================================================================
// Nano Route - Application Settings & Provider Preferences Tauri Commands
// File: src-tauri/src/commands/settings.rs
// ============================================================================
// Thin command handlers for typed application settings and non-secret provider
// preference management. Plaintext secrets and ciphertext BLOBs are strictly absent.
// ============================================================================

use crate::domain::credentials::ProviderCredentialStatus;
use crate::domain::settings::{
    AppSettingKey, AppSettingsSnapshot, ModelSettingsSummary, ProviderSettingsSummary,
    SecurityStatusSummary, SettingsWorkspaceSnapshot, UpdateProviderPreferencesInput,
};
use crate::errors::AppError;
use crate::state::AppState;
use tauri::State;

/// Retrieves the authoritative snapshot of all typed application settings.
#[tauri::command]
pub async fn cmd_get_app_settings(
    state: State<'_, AppState>,
) -> Result<AppSettingsSnapshot, String> {
    state
        .app_settings
        .get_snapshot()
        .map_err(|e| e.to_string())
}

/// Retrieves the value of a specific typed application setting.
#[tauri::command]
pub async fn cmd_get_app_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let setting_key = AppSettingKey::from_key_str(&key)
        .ok_or_else(|| AppError::InvalidInput(format!("Unknown application setting key '{}'", key)).to_string())?;

    state
        .app_settings
        .get_setting(setting_key)
        .map_err(|e| e.to_string())
}

/// Sets and persists a typed application setting after domain validation.
#[tauri::command]
pub async fn cmd_set_app_setting(
    key: String,
    value: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let setting_key = AppSettingKey::from_key_str(&key)
        .ok_or_else(|| AppError::InvalidInput(format!("Unknown application setting key '{}'", key)).to_string())?;

    state
        .app_settings
        .set_setting(setting_key, &value)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Resets a specific application setting to its virtual default.
#[tauri::command]
pub async fn cmd_reset_app_setting(
    key: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let setting_key = AppSettingKey::from_key_str(&key)
        .ok_or_else(|| AppError::InvalidInput(format!("Unknown application setting key '{}'", key)).to_string())?;

    state
        .app_settings
        .reset_setting(setting_key)
        .map_err(|e| e.to_string())
}

/// Retrieves safe non-secret configuration preferences for a specific provider.
#[tauri::command]
pub async fn cmd_get_provider_preferences(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ProviderCredentialStatus>, String> {
    state
        .provider_preferences
        .get_provider_configuration(&provider_id)
        .map_err(|e| e.to_string())
}

/// Lists safe non-secret configuration preferences for all configured providers.
#[tauri::command]
pub async fn cmd_list_provider_preferences(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderCredentialStatus>, String> {
    state
        .provider_preferences
        .list_provider_configurations()
        .map_err(|e| e.to_string())
}

/// Atomically updates provider preferences without touching encrypted credentials.
#[tauri::command]
pub async fn cmd_update_provider_preferences(
    input: UpdateProviderPreferencesInput,
    state: State<'_, AppState>,
) -> Result<ProviderCredentialStatus, String> {
    let pid_str = input.provider_id.clone();
    let res = state
        .provider_preferences
        .update_provider_preferences(input)
        .map_err(|e| e.to_string())?;

    if let Ok(pid) = crate::providers::identity::ProviderId::new(&pid_str) {
        state.provider_health_manager.update_provider_enabled(&pid, res.is_active);
    }

    Ok(res)
}

/// Resets provider preferences to documented defaults while preserving credentials.
#[tauri::command]
pub async fn cmd_reset_provider_preferences(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<ProviderCredentialStatus, String> {
    let res = state
        .provider_preferences
        .reset_provider_preferences(&provider_id)
        .map_err(|e| e.to_string())?;

    if let Ok(pid) = crate::providers::identity::ProviderId::new(&provider_id) {
        state.provider_health_manager.update_provider_enabled(&pid, res.is_active);
    }

    Ok(res)
}

/// Retrieves a unified settings workspace snapshot combining application settings,
/// provider configurations, health states, model registry, routing policy, and security status.
#[tauri::command]
pub async fn cmd_get_settings_workspace_snapshot(
    state: State<'_, AppState>,
) -> Result<SettingsWorkspaceSnapshot, String> {
    let app_settings = state
        .app_settings
        .get_snapshot()
        .map_err(|e| e.to_string())?;

    let registered_providers = state.provider_registry.list_providers();
    let pref_list = state
        .provider_preferences
        .list_provider_configurations()
        .unwrap_or_default();
    let pref_map: std::collections::HashMap<String, _> = pref_list
        .into_iter()
        .map(|p| (p.provider_id.clone(), p))
        .collect();

    let now = crate::providers::health_manager::current_time_ms();
    let health_list = state
        .provider_health_manager
        .get_all_provider_health(now);
    let health_map: std::collections::HashMap<String, _> = health_list
        .into_iter()
        .map(|h| (h.provider_id.clone(), h))
        .collect();

    let mut provider_summaries = Vec::new();
    for p in registered_providers {
        let pid_str = p.provider_id.as_str().to_string();
        let pref = pref_map.get(&pid_str);
        let health = health_map.get(&pid_str);
        let models = state.provider_registry.list_models_for_provider(&p.provider_id);

        let is_configured = pref.map(|pr| pr.is_configured).unwrap_or(false);
        let is_active = pref.map(|pr| pr.is_active).unwrap_or(p.lifecycle_state == crate::providers::descriptor::LifecycleState::Active);
        let priority_weight = pref.map(|pr| pr.priority_weight).unwrap_or(5);
        let configured_base_url = pref.and_then(|pr| pr.base_url.clone());
        let monthly_budget_limit = pref.and_then(|pr| pr.monthly_budget_limit);
        let current_month_spend = pref.map(|pr| pr.current_month_spend).unwrap_or(0.0);

        let (health_state, health_checked_at_ms) = if let Some(h) = health {
            (h.state.as_str().to_string(), h.last_checked_at_ms)
        } else {
            ("unknown".to_string(), None)
        };

        let cap_strings: Vec<String> = p
            .capabilities
            .capabilities
            .iter()
            .map(|c| c.as_str().to_string())
            .collect();

        provider_summaries.push(ProviderSettingsSummary {
            provider_id: pid_str,
            display_name: p.display_name.clone(),
            description: p.description.clone(),
            default_base_url: p.default_base_url.clone(),
            documentation_url: p.documentation_url.clone(),
            configured_base_url,
            is_configured,
            is_active,
            priority_weight,
            monthly_budget_limit,
            current_month_spend,
            health_state,
            health_checked_at_ms,
            model_count: models.len(),
            default_model_id: p.default_model_id.clone(),
            capabilities: cap_strings,
        });
    }

    let all_models = state.provider_registry.list_all_models();
    let model_summaries = all_models
        .into_iter()
        .map(|m| {
            let cap_strings: Vec<String> = m
                .capabilities
                .capabilities
                .iter()
                .map(|c| c.as_str().to_string())
                .collect();

            ModelSettingsSummary {
                provider_id: m.provider_id.as_str().to_string(),
                model_id: m.model_id.clone(),
                display_name: m.display_name.clone(),
                is_active: m.is_active,
                context_window: m.context_window,
                max_output_tokens: m.max_output_tokens,
                is_default: m.is_default,
                capabilities: cap_strings,
            }
        })
        .collect();

    let routing_policy = state.routing_policy_engine.get_config();

    let security_status = SecurityStatusSummary {
        dpapi_protection_active: true,
        local_storage_type: "Protected SQLite + Windows DPAPI".to_string(),
        plaintext_keys_prohibited: true,
        remote_sync_disabled: true,
        last_audit_time_ms: None,
    };

    Ok(SettingsWorkspaceSnapshot {
        app_settings,
        providers: provider_summaries,
        models: model_summaries,
        routing_policy,
        security_status,
    })
}

/// Resets all application settings to documented virtual defaults.
#[tauri::command]
pub async fn cmd_reset_all_settings(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    state
        .app_settings
        .reset_all_settings()
        .map_err(|e| e.to_string())
}

