//! Task Types, State Models, and Lifecycle Contracts
//!
//! Responsibility:
//! - Explicit enumeration of task kinds and states.
//! - State transition validation to prevent invalid lifecycle jumps.
//! - Diagnostic task metadata contracts (free of secret credentials or user prompts).

use serde::{Deserialize, Serialize};
use crate::core::tasks::id::TaskId;
use tokio_util::sync::CancellationToken;

/// Controlled categorization of native background tasks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaskKind {
    /// Core application lifecycle, bootstrapping, or shutdown.
    Application,
    /// Housekeeping, cache pruning, and log maintenance.
    Maintenance,
    /// Generic asynchronous background worker.
    Background,
    /// Synchronous blocking filesystem or OS workload.
    Blocking,
    /// Compute-intensive work subject to bounded CPU concurrency.
    CpuBound,
    /// Asynchronous network or disk I/O.
    Io,
}

impl TaskKind {
    pub fn prefix(&self) -> &'static str {
        match self {
            TaskKind::Application => "app",
            TaskKind::Maintenance => "maint",
            TaskKind::Background => "bg",
            TaskKind::Blocking => "block",
            TaskKind::CpuBound => "cpu",
            TaskKind::Io => "io",
        }
    }
}

/// Explicit lifecycle states for a managed background task.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaskStatus {
    /// Task allocated and configured.
    Created,
    /// Task waiting for concurrency permit or runtime scheduling.
    Queued,
    /// Task actively executing.
    Running,
    /// Cancellation requested; awaiting cooperative task exit.
    Cancelling,
    /// Task completed successfully.
    Completed,
    /// Task terminated with an error or panic.
    Failed,
    /// Task terminated cooperatively following cancellation signal.
    Cancelled,
}

impl TaskStatus {
    /// Returns true if the status is a terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            TaskStatus::Completed | TaskStatus::Failed | TaskStatus::Cancelled
        )
    }

    /// Validates whether a state transition is legal in the task state machine.
    pub fn can_transition_to(&self, next: TaskStatus) -> bool {
        // Terminal states cannot transition to anything
        if self.is_terminal() {
            return false;
        }

        match (self, next) {
            (TaskStatus::Created, TaskStatus::Queued) => true,
            (TaskStatus::Created, TaskStatus::Running) => true,
            (TaskStatus::Created, TaskStatus::Cancelled) => true,

            (TaskStatus::Queued, TaskStatus::Running) => true,
            (TaskStatus::Queued, TaskStatus::Cancelled) => true,

            (TaskStatus::Running, TaskStatus::Completed) => true,
            (TaskStatus::Running, TaskStatus::Failed) => true,
            (TaskStatus::Running, TaskStatus::Cancelling) => true,
            (TaskStatus::Running, TaskStatus::Cancelled) => true,

            (TaskStatus::Cancelling, TaskStatus::Cancelled) => true,
            (TaskStatus::Cancelling, TaskStatus::Completed) => true, // race: finished while cancelling
            (TaskStatus::Cancelling, TaskStatus::Failed) => true,

            _ => false,
        }
    }
}

/// Safe diagnostic metadata representing a task.
/// Strictly omits user prompts, provider credentials, and raw model payloads.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskMetadata {
    pub task_id: TaskId,
    pub kind: TaskKind,
    pub status: TaskStatus,
    pub owner: String,
    pub created_at: String,
    pub started_at: Option<String>,
    pub finished_at: Option<String>,
    pub parent_task_id: Option<TaskId>,
    pub cancellable: bool,
    pub error_message: Option<String>,
}

/// Execution context passed to managed task closures.
#[derive(Clone)]
pub struct TaskContext {
    pub task_id: TaskId,
    pub token: CancellationToken,
    pub parent_task_id: Option<TaskId>,
}

impl TaskContext {
    /// Returns true if cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.token.is_cancelled()
    }

    /// Waits asynchronously until cancellation is requested.
    pub async fn cancelled(&self) {
        self.token.cancelled().await;
    }
}

/// Diagnostic summary returned by `TaskManager::shutdown()`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShutdownReport {
    pub clean_exit: bool,
    pub completed_count: usize,
    pub cancelled_count: usize,
    pub abandoned_count: usize,
    pub duration_ms: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_state_transitions() {
        assert!(TaskStatus::Created.can_transition_to(TaskStatus::Running));
        assert!(TaskStatus::Running.can_transition_to(TaskStatus::Completed));
        assert!(TaskStatus::Running.can_transition_to(TaskStatus::Cancelling));
        assert!(TaskStatus::Cancelling.can_transition_to(TaskStatus::Cancelled));
    }

    #[test]
    fn test_terminal_state_cannot_transition() {
        assert!(!TaskStatus::Completed.can_transition_to(TaskStatus::Running));
        assert!(!TaskStatus::Failed.can_transition_to(TaskStatus::Running));
        assert!(!TaskStatus::Cancelled.can_transition_to(TaskStatus::Queued));
    }
}

