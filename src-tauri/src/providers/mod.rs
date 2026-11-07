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

pub mod capabilities;
pub mod client;
pub mod catalog;
pub mod descriptor;
pub mod errors;
pub mod health;
pub mod identity;
pub mod mock;
pub mod models;
pub mod registry;
pub mod request;
pub mod response;

// Primary re-exports for service layers and consumers
pub use capabilities::{ProviderCapabilities, ProviderCapability};
pub use catalog::builtin_catalog;
pub use client::{ProviderClient, ProviderMetadata};
pub use descriptor::{
    EffectiveProviderDescriptor, HistoricalModelReference, ProviderDescriptor,
    ProviderImplementationState, ProviderLifecycleState,
};
pub use errors::{ProviderError, ProviderErrorKind};
pub use health::{ProviderHealth, ProviderHealthReport};
pub use identity::ProviderId;
pub use mock::{MockProviderClient, MockProviderDynamicConfig};
pub use models::{ModelAvailability, ModelPricing, ProviderModel};
pub use registry::ProviderRegistry;
pub use request::{ChatMessage, GenerationParams, MessageRole, ProviderRequest, RequestMetadata, ToolDefinition};
pub use response::{ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata};
