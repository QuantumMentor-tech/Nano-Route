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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
