// ============================================================================
// Nano Route - Local SLM Runtime Error Taxonomy
// File: src-tauri/src/inference/errors.rs
// ============================================================================
// Strongly-typed errors for local model discovery, manifest validation,
// tokenizer execution, ONNX session lifecycle, and local inference execution.
// Contains zero secret credentials or user prompt contents.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;
use crate::inference::types::InferenceStage;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LocalSlmErrorKind {
    ModelNotFound,
    ModelManifestMissing,
    ModelManifestInvalid,
    ModelIntegrityFailure,
    ModelFormatUnsupported,
    ModelVersionUnsupported,
    ModelInputMismatch,
    ModelOutputMismatch,
    TokenizerMissing,
    TokenizerInvalid,
    RuntimeUnavailable,
    ExecutionProviderUnavailable,
    ModelLoadFailed,
    InferenceFailed,
    InferenceCancelled,
    InferenceTimedOut,
    RuntimeBusy,
    InputTooLong,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LocalSlmError {
    pub kind: LocalSlmErrorKind,
    pub stage: InferenceStage,
    pub model_id: Option<String>,
    pub message: String,
    pub is_retryable: bool,
}

impl LocalSlmError {
    pub fn new(
        kind: LocalSlmErrorKind,
        stage: InferenceStage,
        message: impl Into<String>,
    ) -> Self {
        let is_retryable = matches!(
            kind,
            LocalSlmErrorKind::RuntimeBusy | LocalSlmErrorKind::InferenceTimedOut
        );

        Self {
            kind,
            stage,
            model_id: None,
            message: message.into(),
            is_retryable,
        }
    }

    pub fn with_model_id(mut self, model_id: impl Into<String>) -> Self {
        self.model_id = Some(model_id.into());
        self
    }

    pub fn model_not_found(model_id: impl Into<String>) -> Self {
        let m = model_id.into();
        Self::new(
            LocalSlmErrorKind::ModelNotFound,
            InferenceStage::ModelDiscovery,
            format!("Local model '{}' not found on disk", m),
        )
        .with_model_id(m)
    }

    pub fn manifest_invalid(model_id: impl Into<String>, reason: impl Into<String>) -> Self {
        let m = model_id.into();
        Self::new(
            LocalSlmErrorKind::ModelManifestInvalid,
            InferenceStage::ManifestValidation,
            format!("Model manifest invalid for '{}': {}", m, reason.into()),
        )
        .with_model_id(m)
    }

    pub fn integrity_failure(model_id: impl Into<String>, expected: &str, actual: &str) -> Self {
        let m = model_id.into();
        Self::new(
            LocalSlmErrorKind::ModelIntegrityFailure,
            InferenceStage::ManifestValidation,
            format!(
                "SHA-256 integrity check failed for model '{}' (expected: {}, actual: {})",
                m, expected, actual
            ),
        )
        .with_model_id(m)
    }

    pub fn input_too_long(tokens: usize, max: usize) -> Self {
        Self::new(
            LocalSlmErrorKind::InputTooLong,
            InferenceStage::Tokenization,
            format!(
                "Input length of {} tokens exceeds model maximum sequence length of {}",
                tokens, max
            ),
        )
    }

    pub fn runtime_busy(queue_depth: usize) -> Self {
        Self::new(
            LocalSlmErrorKind::RuntimeBusy,
            InferenceStage::Inference,
            format!(
                "Local inference queue is full (queue depth: {}); cannot accept work",
                queue_depth
            ),
        )
    }

    pub fn cancelled() -> Self {
        Self::new(
            LocalSlmErrorKind::InferenceCancelled,
            InferenceStage::Inference,
            "Local inference operation was cancelled",
        )
    }

    pub fn timed_out(timeout_ms: u64) -> Self {
        Self::new(
            LocalSlmErrorKind::InferenceTimedOut,
            InferenceStage::Inference,
            format!("Local inference operation timed out after {} ms", timeout_ms),
        )
    }
}

impl fmt::Display for LocalSlmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{:?} @ {:?}] {}",
            self.kind, self.stage, self.message
        )
    }
}

impl std::error::Error for LocalSlmError {}

