// ============================================================================
// Nano Route - Intent Classification Tauri IPC Commands
// File: src-tauri/src/commands/classification.rs
// ============================================================================
// Exposes local semantic task intent classification to the Tauri frontend.
// Contains zero cloud provider targets or raw tensor representations.
// ============================================================================

use tauri::State;

use crate::classification::eval::ClassifierEvaluationReport;
use crate::classification::types::{
    ClassifierStatus, IntentClassificationRequest, IntentClassificationResult,
};
use crate::state::AppState;

/// Classifies the semantic task intent of user input using the local SLM.
/// Strictly local on-device execution; zero telemetry or prompt leakage.
#[tauri::command]
pub async fn cmd_classify_intent(
    request: IntentClassificationRequest,
    state: State<'_, AppState>,
) -> Result<IntentClassificationResult, String> {
    state
        .intent_classifier
        .classify(request, None)
        .await
        .map_err(|e| e.to_string())
}

/// Queries the operational availability and status of the local intent classifier.
#[tauri::command]
pub async fn cmd_get_classifier_status(
    state: State<'_, AppState>,
) -> Result<ClassifierStatus, String> {
    Ok(state.intent_classifier.get_status())
}

/// Executes the deterministic gold benchmark evaluation suite against the active classifier.
#[tauri::command]
pub async fn cmd_evaluate_classifier(
    state: State<'_, AppState>,
) -> Result<ClassifierEvaluationReport, String> {
    Ok(ClassifierEvaluationReport::run_evaluation(&state.intent_classifier).await)
}

