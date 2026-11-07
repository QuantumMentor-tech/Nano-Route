//! Nano Route — Application Services Layer
//!
//! Responsibility:
//! - Business use-case orchestrators.
//! - Coordinates domain logic and infrastructure without exposing Tauri internals.
//! - Commands delegate to services; services operate on domain entities.

pub mod app;
pub mod health;

pub use app::AppService;
pub use health::HealthService;
