// ============================================================================
// Nano Route - Groq Provider Client Implementation
// File: src-tauri/src/providers/groq/client.rs
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::errors::ProviderError;
use crate::providers::groq::policy::GroqPolicy;
use crate::providers::health::{ProviderHealth, ProviderHealthReport};
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ModelPricing, ProviderModel};
use crate::providers::request::ProviderRequest;
use crate::providers::response::ProviderResponse;
use crate::providers::shared::compatible_chat::{
    CompatibleChatExecutor, CompatibleChatTransport, DefaultCompatibleChatTransport,
};
use crate::security::SecretString;
use crate::services::credentials::CredentialVaultService;
use crate::services::streaming::types::ProviderStreamChunk;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const DEFAULT_TIMEOUT_MS: u64 = 60_000;

pub struct GroqClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    executor: CompatibleChatExecutor<GroqPolicy>,
}

impl GroqClient {
    pub fn new(credential_vault: Arc<CredentialVaultService>) -> Self {
        Self::with_transport_and_vault(
            Arc::new(DefaultCompatibleChatTransport),
            Some(credential_vault),
            None,
        )
    }

    pub fn with_transport_and_vault(
        transport: Arc<dyn CompatibleChatTransport>,
        credential_vault: Option<Arc<CredentialVaultService>>,
        test_api_key: Option<SecretString>,
    ) -> Self {
        let policy = GroqPolicy;
        let id = policy.provider_id().clone();

        let capabilities = ProviderCapabilities::standard_chat()
            .with_capability(ProviderCapability::ToolCalling)
            .with_capability(ProviderCapability::StructuredOutput)
            .with_capability(ProviderCapability::CodeGeneration)
            .with_capability(ProviderCapability::LargeContext);

        let models = vec![
            ProviderModel::new(
                "llama-3.3-70b-versatile",
                "Llama 3.3 70B (Groq LPU)",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::CodeGeneration)
                    .with_capability(ProviderCapability::LargeContext),
                128_000,
                32_768,
                ModelPricing::standard(0.59, 0.79),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "llama-3.1-8b-instant",
                "Llama 3.1 8B (Groq LPU)",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::CodeGeneration)
                    .with_capability(ProviderCapability::LargeContext),
                128_000,
                8_192,
                ModelPricing::standard(0.05, 0.08),
                ModelAvailability::Available,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "Groq",
            "Ultra-low latency inference powered by Language Processing Units (LPUs).",
            Some("https://console.groq.com/docs".to_string()),
            false,
            true,
            capabilities,
            models,
        );

        let executor = CompatibleChatExecutor::new(
            policy,
            transport,
            credential_vault,
            test_api_key,
            None,
            DEFAULT_TIMEOUT_MS,
        );

        Self {
            id,
            metadata,
            executor,
        }
    }

    pub async fn execute_stream_chunks<F>(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
        on_chunk: F,
    ) -> Result<(), ProviderError>
    where
        F: FnMut(ProviderStreamChunk) -> Result<(), ProviderError> + Send,
    {
        self.executor.execute_stream_chunks(request, context, on_chunk).await
    }
}

#[async_trait]
impl ProviderClient for GroqClient {
    fn id(&self) -> &ProviderId {
        &self.id
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn execute(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
    ) -> Result<ProviderResponse, ProviderError> {
        self.executor.execute(request, context).await
    }

    async fn execute_stream(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
        mut on_chunk: Box<dyn FnMut(ProviderStreamChunk) -> Result<(), ProviderError> + Send>,
    ) -> Result<(), ProviderError> {
        self.execute_stream_chunks(request, context, |chunk| on_chunk(chunk)).await
    }

    async fn health_check(&self) -> Result<ProviderHealthReport, ProviderError> {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        match self.executor.resolve_credentials() {
            Ok(_) => Ok(ProviderHealthReport {
                provider_id: self.id.clone(),
                status: ProviderHealth::Available,
                latency_ms: None,
                last_checked_ms: now_ms,
                error_message: None,
            }),
            Err(e) => Ok(ProviderHealthReport {
                provider_id: self.id.clone(),
                status: ProviderHealth::Unavailable,
                latency_ms: None,
                last_checked_ms: now_ms,
                error_message: Some(e.message),
            }),
        }
    }
}

