// ============================================================================
// Nano Route - DeepSeek Provider Client Implementation
// File: src-tauri/src/providers/deepseek/client.rs
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::deepseek::policy::DeepSeekPolicy;
use crate::providers::errors::ProviderError;
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

pub struct DeepSeekClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    executor: CompatibleChatExecutor<DeepSeekPolicy>,
}

impl DeepSeekClient {
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
        let policy = DeepSeekPolicy;
        let id = policy.provider_id().clone();

        let capabilities = ProviderCapabilities::standard_chat()
            .with_capability(ProviderCapability::ToolCalling)
            .with_capability(ProviderCapability::StructuredOutput)
            .with_capability(ProviderCapability::CodeGeneration)
            .with_capability(ProviderCapability::LargeContext)
            .with_capability(ProviderCapability::Reasoning);

        let models = vec![
            ProviderModel::new(
                "deepseek-chat",
                "DeepSeek-V3",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::CodeGeneration)
                    .with_capability(ProviderCapability::LargeContext),
                64_000,
                8_192,
                ModelPricing::standard(0.14, 0.28),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "deepseek-reasoner",
                "DeepSeek-R1",
                &id,
                ProviderCapabilities::from_slice(&[
                    ProviderCapability::TextGeneration,
                    ProviderCapability::Streaming,
                    ProviderCapability::Reasoning,
                    ProviderCapability::CodeGeneration,
                    ProviderCapability::LargeContext,
                ]),
                64_000,
                8_192,
                ModelPricing::standard(0.55, 2.19),
                ModelAvailability::Available,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "DeepSeek",
            "High-performance open weights and API models specialized in math, code, and reasoning.",
            Some("https://api-docs.deepseek.com".to_string()),
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

    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        let (policy, transport, vault, key, _, timeout) = self.decompose();
        self.executor = CompatibleChatExecutor::new(policy, transport, vault, key, Some(base_url.into()), timeout);
        self
    }

    fn decompose(
        self,
    ) -> (
        DeepSeekPolicy,
        Arc<dyn CompatibleChatTransport>,
        Option<Arc<CredentialVaultService>>,
        Option<SecretString>,
        Option<String>,
        u64,
    ) {
        // Return defaults since executor encapsulates fields
        (
            DeepSeekPolicy,
            Arc::new(DefaultCompatibleChatTransport),
            None,
            None,
            None,
            DEFAULT_TIMEOUT_MS,
        )
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
impl ProviderClient for DeepSeekClient {
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

