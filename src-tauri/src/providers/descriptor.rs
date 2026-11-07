// ============================================================================
// Nano Route - Provider & Model Registry Descriptors
// File: src-tauri/src/providers/descriptor.rs
// ============================================================================
// Authoritative static descriptors and effective configuration models.
// Strictly factual; plaintext credentials and DPAPI blobs are completely absent.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::domain::credentials::ProviderCredentialStatus;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::identity::ProviderId;
use crate::providers::models::ProviderModel;

/// Technical implementation state of a provider client in the native core.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderImplementationState {
    /// Cataloged and specified in registry; client integration planned in roadmap.
    Planned,
    /// Fully implemented native provider client connected to runtime.
    Implemented,
    /// Temporarily or permanently unavailable in current build environment.
    Unavailable,
}

/// Operational lifecycle state of a provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderLifecycleState {
    /// General availability for application execution.
    Active,
    /// Deprecated by upstream or vendor; historical compatibility maintained.
    Deprecated,
    /// Globally disabled by application configuration.
    Disabled,
}

/// Authoritative static descriptor of an AI provider.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderDescriptor {
    /// Canonical machine-readable provider identifier.
    pub provider_id: ProviderId,
    /// Human-readable brand/display name.
    pub display_name: String,
    /// Short description of the provider.
    pub description: String,
    /// Canonical default API base URL.
    pub default_base_url: String,
    /// Public developer documentation URL.
    pub documentation_url: Option<String>,
    /// Capabilities supported at the provider infrastructure level.
    pub capabilities: ProviderCapabilities,
    /// Implementation readiness in the application codebase.
    pub implementation_state: ProviderImplementationState,
    /// Operational lifecycle status.
    pub lifecycle_state: ProviderLifecycleState,
    /// Canonical model ID recommended as provider default.
    pub default_model_id: Option<String>,
    /// Whether this provider requires authentication credentials (DPAPI API key).
    pub credential_required: bool,
}

impl ProviderDescriptor {
    pub fn new(
        provider_id: ProviderId,
        display_name: impl Into<String>,
        description: impl Into<String>,
        default_base_url: impl Into<String>,
        capabilities: ProviderCapabilities,
    ) -> Self {
        Self {
            provider_id,
            display_name: display_name.into(),
            description: description.into(),
            default_base_url: default_base_url.into(),
            documentation_url: None,
            capabilities,
            implementation_state: ProviderImplementationState::Planned,
            lifecycle_state: ProviderLifecycleState::Active,
            default_model_id: None,
            credential_required: true,
        }
    }

    pub fn with_documentation_url(mut self, url: impl Into<String>) -> Self {
        self.documentation_url = Some(url.into());
        self
    }

    pub fn with_default_model(mut self, model_id: impl Into<String>) -> Self {
        self.default_model_id = Some(model_id.into());
        self
    }

    pub fn with_implementation_state(mut self, state: ProviderImplementationState) -> Self {
        self.implementation_state = state;
        self
    }

    pub fn with_credential_required(mut self, required: bool) -> Self {
        self.credential_required = required;
        self
    }

    pub fn supports_capability(&self, cap: ProviderCapability) -> bool {
        self.capabilities.supports(cap)
    }
}

/// Resolved effective configuration combining static registry metadata with user preferences.
/// Plaintext API keys and encrypted BLOBs are strictly absent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EffectiveProviderDescriptor {
    pub provider_id: String,
    pub display_name: String,
    pub description: String,
    pub default_base_url: String,
    pub effective_base_url: String,
    pub documentation_url: Option<String>,
    pub is_active: bool,
    pub priority_weight: u8,
    pub monthly_budget_limit: Option<f64>,
    pub current_month_spend: f64,
    pub is_credential_configured: bool,
    pub credential_required: bool,
    pub implementation_state: ProviderImplementationState,
    pub lifecycle_state: ProviderLifecycleState,
    pub default_model_id: Option<String>,
    pub models: Vec<ProviderModel>,
}

impl EffectiveProviderDescriptor {
    pub fn resolve(
        descriptor: &ProviderDescriptor,
        models: Vec<ProviderModel>,
        preference: Option<&ProviderCredentialStatus>,
    ) -> Self {
        let (effective_base_url, is_active, priority_weight, monthly_budget_limit, current_month_spend, is_credential_configured) =
            if let Some(pref) = preference {
                (
                    pref.base_url.clone().unwrap_or_else(|| descriptor.default_base_url.clone()),
                    pref.isActive,
                    pref.priorityWeight,
                    pref.monthlyBudgetLimit,
                    pref.currentMonthSpend,
                    pref.isConfigured,
                )
            } else {
                (
                    descriptor.default_base_url.clone(),
                    true, // Default active
                    5u8,  // Default priority
                    None,
                    0.0,
                    false,
                )
            };

        Self {
            provider_id: descriptor.provider_id.as_str().to_string(),
            display_name: descriptor.display_name.clone(),
            description: descriptor.description.clone(),
            default_base_url: descriptor.default_base_url.clone(),
            effective_base_url,
            documentation_url: descriptor.documentation_url.clone(),
            is_active,
            priority_weight,
            monthly_budget_limit,
            current_month_spend,
            is_credential_configured,
            credential_required: descriptor.credential_required,
            implementation_state: descriptor.implementation_state,
            lifecycle_state: descriptor.lifecycle_state,
            default_model_id: descriptor.default_model_id.clone(),
            models,
        }
    }
}

/// Fallback descriptor for historical models loaded from persistent chat or telemetry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalModelReference {
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub is_known_in_active_registry: bool,
}

