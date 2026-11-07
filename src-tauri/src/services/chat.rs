// ============================================================================
// Nano Route - Chat Application Service
// File: src-tauri/src/services/chat.rs
// ============================================================================
// Application service coordinating chat sessions, messages, and atomic transactions.
// Enforces validation rules, metadata normalization, and cascade consistency.
// ============================================================================

use crate::domain::{ChatConversation, ChatMessage, ChatMessageMetadata, ChatSession, MessageSender};
use crate::errors::AppError;
use crate::storage::repositories::{ChatMessageRepository, ChatSessionRepository};
use crate::storage::DatabaseManager;
use rusqlite::TransactionBehavior;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

static SESSION_COUNTER: AtomicU64 = AtomicU64::new(1);
static MESSAGE_COUNTER: AtomicU64 = AtomicU64::new(1);

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_session_id() -> String {
    let now = current_epoch_ms();
    let count = SESSION_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("sess_{}_{}", now, count)
}

fn generate_message_id() -> String {
    let now = current_epoch_ms();
    let count = MESSAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("msg_{}_{}", now, count)
}

pub struct ChatService {
    database_manager: Arc<DatabaseManager>,
}

impl ChatService {
    pub fn new(database_manager: Arc<DatabaseManager>) -> Self {
        Self { database_manager }
    }

    /// Creates a new chat session with an optional title and pinned flag.
    pub fn create_session(
        &self,
        title: Option<String>,
        pinned: Option<bool>,
    ) -> Result<ChatSession, AppError> {
        let clean_title = match title {
            Some(t) if !t.trim().is_empty() => t.trim().to_string(),
            _ => "New Conversation".to_string(),
        };

        if clean_title.len() > 255 {
            return Err(AppError::InvalidInput(
                "Session title exceeds maximum allowed length of 255 characters".to_string(),
            ));
        }

        let now = current_epoch_ms();
        let session = ChatSession {
            id: generate_session_id(),
            title: clean_title,
            created_at: now,
            updated_at: now,
            pinned: pinned.unwrap_or(false),
        };

        self.database_manager.with_connection(|conn| {
            ChatSessionRepository::insert(conn, &session)
                .map_err(|e| AppError::Internal(format!("Failed to create chat session: {}", e)))
        })?;

        Ok(session)
    }

    /// Retrieves an existing session by ID.
    pub fn get_session(&self, session_id: &str) -> Result<Option<ChatSession>, AppError> {
        let trimmed_id = session_id.trim();
        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            ChatSessionRepository::get_by_id(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Failed to retrieve session: {}", e)))
        })
    }

    /// Lists recent chat sessions with pagination.
    pub fn list_sessions(
        &self,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ChatSession>, AppError> {
        let limit_val = limit.unwrap_or(50).min(200);
        let offset_val = offset.unwrap_or(0);

        self.database_manager.with_connection(|conn| {
            ChatSessionRepository::list(conn, limit_val, offset_val)
                .map_err(|e| AppError::Internal(format!("Failed to list sessions: {}", e)))
        })
    }

    /// Renames a session and updates its updated_at timestamp.
    pub fn rename_session(&self, session_id: &str, title: &str) -> Result<ChatSession, AppError> {
        let trimmed_id = session_id.trim();
        let trimmed_title = title.trim();

        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }
        if trimmed_title.is_empty() {
            return Err(AppError::InvalidInput("Session title cannot be empty".to_string()));
        }
        if trimmed_title.len() > 255 {
            return Err(AppError::InvalidInput(
                "Session title exceeds maximum allowed length of 255 characters".to_string(),
            ));
        }

        let now = current_epoch_ms();

        self.database_manager.with_connection(|conn| {
            let updated = ChatSessionRepository::update_title(conn, trimmed_id, trimmed_title, now)
                .map_err(|e| AppError::Internal(format!("Failed to update session title: {}", e)))?;

            if !updated {
                return Err(AppError::NotFound(format!("Session '{}' not found", trimmed_id)));
            }

            ChatSessionRepository::get_by_id(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Failed to fetch updated session: {}", e)))?
                .ok_or_else(|| AppError::NotFound(format!("Session '{}' not found after update", trimmed_id)))
        })
    }

    /// Updates pinned status of a session.
    pub fn set_pinned(&self, session_id: &str, pinned: bool) -> Result<ChatSession, AppError> {
        let trimmed_id = session_id.trim();
        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            let updated = ChatSessionRepository::set_pinned(conn, trimmed_id, pinned)
                .map_err(|e| AppError::Internal(format!("Failed to update pinned state: {}", e)))?;

            if !updated {
                return Err(AppError::NotFound(format!("Session '{}' not found", trimmed_id)));
            }

            ChatSessionRepository::get_by_id(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Failed to fetch updated session: {}", e)))?
                .ok_or_else(|| AppError::NotFound(format!("Session '{}' not found after pin update", trimmed_id)))
        })
    }

    /// Deletes a session and automatically cascades to all associated messages.
    pub fn delete_session(&self, session_id: &str) -> Result<bool, AppError> {
        let trimmed_id = session_id.trim();
        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            ChatSessionRepository::delete(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Failed to delete session: {}", e)))
        })
    }

    /// Appends a message to a session in an atomic transaction, updating session updated_at.
    pub fn append_message(
        &self,
        session_id: &str,
        sender: MessageSender,
        content: &str,
        metadata: Option<ChatMessageMetadata>,
    ) -> Result<ChatMessage, AppError> {
        let trimmed_id = session_id.trim();
        let trimmed_content = content.trim();

        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }
        if trimmed_content.is_empty() {
            return Err(AppError::InvalidInput("Message content cannot be empty".to_string()));
        }

        let now = current_epoch_ms();
        let message = ChatMessage {
            id: generate_message_id(),
            session_id: trimmed_id.to_string(),
            sender,
            content: trimmed_content.to_string(),
            metadata: metadata.unwrap_or_default(),
            created_at: now,
        };

        self.database_manager.with_connection(|conn| {
            let tx = conn
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|e| AppError::Internal(format!("Failed to begin transaction: {}", e)))?;

            // 1. Verify target session exists
            let session_exists = ChatSessionRepository::get_by_id(&tx, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Session existence check failed: {}", e)))?;

            if session_exists.is_none() {
                return Err(AppError::NotFound(format!(
                    "Target chat session '{}' does not exist",
                    trimmed_id
                )));
            }

            // 2. Persist message
            ChatMessageRepository::insert(&tx, &message)
                .map_err(|e| AppError::Internal(format!("Failed to persist chat message: {}", e)))?;

            // 3. Atomically touch session updated_at
            ChatSessionRepository::touch_updated_at(&tx, trimmed_id, now)
                .map_err(|e| AppError::Internal(format!("Failed to update session timestamp: {}", e)))?;

            // 4. Commit transaction
            tx.commit()
                .map_err(|e| AppError::Internal(format!("Failed to commit message transaction: {}", e)))?;

            Ok(())
        })?;

        Ok(message)
    }

    /// Retrieves ordered messages for a session.
    pub fn get_messages(
        &self,
        session_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ChatMessage>, AppError> {
        let trimmed_id = session_id.trim();
        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            // Verify session existence
            let session = ChatSessionRepository::get_by_id(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Session lookup failed: {}", e)))?;

            if session.is_none() {
                return Err(AppError::NotFound(format!("Session '{}' not found", trimmed_id)));
            }

            ChatMessageRepository::list_for_session(conn, trimmed_id, limit, offset)
                .map_err(|e| AppError::Internal(format!("Failed to retrieve messages: {}", e)))
        })
    }

    /// Retrieves full conversation thread (session metadata + ordered messages) in a single read.
    pub fn get_conversation(&self, session_id: &str) -> Result<ChatConversation, AppError> {
        let trimmed_id = session_id.trim();
        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Session ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            let session = ChatSessionRepository::get_by_id(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Failed to fetch session: {}", e)))?
                .ok_or_else(|| AppError::NotFound(format!("Session '{}' not found", trimmed_id)))?;

            let messages = ChatMessageRepository::list_for_session(conn, trimmed_id, None, None)
                .map_err(|e| AppError::Internal(format!("Failed to fetch session messages: {}", e)))?;

            Ok(ChatConversation { session, messages })
        })
    }

    /// Deletes a single message by ID.
    pub fn delete_message(&self, message_id: &str) -> Result<bool, AppError> {
        let trimmed_id = message_id.trim();
        if trimmed_id.is_empty() {
            return Err(AppError::InvalidInput("Message ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            ChatMessageRepository::delete(conn, trimmed_id)
                .map_err(|e| AppError::Internal(format!("Failed to delete message: {}", e)))
        })
    }
}

