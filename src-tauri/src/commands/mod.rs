//! Nano Route — Tauri Commands & IPC Boundary
//!
//! Responsibility:
//! - Entry points for frontend-to-native Tauri IPC invocations.
//! - Parameter parsing, validation, and delegation to application services.
//! - Must NOT contain business algorithms, SQL queries, or raw provider calls.

pub mod app;
pub mod chat;
pub mod credentials;
pub mod database;
pub mod diagnostics;
pub mod health;
pub mod registry;
pub mod settings;
pub mod streaming;
pub mod telemetry;

pub use app::cmd_get_app_info;
pub use chat::{
    cmd_append_chat_message, cmd_create_chat_session, cmd_delete_chat_message,
    cmd_delete_chat_session, cmd_get_chat_conversation, cmd_get_chat_messages,
    cmd_get_chat_session, cmd_list_chat_sessions, cmd_rename_chat_session,
    cmd_set_chat_session_pinned,
};
pub use credentials::{
    cmd_delete_provider_credential, cmd_get_provider_credential_status,
    cmd_list_provider_credential_statuses, cmd_save_provider_credential,
    cmd_set_provider_active,
};
pub use database::cmd_get_database_health;
pub use diagnostics::{cmd_ping, PingRequest, PingResponse, MAX_PING_MESSAGE_LEN};
pub use health::{cmd_get_health, cmd_health_check};
pub use registry::{
    cmd_get_registered_model, cmd_get_registered_provider, cmd_list_registered_models,
    cmd_list_registered_providers, cmd_resolve_effective_providers, cmd_resolve_historical_model,
};
pub use settings::{
    cmd_get_app_setting, cmd_get_app_settings, cmd_get_provider_preferences,
    cmd_list_provider_preferences, cmd_reset_app_setting, cmd_reset_provider_preferences,
    cmd_set_app_setting, cmd_update_provider_preferences,
};
pub use streaming::{cmd_cancel_stream, cmd_get_stream_status, cmd_start_stream};
pub use telemetry::{
    cmd_clear_telemetry, cmd_get_telemetry_aggregates, cmd_list_telemetry_records,
    cmd_record_telemetry_event,
};
