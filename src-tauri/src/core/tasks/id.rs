//! Task Identity Management
//!
//! Generates unique, non-secret, structured identifiers for background tasks.
//! Ensures task IDs cannot be confused with IPC Request IDs.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static TASK_COUNTER: AtomicU64 = AtomicU64::new(1);

/// Strongly-typed, unique identifier for a native background task.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct TaskId(String);

impl TaskId {
    /// Generates a new unique TaskId for a given task kind prefix.
    pub fn new(prefix: &str) -> Self {
        let counter = TASK_COUNTER.fetch_add(1, Ordering::Relaxed);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let id_str = format!("task_{}_{:x}_{:x}", prefix, now, counter);
        Self(id_str)
    }

    /// Access the underlying string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for TaskId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl AsRef<str> for TaskId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<&str> for TaskId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

impl From<String> for TaskId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_id_uniqueness() {
        let id1 = TaskId::new("io");
        let id2 = TaskId::new("io");
        assert_ne!(id1, id2);
        assert!(id1.as_str().starts_with("task_io_"));
        assert!(id2.as_str().starts_with("task_io_"));
    }
}

