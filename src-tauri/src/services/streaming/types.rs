// ============================================================================
// Nano Route - Streaming Transport & Event Types
// File: src-tauri/src/services/streaming/types.rs
// ============================================================================
// Canonical stream events, lifecycle state machine, and IPC contracts.
// Follows camelCase serialization for seamless React/TypeScript interoperability.
// ============================================================================

use crate::providers::{ProviderFinishReason, ProviderId, ProviderUsage};
use crate::services::streaming::id::StreamId;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Explicit lifecycle states for a streaming session.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StreamLifecycleState {
    /// Stream allocated and registered.
    Created,
    /// Stream task actively starting or connecting to provider.
    Starting,
    /// Actively receiving and dispatching stream chunks/deltas.
    Streaming,
    /// Successfully finished and closed (terminal).
    Completed,
    /// Cancelled via cooperative cancellation token or client disposal (terminal).
    Cancelled,
    /// Terminated due to upstream error or connection failure (terminal).
    Failed,
}

impl StreamLifecycleState {
    /// Returns true if this state is terminal (cannot transition further).
    #[inline]
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled | Self::Failed)
    }

    /// Validates whether a state transition from `self` to `next` is allowed.
    pub fn can_transition_to(&self, next: Self) -> bool {
        if self.is_terminal() {
            return false;
        }

        match (self, next) {
            (Self::Created, Self::Starting) => true,
            (Self::Created, Self::Cancelled) => true,
            (Self::Created, Self::Failed) => true,

            (Self::Starting, Self::Streaming) => true,
            (Self::Starting, Self::Completed) => true, // Empty stream finished immediately
            (Self::Starting, Self::Cancelled) => true,
            (Self::Starting, Self::Failed) => true,

            (Self::Streaming, Self::Streaming) => true, // Re-entrant during active deltas
            (Self::Streaming, Self::Completed) => true,
            (Self::Streaming, Self::Cancelled) => true,
            (Self::Streaming, Self::Failed) => true,

            _ => false,
        }
    }
}

/// Extensible metadata payload carried by metadata stream events.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StreamMetadata {
    pub latency_ms: Option<u64>,
    pub system_fingerprint: Option<String>,
    pub throughput_tokens_per_sec: Option<f64>,
    pub extra: Option<HashMap<String, String>>,
}

/// Canonical stream event delivered across the Tauri IPC Channel to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    /// Initial event confirming the stream is active and established.
    Started {
        stream_id: StreamId,
        sequence: u64,
        task_id: Option<String>,
        provider_id: Option<ProviderId>,
        model_id: Option<String>,
        timestamp_ms: u64,
    },
    /// Incremental textual delta (safe UTF-8, preserves exact characters).
    Delta {
        stream_id: StreamId,
        sequence: u64,
        text: String,
    },
    /// Stream metadata or progress notification (non-textual).
    Metadata {
        stream_id: StreamId,
        sequence: u64,
        metadata: StreamMetadata,
    },
    /// Terminal event indicating successful completion (emitted exactly once).
    Completed {
        stream_id: StreamId,
        sequence: u64,
        finish_reason: ProviderFinishReason,
        usage: Option<ProviderUsage>,
        model_id: Option<String>,
    },
    /// Terminal event indicating cooperative cancellation (emitted exactly once).
    Cancelled {
        stream_id: StreamId,
        sequence: u64,
        reason: Option<String>,
    },
    /// Terminal event indicating unrecoverable failure (emitted exactly once).
    Error {
        stream_id: StreamId,
        sequence: u64,
        code: String,
        message: String,
        is_retryable: bool,
    },
}

impl StreamEvent {
    /// Returns the StreamId associated with this event.
    pub fn stream_id(&self) -> &StreamId {
        match self {
            Self::Started { stream_id, .. } => stream_id,
            Self::Delta { stream_id, .. } => stream_id,
            Self::Metadata { stream_id, .. } => stream_id,
            Self::Completed { stream_id, .. } => stream_id,
            Self::Cancelled { stream_id, .. } => stream_id,
            Self::Error { stream_id, .. } => stream_id,
        }
    }

    /// Returns the monotonic sequence number of this event.
    pub fn sequence(&self) -> u64 {
        match self {
            Self::Started { sequence, .. } => *sequence,
            Self::Delta { sequence, .. } => *sequence,
            Self::Metadata { sequence, .. } => *sequence,
            Self::Completed { sequence, .. } => *sequence,
            Self::Cancelled { sequence, .. } => *sequence,
            Self::Error { sequence, .. } => *sequence,
        }
    }

    /// Returns true if this event represents terminal stream termination.
    pub fn is_terminal(&self) -> bool {
        matches!(self, Self::Completed { .. } | Self::Cancelled { .. } | Self::Error { .. })
    }
}

/// Inbound request starting a streaming session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamRequest {
    pub stream_id: StreamId,
    pub session_id: Option<String>,
    pub message_id: Option<String>,
    pub provider_id: Option<ProviderId>,
    pub model_id: String,
    pub prompt: Option<String>,
    pub test_mode: Option<MockStreamMode>,
}

/// Immediate return payload acknowledging stream startup.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StreamStartResult {
    pub stream_id: StreamId,
    pub accepted: bool,
    pub task_id: Option<String>,
}

/// Test mode flags for deterministic mock provider streaming.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MockStreamMode {
    /// Standard successful emission of chunks.
    Success { chunk_count: usize, delay_ms: u64 },
    /// Empty stream (immediate completion with 0 deltas).
    Empty,
    /// Slow delivery with delay between deltas.
    Slow { delay_ms: u64 },
    /// Emits deltas then injects a simulated provider error.
    Failure { fail_at_chunk: usize },
    /// Large output emission of many sequential chunks.
    LargeOutput { chunk_count: usize },
}

/// Provider-neutral incremental chunk produced by provider streaming adapters.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
pub struct ProviderStreamChunk {
    pub text_delta: Option<String>,
    pub reasoning_delta: Option<String>,
    pub finish_reason: Option<ProviderFinishReason>,
    pub usage: Option<ProviderUsage>,
    pub is_final: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lifecycle_transitions() {
        assert!(StreamLifecycleState::Created.can_transition_to(StreamLifecycleState::Starting));
        assert!(StreamLifecycleState::Starting.can_transition_to(StreamLifecycleState::Streaming));
        assert!(StreamLifecycleState::Streaming.can_transition_to(StreamLifecycleState::Completed));
        assert!(StreamLifecycleState::Streaming.can_transition_to(StreamLifecycleState::Cancelled));
        assert!(StreamLifecycleState::Streaming.can_transition_to(StreamLifecycleState::Failed));

        // Terminal cannot transition
        assert!(!StreamLifecycleState::Completed.can_transition_to(StreamLifecycleState::Streaming));
        assert!(!StreamLifecycleState::Cancelled.can_transition_to(StreamLifecycleState::Completed));
        assert!(!StreamLifecycleState::Failed.can_transition_to(StreamLifecycleState::Cancelled));
    }

    #[test]
    fn test_event_serialization() {
        let sid = StreamId::parse("strm_test_123").unwrap();
        let event = StreamEvent::Delta {
            stream_id: sid,
            sequence: 5,
            text: "Hello world".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"delta\""));
        assert!(json.contains("\"streamId\":\"strm_test_123\""));
        assert!(json.contains("\"sequence\":5"));
        assert!(json.contains("\"text\":\"Hello world\""));
    }
}

