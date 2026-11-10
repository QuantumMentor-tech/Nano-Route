// ============================================================================
// Nano Route - Routing Scoring Errors
// File: src-tauri/src/routing/scoring/errors.rs
// ============================================================================
// Strongly-typed errors for the Routing Scoring Engine.
// ============================================================================

use std::fmt;
use crate::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RoutingScoringErrorKind {
    InvalidInput,
    WeightValidationFailed,
    RegistryError,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RoutingScoringError {
    pub kind: RoutingScoringErrorKind,
    pub message: String,
}

impl RoutingScoringError {
    pub fn new(kind: RoutingScoringErrorKind, msg: impl Into<String>) -> Self {
        Self {
            kind,
            message: msg.into(),
        }
    }

    pub fn invalid_input(msg: impl Into<String>) -> Self {
        Self::new(RoutingScoringErrorKind::InvalidInput, msg)
    }

    pub fn weight_validation(msg: impl Into<String>) -> Self {
        Self::new(RoutingScoringErrorKind::WeightValidationFailed, msg)
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::new(RoutingScoringErrorKind::Internal, msg)
    }
}

impl fmt::Display for RoutingScoringError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Routing Scoring Error: {}", self.message)
    }
}

impl std::error::Error for RoutingScoringError {}

impl From<AppError> for RoutingScoringError {
    fn from(err: AppError) -> Self {
        match err {
            AppError::InvalidInput(msg) => Self::invalid_input(msg),
            other => Self::internal(other.to_string()),
        }
    }
}

impl From<RoutingScoringError> for AppError {
    fn from(err: RoutingScoringError) -> Self {
        match err.kind {
            RoutingScoringErrorKind::InvalidInput
            | RoutingScoringErrorKind::WeightValidationFailed => AppError::InvalidInput(err.message),
            RoutingScoringErrorKind::RegistryError => AppError::NotFound(err.message),
            RoutingScoringErrorKind::Internal => AppError::Internal(err.message),
        }
    }
}

