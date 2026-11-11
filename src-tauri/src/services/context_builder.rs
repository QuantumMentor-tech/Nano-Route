// ============================================================================
// Nano Route - Conversation Context Builder
// File: src-tauri/src/services/context_builder.rs
// ============================================================================
// Assembles canonical provider chat messages from persisted SQLite history.
// Maps internal domain senders to provider roles, strips metadata artifacts,
// and validates token bounds against the selected model's context capacity.
// ============================================================================

use crate::domain::{ChatMessage as DomainMessage, MessageSender};
use crate::errors::AppError;
use crate::providers::models::ProviderModel;
use crate::providers::request::{ChatMessage as ProviderMessage, MessageRole};

pub struct ConversationContextBuilder;

impl ConversationContextBuilder {
    /// Builds a validated sequence of `ProviderMessage`s for outbound execution.
    ///
    /// Preserves strict conversational order: earlier turns first, followed by
    /// the active turn's user prompt. Validates token constraints against the model.
    pub fn build(
        history: &[DomainMessage],
        current_prompt: &str,
        model: &ProviderModel,
    ) -> Result<Vec<ProviderMessage>, AppError> {
        let trimmed_prompt = current_prompt.trim();
        if trimmed_prompt.is_empty() {
            return Err(AppError::InvalidInput(
                "Current prompt cannot be empty or whitespace only".to_string(),
            ));
        }

        let mut provider_messages = Vec::with_capacity(history.len() + 1);
        let mut total_chars: usize = 0;

        // 1. Map existing history turns
        for msg in history {
            let role = match msg.sender {
                MessageSender::User => MessageRole::User,
                MessageSender::Assistant => MessageRole::Assistant,
                MessageSender::System => MessageRole::System,
            };

            let content = msg.content.trim();
            if !content.is_empty() {
                total_chars += content.len();
                provider_messages.push(ProviderMessage {
                    role,
                    content: content.to_string(),
                    name: None,
                });
            }
        }

        // 2. Append active user prompt
        total_chars += trimmed_prompt.len();
        provider_messages.push(ProviderMessage {
            role: MessageRole::User,
            content: trimmed_prompt.to_string(),
            name: None,
        });

        // 3. Conservative token estimation (~4 characters per token + per-message overhead)
        let estimated_tokens = (total_chars / 4) + (provider_messages.len() * 4);

        // 4. Validate against selected model's context window
        if model.context_window > 0 && estimated_tokens as u32 > model.context_window {
            return Err(AppError::InvalidInput(format!(
                "Conversation context length (~{} tokens) exceeds model '{}' capacity ({} tokens)",
                estimated_tokens, model.model_id, model.context_window
            )));
        }

        Ok(provider_messages)
    }
}

