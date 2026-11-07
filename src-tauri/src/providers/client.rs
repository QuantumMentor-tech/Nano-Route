// ============================================================================
// Nano Route - Provider Client Abstraction Contract
// File: src-tauri/src/providers/client.rs
// ============================================================================
// The single unified Rust contract implemented by all AI provider adapters
// (OpenAI, Anthropic, Gemini, DeepSeek, Mistral, xAI, Groq, local models, etc.).
// Enables dynamic dispatch, cooperative cancellation, and strict isolation.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::ProviderCapabilities;
use crate::providers::errors::ProviderError;
use crate::providers::health::ProviderHealthReport;
use crate::providers::identity::ProviderId;
use crate::providers::models::ProviderModel;
use crate::providers::request::ProviderRequest;
use crate::providers::response::ProviderResponse;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Immutable metadata and declared descriptors for a registered AI provider.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderMetadata {
    /// Strongly-typed provider identifier.
    pub id: ProviderId,
    /// Human-readable brand or service display name (e.g. "Anthropic").
    pub name: String,
    /// Brief description of the provider's characteristics and typical use cases.
    pub description: String,
    /// Official documentation or API console link for user onboarding.
    pub doc_url: Option<String>,
    /// Whether this provider runs locally on-device without external egress.
    pub is_local: bool,
    /// Whether this provider is a first-party built-in adapter vs third-party custom endpoint.
    pub is_built_in: bool,
    /// Discrete functional capabilities supported by this provider adapter.
    pub capabilities: ProviderCapabilities,
    /// Catalog of models known and validated for this provider.
    pub models: Vec<ProviderModel>,
}

impl ProviderMetadata {
    /// Constructor for provider metadata.
    pub fn new(
        id: ProviderId,
        name: impl Into<String>,
        description: impl Into<String>,
        doc_url: Option<String>,
        is_local: bool,
        is_built_in: bool,
        capabilities: ProviderCapabilities,
        models: Vec<ProviderModel>,
    ) -> Self {
        Self {
            id,
            name: name.into(),
            description: description.into(),
            doc_url,
            is_local,
            is_built_in,
            capabilities,
            models,
        }
    }

    /// Finds a model descriptor by exact identifier if present in this provider's catalog.
    pub fn find_model(&self, model_id: &str) -> Option<&ProviderModel> {
        self.models.iter().find(|m| m.id == model_id)
    }
}

/// Unified trait implemented by every AI inference client in Nano Route.
///
/// Designed for safe dynamic dispatch (`Arc<dyn ProviderClient + Send + Sync>`),
/// cooperative cancellation via `TaskContext`, and uniform error handling.
#[async_trait]
pub trait ProviderClient: Send + Sync {
    /// Returns the strongly-typed identifier for this provider.
    fn id(&self) -> &ProviderId;

    /// Returns static metadata and capabilities for this provider.
    fn metadata(&self) -> &ProviderMetadata;

    /// Returns the provider's capability set.
    fn capabilities(&self) -> &ProviderCapabilities {
        &self.metadata().capabilities
    }

    /// Returns the slice of models supported by this provider.
    fn models(&self) -> &[ProviderModel] {
        &self.metadata().models
    }

    /// Executes a non-streaming completion or chat generation request.
    ///
    /// Respects cooperative cancellation via `context.is_cancelled()`.
    /// Does NOT perform raw I/O if the cancellation token is already signalled.
    async fn execute(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
    ) -> Result<ProviderResponse, ProviderError>;

    /// Probes provider connectivity, credentials, and operational health.
    async fn health_check(&self) -> Result<ProviderHealthReport, ProviderError>;
}

