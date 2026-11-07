// ============================================================================
// Nano Route - Chat Domain Models
// File: src-tauri/src/domain/chat.rs
// ============================================================================
// Core business entities and value objects for conversational persistence.
// Independent of transport, UI, or raw SQL representations.
// ============================================================================

use serde::{Deserialize, Serialize};

/// Enumeration of permissible conversation participants.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSender {
    User,
    Assistant,
    System,
}

impl MessageSender {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::User => "user",
            Self::Assistant => "assistant",
            Self::System => "system",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "user" => Ok(Self::User),
            "assistant" => Ok(Self::Assistant),
            "system" => Ok(Self::System),
            other => Err(format!(
                "Invalid sender '{}'. Allowed values are: user, assistant, system",
                other
            )),
        }
    }
}

/// Routing decision, token usage, and latency metadata associated with a message.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageMetadata {
    pub routed_provider: Option<String>,
    pub routed_model: Option<String>,
    pub routing_reason: Option<String>,
    pub slm_confidence_score: Option<f64>,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub latency_ms: u64,
    pub cost_usd: f64,
}

/// Durable chat session entity representing a conversation thread.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSession {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub pinned: bool,
}

/// Durable chat message entity representing a conversational turn.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub id: String,
    pub session_id: String,
    pub sender: MessageSender,
    pub content: String,
    pub metadata: ChatMessageMetadata,
    pub created_at: i64,
}

/// Full conversational thread combining session metadata and sequential messages.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatConversation {
    pub session: ChatSession,
    pub messages: Vec<ChatMessage>,
}

