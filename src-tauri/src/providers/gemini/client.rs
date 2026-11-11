// ============================================================================
// Nano Route - Google Gemini Provider Client Implementation
// File: src-tauri/src/providers/gemini/client.rs
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::gemini::error::map_gemini_http_error;
use crate::providers::gemini::request::GeminiGenerateContentRequest;
use crate::providers::gemini::response::GeminiGenerateContentResponse;
use crate::providers::gemini::streaming::GeminiSseParser;
use crate::providers::gemini::transport::{
    DefaultGeminiTransport, GeminiHttpResponse, GeminiStreamReceiver, GeminiTransport,
};
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

const DEFAULT_GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com";
const DEFAULT_TIMEOUT_MS: u64 = 60_000;

pub struct GeminiClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    transport: Arc<dyn GeminiTransport>,
    credential_vault: Option<Arc<CredentialVaultService>>,
    test_api_key: Option<SecretString>,
    custom_base_url: Option<String>,
    timeout_ms: u64,
}

impl GeminiClient {
    pub fn new(credential_vault: Arc<CredentialVaultService>) -> Self {
        Self::with_transport_and_vault(Arc::new(DefaultGeminiTransport), Some(credential_vault), None)
    }

    pub fn with_transport_and_vault(
        transport: Arc<dyn GeminiTransport>,
        credential_vault: Option<Arc<CredentialVaultService>>,
        test_api_key: Option<SecretString>,
    ) -> Self {
        let id = ProviderId::new(ProviderId::GEMINI).unwrap();

        let capabilities = ProviderCapabilities::standard_chat()
            .with_capability(ProviderCapability::Vision)
            .with_capability(ProviderCapability::ImageInput)
            .with_capability(ProviderCapability::AudioInput)
            .with_capability(ProviderCapability::LargeContext)
            .with_capability(ProviderCapability::CodeGeneration);

        let models = vec![
            ProviderModel::new(
                "gemini-1.5-pro",
                "Gemini 1.5 Pro",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::AudioInput)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                2_000_000,
                8_192,
                ModelPricing::standard(3.50, 10.50),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "gemini-1.5-flash",
                "Gemini 1.5 Flash",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::AudioInput)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                1_000_000,
                8_192,
                ModelPricing::standard(0.075, 0.30),
                ModelAvailability::Available,
            ),
            ProviderModel::new(
                "gemini-2.0-flash-exp",
                "Gemini 2.0 Flash (Experimental)",
                &id,
                ProviderCapabilities::standard_chat()
                    .with_capability(ProviderCapability::Vision)
                    .with_capability(ProviderCapability::ImageInput)
                    .with_capability(ProviderCapability::LargeContext)
                    .with_capability(ProviderCapability::CodeGeneration),
                1_000_000,
                8_192,
                ModelPricing::free(),
                ModelAvailability::Preview,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "Google Gemini",
            "Google DeepMind's native multimodal frontier models with up to 2M token context.",
            Some("https://ai.google.dev/docs".to_string()),
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

    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.custom_base_url = Some(base_url.into());
        self
    }

    pub fn with_timeout_ms(mut self, timeout_ms: u64) -> Self {
        self.timeout_ms = timeout_ms;
        self
    }

    fn resolve_credentials(&self) -> Result<(SecretString, String), ProviderError> {
        if let Some(key) = &self.test_api_key {
            let base_url = self
                .custom_base_url
                .clone()
                .unwrap_or_else(|| DEFAULT_GEMINI_BASE_URL.to_string());
            return Ok((key.clone(), base_url));
        }

        if let Some(vault) = &self.credential_vault {
            match vault.get_decrypted_credential(self.id.as_str()) {
                Ok(cred) => {
                    let base_url = self
                        .custom_base_url
                        .clone()
                        .or(cred.base_url)
                        .unwrap_or_else(|| DEFAULT_GEMINI_BASE_URL.to_string());
                    return Ok((cred.api_key, base_url));
                }
                Err(_) => {
                    return Err(ProviderError::authentication_failure(
                        Some(self.id.clone()),
                        "Google Gemini API key is not configured. Please enter your API key in Settings.",
                    ));
                }
            }
        }

        Err(ProviderError::authentication_failure(
            Some(self.id.clone()),
            "Google Gemini credentials not available. Vault not configured.",
        ))
    }

    fn format_endpoint_url(&self, base_url: &str, model: &str, stream: bool) -> String {
        let trimmed = base_url.trim_end_matches('/');
        let model_id = model.trim_start_matches("models/");
        if stream {
            format!("{}/v1beta/models/{}:streamGenerateContent?alt=sse", trimmed, model_id)
        } else {
            format!("{}/v1beta/models/{}:generateContent", trimmed, model_id)
        }
    }

    fn build_headers<'a>(api_key: &'a SecretString) -> [(&'a str, &'a str); 2] {
        [
            ("Content-Type", "application/json"),
            ("x-goog-api-key", api_key.expose_secret()),
        ]
    }

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
        let endpoint_url = self.format_endpoint_url(&base_url, &request.model_id, true);

        let gemini_req = GeminiGenerateContentRequest::from_provider_request(&request)?;
        let request_body = serde_json::to_string(&gemini_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.id.clone()),
                format!("Failed to serialize Gemini streaming request: {}", e),
            )
        })?;

        let headers = Self::build_headers(&api_key);

        let mut receiver = self
            .transport
            .send_stream_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let mut parser = GeminiSseParser::new();

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
impl ProviderClient for GeminiClient {
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
        let endpoint_url = self.format_endpoint_url(&base_url, &request.model_id, false);

        let gemini_req = GeminiGenerateContentRequest::from_provider_request(&request)?;
        let request_body = serde_json::to_string(&gemini_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.id.clone()),
                format!("Failed to serialize Gemini request body: {}", e),
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
            return Err(map_gemini_http_error(
                http_response.status_code,
                &http_response.body,
                retry_after,
            ));
        }

        let parsed: GeminiGenerateContentResponse = serde_json::from_str(&http_response.body).map_err(|e| {
            ProviderError::new(
                Some(self.id.clone()),
                ProviderErrorKind::ResponseParsingFailed,
                format!("Failed to parse Google Gemini JSON response: {}", e),
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

