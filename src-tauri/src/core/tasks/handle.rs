//! Task Handle Abstraction
//!
//! Responsibility:
//! - Provides callers with a safe handle to query status, signal cancellation, and await results.
//! - Prevents direct uncontrolled manipulation of underlying runtime JoinHandles.

use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;
use crate::core::tasks::id::TaskId;
use crate::errors::AppError;

/// Safe handle to an in-flight managed task.
pub struct TaskHandle<T> {
    pub(crate) task_id: TaskId,
    pub(crate) token: CancellationToken,
    pub(crate) join_handle: JoinHandle<Result<T, AppError>>,
}

impl<T> TaskHandle<T> {
    pub fn new(
        task_id: TaskId,
        token: CancellationToken,
        join_handle: JoinHandle<Result<T, AppError>>,
    ) -> Self {
        Self {
            task_id,
            token,
            join_handle,
        }
    }

    /// Returns the unique task identifier.
    pub fn task_id(&self) -> &TaskId {
        &self.task_id
    }

    /// Signals cooperative cancellation to the task.
    pub fn cancel(&self) {
        self.token.cancel();
    }

    /// Checks if cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.token.is_cancelled()
    }

    /// Checks if the underlying asynchronous task has finished.
    pub fn is_finished(&self) -> bool {
        self.join_handle.is_finished()
    }

    /// Awaits completion of the task and extracts the normalized result.
    /// Handles panics and converts JoinError into a sanitized `AppError::Internal`.
    pub async fn await_result(self) -> Result<T, AppError> {
        match self.join_handle.await {
            Ok(result) => result,
            Err(join_err) => {
                if join_err.is_cancelled() {
                    Err(AppError::ServiceUnavailable(format!(
                        "Task {} was cancelled",
                        self.task_id
                    )))
                } else if join_err.is_panic() {
                    Err(AppError::Internal(format!(
                        "Task {} panicked unexpectedly",
                        self.task_id
                    )))
                } else {
                    Err(AppError::Internal(format!(
                        "Task {} join error: {}",
                        self.task_id, join_err
                    )))
                }
            }
        }
    }
}

