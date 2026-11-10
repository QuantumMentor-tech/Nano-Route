// ============================================================================
// Nano Route - Google Gemini Provider Response Parsing & Normalization
// File: src-tauri/src/providers/gemini/response.rs
// ============================================================================
// Deserializes and maps Google Gemini Generate Content API JSON structures
// into Nano Route's canonical `ProviderResponse`, `ProviderUsage`, and
// `ProviderFinishReason` types.
// ============================================================================

use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::response::{
    ProviderFinishReason, ProviderResponse, ProviderUsage, ResponseMetadata,
};
use serde::{Deserialize, Serialize};

/// Detailed token metrics returned in Gemini `usageMetadata`.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiUsageMetadata {
    pub prompt_token_count: Option<u32>,
    pub candidates_token_count: Option<u32>,
    pub total_token_count: Option<u32>,
}

impl GeminiUsageMetadata {
    pub fn to_provider_usage(&self) -> ProviderUsage {
        let total = self.total_token_count.or_else(|| {
            match (self.prompt_token_count, self.candidates_token_count) {
                (Some(p), Some(c)) => Some(p + c),
                _ => None,
            }
        });

        ProviderUsage {
            input_tokens: self.prompt_token_count,
            output_tokens: self.candidates_token_count,
            total_tokens: total,
            reasoning_tokens: None,
            cache_read_tokens: None,
            cache_write_tokens: None,
        }
    }
}

/// Text part in candidate response content.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeminiCandidatePart {
    #[serde(default)]
    pub text: Option<String>,
}

/// Content envelope within a candidate.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeminiCandidateContent {
    #[serde(default)]
    pub parts: Vec<GeminiCandidatePart>,
    pub role: Option<String>,
}

/// Individual generation candidate returned by Gemini.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiCandidate {
    pub content: Option<GeminiCandidateContent>,
    pub finish_reason: Option<String>,
    pub index: Option<u32>,
}

/// Safety and policy feedback block.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiPromptFeedback {
    pub block_reason: Option<String>,
}

/// Top-level wire envelope returned by Gemini Generate Content API.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeminiGenerateContentResponse {
    #[serde(default)]
    pub candidates: Vec<GeminiCandidate>,
    pub prompt_feedback: Option<GeminiPromptFeedback>,
    pub usage_metadata: Option<GeminiUsageMetadata>,
    pub model_version: Option<String>,
    pub response_id: Option<String>,
}

impl GeminiGenerateContentResponse {
    /// Concatenates text parts from the first valid candidate.
    pub fn extract_text(&self) -> String {
        if let Some(candidate) = self.candidates.first() {
            if let Some(content) = &candidate.content {
                let mut out = String::new();
                for part in &content.parts {
                    if let Some(text) = &part.text {
                        out.push_str(text);
                    }
                }
                return out;
            }
        }
        String::new()
    }

    /// Resolves canonical `ProviderFinishReason`.
    pub fn resolve_finish_reason(&self) -> ProviderFinishReason {
        if let Some(feedback) = &self.prompt_feedback {
            if feedback.block_reason.is_some() {
                return ProviderFinishReason::ContentFiltered;
            }
        }

        if let Some(candidate) = self.candidates.first() {
            if let Some(reason) = candidate.finish_reason.as_deref() {
                match reason {
                    "STOP" => return ProviderFinishReason::Completed,
                    "MAX_TOKENS" => return ProviderFinishReason::LengthLimit,
                    "SAFETY" | "RECITATION" => return ProviderFinishReason::ContentFiltered,
                    "OTHER" => return ProviderFinishReason::Completed,
                    _ => return ProviderFinishReason::Completed,
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
        let usage = self.usage_metadata.as_ref().map(|u| u.to_provider_usage());
        let provider_model_id = self
            .model_version
            .clone()
            .unwrap_or_else(|| requested_model.to_string());

        let provider_id = ProviderId::new(ProviderId::GEMINI).unwrap();

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

