//! Provider Request Contract
//!
//! Responsibility:
//! - Canonical, provider-agnostic representation of user prompts and chat requests.
//! - Message roles, tool definitions, generation parameters, and correlation metadata.
//! - Pre-flight validation ensuring malformed requests never reach provider wire adapters.

use serde::{Deserialize, Serialize};
use crate::providers::errors::ProviderError;

/// Role of a message participant in a conversational turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MessageRole {
    /// High-level system behavior instruction.
    System,
    /// User query or prompt.
    User,
    /// Model-generated response.
    Assistant,
    /// Tool execution output returned to model.
    Tool,
    /// Developer-level guidance (supported in modern models).
    Developer,
}

impl MessageRole {
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageRole::System => "system",
            MessageRole::User => "user",
            MessageRole::Assistant => "assistant",
            MessageRole::Tool => "tool",
            MessageRole::Developer => "developer",
        }
    }
}

/// Canonical representation of an individual message in a chat history.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChatMessage {
    /// Sender role.
    pub role: MessageRole,
    /// Text payload.
    pub content: String,
    /// Optional participant name or tool call identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl ChatMessage {
    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::User,
            content: content.into(),
            name: None,
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::Assistant,
            content: content.into(),
            name: None,
        }
    }

    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: MessageRole::System,
            content: content.into(),
            name: None,
        }
    }

    pub fn tool(content: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            role: MessageRole::Tool,
            content: content.into(),
            name: Some(name.into()),
        }
    }
}

/// Parameters governing model sampling and generation behavior.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct GenerationParams {
    /// Sampling temperature (typically 0.0 to 2.0).
    pub temperature: Option<f32>,
    /// Nucleus sampling probability mass.
    pub top_p: Option<f32>,
    /// Maximum output generation tokens.
    pub max_output_tokens: Option<u32>,
    /// Frequency penalty factor (-2.0 to 2.0).
    pub frequency_penalty: Option<f32>,
    /// Presence penalty factor (-2.0 to 2.0).
    pub presence_penalty: Option<f32>,
    /// Sequences where the model stops generating further tokens.
    pub stop_sequences: Vec<String>,
}

/// Generic definition of an executable function/tool callable by models.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ToolDefinition {
    /// Unique function name.
    pub name: String,
    /// Description explaining when and how the tool should be invoked.
    pub description: String,
    /// JSON schema describing the required and optional arguments.
    pub parameters_schema: serde_json::Value,
}

/// Safe correlation identifiers tying a provider request to IPC and Task subsystems.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RequestMetadata {
    /// Authoritative IPC request correlation identifier.
    pub request_id: String,
    /// Optional background TaskId if executed via TaskManager.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    /// Optional conversation or session identifier.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
}

impl RequestMetadata {
    pub fn new(request_id: impl Into<String>) -> Self {
        Self {
            request_id: request_id.into(),
            task_id: None,
            session_id: None,
        }
    }
}

/// Normalized request dispatched to a ProviderClient instance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderRequest {
    /// Target model identifier on provider.
    pub model: String,
    /// Conversation message history.
    pub messages: Vec<ChatMessage>,
    /// Optional top-level system instruction.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<String>,
    /// Model generation settings.
    pub params: GenerationParams,
    /// Available tools for function-calling models.
    pub tools: Vec<ToolDefinition>,
    /// Correlation tracking metadata.
    pub metadata: RequestMetadata,
}

impl ProviderRequest {
    /// Creates a new single-prompt user request.
    pub fn simple_prompt(
        model: impl Into<String>,
        prompt: impl Into<String>,
        request_id: impl Into<String>,
    ) -> Self {
        Self {
            model: model.into(),
            messages: vec![ChatMessage::user(prompt)],
            system_instruction: None,
            params: GenerationParams::default(),
            tools: Vec::new(),
            metadata: RequestMetadata::new(request_id),
        }
    }

    /// Performs pre-flight validation on the request contract.
    pub fn validate(&self) -> Result<(), ProviderError> {
        let trimmed_model = self.model.trim();
        if trimmed_model.is_empty() {
            return Err(ProviderError::invalid_request("Target model identifier cannot be empty"));
        }

        if self.messages.is_empty() {
            return Err(ProviderError::invalid_request(
                "ProviderRequest must contain at least one chat message",
            ));
        }

        if let Some(temp) = self.params.temperature {
            if !(0.0..=2.0).contains(&temp) {
                return Err(ProviderError::invalid_request(format!(
                    "Temperature must be between 0.0 and 2.0 (got {})",
                    temp
                )));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_request_validation() {
        let req = ProviderRequest::simple_prompt("gpt-4o", "Hello AI", "req_test_01");
        assert!(req.validate().is_ok());
    }

    #[test]
    fn test_empty_model_rejected() {
        let req = ProviderRequest::simple_prompt("   ", "Hello AI", "req_test_01");
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_empty_messages_rejected() {
        let mut req = ProviderRequest::simple_prompt("gpt-4o", "Hello", "req_test_01");
        req.messages.clear();
        assert!(req.validate().is_err());
    }

    #[test]
    fn test_out_of_bounds_temperature_rejected() {
        let mut req = ProviderRequest::simple_prompt("gpt-4o", "Hello", "req_test_01");
        req.params.temperature = Some(2.5);
        assert!(req.validate().is_err());
    }
}

