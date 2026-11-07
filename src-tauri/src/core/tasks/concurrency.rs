//! Task Concurrency Management
//!
//! Responsibility:
//! - Enforces bounded concurrency for CPU-heavy and blocking synchronous workloads.
//! - Prevents unbounded task spawning that could starve the threadpool or freeze host OS.

use std::sync::Arc;
use tokio::sync::{OwnedSemaphorePermit, Semaphore};
use crate::core::tasks::types::TaskKind;

/// Default concurrency limits.
pub const DEFAULT_MAX_CPU_CONCURRENCY: usize = 2;
pub const DEFAULT_MAX_BLOCKING_CONCURRENCY: usize = 8;

/// Manages concurrency permits across task kinds.
pub struct TaskConcurrencyLimiter {
    cpu_semaphore: Arc<Semaphore>,
    blocking_semaphore: Arc<Semaphore>,
}

impl TaskConcurrencyLimiter {
    /// Creates a limiter with custom maximum concurrency boundaries.
    pub fn new(max_cpu: usize, max_blocking: usize) -> Self {
        Self {
            cpu_semaphore: Arc::new(Semaphore::new(max_cpu)),
            blocking_semaphore: Arc::new(Semaphore::new(max_blocking)),
        }
    }

    /// Acquires an asynchronous concurrency permit if required by the task kind.
    pub async fn acquire_permit(&self, kind: TaskKind) -> Option<OwnedSemaphorePermit> {
        match kind {
            TaskKind::CpuBound => {
                let permit = self.cpu_semaphore.clone().acquire_owned().await.ok()?;
                Some(permit)
            }
            TaskKind::Blocking => {
                let permit = self.blocking_semaphore.clone().acquire_owned().await.ok()?;
                Some(permit)
            }
            TaskKind::Application | TaskKind::Maintenance | TaskKind::Background | TaskKind::Io => {
                // Async I/O and lightweight background tasks do not hold CPU permits
                None
            }
        }
    }

    /// Available CPU permits count (for diagnostics).
    pub fn available_cpu_permits(&self) -> usize {
        self.cpu_semaphore.available_permits()
    }

    /// Available blocking permits count (for diagnostics).
    pub fn available_blocking_permits(&self) -> usize {
        self.blocking_semaphore.available_permits()
    }
}

impl Default for TaskConcurrencyLimiter {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_CPU_CONCURRENCY, DEFAULT_MAX_BLOCKING_CONCURRENCY)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cpu_concurrency_bounded() {
        let limiter = TaskConcurrencyLimiter::new(1, 4);
        assert_eq!(limiter.available_cpu_permits(), 1);

        let permit1 = limiter.acquire_permit(TaskKind::CpuBound).await;
        assert!(permit1.is_some());
        assert_eq!(limiter.available_cpu_permits(), 0);

        drop(permit1);
        assert_eq!(limiter.available_cpu_permits(), 1);
    }

    #[tokio::test]
    async fn test_io_tasks_do_not_consume_cpu_permits() {
        let limiter = TaskConcurrencyLimiter::new(1, 4);
        let permit = limiter.acquire_permit(TaskKind::Io).await;
        assert!(permit.is_none());
        assert_eq!(limiter.available_cpu_permits(), 1);
    }
}

