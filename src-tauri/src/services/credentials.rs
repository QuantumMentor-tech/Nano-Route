// ============================================================================
// Nano Route - Credential Vault Application Service
// File: src-tauri/src/services/credentials.rs
// ============================================================================
// Application security service orchestrating Windows DPAPI protection,
// SQLite encrypted persistence, input sanitization, and transient secret lifecycle.
// Plaintext secrets NEVER escape native Rust boundaries.
// ============================================================================

use crate::domain::{
    DecryptedProviderCredential, EncryptedCredentialRecord, ProviderCredentialStatus,
};
use crate::errors::AppError;
use crate::security::{DpapiProtector, SecretString};
use crate::storage::repositories::CredentialRepository;
use crate::storage::DatabaseManager;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Input DTO for persisting or rotating a provider API credential.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCredentialInput {
    pub provider_id: String,
    pub api_key: String,
    pub base_url: Option<String>,
    pub is_active: Option<bool>,
    pub priority_weight: Option<u8>,
    pub monthly_budget_limit: Option<f64>,
}

pub struct CredentialVaultService {
    database_manager: Arc<DatabaseManager>,
}

impl CredentialVaultService {
    pub fn new(database_manager: Arc<DatabaseManager>) -> Self {
        Self { database_manager }
    }

    /// Validates canonical provider ID format.
    fn validate_provider_id(provider_id: &str) -> Result<String, AppError> {
        let trimmed = provider_id.trim();
        if trimmed.len() < 2 || trimmed.len() > 64 {
            return Err(AppError::InvalidInput(format!(
                "Provider ID length must be between 2 and 64 characters; got {}",
                trimmed.len()
            )));
        }

        let first = trimmed.chars().next().unwrap_or(' ');
        if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
            return Err(AppError::InvalidInput(
                "Provider ID must begin with a lowercase ASCII alphanumeric character".to_string(),
            ));
        }

        for ch in trimmed.chars() {
            if !ch.is_ascii_lowercase() && !ch.is_ascii_digit() && ch != '.' && ch != '_' && ch != '-' {
                return Err(AppError::InvalidInput(format!(
                    "Provider ID contains illegal character '{}'. Allowed: [a-z0-9._-]",
                    ch
                )));
            }
        }

        Ok(trimmed.to_string())
    }

    /// Validates raw API key input.
    fn validate_api_key(api_key: &str) -> Result<SecretString, AppError> {
        let trimmed = api_key.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidInput(
                "API key cannot be empty or whitespace only".to_string(),
            ));
        }

        if trimmed.len() > 4096 {
            return Err(AppError::InvalidInput(
                "API key exceeds maximum permitted length of 4096 characters".to_string(),
            ));
        }

        // Ensure no control characters
        if trimmed.chars().any(|c| c.is_control() && c != '\t') {
            return Err(AppError::InvalidInput(
                "API key contains invalid control characters".to_string(),
            ));
        }

        Ok(SecretString::new(trimmed))
    }

    /// Validates custom base URL format and security invariants.
    fn validate_base_url(url: Option<&str>) -> Result<Option<String>, AppError> {
        let raw = match url {
            Some(u) if !u.trim().is_empty() => u.trim(),
            _ => return Ok(None),
        };

        if raw.len() > 512 {
            return Err(AppError::InvalidInput(
                "Base URL exceeds maximum permitted length of 512 characters".to_string(),
            ));
        }

        // Prohibit embedded user credentials (user:pass@host)
        if raw.contains('@') {
            return Err(AppError::InvalidInput(
                "Base URL must not contain embedded user credentials or authorization information".to_string(),
            ));
        }

        // Enforce network schemes only: https or safe localhost/127.0.0.1 http
        let lower = raw.to_lowercase();
        if lower.starts_with("https://") {
            Ok(Some(raw.to_string()))
        } else if lower.starts_with("http://localhost") || lower.starts_with("http://127.0.0.1") {
            Ok(Some(raw.to_string()))
        } else {
            Err(AppError::InvalidInput(
                "Base URL must use HTTPS, or HTTP for localhost/127.0.0.1 development endpoints".to_string(),
            ))
        }
    }

    /// Encrypts and persists a provider credential, returning safe non-secret metadata.
    pub fn save_credential(
        &self,
        input: SaveCredentialInput,
    ) -> Result<ProviderCredentialStatus, AppError> {
        let provider_id = Self::validate_provider_id(&input.provider_id)?;
        let secret = Self::validate_api_key(&input.api_key)?;
        let base_url = Self::validate_base_url(input.base_url.as_deref())?;

        let priority_weight = input.priority_weight.unwrap_or(5).clamp(1, 10);
        let is_active = input.is_active.unwrap_or(true);

        if let Some(limit) = input.monthly_budget_limit {
            if limit.is_nan() || limit.is_infinite() || limit < 0.0 {
                return Err(AppError::InvalidInput(
                    "Monthly budget limit cannot be negative or invalid number".to_string(),
                ));
            }
        }

        // Encrypt with user-scoped Windows DPAPI
        let ciphertext = DpapiProtector::protect(secret.expose_secret().as_bytes())?;

        let now = current_epoch_ms();
        let record = EncryptedCredentialRecord {
            provider_id: provider_id.clone(),
            encrypted_api_key: ciphertext,
            base_url: base_url.clone(),
            is_active,
            priority_weight,
            monthly_budget_limit: input.monthly_budget_limit,
            current_month_spend: 0.0,
            updated_at: now,
        };

        // Atomically store encrypted BLOB in SQLite
        self.database_manager.with_connection(|conn| {
            CredentialRepository::insert_or_update(conn, &record)
                .map_err(|e| AppError::Internal(format!("Failed to persist credential: {}", e)))
        })?;

        // Return safe non-secret status
        Ok(ProviderCredentialStatus {
            provider_id,
            is_configured: true,
            is_active,
            priority_weight,
            base_url,
            monthly_budget_limit: input.monthly_budget_limit,
            current_month_spend: 0.0,
            updated_at: now,
        })
    }

    /// Queries the safe non-secret status of a provider credential.
    pub fn get_credential_status(
        &self,
        provider_id: &str,
    ) -> Result<Option<ProviderCredentialStatus>, AppError> {
        let clean_id = Self::validate_provider_id(provider_id)?;

        self.database_manager.with_connection(|conn| {
            let record = CredentialRepository::get_by_provider(conn, &clean_id)
                .map_err(|e| AppError::Internal(format!("Failed to query credential: {}", e)))?;

            Ok(record.map(|r| ProviderCredentialStatus {
                provider_id: r.provider_id,
                is_configured: true,
                is_active: r.is_active,
                priority_weight: r.priority_weight,
                base_url: r.base_url,
                monthly_budget_limit: r.monthly_budget_limit,
                current_month_spend: r.current_month_spend,
                updated_at: r.updated_at,
            }))
        })
    }

    /// Lists safe non-secret statuses for all configured providers.
    pub fn list_credential_statuses(&self) -> Result<Vec<ProviderCredentialStatus>, AppError> {
        self.database_manager.with_connection(|conn| {
            CredentialRepository::list_statuses(conn)
                .map_err(|e| AppError::Internal(format!("Failed to list credential statuses: {}", e)))
        })
    }

    /// Updates active state for a provider credential.
    pub fn set_provider_active(
        &self,
        provider_id: &str,
        is_active: bool,
    ) -> Result<ProviderCredentialStatus, AppError> {
        let clean_id = Self::validate_provider_id(provider_id)?;
        let now = current_epoch_ms();

        self.database_manager.with_connection(|conn| {
            let updated = CredentialRepository::set_active(conn, &clean_id, is_active, now)
                .map_err(|e| AppError::Internal(format!("Failed to update provider active status: {}", e)))?;

            if !updated {
                return Err(AppError::NotFound(format!(
                    "Provider '{}' has no configured credentials",
                    clean_id
                )));
            }

            let record = CredentialRepository::get_by_provider(conn, &clean_id)
                .map_err(|e| AppError::Internal(format!("Failed to fetch updated credential: {}", e)))?
                .ok_or_else(|| AppError::NotFound(format!("Provider '{}' not found", clean_id)))?;

            Ok(ProviderCredentialStatus {
                provider_id: record.provider_id,
                is_configured: true,
                is_active: record.is_active,
                priority_weight: record.priority_weight,
                base_url: record.base_url,
                monthly_budget_limit: record.monthly_budget_limit,
                current_month_spend: record.current_month_spend,
                updated_at: record.updated_at,
            })
        })
    }

    /// Deletes a provider credential and its associated preferences.
    pub fn delete_credential(&self, provider_id: &str) -> Result<bool, AppError> {
        let clean_id = Self::validate_provider_id(provider_id)?;

        self.database_manager.with_connection(|conn| {
            CredentialRepository::delete(conn, &clean_id)
                .map_err(|e| AppError::Internal(format!("Failed to delete credential: {}", e)))
        })
    }

    /// Native-only operation: decrypts ciphertext into a transient SecretString.
    /// Strictly internal; NEVER called by any command that exposes data to React!
    pub fn get_decrypted_credential(
        &self,
        provider_id: &str,
    ) -> Result<DecryptedProviderCredential, AppError> {
        let clean_id = Self::validate_provider_id(provider_id)?;

        let record = self.database_manager.with_connection(|conn| {
            CredentialRepository::get_by_provider(conn, &clean_id)
                .map_err(|e| AppError::Internal(format!("Failed to retrieve credential record: {}", e)))?
                .ok_or_else(|| AppError::NotFound(format!("No credentials configured for provider '{}'", clean_id)))
        })?;

        // Decrypt using Windows DPAPI
        let decrypted_bytes = DpapiProtector::unprotect(&record.encrypted_api_key)?;
        let secret_string = decrypted_bytes.to_secret_string().map_err(|e| {
            AppError::Internal(format!("Decrypted credential is not valid UTF-8: {}", e))
        })?;

        Ok(DecryptedProviderCredential {
            provider_id: record.provider_id,
            api_key: secret_string,
            base_url: record.base_url,
        })
    }

    /// Clears all credentials (supports local data wipe).
    pub fn clear_all(&self) -> Result<usize, AppError> {
        self.database_manager.with_connection(|conn| {
            CredentialRepository::clear_all(conn)
                .map_err(|e| AppError::Internal(format!("Failed to clear all credentials: {}", e)))
        })
    }
}

