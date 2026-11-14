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
    // Step 66 Keys
    AppearanceThemeMode,
    AppearanceDensity,
    AppearanceReducedMotion,
    AppearanceTextScale,
    AppearanceEnhancedFocus,
    WorkspaceStartupRoute,
    WorkspaceSidebarCollapsed,
    WorkspaceConfirmChatClear,
    ChatShowTimestamps,
    ChatCompactSpacing,
    ChatEnterToSend,
    ChatAutoScrollToBottom,
    NotificationsEnableNonCriticalToasts,
    NotificationsToastDurationMs,
    PaletteShowDescriptions,
    PaletteShowShortcuts,
    // Step 67 Keys
    WorkspaceActiveProfileId,
    WorkspaceProfiles,
    // Step 68 Keys
    WorkspaceSessionState,
    WorkspaceLastExitStatus,
    WorkspaceRestorePreviousSession,
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
            Self::AppearanceThemeMode => "appearance.theme_mode",
            Self::AppearanceDensity => "appearance.density",
            Self::AppearanceReducedMotion => "appearance.reduced_motion",
            Self::AppearanceTextScale => "appearance.text_scale",
            Self::AppearanceEnhancedFocus => "appearance.enhanced_focus",
            Self::WorkspaceStartupRoute => "workspace.startup_route",
            Self::WorkspaceSidebarCollapsed => "workspace.sidebar_collapsed",
            Self::WorkspaceConfirmChatClear => "workspace.confirm_chat_clear",
            Self::ChatShowTimestamps => "chat.show_timestamps",
            Self::ChatCompactSpacing => "chat.compact_spacing",
            Self::ChatEnterToSend => "chat.enter_to_send",
            Self::ChatAutoScrollToBottom => "chat.auto_scroll_to_bottom",
            Self::NotificationsEnableNonCriticalToasts => "notifications.enable_non_critical_toasts",
            Self::NotificationsToastDurationMs => "notifications.toast_duration_ms",
            Self::PaletteShowDescriptions => "palette.show_descriptions",
            Self::PaletteShowShortcuts => "palette.show_shortcuts",
            Self::WorkspaceActiveProfileId => "workspace.active_profile_id",
            Self::WorkspaceProfiles => "workspace.profiles",
            Self::WorkspaceSessionState => "workspace.session_state",
            Self::WorkspaceLastExitStatus => "workspace.last_exit_status",
            Self::WorkspaceRestorePreviousSession => "workspace.restore_previous_session",
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
            "appearance.theme_mode" => Some(Self::AppearanceThemeMode),
            "appearance.density" => Some(Self::AppearanceDensity),
            "appearance.reduced_motion" => Some(Self::AppearanceReducedMotion),
            "appearance.text_scale" => Some(Self::AppearanceTextScale),
            "appearance.enhanced_focus" => Some(Self::AppearanceEnhancedFocus),
            "workspace.startup_route" => Some(Self::WorkspaceStartupRoute),
            "workspace.sidebar_collapsed" => Some(Self::WorkspaceSidebarCollapsed),
            "workspace.confirm_chat_clear" => Some(Self::WorkspaceConfirmChatClear),
            "chat.show_timestamps" => Some(Self::ChatShowTimestamps),
            "chat.compact_spacing" => Some(Self::ChatCompactSpacing),
            "chat.enter_to_send" => Some(Self::ChatEnterToSend),
            "chat.auto_scroll_to_bottom" => Some(Self::ChatAutoScrollToBottom),
            "notifications.enable_non_critical_toasts" => Some(Self::NotificationsEnableNonCriticalToasts),
            "notifications.toast_duration_ms" => Some(Self::NotificationsToastDurationMs),
            "palette.show_descriptions" => Some(Self::PaletteShowDescriptions),
            "palette.show_shortcuts" => Some(Self::PaletteShowShortcuts),
            "workspace.active_profile_id" => Some(Self::WorkspaceActiveProfileId),
            "workspace.profiles" => Some(Self::WorkspaceProfiles),
            "workspace.session_state" => Some(Self::WorkspaceSessionState),
            "workspace.last_exit_status" => Some(Self::WorkspaceLastExitStatus),
            "workspace.restore_previous_session" => Some(Self::WorkspaceRestorePreviousSession),
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
    // Step 66 User Preferences
    #[serde(default = "default_theme_mode")]
    pub theme_mode: String,
    #[serde(default = "default_density")]
    pub density: String,
    #[serde(default = "default_reduced_motion")]
    pub reduced_motion: String,
    #[serde(default = "default_text_scale")]
    pub text_scale: String,
    #[serde(default)]
    pub enhanced_focus: bool,
    #[serde(default = "default_startup_route")]
    pub startup_route: String,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default = "default_true")]
    pub confirm_chat_clear: bool,
    #[serde(default)]
    pub chat_show_timestamps: bool,
    #[serde(default)]
    pub chat_compact_spacing: bool,
    #[serde(default = "default_true")]
    pub chat_enter_to_send: bool,
    #[serde(default = "default_true")]
    pub chat_auto_scroll: bool,
    #[serde(default = "default_true")]
    pub notification_enable_non_critical_toasts: bool,
    #[serde(default = "default_toast_duration")]
    pub notification_toast_duration_ms: u32,
    #[serde(default = "default_true")]
    pub palette_show_descriptions: bool,
    #[serde(default = "default_true")]
    pub palette_show_shortcuts: bool,
    // Step 67 Workspace Profiles
    #[serde(default = "default_active_profile_id")]
    pub active_profile_id: String,
    #[serde(default = "default_profiles_json")]
    pub custom_profiles_json: String,
    // Step 68 Session Continuity & Safe Restoration
    #[serde(default)]
    pub session_state_json: String,
    #[serde(default = "default_last_exit_status")]
    pub last_exit_status: String,
    #[serde(default = "default_true")]
    pub restore_previous_session: bool,
}

fn default_theme_mode() -> String { "dark".to_string() }
fn default_density() -> String { "comfortable".to_string() }
fn default_reduced_motion() -> String { "system".to_string() }
fn default_text_scale() -> String { "100%".to_string() }
fn default_startup_route() -> String { "overview".to_string() }
fn default_true() -> bool { true }
fn default_toast_duration() -> u32 { 5000 }
fn default_active_profile_id() -> String { "prof_default".to_string() }
fn default_profiles_json() -> String { "[]".to_string() }
fn default_last_exit_status() -> String { "clean_exit".to_string() }

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
            theme_mode: default_theme_mode(),
            density: default_density(),
            reduced_motion: default_reduced_motion(),
            text_scale: default_text_scale(),
            enhanced_focus: false,
            startup_route: default_startup_route(),
            sidebar_collapsed: false,
            confirm_chat_clear: true,
            chat_show_timestamps: false,
            chat_compact_spacing: false,
            chat_enter_to_send: true,
            chat_auto_scroll: true,
            notification_enable_non_critical_toasts: true,
            notification_toast_duration_ms: 5000,
            palette_show_descriptions: true,
            palette_show_shortcuts: true,
            active_profile_id: default_active_profile_id(),
            custom_profiles_json: default_profiles_json(),
            session_state_json: String::new(),
            last_exit_status: default_last_exit_status(),
            restore_previous_session: true,
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

