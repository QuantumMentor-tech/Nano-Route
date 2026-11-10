// ============================================================================
// Nano Route - Credential Vault Tauri Commands
// File: src-tauri/src/commands/credentials.rs
// ============================================================================
// Thin command handlers for encrypted credential management.
// Plaintext secrets enter only on controlled save; NEVER returned over IPC.
// ============================================================================

use crate::domain::ProviderCredentialStatus;
use crate::services::SaveCredentialInput;
use crate::state::AppState;
use tauri::State;

/// Encrypts and persists a provider credential, returning safe status metadata.
#[tauri::command]
pub async fn cmd_save_provider_credential(
    input: SaveCredentialInput,
    state: State<'_, AppState>,
) -> Result<ProviderCredentialStatus, String> {
    let pid_str = input.provider_id.clone();
    let res = state
        .credential_vault
        .save_credential(input)
        .map_err(|e| e.to_string())?;

    if let Ok(pid) = crate::providers::identity::ProviderId::new(&pid_str) {
        state.provider_health_manager.update_credential_status(&pid, res.is_configured);
        state.provider_health_manager.update_provider_enabled(&pid, res.is_active);
    }

    Ok(res)
}

/// Retrieves non-secret credential configuration status for a provider.
#[tauri::command]
pub async fn cmd_get_provider_credential_status(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ProviderCredentialStatus>, String> {
    state
        .credential_vault
        .get_credential_status(&provider_id)
        .map_err(|e| e.to_string())
}

/// Lists non-secret credential configuration statuses for all configured providers.
#[tauri::command]
pub async fn cmd_list_provider_credential_statuses(
    state: State<'_, AppState>,
) -> Result<Vec<ProviderCredentialStatus>, String> {
    state
        .credential_vault
        .list_credential_statuses()
        .map_err(|e| e.to_string())
}

/// Toggles or updates the active state of a configured provider credential.
#[tauri::command]
pub async fn cmd_set_provider_active(
    provider_id: String,
    is_active: bool,
    state: State<'_, AppState>,
) -> Result<ProviderCredentialStatus, String> {
    let res = state
        .credential_vault
        .set_provider_active(&provider_id, is_active)
        .map_err(|e| e.to_string())?;

    if let Ok(pid) = crate::providers::identity::ProviderId::new(&provider_id) {
        state.provider_health_manager.update_provider_enabled(&pid, is_active);
    }

    Ok(res)
}

/// Deletes a provider credential and its associated preferences.
#[tauri::command]
pub async fn cmd_delete_provider_credential(
    provider_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let res = state
        .credential_vault
        .delete_credential(&provider_id)
        .map_err(|e| e.to_string())?;

    if res {
        if let Ok(pid) = crate::providers::identity::ProviderId::new(&provider_id) {
            state.provider_health_manager.update_credential_status(&pid, false);
        }
    }

    Ok(res)
}
        .map_err(|e| e.to_string())
}

