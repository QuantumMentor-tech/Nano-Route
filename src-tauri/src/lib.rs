// Nano Route — Native Core Library Entry Point

pub mod analysis;
pub mod commands;
pub mod classification;
pub mod core;
pub mod domain;
pub mod errors;
pub mod inference;
pub mod infrastructure;
pub mod providers;
pub mod reliability;
pub mod routing;
pub mod security;
pub mod services;
pub mod state;
pub mod storage;
pub mod telemetry;

use core::Application;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Application::bootstrap().expect("Failed to bootstrap Nano Route core");

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::cmd_health_check,
            commands::cmd_get_health,
            commands::cmd_get_app_info,
            commands::cmd_get_license_info,
            commands::cmd_ping,
            commands::cmd_start_stream,
            commands::cmd_cancel_stream,
            commands::cmd_get_stream_status,
            commands::cmd_get_database_health,
            commands::cmd_create_chat_session,
            commands::cmd_get_chat_session,
            commands::cmd_list_chat_sessions,
            commands::cmd_rename_chat_session,
            commands::cmd_set_chat_session_pinned,
            commands::cmd_delete_chat_session,
            commands::cmd_append_chat_message,
            commands::cmd_get_chat_messages,
            commands::cmd_get_chat_conversation,
            commands::cmd_delete_chat_message,
            commands::cmd_list_history_sessions,
            commands::cmd_search_history,
            commands::cmd_get_history_filter_options,
            commands::cmd_delete_history_sessions_bulk,
            commands::cmd_rebuild_history_search_index,
            commands::cmd_submit_chat_prompt,
            commands::cmd_stream_chat_prompt,
            commands::cmd_cancel_chat_execution,
            commands::cmd_cancel_session_chat,
            commands::cmd_get_execution_state,
            commands::cmd_preflight_check,
            commands::cmd_get_quota_snapshot,
            commands::cmd_classify_error,
            commands::cmd_record_telemetry_event,
            commands::cmd_list_telemetry_records,
            commands::cmd_get_telemetry_aggregates,
            commands::cmd_get_telemetry_dashboard_snapshot,
            commands::cmd_get_telemetry_cost_analytics_snapshot,
            commands::cmd_get_telemetry_performance_analytics_snapshot,
            commands::cmd_clear_telemetry,
            commands::cmd_save_provider_credential,
            commands::cmd_get_provider_credential_status,
            commands::cmd_list_provider_credential_statuses,
            commands::cmd_set_provider_active,
            commands::cmd_delete_provider_credential,
            commands::cmd_get_app_settings,
            commands::cmd_get_app_setting,
            commands::cmd_set_app_setting,
            commands::cmd_reset_app_setting,
            commands::cmd_reset_all_settings,
            commands::cmd_get_settings_workspace_snapshot,
            commands::cmd_get_provider_preferences,
            commands::cmd_list_provider_preferences,
            commands::cmd_update_provider_preferences,
            commands::cmd_reset_provider_preferences,
            commands::cmd_list_registered_providers,
            commands::cmd_get_registered_provider,
            commands::cmd_list_registered_models,
            commands::cmd_get_registered_model,
            commands::cmd_resolve_effective_providers,
            commands::cmd_resolve_historical_model,
            commands::cmd_get_provider_health,
            commands::cmd_get_all_provider_health,
            commands::cmd_get_provider_capabilities,
            commands::cmd_get_model_capabilities,
            commands::cmd_preflight_provider_request,
            commands::cmd_check_provider_health,
            commands::cmd_get_local_runtime_status,
            commands::cmd_get_local_model_status,
            commands::cmd_initialize_local_runtime,
            commands::cmd_load_router_model,
            commands::cmd_unload_router_model,
            commands::cmd_get_local_runtime_metrics,
            commands::cmd_run_local_inference,
            commands::cmd_classify_intent,
            commands::cmd_get_classifier_status,
            commands::cmd_evaluate_classifier,
            commands::cmd_analyze_task,
            commands::cmd_get_task_analyzer_status,
            commands::cmd_score_routing_candidates,
            commands::cmd_get_routing_scoring_status,
            commands::cmd_get_scoring_weights,
            commands::cmd_update_scoring_weights,
            commands::cmd_evaluate_routing_policy,
            commands::cmd_get_routing_policy_config,
            commands::cmd_update_routing_policy_config,
            commands::cmd_validate_manual_override,
            commands::cmd_get_routing_explanation,
            commands::cmd_get_data_inventory,
            commands::cmd_run_data_audit,
            commands::cmd_run_safe_data_repair,
            commands::cmd_get_retention_policy,
            commands::cmd_update_retention_policy,
            commands::cmd_preview_data_cleanup,
            commands::cmd_run_data_cleanup,
            commands::cmd_preview_full_data_wipe,
            commands::cmd_run_full_data_wipe,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
