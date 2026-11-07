//! Provider Model Descriptor
//!
//! Responsibility:
//! - Provider-neutral specification of an AI model's physical and technical facts.
//! - Context window limits, capability associations, and token pricing specifications.
//! - Strictly factual; contains no scoring, ranking, or routing heuristics.

use serde::{Deserialize, Serialize};
use crate::providers::capabilities::ProviderCapabilities;
use crate::providers::identity::ProviderId;

/// Availability state of a model within a provider's catalog.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ModelAvailability {
    /// Fully available for general production use.
    Available,
    /// Experimental or preview release.
    Preview,
    /// Deprecated by provider; planned for decommission.
    Deprecated,
    /// Temporarily or permanently offline.
    Unavailable,
}

/// Token pricing specification per one million tokens.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelPricing {
    /// Cost in USD per 1M input tokens.
    pub input_cost_per_million: Option<f64>,
    /// Cost in USD per 1M output tokens.
    pub output_cost_per_million: Option<f64>,
    /// ISO 4217 Currency code (default "USD").
    pub currency: String,
}

impl ModelPricing {
    pub fn usd(input: f64, output: f64) -> Self {
        Self {
            input_cost_per_million: Some(input),
            output_cost_per_million: Some(output),
            currency: "USD".to_string(),
        }
    }
}

/// Normalized descriptor for an AI model provided by an external or local service.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderModel {
    /// Owning provider identifier.
    pub provider_id: ProviderId,
    /// Canonical model identifier on the provider's API (e.g., "claude-3-5-sonnet-20241022").
    pub model_id: String,
    /// Human-readable display label (e.g., "Claude 3.5 Sonnet").
    pub display_name: String,
    /// Optional concise factual description.
    pub description: Option<String>,
    /// Maximum total context window in tokens.
    pub context_window: u32,
    /// Maximum output generation tokens limit, if specified.
    pub max_output_tokens: Option<u32>,
    /// Set of capabilities supported by this model.
    pub capabilities: ProviderCapabilities,
    /// Optional token cost descriptor.
    pub pricing: Option<ModelPricing>,
    /// Operational availability status.
    pub availability: ModelAvailability,
    /// Whether this is the default recommended model for this provider.
    pub is_default: bool,
}

impl ProviderModel {
    /// Constructs a basic model descriptor.
    pub fn new(
        provider_id: ProviderId,
        model_id: impl Into<String>,
        display_name: impl Into<String>,
        context_window: u32,
        capabilities: ProviderCapabilities,
    ) -> Self {
        Self {
            provider_id,
            model_id: model_id.into(),
            display_name: display_name.into(),
            description: None,
            context_window,
            max_output_tokens: None,
            capabilities,
            pricing: None,
            availability: ModelAvailability::Available,
            is_default: false,
        }
    }

    /// Attaches an optional concise description.
    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    /// Attaches pricing information to the descriptor.
    pub fn with_pricing(mut self, pricing: ModelPricing) -> Self {
        self.pricing = Some(pricing);
        self
    }

    /// Attaches a maximum output tokens limit.
    pub fn with_max_output_tokens(mut self, max_tokens: u32) -> Self {
        self.max_output_tokens = Some(max_tokens);
        self
    }

    /// Marks this model as the provider's default model.
    pub fn with_default(mut self, is_default: bool) -> Self {
        self.is_default = is_default;
        self
    }

    /// Sets the operational availability status.
    pub fn with_availability(mut self, availability: ModelAvailability) -> Self {
        self.availability = availability;
        self
    }

    /// Checks if this model supports a specific capability.
    pub fn supports_capability(&self, cap: crate::providers::capabilities::ProviderCapability) -> bool {
        self.capabilities.supports(cap)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::providers::capabilities::ProviderCapability;

    #[test]
    fn test_model_descriptor_construction() {
        let pid = ProviderId::new("anthropic").unwrap();
        let model = ProviderModel::new(
            pid.clone(),
            "claude-3-5-sonnet",
            "Claude 3.5 Sonnet",
            200_000,
            ProviderCapabilities::standard_chat().with_capability(ProviderCapability::Vision),
        )
        .with_pricing(ModelPricing::usd(3.0, 15.0))
        .with_max_output_tokens(8192);

        assert_eq!(model.provider_id.as_str(), "anthropic");
        assert_eq!(model.context_window, 200_000);
        assert_eq!(model.max_output_tokens, Some(8192));
        assert!(model.capabilities.supports(ProviderCapability::Vision));
        assert_eq!(model.pricing.unwrap().input_cost_per_million, Some(3.0));
    }
}

