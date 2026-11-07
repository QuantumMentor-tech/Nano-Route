// ============================================================================
// Nano Route - Provider Preferences Application Service
// File: src-tauri/src/services/provider_preferences.rs
// ============================================================================
// Application service orchestrating safe, non-secret provider configuration
// metadata (activation state, priority weights, monthly budget limits, base URLs).
// Plaintext credentials and DPAPI ciphertext are strictly excluded from this service.
// ============================================================================

use crate::domain::credentials::ProviderCredentialStatus;
use crate::domain::settings::UpdateProviderPreferencesInput;
use crate::errors::AppError;
use crate::storage::repositories::CredentialRepository;
use crate::storage::DatabaseManager;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

pub struct ProviderPreferencesService {
    database_manager: Arc<DatabaseManager>,
}

impl ProviderPreferencesService {
    pub fn new(database_manager: Arc<DatabaseManager>) -> Self {
        Self { database_manager }
    }

    /// Validates canonical provider ID format.
    pub fn validate_provider_id(provider_id: &str) -> Result<String, AppError> {
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

    /// Validates custom base URL format and security invariants.
    pub fn validate_base_url(url: Option<&str>) -> Result<Option<String>, AppError> {
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

    /// Retrieves the safe non-secret configuration status for a specific provider.
    pub fn get_provider_configuration(
        &self,
        provider_id: &str,
    ) -> Result<Option<ProviderCredentialStatus>, AppError> {
        let validated_id = Self::validate_provider_id(provider_id)?;

        let record = self
            .database_manager
            .with_connection(|conn| CredentialRepository::get_by_provider(conn, &validated_id))
            .map_err(|e| AppError::Database(format!("Failed to retrieve provider configuration: {}", e)))?;

        Ok(record.map(|r| ProviderCredentialStatus {
            provider_id: r.provider_id,
            is_configured: true,
            base_url: r.base_url,
            is_active: r.is_active,
            priority_weight: r.priority_weight,
            monthly_budget_limit: r.monthly_budget_limit,
            current_month_spend: r.current_month_spend,
            updated_at: r.updated_at,
        }))
    }

    /// Lists safe non-secret configuration statuses for all configured providers.
    pub fn list_provider_configurations(&self) -> Result<Vec<ProviderCredentialStatus>, AppError> {
        self.database_manager
            .with_connection(|conn| CredentialRepository::list_statuses(conn))
            .map_err(|e| AppError::Database(format!("Failed to list provider configurations: {}", e)))
    }

    /// Atomically updates provider preferences without touching encrypted credentials.
    pub fn update_provider_preferences(
        &self,
        input: UpdateProviderPreferencesInput,
    ) -> Result<ProviderCredentialStatus, AppError> {
        let provider_id = Self::validate_provider_id(&input.provider_id)?;

        // Fetch existing record to ensure provider is configured
        let existing = self
            .database_manager
            .with_connection(|conn| CredentialRepository::get_by_provider(conn, &provider_id))
            .map_err(|e| AppError::Database(format!("Database error during provider lookup: {}", e)))?
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Cannot update preferences for unconfigured provider '{}'",
                    provider_id
                ))
            })?;

        // Validate base URL
        let new_base_url = match input.base_url {
            Some(ref u) => Self::validate_base_url(Some(u))?,
            None => existing.base_url,
        };

        // Validate priority
        let new_priority = match input.priority_weight {
            Some(p) => {
                if !(1..=10).contains(&p) {
                    return Err(AppError::InvalidInput(format!(
                        "Priority weight must be between 1 and 10; got {}",
                        p
                    )));
                }
                p
            }
            None => existing.priority_weight,
        };

        // Validate active state
        let new_active = input.is_active.unwrap_or(existing.is_active);

        // Validate budget limit
        let new_budget = match input.monthly_budget_limit {
            Some(limit) => {
                if limit.is_nan() || limit.is_infinite() || limit < 0.0 {
                    return Err(AppError::InvalidInput(
                        "Monthly budget limit must be a non-negative finite number".to_string(),
                    ));
                }
                Some(limit)
            }
            None => existing.monthly_budget_limit,
        };

        let now = current_epoch_ms();

        // Perform atomic update in repository (strictly preserves encrypted_api_key & current_month_spend)
        self.database_manager
            .with_connection(|conn| {
                CredentialRepository::update_preferences(
                    conn,
                    &provider_id,
                    new_base_url.as_deref(),
                    new_active,
                    new_priority,
                    new_budget,
                    now,
                )
            })
            .map_err(|e| AppError::Database(format!("Failed to update provider preferences: {}", e)))?;

        Ok(ProviderCredentialStatus {
            provider_id,
            is_configured: true,
            base_url: new_base_url,
            is_active: new_active,
            priority_weight: new_priority,
            monthly_budget_limit: new_budget,
            current_month_spend: existing.current_month_spend,
            updated_at: now,
        })
    }

    /// Resets provider preferences to documented defaults:
    /// is_active = true, priority_weight = 5, monthly_budget_limit = None, base_url = None.
    /// Strictly preserves encrypted credentials and current_month_spend.
    pub fn reset_provider_preferences(
        &self,
        provider_id: &str,
    ) -> Result<ProviderCredentialStatus, AppError> {
        let validated_id = Self::validate_provider_id(provider_id)?;

        let existing = self
            .database_manager
            .with_connection(|conn| CredentialRepository::get_by_provider(conn, &validated_id))
            .map_err(|e| AppError::Database(format!("Database error during provider lookup: {}", e)))?
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Cannot reset preferences for unconfigured provider '{}'",
                    validated_id
                ))
            })?;

        let now = current_epoch_ms();
        let default_active = true;
        let default_priority = 5u8;
        let default_budget: Option<f64> = None;
        let default_base_url: Option<&str> = None;

        self.database_manager
            .with_connection(|conn| {
                CredentialRepository::reset_preferences(
                    conn,
                    &validated_id,
                    default_base_url,
                    default_active,
                    default_priority,
                    default_budget,
                    now,
                )
            })
            .map_err(|e| AppError::Database(format!("Failed to reset provider preferences: {}", e)))?;

        Ok(ProviderCredentialStatus {
            provider_id: validated_id,
            is_configured: true,
            base_url: None,
            is_active: default_active,
            priority_weight: default_priority,
            monthly_budget_limit: default_budget,
            current_month_spend: existing.current_month_spend,
            updated_at: now,
        })
    }

    /// Toggles the active status of a provider.
    pub fn set_provider_active(
        &self,
        provider_id: &str,
        is_active: bool,
    ) -> Result<ProviderCredentialStatus, AppError> {
        let validated_id = Self::validate_provider_id(provider_id)?;

        let existing = self
            .database_manager
            .with_connection(|conn| CredentialRepository::get_by_provider(conn, &validated_id))
            .map_err(|e| AppError::Database(format!("Database error during provider lookup: {}", e)))?
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Cannot toggle status for unconfigured provider '{}'",
                    validated_id
                ))
            })?;

        let now = current_epoch_ms();

        self.database_manager
            .with_connection(|conn| CredentialRepository::set_active(conn, &validated_id, is_active, now))
            .map_err(|e| AppError::Database(format!("Failed to update provider active status: {}", e)))?;

        Ok(ProviderCredentialStatus {
            provider_id: validated_id,
            is_configured: true,
            base_url: existing.base_url,
            is_active,
            priority_weight: existing.priority_weight,
            monthly_budget_limit: existing.monthly_budget_limit,
            current_month_spend: existing.current_month_spend,
            updated_at: now,
        })
    }
}

