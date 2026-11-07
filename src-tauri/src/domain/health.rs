//! Health Domain Models
//! Pure domain representation of native core and subsystem operational readiness.

use serde::{Deserialize, Serialize};

/// Operational status of the native application core.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CoreStatus {
    Ready,
    Degraded,
    Initializing,
    Error,
}

impl CoreStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            CoreStatus::Ready => "Ready",
            CoreStatus::Degraded => "Degraded",
            CoreStatus::Initializing => "Initializing",
            CoreStatus::Error => "Error",
        }
    }
}

/// Operational state of a discrete native subsystem.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SubsystemHealth {
    pub name: String,
    pub ready: bool,
    pub details: Option<String>,
}

impl SubsystemHealth {
    pub fn new(name: impl Into<String>, ready: bool, details: Option<impl Into<String>>) -> Self {
        Self {
            name: name.into(),
            ready,
            details: details.map(Into::into),
        }
    }
}

/// Comprehensive health report for the native application.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HealthReport {
    pub status: CoreStatus,
    pub message: String,
    pub subsystems: Vec<SubsystemHealth>,
    pub timestamp: String,
}

impl HealthReport {
    pub fn is_ready(&self) -> bool {
        self.status == CoreStatus::Ready
    }
}

