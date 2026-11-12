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
    ManualOverrideEnabled,
    ManualOverrideProvider,
    ManualOverrideModel,
}

impl AppSettingKey {
    pub fn as_key_str(&self) -> &'static str {
        match self {
            Self::RoutingPreferenceMode => "routing.preference_mode",
            Self::TelemetryEnabled => "telemetry.enabled",
            Self::HistoryRetentionDays => "history.retention_days",
            Self::WindowStartMaximized => "window.start_maximized",
            Self::ManualOverrideEnabled => "routing.manual_override_enabled",
            Self::ManualOverrideProvider => "routing.manual_override_provider",
            Self::ManualOverrideModel => "routing.manual_override_model",
        }
    }

    pub fn from_key_str(s: &str) -> Option<Self> {
        match s.trim() {
            "routing.preference_mode" => Some(Self::RoutingPreferenceMode),
            "telemetry.enabled" => Some(Self::TelemetryEnabled),
            "history.retention_days" => Some(Self::HistoryRetentionDays),
            "window.start_maximized" => Some(Self::WindowStartMaximized),
            "routing.manual_override_enabled" => Some(Self::ManualOverrideEnabled),
            "routing.manual_override_provider" => Some(Self::ManualOverrideProvider),
            "routing.manual_override_model" => Some(Self::ManualOverrideModel),
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
    #[serde(default)]
    pub manual_override_enabled: bool,
    #[serde(default)]
    pub manual_override_provider: String,
    #[serde(default)]
    pub manual_override_model: String,
}

impl Default for AppSettingsSnapshot {
    fn default() -> Self {
        Self {
            routing_preference_mode: RoutingPreferenceMode::Balanced,
            telemetry_enabled: true,
            history_retention_days: 0, // 0 = indefinite/unlimited local retention
            window_start_maximized: false,
            manual_override_enabled: false,
            manual_override_provider: String::new(),
            manual_override_model: String::new(),
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

/// Safe non-secret summary of a registered provider for the settings workspace.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderSettingsSummary {
    pub provider_id: String,
    pub display_name: String,
    pub description: String,
    pub default_base_url: String,
    pub documentation_url: Option<String>,
    pub configured_base_url: Option<String>,
    pub is_configured: bool,
    pub is_active: bool,
    pub priority_weight: u8,
    pub monthly_budget_limit: Option<f64>,
    pub current_month_spend: f64,
    pub health_state: String,
    pub health_checked_at_ms: Option<i64>,
    pub model_count: usize,
    pub default_model_id: String,
    pub capabilities: Vec<String>,
}

/// Safe non-secret summary of a registered model for the settings workspace.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelSettingsSummary {
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub is_active: bool,
    pub context_window: u32,
    pub max_output_tokens: u32,
    pub is_default: bool,
    pub capabilities: Vec<String>,
}

/// High-level security and privacy status indicators for the settings workspace.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityStatusSummary {
    pub dpapi_protection_active: bool,
    pub local_storage_type: String,
    pub plaintext_keys_prohibited: bool,
    pub remote_sync_disabled: bool,
    pub last_audit_time_ms: Option<i64>,
}

/// Consolidated settings workspace snapshot returned in a single IPC call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsWorkspaceSnapshot {
    pub app_settings: AppSettingsSnapshot,
    pub providers: Vec<ProviderSettingsSummary>,
    pub models: Vec<ModelSettingsSummary>,
    pub routing_policy: crate::routing::policy::config::RoutingPolicyConfig,
    pub security_status: SecurityStatusSummary,
}

