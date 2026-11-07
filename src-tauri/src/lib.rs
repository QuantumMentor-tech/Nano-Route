// Nano Route — Native Core Library Entry Point

pub mod commands;
pub mod core;
pub mod domain;
pub mod errors;
pub mod inference;
pub mod infrastructure;
pub mod providers;
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
            commands::cmd_record_telemetry_event,
            commands::cmd_list_telemetry_records,
            commands::cmd_get_telemetry_aggregates,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
