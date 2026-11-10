// ============================================================================
// Nano Route - Anthropic Provider Response Parsing & Normalization
// File: src-tauri/src/providers/anthropic/response.rs
// ============================================================================
// Deserializes and maps Anthropic Messages API (`POST /v1/messages`) JSON structures
// into Nano Route's canonical `ProviderResponse`, `ProviderUsage`, and
// `ProviderFinishReason` types.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::response::{
    ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata,
};
use serde::{Deserialize, Serialize};

/// Detailed token metrics returned by Anthropic Messages API.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct AnthropicUsage {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub cache_creation_input_tokens: Option<u32>,
    pub cache_read_input_tokens: Option<u32>,
}

impl AnthropicUsage {
    /// Converts to normalized `ProviderUsage`.
    pub fn to_provider_usage(&self) -> ProviderUsage {
        let total = match (self.input_tokens, self.output_tokens) {
            (Some(i), Some(o)) => Some(i + o),
            (Some(i), None) => Some(i),
            (None, Some(o)) => Some(o),
            (None, None) => None,
        };

        ProviderUsage {
            input_tokens: self.input_tokens,
            output_tokens: self.output_tokens,
            total_tokens: total,
            reasoning_tokens: None,
            cache_read_tokens: self.cache_read_input_tokens,
            cache_write_tokens: self.cache_creation_input_tokens,
        }
    }
}

/// Content block in an Anthropic message response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AnthropicContentBlock {
    Text { text: String },
    #[serde(other)]
    Unknown,
}

/// Inbound JSON envelope returned by Anthropic Messages API (`/v1/messages`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnthropicMessagesResponse {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub response_type: Option<String>,
    pub role: Option<String>,
    #[serde(default)]
    pub content: Vec<AnthropicContentBlock>,
    pub model: Option<String>,
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<String>,
    pub usage: Option<AnthropicUsage>,
}

impl AnthropicMessagesResponse {
    /// Concatenates text across all text content blocks.
    pub fn extract_text(&self) -> String {
        let mut parts = Vec::new();
        for block in &self.content {
            match block {
                AnthropicContentBlock::Text { text } => parts.push(text.as_str()),
                AnthropicContentBlock::Unknown => {}
            }
        }
        parts.join("")
    }

    /// Resolves canonical `ProviderFinishReason`.
    pub fn resolve_finish_reason(&self) -> ProviderFinishReason {
        match self.stop_reason.as_deref() {
            Some("end_turn") => ProviderFinishReason::Completed,
            Some("max_tokens") => ProviderFinishReason::LengthLimit,
            Some("stop_sequence") => ProviderFinishReason::Completed,
            Some("tool_use") => ProviderFinishReason::ToolCall,
            _ => ProviderFinishReason::Completed,
        }
    }

    /// Normalizes this envelope into a canonical `ProviderResponse`.
    pub fn into_provider_response(
        self,
        request_id: String,
        requested_model: &str,
        latency_ms: u64,
    ) -> Result<ProviderResponse, ProviderError> {
        let text = self.extract_text();
        let finish_reason = self.resolve_finish_reason();
        let usage = self.usage.as_ref().map(|u| u.to_provider_usage());
        let provider_model_id = self
            .model
            .clone()
            .unwrap_or_else(|| requested_model.to_string());

        let provider_id = ProviderId::new(ProviderId::ANTHROPIC).unwrap();

        Ok(ProviderResponse {
            provider_id,
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

