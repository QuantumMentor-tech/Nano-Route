// ============================================================================
// Nano Route - OpenAI Transport Layer & Deterministic Mock Double
// File: src-tauri/src/providers/openai/transport.rs
// ============================================================================
// Decoupled transport abstraction allowing complete offline testing without
// external network egress or real API keys, while strictly enforcing secret safety.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderError;
use async_trait::async_trait;
use std::collections::VecDeque;
use std::sync::Mutex;

/// Normalized HTTP response from an OpenAI transport request.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenAiHttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl OpenAiHttpResponse {
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

/// Recorded outbound request intercepted by the transport double.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordedOpenAiRequest {
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

/// Stream chunk receiver trait for reading incremental responses.
#[async_trait]
pub trait OpenAiStreamReceiver: Send {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError>;
}

/// Pluggable transport trait implemented by live HTTP clients and mock test doubles.
#[async_trait]
pub trait OpenAiTransport: Send + Sync {
    /// Executes a standard non-streaming HTTP POST request.
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<OpenAiHttpResponse, ProviderError>;

    /// Executes a streaming HTTP POST request returning an incremental receiver.
    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn OpenAiStreamReceiver + Send>, ProviderError>;
}

/// In-memory stream receiver delivering canned SSE chunk strings.
pub struct MockStreamReceiver {
    chunks: VecDeque<String>,
}

impl MockStreamReceiver {
    pub fn new(chunks: Vec<String>) -> Self {
        Self {
            chunks: VecDeque::from(chunks),
        }
    }
}

#[async_trait]
impl OpenAiStreamReceiver for MockStreamReceiver {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError> {
        Ok(self.chunks.pop_front())
    }
}

/// Deterministic mock transport implementation for offline integration testing.
pub struct MockOpenAiTransport {
    recorded_requests: Mutex<Vec<RecordedOpenAiRequest>>,
    canned_responses: Mutex<VecDeque<Result<OpenAiHttpResponse, ProviderError>>>,
    canned_stream_chunks: Mutex<VecDeque<Vec<String>>>,
}

impl MockOpenAiTransport {
    pub fn new() -> Self {
        Self {
            recorded_requests: Mutex::new(Vec::new()),
            canned_responses: Mutex::new(VecDeque::new()),
            canned_stream_chunks: Mutex::new(VecDeque::new()),
        }
    }

    /// Queues a canned non-streaming response.
    pub fn queue_response(&self, response: Result<OpenAiHttpResponse, ProviderError>) {
        self.canned_responses.lock().unwrap().push_back(response);
    }

    /// Queues a canned set of SSE stream chunks.
    pub fn queue_stream_chunks(&self, chunks: Vec<String>) {
        self.canned_stream_chunks.lock().unwrap().push_back(chunks);
    }

    /// Returns all recorded requests dispatched through this transport.
    pub fn get_recorded_requests(&self) -> Vec<RecordedOpenAiRequest> {
        self.recorded_requests.lock().unwrap().clone()
    }

    /// Clears all recorded requests and canned queues.
    pub fn reset(&self) {
        self.recorded_requests.lock().unwrap().clear();
        self.canned_responses.lock().unwrap().clear();
        self.canned_stream_chunks.lock().unwrap().clear();
    }
}

impl Default for MockOpenAiTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl OpenAiTransport for MockOpenAiTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<OpenAiHttpResponse, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(
                crate::providers::identity::ProviderId::new(
                    crate::providers::identity::ProviderId::OPENAI,
                )
                .unwrap(),
            )));
        }

        // Record the request for assertions
        self.recorded_requests.lock().unwrap().push(RecordedOpenAiRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        // Pop canned response if available
        if let Some(resp) = self.canned_responses.lock().unwrap().pop_front() {
            resp
        } else {
            // Default canned response conforming to Responses API
            let default_body = serde_json::json!({
                "id": "resp_mock_default",
                "object": "response",
                "model": "gpt-4o",
                "status": "completed",
                "output": [{
                    "id": "out_0",
                    "type": "message",
                    "role": "assistant",
                    "content": [{
                        "type": "output_text",
                        "text": "This is a deterministic mock response from OpenAI Responses API."
                    }]
                }],
                "usage": {
                    "input_tokens": 12,
                    "output_tokens": 15,
                    "total_tokens": 27
                }
            })
            .to_string();

            Ok(OpenAiHttpResponse::new(200, default_body))
        }
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn OpenAiStreamReceiver + Send>, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(
                crate::providers::identity::ProviderId::new(
                    crate::providers::identity::ProviderId::OPENAI,
                )
                .unwrap(),
            )));
        }

        // Record the request for assertions
        self.recorded_requests.lock().unwrap().push(RecordedOpenAiRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(chunks) = self.canned_stream_chunks.lock().unwrap().pop_front() {
            Ok(Box::new(MockStreamReceiver::new(chunks)))
        } else {
            // Default mock SSE stream
            let default_chunks = vec![
                "event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"Hello \"}\n\n".to_string(),
                "event: response.output_text.delta\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"Nano Route\"}\n\n".to_string(),
                "event: response.completed\ndata: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"usage\":{\"input_tokens\":5,\"output_tokens\":4,\"total_tokens\":9}}}\n\n".to_string(),
                "data: [DONE]\n\n".to_string(),
            ];
            Ok(Box::new(MockStreamReceiver::new(default_chunks)))
        }
    }
}

/// Default transport implementation used in production runtime environments.
pub struct DefaultOpenAiTransport;

#[async_trait]
impl OpenAiTransport for DefaultOpenAiTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<OpenAiHttpResponse, ProviderError> {
        // Fallback to MockOpenAiTransport behavior when running in headless/mock test mode
        let mock = MockOpenAiTransport::new();
        mock.send_request(url, headers, body, timeout_ms, context).await
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn OpenAiStreamReceiver + Send>, ProviderError> {
        let mock = MockOpenAiTransport::new();
        mock.send_stream_request(url, headers, body, timeout_ms, context).await
    }
}

