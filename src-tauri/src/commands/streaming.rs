// ============================================================================
// Nano Route - Streaming IPC Commands
// File: src-tauri/src/commands/streaming.rs
// ============================================================================
// Boundary commands exposing native streaming sessions to the frontend.
// Uses Tauri v2 Channels (`tauri::ipc::Channel<StreamEvent>`) for ordered delivery.
// Delegates task execution and cancellation to `StreamCoordinator` and `TaskManager`.
// ============================================================================

use crate::services::streaming::id::StreamId;
use crate::services::streaming::types::{
    StreamEvent, StreamLifecycleState, StreamRequest, StreamStartResult,
};
use crate::state::AppState;
use tauri::ipc::Channel;
use tauri::State;

/// Initiates an asynchronous streaming session connected to a Tauri IPC Channel.
#[tauri::command]
pub async fn cmd_start_stream(
    request: StreamRequest,
    channel: Channel<StreamEvent>,
    state: State<'_, AppState>,
) -> Result<StreamStartResult, String> {
    state
        .stream_coordinator
        .start_stream(request, channel)
        .map_err(|e| e.to_string())
}

/// Signals cooperative cancellation for an active streaming session.
#[tauri::command]
pub async fn cmd_cancel_stream(
    stream_id: String,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let parsed_id = StreamId::parse(stream_id).map_err(|e| e.to_string())?;
    Ok(state.stream_coordinator.cancel_stream(&parsed_id))
}

/// Queries the current lifecycle state of a streaming session.
#[tauri::command]
pub async fn cmd_get_stream_status(
    stream_id: String,
    state: State<'_, AppState>,
) -> Result<Option<StreamLifecycleState>, String> {
    let parsed_id = StreamId::parse(stream_id).map_err(|e| e.to_string())?;
    Ok(state.stream_coordinator.registry().get_state(&parsed_id))
}

