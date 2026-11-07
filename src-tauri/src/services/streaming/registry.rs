// ============================================================================
// Nano Route - Stream Registry & Active Stream State
// File: src-tauri/src/services/streaming/registry.rs
// ============================================================================
// In-memory thread-safe registry tracking active streaming operations.
// Enforces lifecycle transitions, sequence monotonicity, and automatic
// memory reclamation on stream termination.
// ============================================================================

use crate::core::tasks::TaskId;
use crate::errors::AppError;
use crate::services::streaming::id::StreamId;
use crate::services::streaming::types::StreamLifecycleState;
use std::collections::HashMap;
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio_util::sync::CancellationToken;

/// In-memory descriptor for an active streaming operation.
#[derive(Debug, Clone)]
pub struct StreamRecord {
    pub stream_id: StreamId,
    pub task_id: Option<TaskId>,
    pub token: CancellationToken,
    pub state: StreamLifecycleState,
    pub sequence: u64,
    pub created_at_ms: u64,
    pub terminated_at_ms: Option<u64>,
}

impl StreamRecord {
    pub fn new(stream_id: StreamId, task_id: Option<TaskId>, token: CancellationToken) -> Self {
        let created_at_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        Self {
            stream_id,
            task_id,
            token,
            state: StreamLifecycleState::Created,
            sequence: 0,
            created_at_ms,
            terminated_at_ms: None,
        }
    }
}

/// Centralized thread-safe registry for tracking active streaming lifecycles.
pub struct StreamRegistry {
    streams: RwLock<HashMap<StreamId, StreamRecord>>,
}

impl StreamRegistry {
    /// Constructs a new empty StreamRegistry.
    pub fn new() -> Self {
        Self {
            streams: RwLock::new(HashMap::new()),
        }
    }

    /// Registers a new stream in the active registry.
    /// Rejects registration if a stream with the same ID is already active.
    pub fn register(&self, record: StreamRecord) -> Result<(), AppError> {
        let mut map = self.streams.write().map_err(|_| {
            AppError::Internal("StreamRegistry lock poisoned during register".to_string())
        })?;

        if let Some(existing) = map.get(&record.stream_id) {
            if !existing.state.is_terminal() {
                return Err(AppError::InvalidInput(format!(
                    "Active stream with ID '{}' already exists in registry",
                    record.stream_id
                )));
            }
        }

        map.insert(record.stream_id.clone(), record);
        Ok(())
    }

    /// Queries the current lifecycle state of a stream.
    pub fn get_state(&self, stream_id: &StreamId) -> Option<StreamLifecycleState> {
        let map = self.streams.read().ok()?;
        map.get(stream_id).map(|r| r.state)
    }

    /// Transitions a stream to a new lifecycle state.
    /// Rejects invalid state transitions.
    pub fn transition(
        &self,
        stream_id: &StreamId,
        next_state: StreamLifecycleState,
    ) -> Result<(), AppError> {
        let mut map = self.streams.write().map_err(|_| {
            AppError::Internal("StreamRegistry lock poisoned during transition".to_string())
        })?;

        let record = map.get_mut(stream_id).ok_or_else(|| {
            AppError::InvalidInput(format!("Stream '{}' not found in registry", stream_id))
        })?;

        if !record.state.can_transition_to(next_state) {
            return Err(AppError::InvalidInput(format!(
                "Invalid lifecycle transition for stream '{}': {:?} -> {:?}",
                stream_id, record.state, next_state
            )));
        }

        record.state = next_state;
        if next_state.is_terminal() {
            let now_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            record.terminated_at_ms = Some(now_ms);
        }

        Ok(())
    }

    /// Atomically increments and returns the next sequence number for a stream.
    pub fn next_sequence(&self, stream_id: &StreamId) -> Result<u64, AppError> {
        let mut map = self.streams.write().map_err(|_| {
            AppError::Internal("StreamRegistry lock poisoned during sequence generation".to_string())
        })?;

        let record = map.get_mut(stream_id).ok_or_else(|| {
            AppError::InvalidInput(format!("Stream '{}' not found in registry", stream_id))
        })?;

        record.sequence += 1;
        Ok(record.sequence)
    }

    /// Signals cancellation for an active stream.
    /// Returns true if the stream was found and cancelled; false if unknown or already terminal.
    pub fn cancel(&self, stream_id: &StreamId) -> bool {
        let map = match self.streams.read() {
            Ok(m) => m,
            Err(_) => return false,
        };

        if let Some(record) = map.get(stream_id) {
            if !record.state.is_terminal() {
                record.token.cancel();
                return true;
            }
        }
        false
    }

    /// Removes a terminated stream record from the registry, reclaiming memory.
    pub fn remove(&self, stream_id: &StreamId) -> Option<StreamRecord> {
        let mut map = self.streams.write().ok()?;
        map.remove(stream_id)
    }

    /// Checks if a stream ID is currently tracked in the registry.
    pub fn contains(&self, stream_id: &StreamId) -> bool {
        let map = match self.streams.read() {
            Ok(m) => m,
            Err(_) => return false,
        };
        map.contains_key(stream_id)
    }

    /// Returns the number of currently active / registered streams.
    pub fn active_count(&self) -> usize {
        let map = match self.streams.read() {
            Ok(m) => m,
            Err(_) => return 0,
        };
        map.len()
    }

    /// Clears all streams (intended for testing).
    pub fn clear(&self) {
        if let Ok(mut map) = self.streams.write() {
            map.clear();
        }
    }
}

impl Default for StreamRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_lifecycle_and_sequence() {
        let registry = StreamRegistry::new();
        let sid = StreamId::parse("strm_reg_001").unwrap();
        let token = CancellationToken::new();

        let record = StreamRecord::new(sid.clone(), None, token);
        registry.register(record).unwrap();

        assert_eq!(registry.get_state(&sid), Some(StreamLifecycleState::Created));
        assert!(registry.contains(&sid));
        assert_eq!(registry.active_count(), 1);

        registry.transition(&sid, StreamLifecycleState::Starting).unwrap();
        registry.transition(&sid, StreamLifecycleState::Streaming).unwrap();

        let seq1 = registry.next_sequence(&sid).unwrap();
        let seq2 = registry.next_sequence(&sid).unwrap();
        assert_eq!(seq1, 1);
        assert_eq!(seq2, 2);

        registry.transition(&sid, StreamLifecycleState::Completed).unwrap();
        assert_eq!(registry.get_state(&sid), Some(StreamLifecycleState::Completed));

        // Memory cleanup
        let removed = registry.remove(&sid);
        assert!(removed.is_some());
        assert_eq!(registry.active_count(), 0);
    }

    #[test]
    fn test_cancellation_signaling() {
        let registry = StreamRegistry::new();
        let sid = StreamId::parse("strm_cancel_001").unwrap();
        let token = CancellationToken::new();

        let record = StreamRecord::new(sid.clone(), None, token.clone());
        registry.register(record).unwrap();

        assert!(!token.is_cancelled());
        assert!(registry.cancel(&sid));
        assert!(token.is_cancelled());

        // Cancel unknown stream returns false
        let unknown = StreamId::parse("strm_unknown").unwrap();
        assert!(!registry.cancel(&unknown));
    }
}

