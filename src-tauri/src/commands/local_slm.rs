// ============================================================================
// Nano Route - Local SLM Tauri IPC Commands
// File: src-tauri/src/commands/local_slm.rs
// ============================================================================
// Strongly-typed command handlers for querying local SLM runtime status,
// loading/unloading router model packages, retrieving performance metrics,
// and executing privacy-preserving local on-device inference.
// Contains zero cloud API calls or raw tensor parameter injections.
// ============================================================================

use tauri::State;

use crate::inference::manifest::LocalModelManifest;
use crate::inference::types::{
    LocalInferenceResult, LocalModelStatus, LocalRuntimeMetrics, LocalRuntimeStatus,
};
use crate::state::AppState;

/// Queries the read-safe status of the local SLM runtime.
#[tauri::command]
pub async fn cmd_get_local_runtime_status(
    state: State<'_, AppState>,
) -> Result<LocalRuntimeStatus, String> {
    Ok(state.local_slm_service.get_status())
}

/// Queries the status of the local router model artifact.
#[tauri::command]
pub async fn cmd_get_local_model_status(
    state: State<'_, AppState>,
) -> Result<LocalModelStatus, String> {
    Ok(state.local_slm_service.get_status().model_status)
}

/// Explicitly initializes the ONNX runtime environment.
#[tauri::command]
pub async fn cmd_initialize_local_runtime(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .local_slm_service
        .initialize()
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Loads the default designated router SLM model into active execution memory.
#[tauri::command]
pub async fn cmd_load_router_model(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let manifest = LocalModelManifest::default_router_manifest();
    // Default simulated / bundled model bytes
    let dummy_model_bytes = b"nano_route_onnx_classifier_model_bytes";

    state
        .local_slm_service
        .load_model(manifest, dummy_model_bytes)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Safely unloads the loaded model session and frees native resources.
#[tauri::command]
pub async fn cmd_unload_router_model(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    state
        .local_slm_service
        .unload_model()
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Queries local SLM performance metrics (latency, tokenization, average runtime).
#[tauri::command]
pub async fn cmd_get_local_runtime_metrics(
    state: State<'_, AppState>,
) -> Result<LocalRuntimeMetrics, String> {
    Ok(state.local_slm_service.get_metrics())
}

/// Executes local-only on-device inference over a text prompt.
/// NEVER sends data to cloud providers or external APIs.
#[tauri::command]
pub async fn cmd_run_local_inference(
    text: String,
    state: State<'_, AppState>,
) -> Result<LocalInferenceResult, String> {
    if text.trim().is_empty() {
        return Err("Inference prompt text cannot be empty or whitespace only".to_string());
    }

    state
        .local_slm_service
        .infer(&text, None)
        .await
        .map_err(|e| e.to_string())
}

