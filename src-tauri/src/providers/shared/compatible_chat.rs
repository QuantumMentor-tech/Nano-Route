// ============================================================================
// Nano Route - Shared Compatible Chat Transport & Policy Infrastructure
// File: src-tauri/src/providers/shared/compatible_chat.rs
// ============================================================================
// Internal transport abstraction centralizing standard Chat Completion semantics
// (message serialization, response choice extraction, SSE data-only framing)
// shared across DeepSeek, Groq, and Mistral, while strictly delegating all
// endpoint, authentication, and error classification policies to each provider.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::identity::ProviderId;
use crate::providers::request::{ChatMessage, MessageRole, ProviderRequest};
use crate::providers::response::{
    ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata,
};
use crate::security::SecretString;
use crate::services::credentials::CredentialVaultService;
use crate::services::streaming::types::ProviderStreamChunk;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Provider-specific policy governing endpoints, authentication, and error mapping.
pub trait ChatCompletionPolicy: Send + Sync {
    /// Returns the canonical provider identifier.
    fn provider_id(&self) -> &ProviderId;

    /// Default base URL defined in registry for this provider.
    fn default_base_url(&self) -> &str;

    /// Formats the complete completion endpoint URL given a base URL.
    fn format_endpoint_url(&self, base_url: &str) -> String;

    /// Builds HTTP headers including authentication for this provider.
    fn build_headers<'a>(
        &self,
        api_key: &'a SecretString,
        auth_buf: &'a mut String,
    ) -> Vec<(&'a str, &'a str)>;

    /// Maps an upstream HTTP status and payload into a normalized `ProviderError`.
    fn map_http_error(
        &self,
        status_code: u16,
        body: &str,
        retry_after: Option<&str>,
    ) -> ProviderError;

    /// Default maximum output tokens if unspecified in request.
    fn default_max_tokens(&self) -> Option<u32> {
        None
    }
}

/// Generic chat completion message structure.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleChatMessage {
    pub role: String,
    pub content: String,
}

/// Generic outbound chat completion request body.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleChatRequest {
    pub model: String,
    pub messages: Vec<CompatibleChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
}

impl CompatibleChatRequest {
    /// Maps a canonical `ProviderRequest` into a `CompatibleChatRequest`.
    pub fn from_provider_request<P: ChatCompletionPolicy + ?Sized>(
        req: &ProviderRequest,
        stream: bool,
        policy: &P,
    ) -> Result<Self, ProviderError> {
        let provider_id = Some(policy.provider_id().clone());

        if req.model_id.trim().is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Model identifier cannot be empty for chat completion execution",
            ));
        }

        if req.messages.is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Request must contain at least one message",
            ));
        }

        let mut messages = Vec::with_capacity(req.messages.len());
        for (idx, msg) in req.messages.iter().enumerate() {
            let role_str = match msg.role {
                MessageRole::System => "system",
                MessageRole::User => "user",
                MessageRole::Assistant => "assistant",
                MessageRole::Tool => "tool",
            };

            if msg.content.is_empty() && msg.role != MessageRole::Assistant {
                return Err(ProviderError::invalid_request(
                    provider_id.clone(),
                    format!("Message at index {} has empty content", idx),
                ));
            }

            messages.push(CompatibleChatMessage {
                role: role_str.to_string(),
                content: msg.content.clone(),
            });
        }

        let max_tokens = req.params.max_tokens.or_else(|| policy.default_max_tokens());

        Ok(Self {
            model: req.model_id.clone(),
            messages,
            stream: if stream { Some(true) } else { None },
            max_tokens,
            temperature: req.params.temperature,
            top_p: req.params.top_p,
        })
    }
}

/// Flexible content representation supporting plain string or structured parts (Mistral).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CompatibleMessageContent {
    Text(String),
    Parts(Vec<CompatibleContentPart>),
}

impl CompatibleMessageContent {
    pub fn extract_text(&self) -> String {
        match self {
            Self::Text(s) => s.clone(),
            Self::Parts(parts) => {
                let mut out = String::new();
                for p in parts {
                    if let Some(t) = &p.text {
                        out.push_str(t);
                    }
                }
                out
            }
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleContentPart {
    #[serde(rename = "type")]
    pub part_type: Option<String>,
    pub text: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleChatChoiceMessage {
    pub role: Option<String>,
    pub content: Option<CompatibleMessageContent>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleChatChoiceDelta {
    pub role: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleChatChoice {
    pub index: Option<u32>,
    pub message: Option<CompatibleChatChoiceMessage>,
    pub delta: Option<CompatibleChatChoiceDelta>,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct CompatibleUsage {
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
}

impl CompatibleUsage {
    pub fn to_provider_usage(&self) -> ProviderUsage {
        let total = self.total_tokens.or_else(|| match (self.prompt_tokens, self.completion_tokens) {
            (Some(p), Some(c)) => Some(p + c),
            _ => None,
        });

        ProviderUsage {
            input_tokens: self.prompt_tokens,
            output_tokens: self.completion_tokens,
            total_tokens: total,
            reasoning_tokens: None,
            cache_read_tokens: None,
            cache_write_tokens: None,
        }
    }
}

/// Top-level response envelope for chat completion endpoints.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CompatibleChatResponse {
    pub id: Option<String>,
    pub model: Option<String>,
    #[serde(default)]
    pub choices: Vec<CompatibleChatChoice>,
    pub usage: Option<CompatibleUsage>,
}

impl CompatibleChatResponse {
    pub fn extract_text(&self) -> String {
        if let Some(first) = self.choices.first() {
            if let Some(msg) = &first.message {
                if let Some(content) = &msg.content {
                    return content.extract_text();
                }
            }
        }
        String::new()
    }

    pub fn resolve_finish_reason(&self) -> ProviderFinishReason {
        if let Some(first) = self.choices.first() {
            if let Some(reason) = first.finish_reason.as_deref() {
                match reason {
                    "stop" => return ProviderFinishReason::Completed,
                    "length" => return ProviderFinishReason::LengthLimit,
                    "content_filter" => return ProviderFinishReason::ContentFiltered,
                    "tool_calls" => return ProviderFinishReason::ToolCall,
                    _ => return ProviderFinishReason::Completed,
                }
            }
        }
        ProviderFinishReason::Completed
    }

    pub fn into_provider_response<P: ChatCompletionPolicy + ?Sized>(
        self,
        request_id: String,
        requested_model: &str,
        latency_ms: u64,
        policy: &P,
    ) -> Result<ProviderResponse, ProviderError> {
        let text = self.extract_text();
        let finish_reason = self.resolve_finish_reason();
        let usage = self.usage.as_ref().map(|u| u.to_provider_usage());
        let provider_model_id = self
            .model
            .clone()
            .unwrap_or_else(|| requested_model.to_string());

        Ok(ProviderResponse {
            provider_id: policy.provider_id().clone(),
            model_id: requested_model.to_string(),
            text,
            finish_reason,
            usage,
            metadata: ResponseMetadata {
                request_id,
                latency_ms,
                provider_model_id,
            },
        })
    }
}

/// Normalized HTTP response structure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompatibleHttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl CompatibleHttpResponse {
    pub fn new(status_code: u16, body: impl Into<String>) -> Self {
        Self {
            status_code,
            headers: Vec::new(),
            body: body.into(),
        }
    }

    pub fn with_header(mut self, key: impl Into<String>, val: impl Into<String>) -> Self {
        self.headers.push((key.into(), val.into()));
        self
    }

    pub fn get_header(&self, name: &str) -> Option<&str> {
        let name_lower = name.to_lowercase();
        self.headers
            .iter()
            .find(|(k, _)| k.to_lowercase() == name_lower)
            .map(|(_, v)| v.as_str())
    }
}

/// Recorded outbound request intercepted by the mock transport.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordedCompatibleRequest {
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

#[async_trait]
pub trait CompatibleStreamReceiver: Send {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError>;
}

#[async_trait]
pub trait CompatibleChatTransport: Send + Sync {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<CompatibleHttpResponse, ProviderError>;

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn CompatibleStreamReceiver + Send>, ProviderError>;
}

/// In-memory stream receiver delivering canned SSE chunk strings.
pub struct MockCompatibleStreamReceiver {
    chunks: VecDeque<String>,
}

impl MockCompatibleStreamReceiver {
    pub fn new(chunks: Vec<String>) -> Self {
        Self {
            chunks: VecDeque::from(chunks),
        }
    }
}

#[async_trait]
impl CompatibleStreamReceiver for MockCompatibleStreamReceiver {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError> {
        Ok(self.chunks.pop_front())
    }
}

/// Deterministic mock transport implementation for offline integration testing.
pub struct MockCompatibleChatTransport {
    recorded_requests: Mutex<Vec<RecordedCompatibleRequest>>,
    canned_responses: Mutex<VecDeque<Result<CompatibleHttpResponse, ProviderError>>>,
    canned_stream_chunks: Mutex<VecDeque<Vec<String>>>,
}

impl MockCompatibleChatTransport {
    pub fn new() -> Self {
        Self {
            recorded_requests: Mutex::new(Vec::new()),
            canned_responses: Mutex::new(VecDeque::new()),
            canned_stream_chunks: Mutex::new(VecDeque::new()),
        }
    }

    pub fn queue_response(&self, response: Result<CompatibleHttpResponse, ProviderError>) {
        self.canned_responses.lock().unwrap().push_back(response);
    }

    pub fn queue_stream_chunks(&self, chunks: Vec<String>) {
        self.canned_stream_chunks.lock().unwrap().push_back(chunks);
    }

    pub fn get_recorded_requests(&self) -> Vec<RecordedCompatibleRequest> {
        self.recorded_requests.lock().unwrap().clone()
    }

    pub fn reset(&self) {
        self.recorded_requests.lock().unwrap().clear();
        self.canned_responses.lock().unwrap().clear();
        self.canned_stream_chunks.lock().unwrap().clear();
    }
}

impl Default for MockCompatibleChatTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl CompatibleChatTransport for MockCompatibleChatTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<CompatibleHttpResponse, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(None));
        }

        self.recorded_requests.lock().unwrap().push(RecordedCompatibleRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(resp) = self.canned_responses.lock().unwrap().pop_front() {
            resp
        } else {
            let default_body = serde_json::json!({
                "id": "chatcmpl_mock_default",
                "model": "compatible-model",
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "Deterministic mock chat completion response."
                    },
                    "finish_reason": "stop"
                }],
                "usage": {
                    "prompt_tokens": 10,
                    "completion_tokens": 8,
                    "total_tokens": 18
                }
            })
            .to_string();

            Ok(CompatibleHttpResponse::new(200, default_body))
        }
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn CompatibleStreamReceiver + Send>, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(None));
        }

        self.recorded_requests.lock().unwrap().push(RecordedCompatibleRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(chunks) = self.canned_stream_chunks.lock().unwrap().pop_front() {
            Ok(Box::new(MockCompatibleStreamReceiver::new(chunks)))
        } else {
            let default_chunks = vec![
                "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"Hello \"},\"finish_reason\":null}]}\n\n".to_string(),
                "data: {\"choices\":[{\"index\":0,\"delta\":{\"content\":\"World\"},\"finish_reason\":null}]}\n\n".to_string(),
                "data: {\"choices\":[{\"index\":0,\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":2,\"total_tokens\":7}}\n\n".to_string(),
                "data: [DONE]\n\n".to_string(),
            ];
            Ok(Box::new(MockCompatibleStreamReceiver::new(default_chunks)))
        }
    }
}

pub struct DefaultCompatibleChatTransport;

#[async_trait]
impl CompatibleChatTransport for DefaultCompatibleChatTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<CompatibleHttpResponse, ProviderError> {
        let mock = MockCompatibleChatTransport::new();
        mock.send_request(url, headers, body, timeout_ms, context).await
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn CompatibleStreamReceiver + Send>, ProviderError> {
        let mock = MockCompatibleChatTransport::new();
        mock.send_stream_request(url, headers, body, timeout_ms, context).await
    }
}

/// Shared resilient SSE parser for standard `data: ` chat completion streams.
#[derive(Debug, Default)]
pub struct CompatibleChatSseParser {
    buffer: String,
    stream_completed: bool,
}

impl CompatibleChatSseParser {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            stream_completed: false,
        }
    }

    pub fn feed(&mut self, chunk: &str) -> Vec<String> {
        self.buffer.push_str(chunk);
        let mut events = Vec::new();

        loop {
            let normalized = self.buffer.replace("\r\n", "\n");
            if let Some(pos) = normalized.find("\n\n") {
                let block = normalized[..pos].to_string();
                let mut data_lines = Vec::new();

                for line in block.lines() {
                    let line = line.trim_end();
                    if line.starts_with(':') {
                        continue;
                    }
                    if let Some(data_val) = line.strip_prefix("data:") {
                        let val = if data_val.starts_with(' ') {
                            &data_val[1..]
                        } else {
                            data_val
                        };
                        data_lines.push(val);
                    }
                }

                if !data_lines.is_empty() {
                    events.push(data_lines.join("\n"));
                }

                // Advance original buffer
                let bytes = self.buffer.as_bytes();
                let mut consumed_bytes = 0;
                let mut i = 0;
                while i < bytes.len() {
                    if bytes[i] == b'\n' {
                        if i + 1 < bytes.len() && bytes[i + 1] == b'\n' {
                            consumed_bytes = i + 2;
                            break;
                        } else if i + 2 < bytes.len() && bytes[i + 1] == b'\r' && bytes[i + 2] == b'\n' {
                            consumed_bytes = i + 3;
                            break;
                        }
                    } else if bytes[i] == b'\r'
                        && i + 3 < bytes.len()
                        && bytes[i + 1] == b'\n'
                        && bytes[i + 2] == b'\r'
                        && bytes[i + 3] == b'\n'
                    {
                        consumed_bytes = i + 4;
                        break;
                    }
                    i += 1;
                }

                if consumed_bytes > 0 {
                    self.buffer.drain(..consumed_bytes);
                } else {
                    self.buffer = normalized[pos + 2..].to_string();
                }
            } else {
                break;
            }
        }

        events
    }

    pub fn parse_chunk(&mut self, raw_chunk: &str) -> Result<Vec<ProviderStreamChunk>, ProviderError> {
        if self.stream_completed {
            return Ok(Vec::new());
        }

        let events = self.feed(raw_chunk);
        let mut chunks = Vec::new();

        for data_str in events {
            if data_str.trim() == "[DONE]" {
                self.stream_completed = true;
                chunks.push(ProviderStreamChunk {
                    text_delta: None,
                    reasoning_delta: None,
                    finish_reason: Some(ProviderFinishReason::Completed),
                    usage: None,
                    is_final: true,
                });
                break;
            }

            if let Ok(value) = serde_json::from_str::<serde_json::Value>(&data_str) {
                if let Some(choices) = value.get("choices").and_then(|c| c.as_array()) {
                    if let Some(first) = choices.first() {
                        let text_delta = first
                            .get("delta")
                            .and_then(|d| d.get("content"))
                            .and_then(|c| c.as_str())
                            .map(|s| s.to_string());

                        let finish_str = first.get("finish_reason").and_then(|f| f.as_str());
                        let finish_reason = finish_str.map(|f| match f {
                            "stop" => ProviderFinishReason::Completed,
                            "length" => ProviderFinishReason::LengthLimit,
                            "content_filter" => ProviderFinishReason::ContentFiltered,
                            "tool_calls" => ProviderFinishReason::ToolCall,
                            _ => ProviderFinishReason::Completed,
                        });

                        let is_final = finish_reason.is_some();

                        let usage = value
                            .get("usage")
                            .and_then(|u| serde_json::from_value::<CompatibleUsage>(u.clone()).ok())
                            .map(|u| u.to_provider_usage());

                        if text_delta.is_some() || finish_reason.is_some() || is_final {
                            if is_final {
                                self.stream_completed = true;
                            }
                            chunks.push(ProviderStreamChunk {
                                text_delta,
                                reasoning_delta: None,
                                finish_reason,
                                usage,
                                is_final,
                            });
                        }
                    }
                }
            }
        }

        Ok(chunks)
    }

    pub fn is_completed(&self) -> bool {
        self.stream_completed
    }
}

/// Shared execution engine powering DeepSeek, Groq, and Mistral client implementations.
pub struct CompatibleChatExecutor<P: ChatCompletionPolicy> {
    policy: P,
    transport: Arc<dyn CompatibleChatTransport>,
    credential_vault: Option<Arc<CredentialVaultService>>,
    test_api_key: Option<SecretString>,
    custom_base_url: Option<String>,
    timeout_ms: u64,
}

impl<P: ChatCompletionPolicy> CompatibleChatExecutor<P> {
    pub fn new(
        policy: P,
        transport: Arc<dyn CompatibleChatTransport>,
        credential_vault: Option<Arc<CredentialVaultService>>,
        test_api_key: Option<SecretString>,
        custom_base_url: Option<String>,
        timeout_ms: u64,
    ) -> Self {
        Self {
            policy,
            transport,
            credential_vault,
            test_api_key,
            custom_base_url,
            timeout_ms,
        }
    }

    pub fn policy(&self) -> &P {
        &self.policy
    }

    pub fn resolve_credentials(&self) -> Result<(SecretString, String), ProviderError> {
        let provider_id = self.policy.provider_id();
        if let Some(key) = &self.test_api_key {
            let base_url = self
                .custom_base_url
                .clone()
                .unwrap_or_else(|| self.policy.default_base_url().to_string());
            return Ok((key.clone(), base_url));
        }

        if let Some(vault) = &self.credential_vault {
            match vault.get_decrypted_credential(provider_id.as_str()) {
                Ok(cred) => {
                    let base_url = self
                        .custom_base_url
                        .clone()
                        .or(cred.base_url)
                        .unwrap_or_else(|| self.policy.default_base_url().to_string());
                    return Ok((cred.api_key, base_url));
                }
                Err(_) => {
                    return Err(ProviderError::authentication_failure(
                        Some(provider_id.clone()),
                        format!(
                            "{} API key is not configured. Please enter your API key in Settings.",
                            provider_id.as_str()
                        ),
                    ));
                }
            }
        }

        Err(ProviderError::authentication_failure(
            Some(provider_id.clone()),
            format!("{} credentials not available. Vault not configured.", provider_id.as_str()),
        ))
    }

    pub async fn execute(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
    ) -> Result<ProviderResponse, ProviderError> {
        let start_time = Instant::now();

        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(self.policy.provider_id().clone())));
        }

        let (api_key, base_url) = self.resolve_credentials()?;
        let endpoint_url = self.policy.format_endpoint_url(&base_url);

        let chat_req = CompatibleChatRequest::from_provider_request(&request, false, &self.policy)?;
        let request_body = serde_json::to_string(&chat_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.policy.provider_id().clone()),
                format!("Failed to serialize chat completion request body: {}", e),
            )
        })?;

        let mut auth_buf = String::new();
        let headers = self.policy.build_headers(&api_key, &mut auth_buf);

        let http_response = self
            .transport
            .send_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let latency_ms = start_time.elapsed().as_millis() as u64;

        if http_response.status_code != 200 {
            let retry_after = http_response.get_header("retry-after");
            return Err(self.policy.map_http_error(
                http_response.status_code,
                &http_response.body,
                retry_after,
            ));
        }

        let parsed: CompatibleChatResponse = serde_json::from_str(&http_response.body).map_err(|e| {
            ProviderError::new(
                Some(self.policy.provider_id().clone()),
                ProviderErrorKind::ResponseParsingFailed,
                format!("Failed to parse chat completion JSON response: {}", e),
                Some(http_response.status_code),
                None,
                None,
            )
        })?;

        parsed.into_provider_response(
            request.metadata.request_id,
            &request.model_id,
            latency_ms,
            &self.policy,
        )
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
            return Err(ProviderError::cancelled(Some(self.policy.provider_id().clone())));
        }

        let (api_key, base_url) = self.resolve_credentials()?;
        let endpoint_url = self.policy.format_endpoint_url(&base_url);

        let chat_req = CompatibleChatRequest::from_provider_request(&request, true, &self.policy)?;
        let request_body = serde_json::to_string(&chat_req).map_err(|e| {
            ProviderError::invalid_request(
                Some(self.policy.provider_id().clone()),
                format!("Failed to serialize streaming chat completion request body: {}", e),
            )
        })?;

        let mut auth_buf = String::new();
        let headers = self.policy.build_headers(&api_key, &mut auth_buf);

        let mut receiver = self
            .transport
            .send_stream_request(&endpoint_url, &headers, &request_body, self.timeout_ms, context)
            .await?;

        let mut parser = CompatibleChatSseParser::new();

        while let Some(raw_chunk) = receiver.next_chunk().await? {
            if context.is_cancelled() {
                return Err(ProviderError::cancelled(Some(self.policy.provider_id().clone())));
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

