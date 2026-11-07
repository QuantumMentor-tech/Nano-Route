//! Nano Route — Core Domain Models
//!
//! Responsibility:
//! - Pure domain entities, values, and business contracts.
//! - Pure, portable business logic independent of UI, SQLite, and network clients.
//! - Must NOT depend on Tauri WebView, rusqlite, or reqwest directly.

pub mod app_info;
pub mod health;

pub use app_info::AppInfo;
pub use health::{CoreStatus, HealthReport, SubsystemHealth};
