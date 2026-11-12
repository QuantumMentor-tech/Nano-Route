// ============================================================================
// Nano Route — AI Provider Abstraction & Adapters
// File: src-tauri/src/providers/mod.rs
// ============================================================================
// Responsibility:
// - Standardized ProviderClient trait defining completion contracts.
// - Concrete provider descriptors, normalized requests, responses, errors, and health.
// - In-memory mock double for test execution and lifecycle verification.
// - Must NOT define routing decisions or persist API keys directly.
// ============================================================================

pub mod anthropic;
pub mod capabilities;
pub mod capability_service;
pub mod client;
pub mod catalog;
pub mod deepseek;
pub mod descriptor;
pub mod errors;
pub mod gemini;
pub mod groq;
pub mod health;
pub mod health_manager;
pub mod health_types;
pub mod identity;
pub mod mistral;
pub mod mock;
pub mod models;
pub mod openai;
pub mod preflight;
pub mod pricing;
pub mod probe;
pub mod registry;
pub mod request;
pub mod resolver;
pub mod response;
pub mod shared;

#[cfg(test)]
pub mod health_tests;

// Primary re-exports for service layers and consumers
pub use anthropic::AnthropicClient;
pub use capabilities::{ProviderCapabilities, ProviderCapability};
pub use capability_service::{
    AdapterCapabilities, CapabilityEvaluationResult, ProviderCapabilityService, RequestRequirements,
};
pub use catalog::builtin_catalog;
pub use client::{ProviderClient, ProviderMetadata};
pub use deepseek::DeepSeekClient;
pub use descriptor::{
    EffectiveProviderDescriptor, HistoricalModelReference, ProviderDescriptor,
    ProviderImplementationState, ProviderLifecycleState,
};
pub use errors::{ProviderError, ProviderErrorKind};
pub use gemini::GeminiClient;
pub use groq::GroqClient;
pub use health::{ProviderHealth, ProviderHealthReport};
pub use health_manager::{current_time_ms, ProviderHealthManager, DEFAULT_HEALTH_FRESHNESS_TTL_MS};
pub use health_types::{
    HealthObservationOutcome, HealthObservationSource, ModelHealthSnapshot,
    ProviderHealthObservation, ProviderHealthSnapshot, RateLimitInfo, RuntimeHealthState,
};
pub use identity::ProviderId;
pub use mistral::MistralClient;
pub use mock::{MockProviderClient, MockProviderDynamicConfig};
pub use models::{ModelAvailability, ModelPricing, ProviderModel};
pub use openai::OpenAiClient;
pub use preflight::{PreflightBlockReason, PreflightEvaluation, PreflightEvaluator};
pub use pricing::{
    builtin_versioned_pricing_table, canonicalize_pricing_model_id,
    canonicalize_pricing_provider_id, compute_token_cost_nano_usd, nano_usd_to_f64,
    resolve_versioned_model_pricing, usd_to_nano_usd, VersionedModelPricingEntry,
    DEFAULT_BASELINE_MODEL_ID, DEFAULT_BASELINE_PROVIDER_ID, NANO_USD_PER_DOLLAR,
};
pub use probe::{
    DefaultHealthProbeRunner, HealthCheckResult, HealthProbeRunner, ProviderHealthProbeService,
};
pub use registry::ProviderRegistry;
pub use resolver::ProviderResolver;
pub use request::{ChatMessage, GenerationParams, MessageRole, ProviderRequest, RequestMetadata, ToolDefinition};
pub use response::{ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata};
