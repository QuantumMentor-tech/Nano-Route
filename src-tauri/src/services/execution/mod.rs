// ============================================================================
// Nano Route - Execution Lifecycle & Cancellation Module
// File: src-tauri/src/services/execution/mod.rs
// ============================================================================

pub mod manager;
pub mod types;

pub use manager::ExecutionManager;
pub use types::{
    CancellationResultDto, ExecutionContext, ExecutionLifecycleState, ExecutionStateDto,
    RecoveryContext, TerminationReason,
};

