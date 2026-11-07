// ============================================================================
// Nano Route - Mock Provider Client Test Double
// File: src-tauri/src/providers/mock.rs
// ============================================================================
// Deterministic in-memory test double implementing `ProviderClient`.
// Simulates model responses, latency, error injections, and cooperative cancellation
// without any external network access.
// ============================================================================

use crate::core::tasks::TaskContext;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::client::{ProviderClient, ProviderMetadata};
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::health::{ProviderHealth, ProviderHealthReport};
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ModelPricing, ProviderModel};
use crate::providers::request::ProviderRequest;
use crate::providers::response::{ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata};
use async_trait::async_trait;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use std::time::Duration;

/// Mutable runtime behavior overrides for `MockProviderClient`.
#[derive(Debug, Clone)]
pub struct MockProviderDynamicConfig {
    /// Simulated execution latency.
    pub latency: Duration,
    /// If Some, execution returns this error instead of a response.
    pub injected_error: Option<ProviderError>,
    /// Canned response content text to return on success.
    pub default_reply: String,
    /// Health status to return on `health_check()`.
    pub health_status: ProviderHealth,
}

impl Default for MockProviderDynamicConfig {
    fn default() -> Self {
        Self {
            latency: Duration::from_millis(0),
            injected_error: None,
            default_reply: "This is a deterministic mock response from Nano Route.".to_string(),
            health_status: ProviderHealth::Available,
        }
    }
}

/// In-memory test double implementing `ProviderClient`.
pub struct MockProviderClient {
    id: ProviderId,
    metadata: ProviderMetadata,
    dynamic_config: Mutex<MockProviderDynamicConfig>,
    call_count: AtomicUsize,
    last_request: Mutex<Option<ProviderRequest>>,
}

impl MockProviderClient {
    /// Creates a mock provider with default test configuration.
    pub fn new() -> Self {
        let id = ProviderId::new("mock-provider").unwrap();
        let capabilities = ProviderCapabilities::standard_chat();
        let models = vec![
            ProviderModel::new(
                "mock-model-v1",
                "Mock Model v1",
                &id,
                capabilities.clone(),
                128_000,
                4_096,
                ModelPricing::free(),
                ModelAvailability::Available,
            ),
        ];

        let metadata = ProviderMetadata::new(
            id.clone(),
            "Mock Provider",
            "Deterministic in-memory test double for unit and integration testing",
            None,
            true,
            false,
            capabilities,
            models,
        );

        Self {
            id,
            metadata,
            dynamic_config: Mutex::new(MockProviderDynamicConfig::default()),
            call_count: AtomicUsize::new(0),
            last_request: Mutex::new(None),
        }
    }

    /// Creates a mock provider with custom metadata and dynamic configuration.
    pub fn with_metadata_and_config(
        metadata: ProviderMetadata,
        dynamic_config: MockProviderDynamicConfig,
    ) -> Self {
        Self {
            id: metadata.id.clone(),
            metadata,
            dynamic_config: Mutex::new(dynamic_config),
            call_count: AtomicUsize::new(0),
            last_request: Mutex::new(None),
        }
    }

    /// Helper to inject an error for subsequent calls.
    pub fn set_injected_error(&self, error: Option<ProviderError>) {
        let mut cfg = self.dynamic_config.lock().unwrap();
        cfg.injected_error = error;
    }

    /// Helper to set simulated network latency.
    pub fn set_latency(&self, latency: Duration) {
        let mut cfg = self.dynamic_config.lock().unwrap();
        cfg.latency = latency;
    }

    /// Helper to set canned reply text.
    pub fn set_default_reply(&self, reply: impl Into<String>) {
        let mut cfg = self.dynamic_config.lock().unwrap();
        cfg.default_reply = reply.into();
    }

    /// Helper to set the simulated health status.
    pub fn set_health_status(&self, status: ProviderHealth) {
        let mut cfg = self.dynamic_config.lock().unwrap();
        cfg.health_status = status;
    }

    /// Returns the total number of times `execute()` was invoked.
    pub fn call_count(&self) -> usize {
        self.call_count.load(Ordering::SeqCst)
    }

    /// Returns a clone of the most recent request passed to `execute()`.
    pub fn last_request(&self) -> Option<ProviderRequest> {
        self.last_request.lock().unwrap().clone()
    }
}

impl Default for MockProviderClient {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ProviderClient for MockProviderClient {
    fn id(&self) -> &ProviderId {
        &self.id
    }

    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    fn capabilities(&self) -> &ProviderCapabilities {
        &self.metadata.capabilities
    }

    fn models(&self) -> &[ProviderModel] {
        &self.metadata.models
    }

    async fn execute(
        &self,
        request: ProviderRequest,
        context: &TaskContext,
    ) -> Result<ProviderResponse, ProviderError> {
        self.call_count.fetch_add(1, Ordering::SeqCst);
        *self.last_request.lock().unwrap() = Some(request.clone());

        // 1. Pre-flight cooperative cancellation check
        if context.is_cancelled() {
            return Err(ProviderError::cancelled(Some(self.id.clone())));
        }

        // 2. Validate request
        request.validate().map_err(|msg| {
            ProviderError::invalid_request(Some(self.id.clone()), msg)
        })?;

        // 3. Extract dynamic test configuration
        let (latency, injected_error, default_reply) = {
            let cfg = self.dynamic_config.lock().unwrap();
            (cfg.latency, cfg.injected_error.clone(), cfg.default_reply.clone())
        };

        // 4. Simulate latency with cooperative cancellation
        if latency > Duration::ZERO {
            tokio::select! {
                _ = tokio::time::sleep(latency) => {}
                _ = context.cancelled() => {
                    return Err(ProviderError::cancelled(Some(self.id.clone())));
                }
            }
        }

        // 5. Injected error branch
        if let Some(err) = injected_error {
            return Err(err);
        }

        // 6. Return successful mock response
        let prompt_tokens = request.messages.iter().map(|m| m.content.len() as u32 / 4).sum::<u32>() + 10;
        let completion_tokens = default_reply.len() as u32 / 4 + 5;
        let usage = ProviderUsage::new(prompt_tokens, completion_tokens);

        let metadata = ResponseMetadata::new(
            Some(250),
            Some("mock-system-fingerprint-001".to_string()),
            Some(100.0),
        );

        Ok(ProviderResponse::new(
            format!("mock-resp-{}", self.call_count.load(Ordering::SeqCst)),
            self.id.clone(),
            request.model_id,
            default_reply,
            ProviderFinishReason::Stop,
            usage,
            metadata,
        ))
    }

    async fn health_check(&self) -> Result<ProviderHealthReport, ProviderError> {
        let (status, latency) = {
            let cfg = self.dynamic_config.lock().unwrap();
            (cfg.health_status, cfg.latency.as_millis() as u64)
        };

        Ok(ProviderHealthReport::new(
            status,
            1700000000000,
            Some(latency),
            Some(format!("Mock health status: {}", status)),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::tasks::TaskId;
    use std::sync::Arc;
    use tokio_util::sync::CancellationToken;

    fn test_task_context() -> TaskContext {
        TaskContext {
            task_id: TaskId::new("test-provider-task"),
            token: CancellationToken::new(),
            parent_task_id: None,
        }
    }

    #[tokio::test]
    async fn test_mock_client_dynamic_dispatch() {
        let mock = MockProviderClient::new();
        let client: Arc<dyn ProviderClient + Send + Sync> = Arc::new(mock);

        assert_eq!(client.id().as_str(), "mock-provider");
        assert_eq!(client.models().len(), 1);
        assert!(client.capabilities().supports(&ProviderCapability::TextGeneration));

        let health = client.health_check().await.unwrap();
        assert!(health.status.is_operational());
    }

    #[tokio::test]
    async fn test_mock_client_execution_success() {
        let mock = MockProviderClient::new();
        let ctx = test_task_context();
        let req = ProviderRequest::simple("mock-model-v1", "Hello Nano Route!");

        let resp = mock.execute(req, &ctx).await.unwrap();
        assert_eq!(resp.provider_id.as_str(), "mock-provider");
        assert_eq!(resp.model_id, "mock-model-v1");
        assert!(resp.content.contains("deterministic mock response"));
        assert_eq!(resp.finish_reason, ProviderFinishReason::Stop);
        assert_eq!(mock.call_count(), 1);
    }

    #[tokio::test]
    async fn test_mock_client_cancellation() {
        let mock = MockProviderClient::new();
        let ctx = test_task_context();
        ctx.token.cancel(); // Pre-cancel

        let req = ProviderRequest::simple("mock-model-v1", "Hello");
        let result = mock.execute(req, &ctx).await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.kind, ProviderErrorKind::Cancelled);
    }

    #[tokio::test]
    async fn test_mock_client_error_injection() {
        let mock = MockProviderClient::new();
        let ctx = test_task_context();

        mock.set_injected_error(Some(ProviderError::rate_limited(
            Some(mock.id().clone()),
            "Rate limited by mock",
            Some(3000),
        )));

        let req = ProviderRequest::simple("mock-model-v1", "Test error injection");
        let result = mock.execute(req, &ctx).await;

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.kind, ProviderErrorKind::RateLimited);
        assert_eq!(err.retry_after_ms, Some(3000));
    }
}
