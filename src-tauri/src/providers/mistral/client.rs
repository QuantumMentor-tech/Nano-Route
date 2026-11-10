// ============================================================================
// Nano Route - Mistral AI Provider Client Implementation
// File: src-tauri/src/providers/mistral/client.rs
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::errors::ProviderError;
use crate::providers::health::{ProviderHealth, ProviderHealthReport};
use crate::providers::identity::ProviderId;
use crate::providers::mistral::policy::MistralPolicy;
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

pub struct MistralClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    executor: CompatibleChatExecutor<MistralPolicy>,
}

impl MistralClient {
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
        let policy = MistralPolicy;
        let id = policy.provider_id().clone();

        let capabilities = ProviderCapabilities::standard_chat()
            .with_capability(ProviderCapability::ToolCalling)
            .with_capability(ProviderCapability::StructuredOutput)
            .with_capability(ProviderCapability::CodeGeneration)
            .with_capability(ProviderCapability::LargeContext);

        let models = vec![
            ProviderModel::new(
                "mistral-large-latest",
                "Mistral Large",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::CodeGeneration)
                    .with_capability(ProviderCapability::LargeContext),
                128_000,
                32_768,
                ModelPricing::standard(2.00, 6.00),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "mistral-small-latest",
                "Mistral Small",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::CodeGeneration),
                32_000,
                8_192,
                ModelPricing::standard(0.20, 0.60),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "codestral-latest",
                "Codestral",
                &id,
                ProviderCapabilities::from_slice(&[
                    ProviderCapability::TextGeneration,
                    ProviderCapability::Streaming,
                    ProviderCapability::CodeGeneration,
                    ProviderCapability::LargeContext,
                ]),
                256_000,
                32_768,
                ModelPricing::standard(0.30, 0.90),
                ModelAvailability::Available,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "Mistral AI",
            "European AI champion providing open and proprietary high-efficiency language models.",
            Some("https://docs.mistral.ai".to_string()),
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
impl ProviderClient for MistralClient {
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

