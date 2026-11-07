// ============================================================================
// Nano Route - Streaming Transport Subsystem
// File: src-tauri/src/services/streaming/mod.rs
// ============================================================================
// Responsibility:
// - Provider-neutral, ordered, cancellable streaming transport.
// - Bridges Rust application core to Tauri Channels without leaking UI or DB concepts.
// ============================================================================

pub mod coordinator;
pub mod id;
pub mod mock;
pub mod registry;
pub mod types;

pub use coordinator::{StreamCoordinator, StreamSink};
pub use id::StreamId;
pub use mock::MockStreamGenerator;
pub use registry::{StreamRecord, StreamRegistry};
pub use types::{
    MockStreamMode, ProviderStreamChunk, StreamEvent, StreamLifecycleState, StreamMetadata,
    StreamRequest, StreamStartResult,
};
