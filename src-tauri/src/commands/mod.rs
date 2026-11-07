//! Nano Route — Tauri Commands & IPC Boundary
//!
//! Responsibility:
//! - Entry points for frontend-to-native Tauri IPC invocations.
//! - Parameter parsing, validation, and delegation to application services.
//! - Must NOT contain business algorithms, SQL queries, or raw provider calls.

pub mod app;
pub mod diagnostics;
pub mod health;

pub use app::cmd_get_app_info;
pub use diagnostics::{cmd_ping, PingRequest, PingResponse, MAX_PING_MESSAGE_LEN};
pub use health::{cmd_get_health, cmd_health_check};
