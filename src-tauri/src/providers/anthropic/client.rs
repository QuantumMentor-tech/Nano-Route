// ============================================================================
// Nano Route - Anthropic Provider Client Implementation
// File: src-tauri/src/providers/anthropic/client.rs
// ============================================================================
// Concrete implementation of `ProviderClient` for Anthropic.
// Exclusively targets the Anthropic Messages API (`POST /v1/messages`).
// Authenticates strictly via transient DPAPI credentials or test secret strings.
// Plaintext secrets NEVER escape native boundaries.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::anthropic::error::map_anthropic_http_error;
use crate::providers::anthropic::request::AnthropicMessagesRequest;
use crate::providers::anthropic::response::AnthropicMessagesResponse;
use crate::providers::anthropic::streaming::AnthropicSseParser;
use crate::providers::anthropic::transport::{
    AnthropicHttpResponse, AnthropicStreamReceiver, AnthropicTransport,
    DefaultAnthropicTransport,
};
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::health::{ProviderHealth, ProviderHealthReport};
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ModelPricing, ProviderModel};
use crate::providers::request::ProviderRequest;
use crate::providers::response::ProviderResponse;
use crate::security::SecretString;
use crate::services::credentials::CredentialVaultService;
use crate::services::streaming::types::ProviderStreamChunk;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

pub const ANTHROPIC_API_VERSION: &str = "2023-06-01";
const DEFAULT_ANTHROPIC_BASE_URL: &str = "https://api.anthropic.com";
const DEFAULT_TIMEOUT_MS: u64 = 60_000;

/// Concrete client adapter for Anthropic Claude inference services.
pub struct AnthropicClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    transport: Arc<dyn AnthropicTransport>,
    credential_vault: Option<Arc<CredentialVaultService>>,
    test_api_key: Option<SecretString>,
    custom_base_url: Option<String>,
    timeout_ms: u64,
}

impl AnthropicClient {
    /// Constructs an `AnthropicClient` backed by the DPAPI credential vault.
    pub fn new(credential_vault: Arc<CredentialVaultService>) -> Self {
        Self::with_transport_and_vault(Arc::new(DefaultAnthropicTransport), Some(credential_vault), None)
    }

    /// Constructs an `AnthropicClient` with custom transport and optional vault/key (for offline tests).
    pub fn with_transport_and_vault(
        transport: Arc<dyn AnthropicTransport>,
        credential_vault: Option<Arc<CredentialVaultService>>,
        test_api_key: Option<SecretString>,
    ) -> Self {
        let id = ProviderId::new(ProviderId::ANTHROPIC).unwrap();

        let capabilities = ProviderCapabilities::standard_chat()
            .with_capability(ProviderCapability::Vision)
            .with_capability(ProviderCapability::ImageInput)
            .with_capability(ProviderCapability::ToolCalling)
            .with_capability(ProviderCapability::StructuredOutput)
            .with_capability(ProviderCapability::LargeContext)
            .with_capability(ProviderCapability::CodeGeneration);

        let models = vec![
            ProviderModel::new(
                "claude-3-5-sonnet-20241022",
                "Claude 3.5 Sonnet",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                200_000,
                8_192,
                ModelPricing::standard(3.00, 15.00),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "claude-3-5-haiku-20241022",
                "Claude 3.5 Haiku",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                200_000,
                8_192,
                ModelPricing::standard(0.80, 4.00),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "claude-3-opus-20240229",
                "Claude 3 Opus",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::LargeContext),
                200_000,
                4_096,
                ModelPricing::standard(15.00, 75.00),
                ModelAvailability::Available,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "Anthropic",
            "Creators of the Claude model family, known for steering, safety, and nuanced coding.",
            Some("https://docs.anthropic.com".to_string()),
            false,
            true,
            capabilities,
            models,
        );

        Self {
            id,
            metadata,
            transport,
            credential_vault,
            test_api_key,
            custom_base_url: None,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }

    /// Sets custom endpoint base URL override.
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.custom_base_url = Some(base_url.into());
        self
    }

    /// Sets request timeout in milliseconds.
    pub fn with_timeout_ms(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = timeout_ms;
        self
    }

    /// Resolves active API key and endpoint base URL transiently.
    fn resolve_credentials(&self) -> Result<(SecretString, String), ProviderError> {
        if let Some(key) = &self.test_api_key {
            let base_url = self
                .custom_base_url
                .clone()
                .unwrap_or_else(|| DEFAULT_ANTHROPIC_BASE_URL.to_string());
            return Ok((key.clone(), base_url));
        }

        if let Some(vault) = &self.credential_vault {
            match vault.get_decrypted_credential(self.id.as_str()) {
                Ok(cred) => {
                    let base_url = self
                        .custom_base_url
                        .clone()
                        .or(cred.base_url)
                        .unwrap_or_else(|| DEFAULT_ANTHROPIC_BASE_URL.to_string());
                    return Ok((cred.api_key, base_url));
                }
                Err(_) => {
                    return Err(ProviderError::authentication_failure(
                        Some(self.id.clone()),
                        "Anthropic API key is not configured. Please enter your API key in Settings.",
                    ));
                }
            }
        }

        Err(ProviderError::authentication_failure(
            Some(self.id.clone()),
            "Anthropic credentials not available. Vault not configured.",
        ))
    }

    /// Builds standard Anthropic headers: x-api-key, anthropic-version, Content-Type.
    fn build_headers<'a>(api_key: &'a SecretString) -> [(&'a str, &'a str); 3] {
        [
            ("Content-Type", "application/json"),
            ("x-api-key", api_key.expose_secret()),
            ("anthropic-version", ANTHROPIC_API_VERSION),
        ]
    }

    /// Builds the Messages API endpoint URL (`{base_url}/v1/messages`).
    fn build_messages_url(&self, base_url: &str) -> String {
        let trimmed = base_url.trim_end_matches('/');
        if trimmed.ends_with("/v1/messages") {
            trimmed.to_string()
        } else if trimmed.ends_with("/v1") {
            format!("{}/messages", trimmed)
        } else {
            format!("{}/v1/messages", trimmed)
        }
    }

    /// Executes a streaming completion request delivering incremental `ProviderStreamChunk` items.
    pub async fn execute_stream_chunks<F>(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
        mut on_chunk: F,
    ) -> Result<(), ProviderError>
    where
        F: FnMut(ProviderStreamChunk) -> Result<(), ProviderError> + Send,
    {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(self.id.clone())));
        }

        let (api_key, base_url) = self.resolve_credentials()?;
        let endpoint_url = self.build_messages_url(&base_url);

        let anthropic_req = AnthropicMessagesRequest::from_provider_request(&request, true)?;
        let request_body = serde_json::to_string(&anthropic_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.id.clone()),
                format!("Failed to serialize Anthropic streaming request: {}", e),
            )
        })?;

        let headers = Self::build_headers(&api_key);

        let mut receiver = self
            .transport
            .send_stream_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let mut parser = AnthropicSseParser::new();

        while let Some(raw_chunk) = receiver.next_chunk().await? {
            if context.is_cancelled() {
                return Err(ProviderError::cancelled(Some(self.id.clone())));
            }

            let stream_chunks = parser.parse_chunk(&raw_chunk)?;
            for chunk in stream_chunks {
                let is_final = chunk.is_final;
                on_chunk(chunk)?;
                if is_final {
                    return Ok(());
                }
            }
        }

        Ok(())
    }
}

#[async_trait]
impl ProviderClient for AnthropicClient {
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
        let start_time = Instant::now();

        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(self.id.clone())));
        }

        let (api_key, base_url) = self.resolve_credentials()?;
        let endpoint_url = self.build_messages_url(&base_url);

        let anthropic_req = AnthropicMessagesRequest::from_provider_request(&request, false)?;
        let request_body = serde_json::to_string(&anthropic_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.id.clone()),
                format!("Failed to serialize Anthropic request body: {}", e),
            )
        })?;

        let headers = Self::build_headers(&api_key);

        let http_response = self
            .transport
            .send_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let latency_ms = start_time.elapsed().as_millis() as u64;

        if http_response.status_code != 200 {
            let retry_after = http_response.get_header("retry-after");
            return Err(map_anthropic_http_error(
                http_response.status_code,
                &http_response.body,
                retry_after,
            ));
        }

        let parsed: AnthropicMessagesResponse = serde_json::from_str(&http_response.body).map_err(|e| {
            ProviderError::new(
                Some(self.id.clone()),
                ProviderErrorKind::ResponseParsingFailed,
                format!("Failed to parse Anthropic Messages API JSON response: {}", e),
                Some(http_response.status_code),
                None,
                None,
            )
        })?;

        parsed.into_provider_response(
            request.metadata.request_id,
            &request.model_id,
            latency_ms,
        )
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

        match self.resolve_credentials() {
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

