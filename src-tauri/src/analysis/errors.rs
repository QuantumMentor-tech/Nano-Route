// ============================================================================
// Nano Route - Task Analysis Errors
// File: src-tauri/src/analysis/errors.rs
// ============================================================================
// Strongly-typed errors for the task analysis pipeline (complexity, domain,
// capabilities). Tracks execution stage, sanitized messages, and zero prompt text.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;

use crate::classification::errors::{ClassificationError, ClassificationErrorKind};
use crate::inference::errors::LocalSlmError;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisStage {
    InputValidation,
    IntentClassification,
    ComplexityAnalysis,
    DomainAnalysis,
    CapabilityAnalysis,
    ConflictResolution,
    Synthesis,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisErrorKind {
    AnalysisInputInvalid,
    AnalysisRuntimeUnavailable,
    AnalysisModelMismatch,
    ComplexityUnavailable,
    DomainUnavailable,
    CapabilityAnalysisUnavailable,
    AnalysisOutputInvalid,
    AnalysisPolicyInvalid,
    AnalysisTimedOut,
    AnalysisCancelled,
    AnalysisFailed,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnalysisError {
    pub kind: AnalysisErrorKind,
    pub stage: AnalysisStage,
    pub message: String,
    pub model_id: Option<String>,
}

impl AnalysisError {
    pub fn new(kind: AnalysisErrorKind, stage: AnalysisStage, message: impl Into<String>) -> Self {
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

    pub fn input_invalid(msg: impl Into<String>) -> Self {
        Self::new(AnalysisErrorKind::AnalysisInputInvalid, AnalysisStage::InputValidation, msg)
    }

    pub fn timed_out(msg: impl Into<String>) -> Self {
        Self::new(AnalysisErrorKind::AnalysisTimedOut, AnalysisStage::Synthesis, msg)
    }

    pub fn cancelled() -> Self {
        Self::new(AnalysisErrorKind::AnalysisCancelled, AnalysisStage::Synthesis, "Task analysis was cooperatively cancelled")
    }

    pub fn output_invalid(msg: impl Into<String>) -> Self {
        Self::new(AnalysisErrorKind::AnalysisOutputInvalid, AnalysisStage::Synthesis, msg)
    }
}

impl fmt::Display for AnalysisError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{:?}:{:?}] {}", self.stage, self.kind, self.message)
    }
}

impl std::error::Error for AnalysisError {}

impl From<ClassificationError> for AnalysisError {
    fn from(err: ClassificationError) -> Self {
        let kind = match err.kind {
            ClassificationErrorKind::EmptyInput | ClassificationErrorKind::InputTooLong => {
                AnalysisErrorKind::AnalysisInputInvalid
            }
            ClassificationErrorKind::ClassifierUnavailable | ClassificationErrorKind::ClassifierModelMissing => {
                AnalysisErrorKind::AnalysisRuntimeUnavailable
            }
            ClassificationErrorKind::ClassifierModelIncompatible => {
                AnalysisErrorKind::AnalysisModelMismatch
            }
            ClassificationErrorKind::ClassificationCancelled => {
                AnalysisErrorKind::AnalysisCancelled
            }
            ClassificationErrorKind::ClassificationTimedOut => {
                AnalysisErrorKind::AnalysisTimedOut
            }
            _ => AnalysisErrorKind::AnalysisFailed,
        };

        let mut res = Self::new(kind, AnalysisStage::IntentClassification, err.message);
        if let Some(m) = err.model_id {
            res = res.with_model_id(m);
        }
        res
    }
}

impl From<LocalSlmError> for AnalysisError {
    fn from(err: LocalSlmError) -> Self {
        let class_err = ClassificationError::from(err);
        Self::from(class_err)
    }
}

