// ============================================================================
// Nano Route - Local SLM Runtime Types
// File: src-tauri/src/inference/types.rs
// ============================================================================
// Authoritative types for the native local SLM runtime, lifecycle states,
// tensor inputs/outputs, performance metrics, and safe status DTOs.
// Zero secret keys, user prompts, or raw model weights are exposed here.
// ============================================================================

use serde::{Deserialize, Serialize};

/// High-level lifecycle state of the local inference runtime.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocalRuntimeState {
    /// Runtime has not been initialized yet.
    Uninitialized,
    /// Runtime is actively initializing the backend environment.
    Initializing,
    /// Runtime environment is initialized; ready to load a model or already loaded.
    Ready,
    /// Actively validating and loading a model into memory.
    LoadingModel,
    /// Actively executing an inference request.
    Running,
    /// Actively unloading a model session and releasing resources.
    Unloading,
    /// Runtime encountered an unrecoverable initialization or backend error.
    Failed,
    /// Runtime is shutting down.
    ShuttingDown,
}

impl LocalRuntimeState {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Uninitialized => "uninitialized",
            Self::Initializing => "initializing",
            Self::Ready => "ready",
            Self::LoadingModel => "loading_model",
            Self::Running => "running",
            Self::Unloading => "unloading",
            Self::Failed => "failed",
            Self::ShuttingDown => "shutting_down",
        }
    }
}

impl Default for LocalRuntimeState {
    fn default() -> Self {
        Self::Uninitialized
    }
}

/// State of a specific local model artifact.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocalModelStatus {
    /// Model package is not installed on disk.
    NotInstalled,
    /// Model is installed on disk but not currently loaded in memory.
    NotLoaded,
    /// Model is loaded into an active session and ready for inference.
    Loaded,
    /// Model artifact integrity check failed (e.g. SHA-256 mismatch).
    IntegrityFailed,
    /// Model failed to load into the inference engine.
    LoadFailed,
}

/// Supported execution backend engines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InferenceBackendType {
    /// ONNX Runtime native execution.
    Onnx,
    /// Future GGUF / llama.cpp execution path (architectural boundary).
    Gguf,
    /// In-memory mock/fake backend for unit testing and offline development.
    Mock,
}

impl Default for InferenceBackendType {
    fn default() -> Self {
        Self::Onnx
    }
}

/// Execution provider for hardware acceleration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExecutionProviderType {
    /// Standard CPU execution (guaranteed baseline).
    Cpu,
    /// Windows DirectML hardware acceleration (optional).
    DirectMl,
    /// NVIDIA CUDA acceleration (optional).
    Cuda,
    /// Simulated execution provider for test doubles.
    Simulated,
}

impl Default for ExecutionProviderType {
    fn default() -> Self {
        Self::Cpu
    }
}

/// Lifecycle stage where a failure or latency observation occurred.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InferenceStage {
    Initialization,
    ModelDiscovery,
    ManifestValidation,
    TokenizerLoad,
    RuntimeLoad,
    SessionCreation,
    Tokenization,
    TensorPreparation,
    Inference,
    PostProcessing,
}

/// Normalized tensor input for local model execution.
#[derive(Debug, Clone, PartialEq)]
pub struct InferenceInput {
    pub input_ids: Vec<i64>,
    pub attention_mask: Vec<i64>,
    pub token_type_ids: Option<Vec<i64>>,
    pub sequence_length: usize,
}

/// Output produced by the local inference session.
/// For the router SLM, this is typically classification logits.
#[derive(Debug, Clone, PartialEq)]
pub struct InferenceOutput {
    pub output_name: String,
    pub shape: Vec<usize>,
    pub logits: Vec<f32>,
    pub latency_ms: u64,
}

/// Read-safe runtime status DTO exposed to diagnostics and UI.
/// Excludes raw memory addresses, prompts, and tensor weights.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocalRuntimeStatus {
    pub state: LocalRuntimeState,
    pub backend: InferenceBackendType,
    pub execution_provider: ExecutionProviderType,
    pub model_id: Option<String>,
    pub model_version: Option<String>,
    pub model_status: LocalModelStatus,
    pub runtime_version: String,
    pub is_busy: bool,
    pub queue_depth: usize,
    pub last_inference_at_ms: Option<u64>,
    pub last_latency_ms: Option<u64>,
    pub last_error: Option<String>,
}

/// Read-safe performance metrics for local inference.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct LocalRuntimeMetrics {
    pub total_inferences: u64,
    pub successful_inferences: u64,
    pub failed_inferences: u64,
    pub cancelled_inferences: u64,
    pub last_tokenization_ms: u64,
    pub last_queue_wait_ms: u64,
    pub last_inference_ms: u64,
    pub last_total_ms: u64,
    pub last_input_tokens: usize,
    pub average_inference_ms: f64,
    pub cold_load_ms: Option<u64>,
}

/// High-level result of a local inference execution returned over IPC.
/// Contains no sensitive user text; only classification output metadata.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LocalInferenceResult {
    pub request_id: String,
    pub model_id: String,
    pub output_shape: Vec<usize>,
    pub logits_preview: Vec<f32>,
    pub latency_ms: u64,
    pub token_count: usize,
}

