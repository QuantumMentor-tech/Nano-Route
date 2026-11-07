// ============================================================================
// Nano Route - Application Settings & Provider Preferences Tauri Commands
// File: src-tauri/src/commands/settings.rs
// ============================================================================
// Thin command handlers for typed application settings and non-secret provider
// preference management. Plaintext secrets and ciphertext BLOBs are strictly absent.
// ============================================================================

use crate::domain::credentials::ProviderCredentialStatus;
use crate::domain::settings::{AppSettingKey, AppSettingsSnapshot, UpdateProviderPreferencesInput};
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
    state
        .provider_preferences
        .update_provider_preferences(input)
        .map_err(|e| e.to_string())
}

/// Resets provider preferences to documented defaults while preserving credentials.
#[tauri::command]
pub async fn cmd_reset_provider_preferences(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<ProviderCredentialStatus, String> {
    state
        .provider_preferences
        .reset_provider_preferences(&provider_id)
        .map_err(|e| e.to_string())
}

