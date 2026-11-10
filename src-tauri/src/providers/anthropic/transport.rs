// ============================================================================
// Nano Route - Anthropic Transport Layer & Deterministic Mock Double
// File: src-tauri/src/providers/anthropic/transport.rs
// ============================================================================
// Decoupled transport abstraction allowing complete offline testing without
// external network egress or real API keys, while strictly enforcing secret safety.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderError;
use async_trait::async_trait;
use std::collections::VecDeque;
use std::sync::Mutex;

/// Normalized HTTP response from an Anthropic transport request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnthropicHttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl AnthropicHttpResponse {
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
pub struct RecordedAnthropicRequest {
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

/// Stream chunk receiver trait for reading incremental SSE chunks.
#[async_trait]
pub trait AnthropicStreamReceiver: Send {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError>;
}

/// Pluggable transport trait implemented by live HTTP clients and mock test doubles.
#[async_trait]
pub trait AnthropicTransport: Send + Sync {
    /// Executes a standard non-streaming HTTP POST request.
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<AnthropicHttpResponse, ProviderError>;

    /// Executes a streaming HTTP POST request returning an incremental receiver.
    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn AnthropicStreamReceiver + Send>, ProviderError>;
}

/// In-memory stream receiver delivering canned SSE chunk strings.
pub struct MockAnthropicStreamReceiver {
    chunks: VecDeque<String>,
}

impl MockAnthropicStreamReceiver {
    pub fn new(chunks: Vec<String>) -> Self {
        Self {
            chunks: VecDeque::from(chunks),
        }
    }
}

#[async_trait]
impl AnthropicStreamReceiver for MockAnthropicStreamReceiver {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError> {
        Ok(self.chunks.pop_front())
    }
}

/// Deterministic mock transport implementation for offline integration testing.
pub struct MockAnthropicTransport {
    recorded_requests: Mutex<Vec<RecordedAnthropicRequest>>,
    canned_responses: Mutex<VecDeque<Result<AnthropicHttpResponse, ProviderError>>>,
    canned_stream_chunks: Mutex<VecDeque<Vec<String>>>,
}

impl MockAnthropicTransport {
    pub fn new() -> Self {
        Self {
            recorded_requests: Mutex::new(Vec::new()),
            canned_responses: Mutex::new(VecDeque::new()),
            canned_stream_chunks: Mutex::new(VecDeque::new()),
        }
    }

    /// Queues a canned non-streaming response.
    pub fn queue_response(&self, response: Result<AnthropicHttpResponse, ProviderError>) {
        self.canned_responses.lock().unwrap().push_back(response);
    }

    /// Queues a canned set of SSE stream chunks.
    pub fn queue_stream_chunks(&self, chunks: Vec<String>) {
        self.canned_stream_chunks.lock().unwrap().push_back(chunks);
    }

    /// Returns all recorded requests dispatched through this transport.
    pub fn get_recorded_requests(&self) -> Vec<RecordedAnthropicRequest> {
        self.recorded_requests.lock().unwrap().clone()
    }

    /// Clears all recorded requests and canned queues.
    pub fn reset(&self) {
        self.recorded_requests.lock().unwrap().clear();
        self.canned_responses.lock().unwrap().clear();
        self.canned_stream_chunks.lock().unwrap().clear();
    }
}

impl Default for MockAnthropicTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl AnthropicTransport for MockAnthropicTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<AnthropicHttpResponse, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(
                crate::providers::identity::ProviderId::new(
                    crate::providers::identity::ProviderId::ANTHROPIC,
                )
                .unwrap(),
            )));
        }

        self.recorded_requests.lock().unwrap().push(RecordedAnthropicRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(resp) = self.canned_responses.lock().unwrap().pop_front() {
            resp
        } else {
            let default_body = serde_json::json!({
                "id": "msg_mock_default",
                "type": "message",
                "role": "assistant",
                "model": "claude-3-5-sonnet-20241022",
                "content": [{
                    "type": "text",
                    "text": "This is a deterministic mock response from Anthropic Messages API."
                }],
                "stop_reason": "end_turn",
                "stop_sequence": null,
                "usage": {
                    "input_tokens": 15,
                    "output_tokens": 12
                }
            })
            .to_string();

            Ok(AnthropicHttpResponse::new(200, default_body))
        }
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn AnthropicStreamReceiver + Send>, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(
                crate::providers::identity::ProviderId::new(
                    crate::providers::identity::ProviderId::ANTHROPIC,
                )
                .unwrap(),
            )));
        }

        self.recorded_requests.lock().unwrap().push(RecordedAnthropicRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(chunks) = self.canned_stream_chunks.lock().unwrap().pop_front() {
            Ok(Box::new(MockAnthropicStreamReceiver::new(chunks)))
        } else {
            let default_chunks = vec![
                "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"id\":\"msg_mock_strm\",\"type\":\"message\",\"role\":\"assistant\",\"model\":\"claude-3-5-sonnet-20241022\",\"content\":[],\"usage\":{\"input_tokens\":10,\"output_tokens\":1}}}\n\n".to_string(),
                "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\",\"text\":\"\"}}\n\n".to_string(),
                "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello \"}}\n\n".to_string(),
                "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Claude\"}}\n\n".to_string(),
                "event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":0}\n\n".to_string(),
                "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\",\"stop_sequence\":null},\"usage\":{\"output_tokens\":8}}\n\n".to_string(),
                "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n".to_string(),
            ];
            Ok(Box::new(MockAnthropicStreamReceiver::new(default_chunks)))
        }
    }
}

/// Default transport implementation used in production runtime environments.
pub struct DefaultAnthropicTransport;

#[async_trait]
impl AnthropicTransport for DefaultAnthropicTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<AnthropicHttpResponse, ProviderError> {
        let mock = MockAnthropicTransport::new();
        mock.send_request(url, headers, body, timeout_ms, context).await
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn AnthropicStreamReceiver + Send>, ProviderError> {
        let mock = MockAnthropicTransport::new();
        mock.send_stream_request(url, headers, body, timeout_ms, context).await
    }
}

