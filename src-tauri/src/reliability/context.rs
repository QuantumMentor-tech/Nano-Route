// ============================================================================
// Nano Route - Context Window Headroom & Feasibility Subsystem
// File: src-tauri/src/reliability/context.rs
// ============================================================================
// Evaluates conversation history, system prompt, user input, and requested
// output tokens against candidate model context limits before physical dispatch.
// Zero network calls are made during context verification.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::domain::chat::ChatMessage;
use crate::providers::models::ProviderModel;

pub const DEFAULT_SAFETY_MARGIN_RATIO: f64 = 0.10; // 10% safety buffer
pub const DEFAULT_MIN_SAFETY_MARGIN_TOKENS: u64 = 500;
pub const DEFAULT_ESTIMATED_OUTPUT_TOKENS: u64 = 4096;

/// Headroom status of candidate context window feasibility.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ContextStatus {
    /// Fits comfortably with safety margin.
    Sufficient,
    /// Fits within absolute limit, but enters safety margin buffer.
    NearLimit,
    /// Exceeds model context limit or output token ceiling.
    ExceedsLimit,
    /// Model context specification is missing or invalid.
    Unsupported,
}

impl ContextStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Sufficient => "sufficient",
            Self::NearLimit => "near_limit",
            Self::ExceedsLimit => "exceeds_limit",
            Self::Unsupported => "unsupported",
        }
    }
}

/// Provenance of the token count estimation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenCountProvenance {
    /// Counted with exact tokenizer.
    Exact,
    /// Computed via heuristic estimation.
    Estimated,
    /// Unknown / cannot estimate.
    Unknown,
}

/// Comprehensive context evaluation result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextCheckResult {
    pub input_tokens: u64,
    pub requested_output_tokens: u64,
    pub total_required_tokens: u64,
    pub context_window_limit: u64,
    pub max_output_tokens_limit: u64,
    pub safety_margin_tokens: u64,
    pub available_headroom: i64,
    pub status: ContextStatus,
    pub provenance: TokenCountProvenance,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

pub struct ContextChecker;

impl ContextChecker {
    /// Estimates input tokens from history messages, system prompt, and current user prompt.
    /// Uses standard ~3.8 chars per token plus framing overhead per message.
    pub fn estimate_input_tokens(
        history: &[ChatMessage],
        prompt: &str,
        system_instruction: Option<&str>,
    ) -> u64 {
        let mut total_chars: usize = prompt.chars().count();
        if let Some(sys) = system_instruction {
            total_chars += sys.chars().count();
        }
        for msg in history {
            total_chars += msg.content.chars().count();
        }

        // Base tokens: ~3.8 chars/token heuristic
        let base_tokens = (total_chars as f64 / 3.8).ceil() as u64;

        // Framing overhead: 4 tokens per message (role + format markers)
        let framing_overhead = ((history.len() + 1 + if system_instruction.is_some() { 1 } else { 0 }) * 4) as u64;

        base_tokens + framing_overhead
    }

    /// Evaluates context feasibility for a given candidate model.
    pub fn check_context(
        model: &ProviderModel,
        history: &[ChatMessage],
        prompt: &str,
        system_instruction: Option<&str>,
        requested_output: Option<u64>,
    ) -> ContextCheckResult {
        let input_tokens = Self::estimate_input_tokens(history, prompt, system_instruction);
        let context_limit = model.context_window as u64;
        let max_output_limit = model.max_output_tokens.unwrap_or(context_limit / 2).max(1024) as u64;

        let requested_output_tokens = requested_output.unwrap_or_else(|| {
            DEFAULT_ESTIMATED_OUTPUT_TOKENS.min(max_output_limit)
        });

        // Check if requested output exceeds model max output
        if requested_output_tokens > max_output_limit {
            return ContextCheckResult {
                input_tokens,
                requested_output_tokens,
                total_required_tokens: input_tokens + requested_output_tokens,
                context_window_limit: context_limit,
                max_output_tokens_limit: max_output_limit,
                safety_margin_tokens: 0,
                available_headroom: -(requested_output_tokens as i64 - max_output_limit as i64),
                status: ContextStatus::ExceedsLimit,
                provenance: TokenCountProvenance::Estimated,
                reason: Some(format!(
                    "Requested output tokens ({}) exceed candidate maximum output limit ({})",
                    requested_output_tokens, max_output_limit
                )),
            };
        }

        let total_required = input_tokens + requested_output_tokens;
        let safety_margin = ((total_required as f64 * DEFAULT_SAFETY_MARGIN_RATIO).ceil() as u64)
            .max(DEFAULT_MIN_SAFETY_MARGIN_TOKENS);
        let available_headroom = context_limit as i64 - total_required as i64;

        if total_required > context_limit {
            ContextCheckResult {
                input_tokens,
                requested_output_tokens,
                total_required_tokens: total_required,
                context_window_limit: context_limit,
                max_output_tokens_limit: max_output_limit,
                safety_margin_tokens: safety_margin,
                available_headroom,
                status: ContextStatus::ExceedsLimit,
                provenance: TokenCountProvenance::Estimated,
                reason: Some(format!(
                    "Total required tokens ({}) exceed candidate context window ({})",
                    total_required, context_limit
                )),
            }
        } else if available_headroom < safety_margin as i64 {
            ContextCheckResult {
                input_tokens,
                requested_output_tokens,
                total_required_tokens: total_required,
                context_window_limit: context_limit,
                max_output_tokens_limit: max_output_limit,
                safety_margin_tokens: safety_margin,
                available_headroom,
                status: ContextStatus::NearLimit,
                provenance: TokenCountProvenance::Estimated,
                reason: Some(format!(
                    "Context headroom ({} tokens) is within safety buffer ({} tokens)",
                    available_headroom, safety_margin
                )),
            }
        } else {
            ContextCheckResult {
                input_tokens,
                requested_output_tokens,
                total_required_tokens: total_required,
                context_window_limit: context_limit,
                max_output_tokens_limit: max_output_limit,
                safety_margin_tokens: safety_margin,
                available_headroom,
                status: ContextStatus::Sufficient,
                provenance: TokenCountProvenance::Estimated,
                reason: None,
            }
        }
    }
}

