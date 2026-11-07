//! Nano Route — Asynchronous Task & Concurrency Subsystem
//!
//! Responsibility:
//! - Controlled native task execution for asynchronous and blocking workloads.
//! - Cooperative cancellation hierarchies via CancellationToken.
//! - Bounded concurrency for CPU-bound and blocking execution pools.
//! - Bounded application shutdown and automatic registry cleanup.

pub mod cancellation;
pub mod concurrency;
pub mod handle;
pub mod id;
pub mod manager;
pub mod registry;
pub mod types;

pub use handle::TaskHandle;
pub use id::TaskId;
pub use manager::TaskManager;
pub use types::{ShutdownReport, TaskContext, TaskKind, TaskMetadata, TaskStatus};

