//! Nano Route — Unified Error Handling Subsystem
//!
//! Responsibility:
//! - Standardized application and service error hierarchy.
//! - Normalization of domain and infrastructure failures into safe IPC errors.
//! - Prevents leaking internal paths, database connection strings, or secrets.

use serde::Serialize;
use std::fmt;

/// Unified Application Error Hierarchy
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    /// Service is temporarily unavailable or degraded.
    ServiceUnavailable(String),
    /// Application initialization or bootstrapping failed.
    InitializationFailed(String),
    /// Invalid command argument or IPC request payload.
    InvalidInput(String),
    /// Internal unexpected error with sanitized diagnostic message.
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::ServiceUnavailable(msg) => write!(f, "Service unavailable: {}", msg),
            AppError::InitializationFailed(msg) => write!(f, "Initialization failed: {}", msg),
            AppError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl From<AppError> for String {
    fn from(err: AppError) -> Self {
        err.to_string()
    }
}
