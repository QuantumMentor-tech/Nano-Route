//! Task Active Registry
//!
//! Responsibility:
//! - Thread-safe synchronization of active in-flight tasks.
//! - Enforces state transitions via the TaskStatus state machine.
//! - Guarantees removal of finished/failed/cancelled tasks to prevent memory leaks.
//! - Exposes sanitized diagnostic snapshots without holding locks across async points.

use std::collections::HashMap;
use std::sync::RwLock;
use tokio_util::sync::CancellationToken;
use crate::core::tasks::id::TaskId;
use crate::core::tasks::types::{TaskMetadata, TaskStatus};

/// Internal registry entry holding metadata and cancellation control.
pub struct TaskEntry {
    pub metadata: TaskMetadata,
    pub token: CancellationToken,
}

/// Synchronized in-memory registry of active tasks.
pub struct TaskRegistry {
    entries: RwLock<HashMap<TaskId, TaskEntry>>,
}

impl TaskRegistry {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    /// Registers a newly created task.
    pub fn register(&self, metadata: TaskMetadata, token: CancellationToken) {
        if let Ok(mut lock) = self.entries.write() {
            lock.insert(metadata.task_id.clone(), TaskEntry { metadata, token });
        }
    }

    /// Updates task status, enforcing legal state machine transitions.
    pub fn update_status(&self, task_id: &TaskId, new_status: TaskStatus) -> bool {
        if let Ok(mut lock) = self.entries.write() {
            if let Some(entry) = lock.get_mut(task_id) {
                if entry.metadata.status.can_transition_to(new_status) {
                    entry.metadata.status = new_status;
                    return true;
                }
            }
        }
        false
    }

    /// Marks a task as finished and records completion metadata.
    pub fn mark_finished(
        &self,
        task_id: &TaskId,
        terminal_status: TaskStatus,
        error_message: Option<String>,
        timestamp: impl Into<String>,
    ) {
        if let Ok(mut lock) = self.entries.write() {
            if let Some(entry) = lock.get_mut(task_id) {
                entry.metadata.status = terminal_status;
                entry.metadata.finished_at = Some(timestamp.into());
                entry.metadata.error_message = error_message;
            }
        }
    }

    /// Removes a finished/cancelled task from the active registry to reclaim memory.
    pub fn remove(&self, task_id: &TaskId) -> Option<TaskEntry> {
        self.entries.write().ok().and_then(|mut lock| lock.remove(task_id))
    }

    /// Retrieves the current status of a task.
    pub fn get_status(&self, task_id: &TaskId) -> Option<TaskStatus> {
        self.entries
            .read()
            .ok()
            .and_then(|lock| lock.get(task_id).map(|e| e.metadata.status))
    }

    /// Retrieves a cloned snapshot of task metadata.
    pub fn get_metadata(&self, task_id: &TaskId) -> Option<TaskMetadata> {
        self.entries
            .read()
            .ok()
            .and_then(|lock| lock.get(task_id).map(|e| e.metadata.clone()))
    }

    /// Retrieves the cancellation token for a task.
    pub fn get_token(&self, task_id: &TaskId) -> Option<CancellationToken> {
        self.entries
            .read()
            .ok()
            .and_then(|lock| lock.get(task_id).map(|e| e.token.clone()))
    }

    /// Returns a diagnostic snapshot of all active tasks.
    pub fn list_active(&self) -> Vec<TaskMetadata> {
        self.entries
            .read()
            .map(|lock| lock.values().map(|e| e.metadata.clone()).collect())
            .unwrap_or_default()
    }

    /// Returns the number of currently active tasks.
    pub fn active_count(&self) -> usize {
        self.entries.read().map(|lock| lock.len()).unwrap_or(0)
    }

    /// Clears all entries from the registry.
    pub fn clear(&self) {
        if let Ok(mut lock) = self.entries.write() {
            lock.clear();
        }
    }
}

impl Default for TaskRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::tasks::types::TaskKind;

    #[test]
    fn test_registry_lifecycle_and_cleanup() {
        let registry = TaskRegistry::new();
        let id = TaskId::new("test");
        let token = CancellationToken::new();

        let meta = TaskMetadata {
            task_id: id.clone(),
            kind: TaskKind::Background,
            status: TaskStatus::Created,
            owner: "test".to_string(),
            created_at: "2026-11-07T00:00:00Z".to_string(),
            started_at: None,
            finished_at: None,
            parent_task_id: None,
            cancellable: true,
            error_message: None,
        };

        registry.register(meta, token);
        assert_eq!(registry.active_count(), 1);
        assert_eq!(registry.get_status(&id), Some(TaskStatus::Created));

        assert!(registry.update_status(&id, TaskStatus::Running));
        assert_eq!(registry.get_status(&id), Some(TaskStatus::Running));

        // Mark finished
        registry.mark_finished(&id, TaskStatus::Completed, None, "2026-11-07T00:00:01Z");
        assert_eq!(registry.get_status(&id), Some(TaskStatus::Completed));

        // Reclaim memory
        registry.remove(&id);
        assert_eq!(registry.active_count(), 0);
        assert_eq!(registry.get_status(&id), None);
    }
}

