// ============================================================================
// Nano Route - Anthropic Provider Request Mapping
// File: src-tauri/src/providers/anthropic/request.rs
// ============================================================================
// Translates canonical Nano Route `ProviderRequest` contracts into Anthropic's
// native Messages API (`POST /v1/messages`) wire schema.
// Extracts system instructions into the top-level `system` field.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::request::{ChatMessage, MessageRole, ProviderRequest};
use serde::{Deserialize, Serialize};

const DEFAULT_ANTHROPIC_MAX_TOKENS: u32 = 4096;

/// Message item conforming to the Anthropic Messages API specification.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnthropicMessage {
    /// Role identifier: strictly "user" or "assistant".
    pub role: String,
    /// Textual content of the conversational turn.
    pub content: String,
}

impl AnthropicMessage {
    pub fn new(role: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            content: content.into(),
        }
    }
}

/// Outbound wire payload for Anthropic Messages API (`POST /v1/messages`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnthropicMessagesRequest {
    /// Exact Anthropic model identifier (e.g. "claude-3-5-sonnet-20241022").
    pub model: String,
    /// Maximum number of tokens the model may generate (mandatory in Anthropic API).
    pub max_tokens: u32,
    /// Ordered conversation turns between user and assistant.
    pub messages: Vec<AnthropicMessage>,
    /// Top-level system prompt instructions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system: Option<String>,
    /// Whether to stream incremental Server-Sent Events (SSE).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    /// Sampling temperature between 0.0 and 1.0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Nucleus sampling cutoff between 0.0 and 1.0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
}

impl AnthropicMessagesRequest {
    /// Maps a canonical `ProviderRequest` into an `AnthropicMessagesRequest`.
    pub fn from_provider_request(
        req: &ProviderRequest,
        stream: bool,
    ) -> Result<Self, ProviderError> {
        let provider_id = Some(ProviderId::new(ProviderId::ANTHROPIC).unwrap());

        if req.model_id.trim().is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Model identifier cannot be empty for Anthropic execution",
            ));
        }

        if req.messages.is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Request must contain at least one message for Anthropic execution",
            ));
        }

        let mut system_parts = Vec::new();
        let mut messages = Vec::new();

        for (idx, msg) in req.messages.iter().enumerate() {
            match msg.role {
                MessageRole::System => {
                    if !msg.content.trim().is_empty() {
                        system_parts.push(msg.content.clone());
                    }
                }
                MessageRole::User => {
                    if msg.content.trim().is_empty() {
                        return Err(ProviderError::invalid_request(
                            provider_id.clone(),
                            format!("User message at index {} has empty content", idx),
                        ));
                    }
                    messages.push(AnthropicMessage::new("user", &msg.content));
                }
                MessageRole::Assistant => {
                    messages.push(AnthropicMessage::new("assistant", &msg.content));
                }
                MessageRole::Tool => {
                    // Tool messages without tool calling capability enabled are unsupported in MVP
                    return Err(ProviderError::invalid_request(
                        provider_id.clone(),
                        format!(
                            "Tool message at index {} is not supported in Anthropic text-chat MVP",
                            idx
                        ),
                    ));
                }
            }
        }

        if messages.is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Anthropic request requires at least one conversational user/assistant message",
            ));
        }

        let system = if system_parts.is_empty() {
            None
        } else {
            Some(system_parts.join("\n\n"))
        };

        let max_tokens = req
            .params
            .max_tokens
            .unwrap_or(DEFAULT_ANTHROPIC_MAX_TOKENS);

        let temperature = req.params.temperature;
        let top_p = req.params.top_p;

        Ok(Self {
            model: req.model_id.clone(),
            max_tokens,
            messages,
            system,
            stream: if stream { Some(true) } else { None },
            temperature,
            top_p,
        })
    }
}

