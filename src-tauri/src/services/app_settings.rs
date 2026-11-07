// ============================================================================
// Nano Route - Application Settings Service
// File: src-tauri/src/services/app_settings.rs
// ============================================================================
// Typed application settings service orchestrating persistent user preferences,
// virtual defaults, strict validation, and non-secret in-memory caching.
// Plaintext secrets or credentials must NEVER enter this service.
// ============================================================================

use crate::domain::settings::{AppSettingKey, AppSettingsSnapshot, RoutingPreferenceMode};
use crate::errors::AppError;
use crate::storage::repositories::AppSettingsRepository;
use crate::storage::DatabaseManager;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

pub struct AppSettingsService {
    database_manager: Arc<DatabaseManager>,
    cache: RwLock<Option<HashMap<String, String>>>,
}

impl AppSettingsService {
    pub fn new(database_manager: Arc<DatabaseManager>) -> Self {
        Self {
            database_manager,
            cache: RwLock::new(None),
        }
    }

    /// Validates raw string value according to the canonical setting key rules.
    pub fn validate_setting_value(key: AppSettingKey, value: &str) -> Result<String, AppError> {
        let trimmed = value.trim();

        match key {
            AppSettingKey::RoutingPreferenceMode => {
                if let Some(mode) = RoutingPreferenceMode::from_str_strict(trimmed) {
                    Ok(mode.as_str().to_string())
                } else {
                    Err(AppError::InvalidInput(format!(
                        "Invalid routing preference mode '{}'. Allowed: [quality, balanced, cost_saving]",
                        trimmed
                    )))
                }
            }
            AppSettingKey::TelemetryEnabled => {
                let lower = trimmed.to_lowercase();
                if lower == "true" || lower == "false" {
                    Ok(lower)
                } else {
                    Err(AppError::InvalidInput(format!(
                        "Invalid boolean value '{}' for telemetry.enabled. Allowed: [true, false]",
                        trimmed
                    )))
                }
            }
            AppSettingKey::HistoryRetentionDays => {
                match trimmed.parse::<u32>() {
                    Ok(days) if days <= 365 => Ok(days.to_string()),
                    _ => Err(AppError::InvalidInput(format!(
                        "Invalid retention days '{}'. Must be an integer between 0 and 365 (0 = unlimited)",
                        trimmed
                    ))),
                }
            }
            AppSettingKey::WindowStartMaximized => {
                let lower = trimmed.to_lowercase();
                if lower == "true" || lower == "false" {
                    Ok(lower)
                } else {
                    Err(AppError::InvalidInput(format!(
                        "Invalid boolean value '{}' for window.start_maximized. Allowed: [true, false]",
                        trimmed
                    )))
                }
            }
        }
    }

    /// Loads all raw settings from SQLite or cache.
    fn get_all_raw(&self) -> Result<HashMap<String, String>, AppError> {
        {
            let cache_read = self.cache.read().map_err(|_| {
                AppError::Internal("Settings cache lock poisoned on read".to_string())
            })?;
            if let Some(ref map) = *cache_read {
                return Ok(map.clone());
            }
        }

        let settings_list = self
            .database_manager
            .with_connection(|conn| AppSettingsRepository::list_all(conn))
            .map_err(|e| AppError::Database(format!("Failed to load application settings: {}", e)))?;

        let mut map = HashMap::new();
        for (k, v) in settings_list {
            map.insert(k, v);
        }

        let mut cache_write = self.cache.write().map_err(|_| {
            AppError::Internal("Settings cache lock poisoned on write".to_string())
        })?;
        *cache_write = Some(map.clone());

        Ok(map)
    }

    /// Invalidate the non-secret in-memory cache.
    pub fn invalidate_cache(&self) {
        if let Ok(mut cache_write) = self.cache.write() {
            *cache_write = None;
        }
    }

    /// Retrieves the authoritative typed snapshot of all application settings,
    /// resolving virtual defaults for unconfigured settings and handling corrupt rows safely.
    pub fn get_snapshot(&self) -> Result<AppSettingsSnapshot, AppError> {
        let raw_map = self.get_all_raw()?;
        let mut snapshot = AppSettingsSnapshot::default();

        if let Some(val) = raw_map.get(AppSettingKey::RoutingPreferenceMode.as_key_str()) {
            if let Some(mode) = RoutingPreferenceMode::from_str_strict(val) {
                snapshot.routing_preference_mode = mode;
            }
        }

        if let Some(val) = raw_map.get(AppSettingKey::TelemetryEnabled.as_key_str()) {
            if val.eq_ignore_ascii_case("true") {
                snapshot.telemetry_enabled = true;
            } else if val.eq_ignore_ascii_case("false") {
                snapshot.telemetry_enabled = false;
            }
        }

        if let Some(val) = raw_map.get(AppSettingKey::HistoryRetentionDays.as_key_str()) {
            if let Ok(days) = val.parse::<u32>() {
                if days <= 365 {
                    snapshot.history_retention_days = days;
                }
            }
        }

        if let Some(val) = raw_map.get(AppSettingKey::WindowStartMaximized.as_key_str()) {
            if val.eq_ignore_ascii_case("true") {
                snapshot.window_start_maximized = true;
            } else if val.eq_ignore_ascii_case("false") {
                snapshot.window_start_maximized = false;
            }
        }

        Ok(snapshot)
    }

    /// Retrieves the effective string value for a specific setting key,
    /// returning the default if not explicitly persisted.
    pub fn get_setting(&self, key: AppSettingKey) -> Result<String, AppError> {
        let raw_map = self.get_all_raw()?;

        if let Some(val) = raw_map.get(key.as_key_str()) {
            // Validate stored value; if valid return it, otherwise fallback to default
            if let Ok(valid_val) = Self::validate_setting_value(key, val) {
                return Ok(valid_val);
            }
        }

        // Return virtual default
        let default_snapshot = AppSettingsSnapshot::default();
        let default_val = match key {
            AppSettingKey::RoutingPreferenceMode => default_snapshot.routing_preference_mode.as_str().to_string(),
            AppSettingKey::TelemetryEnabled => default_snapshot.telemetry_enabled.to_string(),
            AppSettingKey::HistoryRetentionDays => default_snapshot.history_retention_days.to_string(),
            AppSettingKey::WindowStartMaximized => default_snapshot.window_start_maximized.to_string(),
        };

        Ok(default_val)
    }

    /// Sets and persists a typed application setting after strict domain validation.
    pub fn set_setting(&self, key: AppSettingKey, raw_value: &str) -> Result<(), AppError> {
        let validated_value = Self::validate_setting_value(key, raw_value)?;
        let key_str = key.as_key_str();

        self.database_manager
            .with_connection(|conn| AppSettingsRepository::set(conn, key_str, &validated_value))
            .map_err(|e| AppError::Database(format!("Failed to persist setting '{}': {}", key_str, e)))?;

        // Update in-memory cache
        if let Ok(mut cache_write) = self.cache.write() {
            if let Some(ref mut map) = *cache_write {
                map.insert(key_str.to_string(), validated_value);
            }
        }

        Ok(())
    }

    /// Resets a specific setting back to its virtual default by deleting its row from SQLite.
    pub fn reset_setting(&self, key: AppSettingKey) -> Result<bool, AppError> {
        let key_str = key.as_key_str();

        let removed = self
            .database_manager
            .with_connection(|conn| AppSettingsRepository::delete(conn, key_str))
            .map_err(|e| AppError::Database(format!("Failed to reset setting '{}': {}", key_str, e)))?;

        // Invalidate or update cache
        if let Ok(mut cache_write) = self.cache.write() {
            if let Some(ref mut map) = *cache_write {
                map.remove(key_str);
            }
        }

        Ok(removed)
    }

    /// Resets all application settings to virtual defaults.
    pub fn reset_all_settings(&self) -> Result<usize, AppError> {
        let count = self
            .database_manager
            .with_connection(|conn| AppSettingsRepository::clear_all(conn))
            .map_err(|e| AppError::Database(format!("Failed to clear settings: {}", e)))?;

        self.invalidate_cache();
        Ok(count)
    }
}

