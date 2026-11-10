// ============================================================================
// Nano Route - Google Gemini Transport Layer & Deterministic Mock Double
// File: src-tauri/src/providers/gemini/transport.rs
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::errors::ProviderError;
use async_trait::async_trait;
use std::collections::VecDeque;
use std::sync::Mutex;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GeminiHttpResponse {
    pub status_code: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl GeminiHttpResponse {
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

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecordedGeminiRequest {
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

#[async_trait]
pub trait GeminiStreamReceiver: Send {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError>;
}

#[async_trait]
pub trait GeminiTransport: Send + Sync {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<GeminiHttpResponse, ProviderError>;

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn GeminiStreamReceiver + Send>, ProviderError>;
}

pub struct MockGeminiStreamReceiver {
    chunks: VecDeque<String>,
}

impl MockGeminiStreamReceiver {
    pub fn new(chunks: Vec<String>) -> Self {
        Self {
            chunks: VecDeque::from(chunks),
        }
    }
}

#[async_trait]
impl GeminiStreamReceiver for MockGeminiStreamReceiver {
    async fn next_chunk(&mut self) -> Result<Option<String>, ProviderError> {
        Ok(self.chunks.pop_front())
    }
}

pub struct MockGeminiTransport {
    recorded_requests: Mutex<Vec<RecordedGeminiRequest>>,
    canned_responses: Mutex<VecDeque<Result<GeminiHttpResponse, ProviderError>>>,
    canned_stream_chunks: Mutex<VecDeque<Vec<String>>>,
}

impl MockGeminiTransport {
    pub fn new() -> Self {
        Self {
            recorded_requests: Mutex::new(Vec::new()),
            canned_responses: Mutex::new(VecDeque::new()),
            canned_stream_chunks: Mutex::new(VecDeque::new()),
        }
    }

    pub fn queue_response(&self, response: Result<GeminiHttpResponse, ProviderError>) {
        self.canned_responses.lock().unwrap().push_back(response);
    }

    pub fn queue_stream_chunks(&self, chunks: Vec<String>) {
        self.canned_stream_chunks.lock().unwrap().push_back(chunks);
    }

    pub fn get_recorded_requests(&self) -> Vec<RecordedGeminiRequest> {
        self.recorded_requests.lock().unwrap().clone()
    }

    pub fn reset(&self) {
        self.recorded_requests.lock().unwrap().clear();
        self.canned_responses.lock().unwrap().clear();
        self.canned_stream_chunks.lock().unwrap().clear();
    }
}

impl Default for MockGeminiTransport {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl GeminiTransport for MockGeminiTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<GeminiHttpResponse, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(
                crate::providers::identity::ProviderId::new(
                    crate::providers::identity::ProviderId::GEMINI,
                )
                .unwrap(),
            )));
        }

        self.recorded_requests.lock().unwrap().push(RecordedGeminiRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(resp) = self.canned_responses.lock().unwrap().pop_front() {
            resp
        } else {
            let default_body = serde_json::json!({
                "candidates": [{
                    "content": {
                        "parts": [{ "text": "This is a deterministic mock response from Google Gemini." }],
                        "role": "model"
                    },
                    "finishReason": "STOP",
                    "index": 0
                }],
                "usageMetadata": {
                    "promptTokenCount": 16,
                    "candidatesTokenCount": 11,
                    "totalTokenCount": 27
                },
                "modelVersion": "gemini-1.5-pro",
                "responseId": "gem_resp_123"
            })
            .to_string();

            Ok(GeminiHttpResponse::new(200, default_body))
        }
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        _timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn GeminiStreamReceiver + Send>, ProviderError> {
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(
                crate::providers::identity::ProviderId::new(
                    crate::providers::identity::ProviderId::GEMINI,
                )
                .unwrap(),
            )));
        }

        self.recorded_requests.lock().unwrap().push(RecordedGeminiRequest {
            url: url.to_string(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_string(),
        });

        if let Some(chunks) = self.canned_stream_chunks.lock().unwrap().pop_front() {
            Ok(Box::new(MockGeminiStreamReceiver::new(chunks)))
        } else {
            let default_chunks = vec![
                "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hello \"}],\"role\":\"model\"}}]}\n\n".to_string(),
                "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Gemini\"}],\"role\":\"model\"}}]}\n\n".to_string(),
                "data: {\"candidates\":[{\"content\":{\"parts\":[]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"promptTokenCount\":10,\"candidatesTokenCount\":2,\"totalTokenCount\":12}}\n\n".to_string(),
            ];
            Ok(Box::new(MockGeminiStreamReceiver::new(default_chunks)))
        }
    }
}

pub struct DefaultGeminiTransport;

#[async_trait]
impl GeminiTransport for DefaultGeminiTransport {
    async fn send_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<GeminiHttpResponse, ProviderError> {
        let mock = MockGeminiTransport::new();
        mock.send_request(url, headers, body, timeout_ms, context).await
    }

    async fn send_stream_request(
        &self,
        url: &str,
        headers: &[(&str, &str)],
        body: &str,
        timeout_ms: u64,
        context: &TaskContext,
    ) -> Result<Box<dyn GeminiStreamReceiver + Send>, ProviderError> {
        let mock = MockGeminiTransport::new();
        mock.send_stream_request(url, headers, body, timeout_ms, context).await
    }
}

