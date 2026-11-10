// ============================================================================
// Nano Route - Routing Policy Errors
// File: src-tauri/src/routing/policy/errors.rs
// ============================================================================
// Strongly-typed errors for the Routing Policy Engine.
// ============================================================================

use std::fmt;
use crate::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RoutingPolicyErrorKind {
    InvalidConfiguration,
    MissingInput,
    StaleData,
    ProviderNotFound,
    ModelNotFound,
    Internal,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RoutingPolicyError {
    pub kind: RoutingPolicyErrorKind,
    pub message: String,
}

impl RoutingPolicyError {
    pub fn new(kind: RoutingPolicyErrorKind, msg: impl Into<String>) -> Self {
        Self {
            kind,
            message: msg.into(),
        }
    }

    pub fn invalid_config(msg: impl Into<String>) -> Self {
        Self::new(RoutingPolicyErrorKind::InvalidConfiguration, msg)
    }

    pub fn missing_input(msg: impl Into<String>) -> Self {
        Self::new(RoutingPolicyErrorKind::MissingInput, msg)
    }

    pub fn stale_data(msg: impl Into<String>) -> Self {
        Self::new(RoutingPolicyErrorKind::StaleData, msg)
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::new(RoutingPolicyErrorKind::Internal, msg)
    }
}

impl fmt::Display for RoutingPolicyError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Routing Policy Error: {}", self.message)
    }
}

impl std::error::Error for RoutingPolicyError {}

impl From<AppError> for RoutingPolicyError {
    fn from(err: AppError) -> Self {
        match err {
            AppError::InvalidInput(msg) => Self::invalid_config(msg),
            other => Self::internal(other.to_string()),
        }
    }
}

impl From<RoutingPolicyError> for AppError {
    fn from(err: RoutingPolicyError) -> Self {
        match err.kind {
            RoutingPolicyErrorKind::InvalidConfiguration
            | RoutingPolicyErrorKind::MissingInput => AppError::InvalidInput(err.message),
            RoutingPolicyErrorKind::StaleData => AppError::PreflightBlocked(err.message),
            RoutingPolicyErrorKind::ProviderNotFound
            | RoutingPolicyErrorKind::ModelNotFound => AppError::NotFound(err.message),
            RoutingPolicyErrorKind::Internal => AppError::Internal(err.message),
        }
    }
}

