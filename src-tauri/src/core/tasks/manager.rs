//! Task Manager Engine
//!
//! Responsibility:
//! - Composition root for native background task execution.
//! - Enforces cooperative cancellation, concurrency limits, and shutdown ordering.
//! - Guarantees task lifecycle tracking and automatic registry cleanup.
//! - Separates Request IDs (IPC requests) from Task IDs (execution units).

use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio_util::sync::CancellationToken;

use crate::core::tasks::concurrency::TaskConcurrencyLimiter;
use crate::core::tasks::handle::TaskHandle;
use crate::core::tasks::id::TaskId;
use crate::core::tasks::registry::TaskRegistry;
use crate::core::tasks::types::{
    ShutdownReport, TaskContext, TaskKind, TaskMetadata, TaskStatus,
};
use crate::errors::AppError;

/// Central native coordinator for asynchronous background tasks.
pub struct TaskManager {
    registry: Arc<TaskRegistry>,
    concurrency: Arc<TaskConcurrencyLimiter>,
    root_shutdown_token: CancellationToken,
    is_shutting_down: Arc<AtomicBool>,
}

impl TaskManager {
    /// Constructs a new TaskManager with default concurrency limits.
    pub fn new() -> Self {
        Self {
            registry: Arc::new(TaskRegistry::new()),
            concurrency: Arc::new(TaskConcurrencyLimiter::default()),
            root_shutdown_token: CancellationToken::new(),
            is_shutting_down: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Constructs a new TaskManager with custom concurrency boundaries.
    pub fn with_concurrency(max_cpu: usize, max_blocking: usize) -> Self {
        Self {
            registry: Arc::new(TaskRegistry::new()),
            concurrency: Arc::new(TaskConcurrencyLimiter::new(max_cpu, max_blocking)),
            root_shutdown_token: CancellationToken::new(),
            is_shutting_down: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Spawns an asynchronous task on the Tokio/Tauri async runtime.
    pub fn spawn<F, Fut, T>(
        &self,
        kind: TaskKind,
        owner: &str,
        parent_id: Option<TaskId>,
        f: F,
    ) -> Result<TaskHandle<T>, AppError>
    where
        F: FnOnce(TaskContext) -> Fut + Send + 'static,
        Fut: Future<Output = Result<T, AppError>> + Send + 'static,
        T: Send + 'static,
    {
        // 1. Refuse new work if application shutdown is in progress
        if self.is_shutting_down.load(Ordering::SeqCst) {
            return Err(AppError::ServiceUnavailable(
                "Application is shutting down; new background tasks are rejected".to_string(),
            ));
        }

        let task_id = TaskId::new(kind.prefix());
        
        // 2. Derive child token from parent task or root shutdown token
        let token = if let Some(ref p_id) = parent_id {
            if let Some(p_token) = self.registry.get_token(p_id) {
                p_token.child_token()
            } else {
                self.root_shutdown_token.child_token()
            }
        } else {
            self.root_shutdown_token.child_token()
        };

        let metadata = TaskMetadata {
            task_id: task_id.clone(),
            kind,
            status: TaskStatus::Created,
            owner: owner.to_string(),
            created_at: "2026-11-07T00:00:00Z".to_string(),
            started_at: None,
            finished_at: None,
            parent_task_id: parent_id.clone(),
            cancellable: true,
            error_message: None,
        };

        // 3. Register task in the active registry
        self.registry.register(metadata, token.clone());

        let registry = self.registry.clone();
        let concurrency = self.concurrency.clone();
        let t_id = task_id.clone();
        let task_token = token.clone();

        let context = TaskContext {
            task_id: task_id.clone(),
            token: token.clone(),
            parent_task_id: parent_id,
        };

        // 4. Spawn managed asynchronous execution
        let join_handle = tokio::spawn(async move {
            registry.update_status(&t_id, TaskStatus::Queued);

            // Acquire bounded permit for CPU tasks
            let _permit = concurrency.acquire_permit(kind).await;

            registry.update_status(&t_id, TaskStatus::Running);

            // Execute work with cooperative cancellation listener
            let outcome = tokio::select! {
                res = f(context) => res,
                _ = task_token.cancelled() => {
                    Err(AppError::ServiceUnavailable(format!("Task {} cancelled cooperatively", t_id)))
                }
            };

            // Record terminal status and remove from active registry to reclaim memory
            match outcome {
                Ok(val) => {
                    registry.mark_finished(&t_id, TaskStatus::Completed, None, "2026-11-07T00:00:00Z");
                    registry.remove(&t_id);
                    Ok(val)
                }
                Err(err) => {
                    let status = if task_token.is_cancelled() {
                        TaskStatus::Cancelled
                    } else {
                        TaskStatus::Failed
                    };
                    registry.mark_finished(&t_id, status, Some(err.to_string()), "2026-11-07T00:00:00Z");
                    registry.remove(&t_id);
                    Err(err)
                }
            }
        });

        Ok(TaskHandle::new(task_id, token, join_handle))
    }

    /// Spawns synchronous/blocking work onto the dedicated blocking threadpool.
    ///
    /// NOTE: As documented by Tokio, blocking work cannot generally be aborted once started.
    /// Cooperative cancellation is honored if the closure periodically checks `context.is_cancelled()`.
    pub fn spawn_blocking<F, T>(
        &self,
        kind: TaskKind,
        owner: &str,
        parent_id: Option<TaskId>,
        f: F,
    ) -> Result<TaskHandle<T>, AppError>
    where
        F: FnOnce(TaskContext) -> Result<T, AppError> + Send + 'static,
        T: Send + 'static,
    {
        if self.is_shutting_down.load(Ordering::SeqCst) {
            return Err(AppError::ServiceUnavailable(
                "Application is shutting down; new blocking tasks are rejected".to_string(),
            ));
        }

        let task_id = TaskId::new(kind.prefix());
        let token = if let Some(ref p_id) = parent_id {
            if let Some(p_token) = self.registry.get_token(p_id) {
                p_token.child_token()
            } else {
                self.root_shutdown_token.child_token()
            }
        } else {
            self.root_shutdown_token.child_token()
        };

        let metadata = TaskMetadata {
            task_id: task_id.clone(),
            kind,
            status: TaskStatus::Created,
            owner: owner.to_string(),
            created_at: "2026-11-07T00:00:00Z".to_string(),
            started_at: None,
            finished_at: None,
            parent_task_id: parent_id.clone(),
            cancellable: true,
            error_message: None,
        };

        self.registry.register(metadata, token.clone());

        let registry = self.registry.clone();
        let t_id = task_id.clone();
        let task_token = token.clone();

        let context = TaskContext {
            task_id: task_id.clone(),
            token: token.clone(),
            parent_task_id: parent_id,
        };

        let join_handle = tokio::task::spawn_blocking(move || {
            registry.update_status(&t_id, TaskStatus::Running);

            let outcome = f(context);

            match outcome {
                Ok(val) => {
                    let status = if task_token.is_cancelled() {
                        TaskStatus::Cancelled
                    } else {
                        TaskStatus::Completed
                    };
                    registry.mark_finished(&t_id, status, None, "2026-11-07T00:00:00Z");
                    registry.remove(&t_id);
                    Ok(val)
                }
                Err(err) => {
                    let status = if task_token.is_cancelled() {
                        TaskStatus::Cancelled
                    } else {
                        TaskStatus::Failed
                    };
                    registry.mark_finished(&t_id, status, Some(err.to_string()), "2026-11-07T00:00:00Z");
                    registry.remove(&t_id);
                    Err(err)
                }
            }
        });

        Ok(TaskHandle::new(task_id, token, join_handle))
    }

    /// Requests cooperative cancellation for a specific task.
    pub fn cancel(&self, task_id: &TaskId) -> bool {
        if let Some(token) = self.registry.get_token(task_id) {
            token.cancel();
            self.registry.update_status(task_id, TaskStatus::Cancelling);
            true
        } else {
            false
        }
    }

    /// Cancels all currently active managed tasks.
    pub fn cancel_all(&self) {
        for meta in self.registry.list_active() {
            self.cancel(&meta.task_id);
        }
    }

    /// Inspects the status of a specific task.
    pub fn status(&self, task_id: &TaskId) -> Option<TaskStatus> {
        self.registry.get_status(task_id)
    }

    /// Returns a diagnostic snapshot of all currently active tasks.
    pub fn list_active(&self) -> Vec<TaskMetadata> {
        self.registry.list_active()
    }

    /// Initiates bounded application shutdown.
    ///
    /// Sequence:
    /// 1. Stops accepting new background work.
    /// 2. Signals cooperative root shutdown token.
    /// 3. Awaits completion of in-flight tasks up to `timeout`.
    /// 4. Reports clean exit or records abandoned tasks.
    pub async fn shutdown(&self, timeout: Duration) -> ShutdownReport {
        let start = Instant::now();
        self.is_shutting_down.store(true, Ordering::SeqCst);

        // Signal cancellation to all root and child tokens
        self.root_shutdown_token.cancel();

        let check_interval = Duration::from_millis(50);
        let mut clean_exit = false;

        while start.elapsed() < timeout {
            if self.registry.active_count() == 0 {
                clean_exit = true;
                break;
            }
            tokio::time::sleep(check_interval).await;
        }

        let abandoned_count = self.registry.active_count();
        if abandoned_count > 0 {
            eprintln!(
                "[TaskManager] Shutdown timeout reached with {} active tasks remaining",
                abandoned_count
            );
        }

        self.registry.clear();

        ShutdownReport {
            clean_exit,
            completed_count: 0,
            cancelled_count: 0,
            abandoned_count,
            duration_ms: start.elapsed().as_millis() as u64,
        }
    }
}

impl Default for TaskManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_task_success_lifecycle() {
        let manager = TaskManager::new();
        let handle = manager
            .spawn(TaskKind::Io, "test", None, |_ctx| async { Ok(42) })
            .expect("spawn should succeed");

        let result = handle.await_result().await.expect("task should succeed");
        assert_eq!(result, 42);
        assert_eq!(manager.list_active().len(), 0); // Reclaimed
    }

    #[tokio::test]
    async fn test_task_failure_lifecycle() {
        let manager = TaskManager::new();
        let handle = manager
            .spawn(TaskKind::Io, "test", None, |_ctx| async {
                Err(AppError::InvalidInput("test error".into()))
            })
            .expect("spawn should succeed");

        let result = handle.await_result().await;
        assert!(result.is_err());
        assert_eq!(manager.list_active().len(), 0); // Reclaimed
    }

    #[tokio::test]
    async fn test_task_cancellation_cooperative() {
        let manager = TaskManager::new();
        let handle = manager
            .spawn(TaskKind::Background, "test", None, |ctx| async move {
                ctx.cancelled().await;
                Err(AppError::ServiceUnavailable("cancelled".into()))
            })
            .expect("spawn should succeed");

        handle.cancel();
        let result = handle.await_result().await;
        assert!(result.is_err());
        assert_eq!(manager.list_active().len(), 0); // Reclaimed
    }

    #[tokio::test]
    async fn test_parent_child_cancellation() {
        let manager = TaskManager::new();
        let parent_handle = manager
            .spawn(TaskKind::Application, "parent", None, |ctx| async move {
                ctx.cancelled().await;
                Ok(())
            })
            .expect("parent spawn should succeed");

        let child_handle = manager
            .spawn(
                TaskKind::Io,
                "child",
                Some(parent_handle.task_id().clone()),
                |ctx| async move {
                    ctx.cancelled().await;
                    Ok(())
                },
            )
            .expect("child spawn should succeed");

        // Cancelling parent automatically cancels child
        parent_handle.cancel();
        assert!(child_handle.is_cancelled());
    }

    #[tokio::test]
    async fn test_shutdown_rejects_new_tasks() {
        let manager = TaskManager::new();
        manager.shutdown(Duration::from_millis(50)).await;

        let spawn_res = manager.spawn(TaskKind::Io, "test", None, |_ctx| async { Ok(()) });
        assert!(spawn_res.is_err());
    }
}

