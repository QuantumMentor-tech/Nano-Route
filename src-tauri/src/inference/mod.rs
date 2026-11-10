// ============================================================================
// Nano Route - Local SLM Inference Subsystem
// File: src-tauri/src/inference/mod.rs
// ============================================================================
// Responsibility:
// - Local on-device model execution (ONNX Runtime and future GGUF backend).
// - Tokenizer management and input tensor preparation.
// - Local SLM runtime lifecycle, status monitoring, and metrics.
// - Must NOT define cloud provider routing policies, failover, or retries.
// ============================================================================

pub mod backend;
pub mod errors;
pub mod manifest;
pub mod service;
pub mod tokenizer;
pub mod types;
pub mod worker;

#[cfg(test)]
pub mod tests;

// Re-exports for consumers and Tauri state
pub use backend::{FakeInferenceBackend, InferenceBackend, InferenceSession, OnnxBackend};
pub use errors::{LocalSlmError, LocalSlmErrorKind};
pub use manifest::LocalModelManifest;
pub use service::LocalSlmService;
pub use tokenizer::{BertStyleTokenizer, MockTokenizer, Tokenizer};
pub use types::{
    ExecutionProviderType, InferenceBackendType, InferenceInput, InferenceOutput, InferenceStage,
    LocalInferenceResult, LocalModelStatus, LocalRuntimeMetrics, LocalRuntimeState,
    LocalRuntimeStatus,
};
pub use worker::{InferenceWorkerHandle, DEFAULT_INFERENCE_TIMEOUT_MS, DEFAULT_MAX_QUEUE_CAPACITY};
