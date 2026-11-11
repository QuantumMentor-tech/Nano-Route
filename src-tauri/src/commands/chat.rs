// ============================================================================
// Nano Route - Chat Persistence Tauri Commands
// File: src-tauri/src/commands/chat.rs
// ============================================================================
// Thin Tauri command handlers for session and message persistence.
// Validates parameters, translates errors, and delegates directly to ChatService.
// ============================================================================

use crate::domain::{ChatConversation, ChatMessage, ChatMessageMetadata, ChatSession, MessageSender};
use crate::services::{ChatSubmissionRequest, ChatSubmissionResult};
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

/// Submits a user prompt through the complete routing pipeline and non-streaming provider execution.
#[tauri::command]
pub async fn cmd_submit_chat_prompt(
    request: ChatSubmissionRequest,
    state: State<'_, AppState>,
) -> Result<ChatSubmissionResult, String> {
    state
        .chat_orchestrator
        .submit_prompt(request)
        .await
        .map_err(|e| e.to_string())
}

/// Streams provider responses live across a Tauri IPC Channel.
#[tauri::command]
pub async fn cmd_stream_chat_prompt(
    request: ChatSubmissionRequest,
    channel: tauri::ipc::Channel<crate::services::ChatStreamEvent>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .chat_orchestrator
        .stream_prompt(request, channel)
        .await
        .map_err(|e| e.to_string())
}

/// Cancels an active chat execution by execution ID.
#[tauri::command]
pub async fn cmd_cancel_chat_execution(
    execution_id: String,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<crate::services::execution::CancellationResultDto, String> {
    let term_reason = crate::services::execution::TerminationReason::from_opt_str(reason.as_deref());
    state
        .chat_orchestrator
        .cancel_execution(&execution_id, term_reason)
        .map_err(|e| e.to_string())
}

/// Cancels an active chat execution associated with a session ID.
#[tauri::command]
pub async fn cmd_cancel_session_chat(
    session_id: String,
    reason: Option<String>,
    state: State<'_, AppState>,
) -> Result<Option<crate::services::execution::CancellationResultDto>, String> {
    let term_reason = crate::services::execution::TerminationReason::from_opt_str(reason.as_deref());
    state
        .chat_orchestrator
        .cancel_session_execution(&session_id, term_reason)
        .map_err(|e| e.to_string())
}

/// Retrieves the current lifecycle state of an execution by execution ID.
#[tauri::command]
pub async fn cmd_get_execution_state(
    execution_id: String,
    state: State<'_, AppState>,
) -> Result<Option<crate::services::execution::ExecutionStateDto>, String> {
    Ok(state.chat_orchestrator.get_execution_state(&execution_id))
}

/// Normalizes and classifies an error message and optional status code into an ErrorEnvelope.
#[tauri::command]
pub fn cmd_classify_error(
    error_message: String,
    http_status: Option<u16>,
    provider_id: Option<String>,
    model_id: Option<String>,
    execution_id: Option<String>,
) -> Result<crate::errors::ErrorEnvelope, String> {
    let prov = provider_id.as_deref();
    let mapping = match prov {
        Some("openai") | Some("deepseek") | Some("groq") | Some("mistral") => {
            crate::errors::provider_mapping::map_openai_error_evidence(
                http_status,
                None,
                None,
                Some(&error_message),
            )
        }
        Some("anthropic") => crate::errors::provider_mapping::map_anthropic_error_evidence(
            http_status,
            None,
            Some(&error_message),
        ),
        Some("gemini") => crate::errors::provider_mapping::map_gemini_error_evidence(
            http_status,
            None,
            Some(&error_message),
        ),
        _ => crate::errors::provider_mapping::map_http_status_fallback(
            http_status,
            Some(&error_message),
            None,
        ),
    };

    let envelope = crate::errors::ErrorEnvelope::new(
        mapping.category,
        mapping.user_message,
        mapping.technical_message,
        crate::errors::ClassificationProvenance::Application,
    )
    .with_execution_id(execution_id)
    .with_provider(provider_id, model_id)
    .with_http_status(http_status);

    Ok(envelope)
}

/// Performs preflight validation for candidate execution.
#[tauri::command]
pub async fn cmd_preflight_check(
    provider_id: String,
    model_id: String,
    prompt: String,
    session_id: Option<String>,
    requested_output_tokens: Option<u64>,
    state: State<'_, AppState>,
) -> Result<crate::reliability::ExecutionPreflight, String> {
    let history = if let Some(sid) = session_id {
        state.chat_service.get_messages(&sid, Some(100), None).unwrap_or_default()
    } else {
        Vec::new()
    };
    let attempted = std::collections::HashSet::new();
    let preflight = state.chat_orchestrator.preflight_coordinator().evaluate_preflight(
        &provider_id,
        &model_id,
        &history,
        &prompt,
        None,
        None,
        &attempted,
        requested_output_tokens,
    );
    Ok(preflight)
}

/// Retrieves the current quota and budget snapshot for a provider.
#[tauri::command]
pub async fn cmd_get_quota_snapshot(
    provider_id: String,
    model_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<crate::reliability::QuotaSnapshot, String> {
    let cred_status = state.credential_vault.get_credential_status(&provider_id).ok().flatten();
    let snapshot = state
        .chat_orchestrator
        .budget_guard()
        .get_quota_snapshot(&provider_id, model_id.as_deref(), cred_status.as_ref());
    Ok(snapshot)
}


