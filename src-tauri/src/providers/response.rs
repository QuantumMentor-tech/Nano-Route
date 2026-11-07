//! Provider Response Contract
//!
//! Responsibility:
//! - Canonical representation of model generation responses.
//! - Normalized token accounting, finish reason categories, and diagnostic latency.
//! - Translates vendor-specific response bodies into a unified internal model.

use serde::{Deserialize, Serialize};
use crate::providers::identity::ProviderId;

/// Normalized termination reason for model generation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ProviderFinishReason {
    /// Natural generation completion (stop sequence or end of turn).
    Completed,
    /// Generation halted due to max_output_tokens or context window boundary.
    LengthLimit,
    /// Generation halted because model requested one or more tool/function invocations.
    ToolCall,
    /// Generation halted due to provider content safety policy / moderation filter.
    ContentFiltered,
    /// Request was cancelled by caller before natural completion.
    Cancelled,
    /// Provider encountered an execution failure during token generation.
    ProviderError,
    /// Finish reason could not be determined or is vendor-specific.
    Unknown,
}

/// Normalized token accounting metrics returned by an AI provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ProviderUsage {
    /// Prompt tokens processed by the model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_tokens: Option<u32>,
    /// Generation tokens produced by the model.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_tokens: Option<u32>,
    /// Total billed or processed tokens.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u32>,
    /// Internal reasoning / thinking tokens (e.g., o1, o3, DeepSeek-R1).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning_tokens: Option<u32>,
    /// Tokens read from provider KV cache.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u32>,
    /// Tokens written to provider KV cache.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cache_write_tokens: Option<u32>,
}

impl ProviderUsage {
    pub fn new(input: u32, output: u32) -> Self {
        Self {
            input_tokens: Some(input),
            output_tokens: Some(output),
            total_tokens: Some(input + output),
            reasoning_tokens: None,
            cache_read_tokens: None,
            cache_write_tokens: None,
        }
    }
}

/// Operational metadata associated with the completed response.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResponseMetadata {
    /// Correlating IPC Request ID.
    pub request_id: String,
    /// Total execution duration in milliseconds.
    pub latency_ms: u64,
    /// Specific model checkpoint returned by the provider (e.g., "gpt-4o-2024-08-06").
    pub provider_model_id: String,
}

/// Canonical provider response returned to application services.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderResponse {
    /// Identity of the provider delivering the response.
    pub provider_id: ProviderId,
    /// Requested model identifier.
    pub model_id: String,
    /// Generated textual content.
    pub text: String,
    /// Normalized termination state.
    pub finish_reason: ProviderFinishReason,
    /// Token usage measurements, if provided by the vendor.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<ProviderUsage>,
    /// Operational response metadata.
    pub metadata: ResponseMetadata,
}

impl ProviderResponse {
    /// Convenience constructor for successful text completions.
    pub fn success(
        provider_id: ProviderId,
        model_id: impl Into<String>,
        text: impl Into<String>,
        request_id: impl Into<String>,
        latency_ms: u64,
        usage: Option<ProviderUsage>,
    ) -> Self {
        let m_id = model_id.into();
        Self {
            provider_id,
            model_id: m_id.clone(),
            text: text.into(),
            finish_reason: ProviderFinishReason::Completed,
            usage,
            metadata: ResponseMetadata {
                request_id: request_id.into(),
                latency_ms,
                provider_model_id: m_id,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_provider_response_construction() {
        let pid = ProviderId::new("openai").unwrap();
        let usage = ProviderUsage::new(100, 50);

        let response = ProviderResponse::success(
            pid,
            "gpt-4o",
            "This is an AI response.",
            "req_test_02",
            245,
            Some(usage),
        );

        assert_eq!(response.provider_id.as_str(), "openai");
        assert_eq!(response.text, "This is an AI response.");
        assert_eq!(response.finish_reason, ProviderFinishReason::Completed);
        assert_eq!(response.usage.unwrap().total_tokens, Some(150));
        assert_eq!(response.metadata.latency_ms, 245);
    }
}

