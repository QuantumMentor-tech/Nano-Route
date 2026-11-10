// ============================================================================
// Nano Route - OpenAI Provider Client Implementation
// File: src-tauri/src/providers/openai/client.rs
// ============================================================================
// Concrete implementation of `ProviderClient` for OpenAI.
// Exclusively targets the OpenAI Responses API (`/v1/responses`).
// Authenticates strictly via transient DPAPI credentials or test secret strings.
// Plaintext secrets NEVER escape native boundaries.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::health::{ProviderHealth, ProviderHealthReport};
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ModelPricing, ProviderModel};
use crate::providers::openai::error::map_openai_http_error;
use crate::providers::openai::request::OpenAiResponsesRequest;
use crate::providers::openai::response::OpenAiResponsesResponse;
use crate::providers::openai::streaming::OpenAiSseParser;
use crate::providers::openai::transport::{
    DefaultOpenAiTransport, OpenAiHttpResponse, OpenAiStreamReceiver, OpenAiTransport,
};
use crate::providers::request::ProviderRequest;
use crate::providers::response::ProviderResponse;
use crate::security::SecretString;
use crate::services::credentials::CredentialVaultService;
use crate::services::streaming::types::ProviderStreamChunk;
use async_trait::async_trait;
use std::sync::Arc;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS: u64 = 60_000;

/// Concrete client adapter for OpenAI LLM services.
pub struct OpenAiClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    transport: Arc<dyn OpenAiTransport>,
    credential_vault: Option<Arc<CredentialVaultService>>,
    test_api_key: Option<SecretString>,
    custom_base_url: Option<String>,
    timeout_ms: u64,
}

impl OpenAiClient {
    /// Constructs an `OpenAiClient` backed by the DPAPI credential vault.
    pub fn new(credential_vault: Arc<CredentialVaultService>) -> Self {
        Self::with_transport_and_vault(Arc::new(DefaultOpenAiTransport), Some(credential_vault), None)
    }

    /// Constructs an `OpenAiClient` with custom transport and optional vault/key (for offline tests).
    pub fn with_transport_and_vault(
        transport: Arc<dyn OpenAiTransport>,
        credential_vault: Option<Arc<CredentialVaultService>>,
        test_api_key: Option<SecretString>,
    ) -> Self {
        let id = ProviderId::new(ProviderId::OPENAI).unwrap();

        let capabilities = ProviderCapabilities::standard_chat()
            .with_capability(ProviderCapability::Vision)
            .with_capability(ProviderCapability::ImageInput)
            .with_capability(ProviderCapability::ToolCalling)
            .with_capability(ProviderCapability::StructuredOutput)
            .with_capability(ProviderCapability::LargeContext)
            .with_capability(ProviderCapability::CodeGeneration)
            .with_capability(ProviderCapability::Reasoning);

        let models = vec![
            ProviderModel::new(
                "gpt-4o",
                "GPT-4o",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                128_000,
                4_096,
                ModelPricing::standard(2.50, 10.00),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "gpt-4o-mini",
                "GPT-4o Mini",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::CodeGeneration),
                128_000,
                16_384,
                ModelPricing::standard(0.15, 0.60),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "o1",
                "o1",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Reasoning)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                200_000,
                100_000,
                ModelPricing::standard(15.00, 60.00),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "o3-mini",
                "o3-mini",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Reasoning)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                200_000,
                100_000,
                ModelPricing::standard(1.10, 4.40),
                ModelAvailability::Available,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "OpenAI",
            "Pioneer in frontier large language models, reasoning, and multimodal systems.",
            Some("https://platform.openai.com/docs".to_string()),
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

    /// Sets a custom endpoint base URL override (e.g. for enterprise gateways or test mocks).
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
        // 1. Direct test secret string takes precedence
        if let Some(key) = &self.test_api_key {
            let base_url = self
                .custom_base_url
                .clone()
                .unwrap_or_else(|| DEFAULT_OPENAI_BASE_URL.to_string());
            return Ok((key.clone(), base_url));
        }

        // 2. Resolve from DPAPI credential vault
        if let Some(vault) = &self.credential_vault {
            match vault.get_decrypted_credential(self.id.as_str()) {
                Ok(cred) => {
                    let base_url = self
                        .custom_base_url
                        .clone()
                        .or(cred.base_url)
                        .unwrap_or_else(|| DEFAULT_OPENAI_BASE_URL.to_string());
                    return Ok((cred.api_key, base_url));
                }
                Err(_) => {
                    return Err(ProviderError::authentication_failure(
                        Some(self.id.clone()),
                        "OpenAI API key is not configured. Please enter your API key in Settings.",
                    ));
                }
            }
        }

        Err(ProviderError::authentication_failure(
            Some(self.id.clone()),
            "OpenAI credentials not available. Vault not configured.",
        ))
    }

    /// Builds standard HTTP headers including transient Authorization token.
    fn build_headers<'a>(api_key: &'a SecretString, auth_buffer: &'a mut String) -> [(&'a str, &'a str); 2] {
        *auth_buffer = format!("Bearer {}", api_key.expose_secret());
        [
            ("Content-Type", "application/json"),
            ("Authorization", auth_buffer.as_str()),
        ]
    }

    /// Builds the Responses API endpoint URL (`{base_url}/responses`).
    fn build_responses_url(&self, base_url: &str) -> String {
        let trimmed = base_url.trim_end_matches('/');
        if trimmed.ends_with("/responses") {
            trimmed.to_string()
        } else {
            format!("{}/responses", trimmed)
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
        let endpoint_url = self.build_responses_url(&base_url);

        // Serialize Responses API request with stream: true
        let openai_req = OpenAiResponsesRequest::from_provider_request(&request, true)?;
        let request_body = serde_json::to_string(&openai_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.id.clone()),
                format!("Failed to serialize OpenAI streaming request: {}", e),
            )
        })?;

        let mut auth_buffer = String::new();
        let headers = Self::build_headers(&api_key, &mut auth_buffer);

        let mut receiver = self
            .transport
            .send_stream_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let mut parser = OpenAiSseParser::new();

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
impl ProviderClient for OpenAiClient {
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
        let endpoint_url = self.build_responses_url(&base_url);

        // Validate and serialize request for Responses API
        let openai_req = OpenAiResponsesRequest::from_provider_request(&request, false)?;
        let request_body = serde_json::to_string(&openai_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.id.clone()),
                format!("Failed to serialize OpenAI request body: {}", e),
            )
        })?;

        let mut auth_buffer = String::new();
        let headers = Self::build_headers(&api_key, &mut auth_buffer);

        let http_response = self
            .transport
            .send_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let latency_ms = start_time.elapsed().as_millis() as u64;

        if http_response.status_code != 200 {
            let retry_after = http_response.get_header("retry-after");
            return Err(map_openai_http_error(
                http_response.status_code,
                &http_response.body,
                retry_after,
            ));
        }

        let parsed: OpenAiResponsesResponse = serde_json::from_str(&http_response.body).map_err(|e| {
            ProviderError::new(
                Some(self.id.clone()),
                ProviderErrorKind::ResponseParsingFailed,
                format!("Failed to parse OpenAI Responses API JSON response: {}", e),
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

    async fn health_check(&self) -> Result<ProviderHealthReport, ProviderError> {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        // Verify if credentials can be resolved
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

