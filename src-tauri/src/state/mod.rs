//! Nano Route — Managed Native Application State
//!
//! Responsibility:
//! - Centralized holder for Tauri-managed application state.
//! - Thread-safe concurrency primitives (Arc, RwLock) compatible with Tokio async tasks.

pub mod app_state;

pub use app_state::AppState;
