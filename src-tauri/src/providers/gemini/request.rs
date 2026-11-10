// ============================================================================
// Nano Route - Google Gemini Provider Request Mapping
// File: src-tauri/src/providers/gemini/request.rs
// ============================================================================
// Translates canonical Nano Route `ProviderRequest` contracts into Google Gemini's
// native Generate Content API (`/v1beta/models/{model}:generateContent`) wire schema.
// Maps system instructions to `systemInstruction` and conversational turns to `contents`.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::request::{ChatMessage, MessageRole, ProviderRequest};
use serde::{Deserialize, Serialize};

/// Text part within a Gemini content object.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeminiPart {
    pub text: String,
}

impl GeminiPart {
    pub fn new(text: impl Into<String>) -> Self {
        Self { text: text.into() }
    }
}

/// Conversational content turn for Gemini.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeminiContent {
    /// Role identifier: "user" or "model" (Google Gemini native convention).
    pub role: String,
    pub parts: Vec<GeminiPart>,
}

/// Dedicated top-level system instruction payload for Gemini models.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeminiSystemInstruction {
    pub parts: Vec<GeminiPart>,
}

/// Generation parameters conforming to camelCase Gemini wire schema.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
}

/// Outbound wire payload for Google Gemini Generate Content API.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerateContentRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<GeminiSystemInstruction>,
    pub contents: Vec<GeminiContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generation_config: Option<GeminiGenerationConfig>,
}

impl GeminiGenerateContentRequest {
    /// Maps a canonical `ProviderRequest` into a `GeminiGenerateContentRequest`.
    pub fn from_provider_request(req: &ProviderRequest) -> Result<Self, ProviderError> {
        let provider_id = Some(ProviderId::new(ProviderId::GEMINI).unwrap());

        if req.model_id.trim().is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Model identifier cannot be empty for Gemini execution",
            ));
        }

        if req.messages.is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Request must contain at least one message for Gemini execution",
            ));
        }

        let mut system_parts = Vec::new();
        let mut contents = Vec::new();

        for (idx, msg) in req.messages.iter().enumerate() {
            match msg.role {
                MessageRole::System => {
                    if !msg.content.trim().is_empty() {
                        system_parts.push(GeminiPart::new(&msg.content));
                    }
                }
                MessageRole::User => {
                    if msg.content.trim().is_empty() {
                        return Err(ProviderError::invalid_request(
                            provider_id.clone(),
                            format!("User message at index {} has empty content", idx),
                        ));
                    }
                    contents.push(GeminiContent {
                        role: "user".to_string(),
                        parts: vec![GeminiPart::new(&msg.content)],
                    });
                }
                MessageRole::Assistant => {
                    contents.push(GeminiContent {
                        role: "model".to_string(), // Gemini uses "model" instead of "assistant"
                        parts: vec![GeminiPart::new(&msg.content)],
                    });
                }
                MessageRole::Tool => {
                    return Err(ProviderError::invalid_request(
                        provider_id.clone(),
                        format!(
                            "Tool message at index {} is not supported in Gemini text-chat MVP",
                            idx
                        ),
                    ));
                }
            }
        }

        if contents.is_empty() {
            return Err(ProviderError::invalid_request(
                provider_id,
                "Gemini request requires at least one conversational user or model turn",
            ));
        }

        let system_instruction = if system_parts.is_empty() {
            None
        } else {
            Some(GeminiSystemInstruction {
                parts: system_parts,
            })
        };

        let generation_config = if req.params.temperature.is_some()
            || req.params.max_tokens.is_some()
            || req.params.top_p.is_some()
        {
            Some(GeminiGenerationConfig {
                temperature: req.params.temperature,
                max_output_tokens: req.params.max_tokens,
                top_p: req.params.top_p,
            })
        } else {
            None
        };

        Ok(Self {
            system_instruction,
            contents,
            generation_config,
        })
    }
}

