// ============================================================================
// Nano Route - Chat Persistence Tauri Commands
// File: src-tauri/src/commands/chat.rs
// ============================================================================
// Thin Tauri command handlers for session and message persistence.
// Validates parameters, translates errors, and delegates directly to ChatService.
// ============================================================================

use crate::domain::{ChatConversation, ChatMessage, ChatMessageMetadata, ChatSession, MessageSender};
use crate::state::AppState;
use tauri::State;

/// Creates a new persistent chat session.
#[tauri::command]
pub async fn cmd_create_chat_session(
    title: Option<String>,
    pinned: Option<bool>,
    state: State<'_, AppState>,
) -> Result<ChatSession, String> {
    state
        .chat_service
        .create_session(title, pinned)
        .map_err(|e| e.to_string())
}

/// Retrieves a chat session by ID.
#[tauri::command]
pub async fn cmd_get_chat_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Option<ChatSession>, String> {
    state
        .chat_service
        .get_session(&session_id)
        .map_err(|e| e.to_string())
}

/// Lists recent chat sessions with pagination.
#[tauri::command]
pub async fn cmd_list_chat_sessions(
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ChatSession>, String> {
    state
        .chat_service
        .list_sessions(limit, offset)
        .map_err(|e| e.to_string())
}

/// Renames a chat session.
#[tauri::command]
pub async fn cmd_rename_chat_session(
    session_id: String,
    title: String,
    state: State<'_, AppState>,
) -> Result<ChatSession, String> {
    state
        .chat_service
        .rename_session(&session_id, &title)
        .map_err(|e| e.to_string())
}

/// Toggles or updates the pinned flag of a chat session.
#[tauri::command]
pub async fn cmd_set_chat_session_pinned(
    session_id: String,
    pinned: bool,
    state: State<'_, AppState>,
) -> Result<ChatSession, String> {
    state
        .chat_service
        .set_pinned(&session_id, pinned)
        .map_err(|e| e.to_string())
}

/// Deletes a chat session and cascades deletion to all messages.
#[tauri::command]
pub async fn cmd_delete_chat_session(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .chat_service
        .delete_session(&session_id)
        .map_err(|e| e.to_string())
}

/// Appends a new user, assistant, or system message to an existing session.
#[tauri::command]
pub async fn cmd_append_chat_message(
    session_id: String,
    sender: String,
    content: String,
    metadata: Option<ChatMessageMetadata>,
    state: State<'_, AppState>,
) -> Result<ChatMessage, String> {
    let parsed_sender = MessageSender::from_str(&sender)?;

    state
        .chat_service
        .append_message(&session_id, parsed_sender, &content, metadata)
        .map_err(|e| e.to_string())
}

/// Retrieves ordered messages for a session.
#[tauri::command]
pub async fn cmd_get_chat_messages(
    session_id: String,
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<ChatMessage>, String> {
    state
        .chat_service
        .get_messages(&session_id, limit, offset)
        .map_err(|e| e.to_string())
}

/// Retrieves a complete conversation (session + ordered messages) in a single call.
#[tauri::command]
pub async fn cmd_get_chat_conversation(
    session_id: String,
    state: State<'_, AppState>,
) -> Result<ChatConversation, String> {
    state
        .chat_service
        .get_conversation(&session_id)
        .map_err(|e| e.to_string())
}

/// Deletes an individual chat message.
#[tauri::command]
pub async fn cmd_delete_chat_message(
    message_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .chat_service
        .delete_message(&message_id)
        .map_err(|e| e.to_string())
}

