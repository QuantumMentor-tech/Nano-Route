// ============================================================================
// Nano Route - OpenAI Provider Request Mapping
// File: src-tauri/src/providers/openai/request.rs
// ============================================================================
// Translates canonical Nano Route `ProviderRequest` contracts into OpenAI's
// native Responses API (`/v1/responses`) wire schema.
// Strictly avoids legacy Assistants API, Threads, or Runs concepts.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::request::{ChatMessage, MessageRole, ProviderRequest};
use serde::{Deserialize, Serialize};

/// Discrete content item inside an OpenAI Responses API input message.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OpenAiContentPart {
    /// Text input part.
    InputText { text: String },
    /// Image URL or base64 input part for vision-capable models.
    InputImage { image_url: OpenAiImageUrl },
}

/// Image payload representation for multimodal inputs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiImageUrl {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Structured input content representing either a single string or multipart array.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAiInputContent {
    /// Simple raw text string.
    Text(String),
    /// Multipart array containing text and/or images.
    Parts(Vec<OpenAiContentPart>),
}

/// Individual message/input item conforming to the OpenAI Responses API schema.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiInputItem {
    /// Role identifier: "user", "assistant", "system", or "developer".
    pub role: String,
    /// Content of the message.
    pub content: OpenAiInputContent,
}

impl OpenAiInputItem {
    /// Creates a simple text message item.
    pub fn new_text(role: impl Into<String>, text: impl Into<String>) -> Self {
        Self {
            role: role.into(),
            content: OpenAiInputContent::Text(text.into()),
        }
    }
}

/// Wire payload for OpenAI Responses API (`POST /v1/responses`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiResponsesRequest {
    /// Exact OpenAI model identifier (e.g. "gpt-4o", "gpt-4o-mini", "o1", "o3-mini").
    pub model: String,
    /// Ordered conversation history passed to the model.
    pub input: Vec<OpenAiInputItem>,
    /// Whether to stream incremental tokens via Server-Sent Events (SSE).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    /// Sampling temperature between 0.0 and 2.0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    /// Maximum number of tokens the model is allowed to generate in the response.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    /// Nucleus sampling probability cutoff between 0.0 and 1.0.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
}

impl OpenAiResponsesRequest {
    /// Maps a canonical `ProviderRequest` into an `OpenAiResponsesRequest`.
    pub fn from_provider_request(
        req: &ProviderRequest,
        stream: bool,
    ) -> Result<Self, ProviderError> {
        let provider_id = Some(ProviderId::new(ProviderId::OPENAI).unwrap());

        if req.model_id.trim().is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Model identifier cannot be empty for OpenAI execution",
            ));
        }

        if req.messages.is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Request must contain at least one message for OpenAI execution",
            ));
        }

        let mut input_items = Vec::with_capacity(req.messages.len());
        for (idx, msg) in req.messages.iter().enumerate() {
            let role_str = match msg.role {
                MessageRole::System => "developer", // OpenAI Responses API standardizes system instructions to 'developer'
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

            input_items.push(OpenAiInputItem::new_text(role_str, &msg.content));
        }

        let temperature = req.params.temperature;
        let top_p = req.params.top_p;
        let max_output_tokens = req.params.max_tokens;

        Ok(Self {
            model: req.model_id.clone(),
            input: input_items,
            stream: if stream { Some(true) } else { None },
            temperature,
            max_output_tokens,
            top_p,
        })
    }
}

