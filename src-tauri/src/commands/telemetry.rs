// ============================================================================
// Nano Route - Telemetry Tauri Commands
// File: src-tauri/src/commands/telemetry.rs
// ============================================================================
// Thin command handlers for operational telemetry persistence and querying.
// Validates parameters and delegates directly to TelemetryService.
// ============================================================================

use crate::domain::{
    TelemetryAggregateReport, TelemetryDashboardFilters, TelemetryDashboardSnapshot,
    TelemetryFilter, TelemetryFinancialAnalytics, TelemetryPerformanceAnalytics, TelemetryRecord,
};
use crate::services::RecordTelemetryInput;
use crate::state::AppState;
use tauri::State;

/// Records an operational observation event.
#[tauri::command]
pub async fn cmd_record_telemetry_event(
    input: RecordTelemetryInput,
    state: State<'_, AppState>,
) -> Result<TelemetryRecord, String> {
    state
        .telemetry_service
        .record_event(input)
        .map_err(|e| e.to_string())
}

/// Lists filtered telemetry records with pagination.
#[tauri::command]
pub async fn cmd_list_telemetry_records(
    filter: TelemetryFilter,
    limit: Option<u32>,
    offset: Option<u32>,
    state: State<'_, AppState>,
) -> Result<Vec<TelemetryRecord>, String> {
    state
        .telemetry_service
        .list_records(filter, limit, offset)
        .map_err(|e| e.to_string())
}

/// Calculates aggregate metrics over filtered operational observations.
#[tauri::command]
pub async fn cmd_get_telemetry_aggregates(
    filter: TelemetryFilter,
    state: State<'_, AppState>,
) -> Result<TelemetryAggregateReport, String> {
    state
        .telemetry_service
        .aggregate_metrics(filter)
        .map_err(|e| e.to_string())
}

/// Computes a coherent read-only Step 42 & Step 43 Telemetry Dashboard snapshot.
#[tauri::command]
pub async fn cmd_get_telemetry_dashboard_snapshot(
    filters: Option<TelemetryDashboardFilters>,
    state: State<'_, AppState>,
) -> Result<TelemetryDashboardSnapshot, String> {
    state
        .telemetry_service
        .get_dashboard_snapshot(filters.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Computes a coherent read-only Step 43 Token Usage, Cost Analytics & Routing Savings snapshot.
#[tauri::command]
pub async fn cmd_get_telemetry_cost_analytics_snapshot(
    filters: Option<TelemetryDashboardFilters>,
    state: State<'_, AppState>,
) -> Result<TelemetryFinancialAnalytics, String> {
    state
        .telemetry_service
        .get_cost_analytics_snapshot(filters.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Computes a coherent read-only Step 44 Latency, Execution Performance & Benchmark Analytics snapshot.
#[tauri::command]
pub async fn cmd_get_telemetry_performance_analytics_snapshot(
    filters: Option<TelemetryDashboardFilters>,
    state: State<'_, AppState>,
) -> Result<TelemetryPerformanceAnalytics, String> {
    state
        .telemetry_service
        .get_performance_analytics_snapshot(filters.unwrap_or_default())
        .map_err(|e| e.to_string())
}

/// Clears all telemetry records (supports local data wipe).
#[tauri::command]
pub async fn cmd_clear_telemetry(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    state
        .telemetry_service
        .clear_all()
        .map_err(|e| e.to_string())
}
