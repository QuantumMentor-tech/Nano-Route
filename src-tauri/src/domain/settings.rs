// ============================================================================
// Nano Route - Application Settings Domain Entities
// File: src-tauri/src/domain/settings.rs
// ============================================================================
// Authoritative domain types for typed application settings and
// provider preference updates. Plaintext secrets are strictly excluded.
// ============================================================================

use serde::{Deserialize, Serialize};

/// User-selectable routing preference mode.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RoutingPreferenceMode {
    Quality,
    Balanced,
    CostSaving,
}

impl RoutingPreferenceMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Quality => "quality",
            Self::Balanced => "balanced",
            Self::CostSaving => "cost_saving",
        }
    }

    pub fn from_str_strict(s: &str) -> Option<Self> {
        match s.trim().to_lowercase().as_str() {
            "quality" => Some(Self::Quality),
            "balanced" => Some(Self::Balanced),
            "cost_saving" => Some(Self::CostSaving),
            _ => None,
        }
    }
}

impl Default for RoutingPreferenceMode {
    fn default() -> Self {
        Self::Balanced
    }
}

/// Canonical typed keys for application settings in `app_settings` table.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AppSettingKey {
    RoutingPreferenceMode,
    TelemetryEnabled,
    HistoryRetentionDays,
    WindowStartMaximized,
}

impl AppSettingKey {
    pub fn as_key_str(&self) -> &'static str {
        match self {
            Self::RoutingPreferenceMode => "routing.preference_mode",
            Self::TelemetryEnabled => "telemetry.enabled",
            Self::HistoryRetentionDays => "history.retention_days",
            Self::WindowStartMaximized => "window.start_maximized",
        }
    }

    pub fn from_key_str(s: &str) -> Option<Self> {
        match s.trim() {
            "routing.preference_mode" => Some(Self::RoutingPreferenceMode),
            "telemetry.enabled" => Some(Self::TelemetryEnabled),
            "history.retention_days" => Some(Self::HistoryRetentionDays),
            "window.start_maximized" => Some(Self::WindowStartMaximized),
            _ => None,
        }
    }
}

/// Authoritative snapshot of application-level user preferences.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsSnapshot {
    pub routing_preference_mode: RoutingPreferenceMode,
    pub telemetry_enabled: bool,
    pub history_retention_days: u32,
    pub window_start_maximized: bool,
}

impl Default for AppSettingsSnapshot {
    fn default() -> Self {
        Self {
            routing_preference_mode: RoutingPreferenceMode::Balanced,
            telemetry_enabled: true,
            history_retention_days: 0, // 0 = indefinite/unlimited local retention
            window_start_maximized: false,
        }
    }
}

/// Input DTO for updating non-secret provider preferences.
/// Plaintext API keys and encrypted BLOBs are strictly absent.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProviderPreferencesInput {
    pub provider_id: String,
    pub base_url: Option<String>,
    pub is_active: Option<bool>,
    pub priority_weight: Option<u8>,
    pub monthly_budget_limit: Option<f64>,
}

