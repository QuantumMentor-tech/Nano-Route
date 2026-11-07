//! Nano Route — Core Native Orchestration
//!
//! Responsibility:
//! - Application bootstrap and dependency composition.
//! - Lifecycle initialization and shutdown coordination.

pub mod application;
pub mod tasks;

pub use application::Application;
pub use tasks::TaskManager;
