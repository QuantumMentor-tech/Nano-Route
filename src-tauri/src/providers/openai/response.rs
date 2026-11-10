// ============================================================================
// Nano Route - OpenAI Provider Response Parsing & Normalization
// File: src-tauri/src/providers/openai/response.rs
// ============================================================================
// Deserializes and maps OpenAI Responses API (`/v1/responses`) JSON structures
// into Nano Route's canonical `ProviderResponse`, `ProviderUsage`, and
// `ProviderFinishReason` types. Includes fallback for standard chat completion envelopes.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::response::{
    ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata,
};
use serde::{Deserialize, Serialize};

/// Detailed breakdown of output token metrics.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct OpenAiOutputTokenDetails {
    pub reasoning_tokens: Option<u32>,
    pub accepted_prediction_tokens: Option<u32>,
    pub rejected_prediction_tokens: Option<u32>,
}

/// Token usage metadata returned in OpenAI Responses API envelopes.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct OpenAiResponsesUsage {
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub total_tokens: Option<u32>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub output_token_details: Option<OpenAiOutputTokenDetails>,
}

impl OpenAiResponsesUsage {
    /// Converts to normalized `ProviderUsage`.
    pub fn to_provider_usage(&self) -> ProviderUsage {
        let input = self.input_tokens.or(self.prompt_tokens);
        let output = self.output_tokens.or(self.completion_tokens);
        let total = self.total_tokens.or_else(|| match (input, output) {
            (Some(i), Some(o)) => Some(i + o),
            _ => None,
        });

        let reasoning = self
            .output_token_details
            .as_ref()
            .and_then(|d| d.reasoning_tokens);

        ProviderUsage {
            input_tokens: input,
            output_tokens: output,
            total_tokens: total,
            reasoning_tokens: reasoning,
            cache_read_tokens: None,
            cache_write_tokens: None,
        }
    }
}

/// Output item content part in Responses API.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OpenAiOutputContentPart {
    OutputText {
        text: String,
    },
    Text {
        text: String,
    },
    #[serde(other)]
    Unknown,
}

/// Output item in the Responses API `output` array.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiOutputItem {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub item_type: Option<String>,
    pub role: Option<String>,
    pub content: Option<Vec<OpenAiOutputContentPart>>,
}

/// Details about why a response is incomplete.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiIncompleteDetails {
    pub reason: Option<String>,
}

/// Fallback choice structure for standard Chat Completions payloads.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiChatChoice {
    pub index: Option<u32>,
    pub message: Option<OpenAiChatMessage>,
    pub finish_reason: Option<String>,
}

/// Fallback message structure for standard Chat Completions payloads.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiChatMessage {
    pub role: Option<String>,
    pub content: Option<String>,
}

/// Top-level wire envelope returned by OpenAI Responses API (`/v1/responses`).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct OpenAiResponsesResponse {
    pub id: Option<String>,
    pub object: Option<String>,
    pub model: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub output: Vec<OpenAiOutputItem>,
    pub usage: Option<OpenAiResponsesUsage>,
    pub incomplete_details: Option<OpenAiIncompleteDetails>,
    // Fallback choices for /v1/chat/completions compatible envelopes
    pub choices: Option<Vec<OpenAiChatChoice>>,
}

impl OpenAiResponsesResponse {
    /// Extracts the full generated textual response.
    pub fn extract_text(&self) -> String {
        // 1. Try Responses API `output` array
        let mut parts = Vec::new();
        for item in &self.output {
            if let Some(content_parts) = &item.content {
                for part in content_parts {
                    match part {
                        OpenAiOutputContentPart::OutputText { text } => parts.push(text.as_str()),
                        OpenAiOutputContentPart::Text { text } => parts.push(text.as_str()),
                        OpenAiOutputContentPart::Unknown => {}
                    }
                }
            }
        }

        if !parts.is_empty() {
            return parts.join("");
        }

        // 2. Fallback to standard chat completions `choices` array
        if let Some(choices) = &self.choices {
            if let Some(first) = choices.first() {
                if let Some(msg) = &first.message {
                    if let Some(content) = &msg.content {
                        return content.clone();
                    }
                }
            }
        }

        String::new()
    }

    /// Resolves canonical `ProviderFinishReason`.
    pub fn resolve_finish_reason(&self) -> ProviderFinishReason {
        // 1. Check Responses API status & incomplete_details
        if let Some(status) = self.status.as_deref() {
            match status {
                "completed" => return ProviderFinishReason::Completed,
                "cancelled" => return ProviderFinishReason::Cancelled,
                "failed" => return ProviderFinishReason::ProviderError,
                "incomplete" => {
                    if let Some(details) = &self.incomplete_details {
                        if let Some(reason) = details.reason.as_deref() {
                            match reason {
                                "max_output_tokens" => return ProviderFinishReason::LengthLimit,
                                "content_filter" => return ProviderFinishReason::ContentFiltered,
                                _ => return ProviderFinishReason::LengthLimit,
                            }
                        }
                    }
                    return ProviderFinishReason::LengthLimit;
                }
                _ => {}
            }
        }

        // 2. Check fallback choices finish_reason
        if let Some(choices) = &self.choices {
            if let Some(first) = choices.first() {
                if let Some(reason) = first.finish_reason.as_deref() {
                    match reason {
                        "stop" => return ProviderFinishReason::Completed,
                        "length" => return ProviderFinishReason::LengthLimit,
                        "tool_calls" | "function_call" => return ProviderFinishReason::ToolCall,
                        "content_filter" => return ProviderFinishReason::ContentFiltered,
                        _ => return ProviderFinishReason::Unknown,
                    }
                }
            }
        }

        ProviderFinishReason::Completed
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

        let provider_id = ProviderId::new(ProviderId::OPENAI).unwrap();

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

