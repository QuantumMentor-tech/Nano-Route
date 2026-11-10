// ============================================================================
// Nano Route - Classification Error Taxonomy
// File: src-tauri/src/classification/errors.rs
// ============================================================================
// Strongly-typed errors for the local semantic intent classification pipeline.
// Tracks execution stage, sanitized error messages, and contains zero prompt text.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;
use crate::inference::errors::{LocalSlmError, LocalSlmErrorKind};

/// Pipeline stage where a classification error occurred.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassificationStage {
    Validation,
    Tokenization,
    Inference,
    OutputValidation,
    LabelMapping,
    PolicyEvaluation,
}

impl ClassificationStage {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Validation => "validation",
            Self::Tokenization => "tokenization",
            Self::Inference => "inference",
            Self::OutputValidation => "output_validation",
            Self::LabelMapping => "label_mapping",
            Self::PolicyEvaluation => "policy_evaluation",
        }
    }
}

/// Typed error kind identifying the root cause of classification failure.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassificationErrorKind {
    /// Input prompt is empty, null, or whitespace-only.
    EmptyInput,
    /// Input token length exceeds local model context window.
    InputTooLong,
    /// Underlying SLM runtime is not running, busy, or uninitialized.
    ClassifierUnavailable,
    /// No local router model package is installed or loaded.
    ClassifierModelMissing,
    /// Loaded model declares an incompatible task type (e.g. text generation, embedding).
    ClassifierModelIncompatible,
    /// No label schema is registered for the specified model and version.
    LabelSchemaMissing,
    /// Model output tensor shape does not match expected label schema count.
    LabelSchemaMismatch,
    /// Model output contains NaN, Infinity, or corrupted tensor dimensions.
    InvalidModelOutput,
    /// Normalization or confidence computation failed numerically.
    InvalidConfidence,
    /// Model output references an unrecognized class index or intent label.
    UnknownIntentLabel,
    /// Inference or classification exceeded the configured deadline.
    ClassificationTimedOut,
    /// Classification task was cooperatively cancelled by user or caller.
    ClassificationCancelled,
    /// Unspecified internal or runtime failure.
    ClassificationFailed,
}

/// Authoritative error struct for the intent classifier.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClassificationError {
    pub kind: ClassificationErrorKind,
    pub stage: ClassificationStage,
    pub message: String,
    pub model_id: Option<String>,
}

impl ClassificationError {
    pub fn new(
        kind: ClassificationErrorKind,
        stage: ClassificationStage,
        message: impl Into<String>,
    ) -> Self {
        Self {
            kind,
            stage,
            message: message.into(),
            model_id: None,
        }
    }

    pub fn with_model_id(mut self, model_id: impl Into<String>) -> Self {
        self.model_id = Some(model_id.into());
        self
    }

    pub fn empty_input() -> Self {
        Self::new(
            ClassificationErrorKind::EmptyInput,
            ClassificationStage::Validation,
            "Input text prompt cannot be empty or whitespace only",
        )
    }

    pub fn input_too_long(tokens: usize, max: usize) -> Self {
        Self::new(
            ClassificationErrorKind::InputTooLong,
            ClassificationStage::Validation,
            format!("Input token count ({}) exceeds maximum model sequence limit of {}", tokens, max),
        )
    }

    pub fn model_missing() -> Self {
        Self::new(
            ClassificationErrorKind::ClassifierModelMissing,
            ClassificationStage::Inference,
            "No local router SLM model is currently loaded in memory",
        )
    }

    pub fn model_incompatible(model_id: &str, task_type: &str) -> Self {
        Self::new(
            ClassificationErrorKind::ClassifierModelIncompatible,
            ClassificationStage::Validation,
            format!(
                "Model '{}' declares incompatible task_type '{}'; expected 'intent_classification'",
                model_id, task_type
            ),
        )
        .with_model_id(model_id)
    }

    pub fn schema_mismatch(model_id: &str, expected: usize, actual: usize) -> Self {
        Self::new(
            ClassificationErrorKind::LabelSchemaMismatch,
            ClassificationStage::LabelMapping,
            format!(
                "Output dimension mismatch for model '{}': expected {} labels, received {}",
                model_id, expected, actual
            ),
        )
        .with_model_id(model_id)
    }

    pub fn invalid_output(msg: impl Into<String>) -> Self {
        Self::new(
            ClassificationErrorKind::InvalidModelOutput,
            ClassificationStage::OutputValidation,
            msg,
        )
    }
}

impl fmt::Display for ClassificationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "[{:?}:{:?}] {}",
            self.stage, self.kind, self.message
        )
    }
}

impl std::error::Error for ClassificationError {}

impl From<LocalSlmError> for ClassificationError {
    fn from(err: LocalSlmError) -> Self {
        let (kind, stage) = match err.kind {
            LocalSlmErrorKind::InputTooLong => (
                ClassificationErrorKind::InputTooLong,
                ClassificationStage::Tokenization,
            ),
            LocalSlmErrorKind::ModelNotFound => (
                ClassificationErrorKind::ClassifierModelMissing,
                ClassificationStage::Inference,
            ),
            LocalSlmErrorKind::InferenceCancelled => (
                ClassificationErrorKind::ClassificationCancelled,
                ClassificationStage::Inference,
            ),
            LocalSlmErrorKind::InferenceTimedOut => (
                ClassificationErrorKind::ClassificationTimedOut,
                ClassificationStage::Inference,
            ),
            LocalSlmErrorKind::RuntimeUnavailable | LocalSlmErrorKind::RuntimeBusy => (
                ClassificationErrorKind::ClassifierUnavailable,
                ClassificationStage::Inference,
            ),
            LocalSlmErrorKind::ModelManifestInvalid | LocalSlmErrorKind::ModelIntegrityFailure => (
                ClassificationErrorKind::ClassifierModelMissing,
                ClassificationStage::Validation,
            ),
            _ => (
                ClassificationErrorKind::ClassificationFailed,
                ClassificationStage::Inference,
            ),
        };

        let mut res = Self::new(kind, stage, err.message);
        if let Some(m) = err.model_id {
            res = res.with_model_id(m);
        }
        res
    }
}

