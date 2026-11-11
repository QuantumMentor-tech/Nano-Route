// ============================================================================
// Nano Route - Automatic Failover & Fallback Engine Types
// File: src-tauri/src/reliability/types.rs
// ============================================================================
// Authoritative data types, attempt structures, and result contracts
// for the Step 37 automatic failover & fallback execution subsystem.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::errors::{ErrorCategory, ErrorEnvelope};

pub const DEFAULT_FAILOVER_POLICY_VERSION: &str = "1.0.0";

/// Final resolution status of a logical request's failover lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FailoverFinalStatus {
    /// Succeeded on primary route without requiring failover.
    NotRequired,
    /// Successfully recovered and completed via an eligible fallback candidate.
    Succeeded,
    /// All eligible fallback candidates were attempted and failed, or none qualified.
    Exhausted,
    /// Execution was terminated by user or system cancellation during failover.
    Cancelled,
    /// Failover was explicitly rejected (e.g. strict manual override or non-eligible failure).
    Rejected,
}

impl FailoverFinalStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::NotRequired => "not_required",
            Self::Succeeded => "succeeded",
            Self::Exhausted => "exhausted",
            Self::Cancelled => "cancelled",
            Self::Rejected => "rejected",
        }
    }
}

/// Operational state of an individual physical execution attempt.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AttemptStatus {
    Running,
    Succeeded,
    Failed,
    Cancelled,
    RejectedBeforeExecution,
}

impl AttemptStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Running => "running",
            Self::Succeeded => "succeeded",
            Self::Failed => "failed",
            Self::Cancelled => "cancelled",
            Self::RejectedBeforeExecution => "rejected_before_execution",
        }
    }
}

/// Non-secret audit and telemetry record of a single provider attempt within a logical request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailoverAttempt {
    pub attempt_id: String,
    pub attempt_number: u32,
    pub provider_id: String,
    pub model_id: String,
    pub started_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ended_at_ms: Option<u64>,
    pub status: AttemptStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_category: Option<ErrorCategory>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prompt_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completion_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
}

/// Precise reason a potential fallback candidate was disqualified before physical dispatch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateRejectionReason {
    AlreadyAttempted { provider_id: String, model_id: String },
    ProviderNotFound { provider_id: String },
    ProviderDisabled { provider_id: String },
    CredentialMissing { provider_id: String },
    ModelNotFound { provider_id: String, model_id: String },
    MissingRequiredCapability { capability: String },
    ContextLengthExceeded { requested: u64, limit: u64 },
    OutputLimitExceeded { requested: u64, limit: u64 },
    LocalBudgetExceeded { provider_id: String, spend: f64, limit: f64 },
    ProviderQuotaExhausted { provider_id: String },
    EndpointMisconfigured { provider_id: String, reason: String },
    ManualOverrideStrictConstraint,
    PolicyRejected(String),
}

impl CandidateRejectionReason {
    pub fn description(&self) -> String {
        match self {
            Self::AlreadyAttempted { provider_id, model_id } => {
                format!("Candidate '{}/{}' was already attempted during this logical request", provider_id, model_id)
            }
            Self::ProviderNotFound { provider_id } => {
                format!("Provider '{}' is not registered in the catalog", provider_id)
            }
            Self::ProviderDisabled { provider_id } => {
                format!("Provider '{}' is deactivated in user preferences", provider_id)
            }
            Self::CredentialMissing { provider_id } => {
                format!("No configured credential found in DPAPI vault for provider '{}'", provider_id)
            }
            Self::ModelNotFound { provider_id, model_id } => {
                format!("Model '{}' not found in catalog for provider '{}'", model_id, provider_id)
            }
            Self::MissingRequiredCapability { capability } => {
                format!("Candidate lacks required task capability '{}'", capability)
            }
            Self::ContextLengthExceeded { requested, limit } => {
                format!("Estimated tokens ({}) exceed candidate context window ({})", requested, limit)
            }
            Self::OutputLimitExceeded { requested, limit } => {
                format!("Requested output tokens ({}) exceed candidate maximum ({})", requested, limit)
            }
            Self::LocalBudgetExceeded { provider_id, spend, limit } => {
                format!("Provider '{}' spend (${:.4}) exceeds local monthly budget (${:.4})", provider_id, spend, limit)
            }
            Self::ProviderQuotaExhausted { provider_id } => {
                format!("Provider '{}' reported quota exhaustion", provider_id)
            }
            Self::EndpointMisconfigured { provider_id, reason } => {
                format!("Provider '{}' endpoint configuration invalid: {}", provider_id, reason)
            }
            Self::ManualOverrideStrictConstraint => {
                "User selected explicit manual model override; automatic fallback is disallowed".to_string()
            }
            Self::PolicyRejected(msg) => msg.clone(),
        }
    }
}

/// Comprehensive outcome of failover orchestration for a logical request.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FailoverResult {
    pub logical_request_id: String,
    pub final_provider_id: String,
    pub final_model_id: String,
    pub primary_provider_id: String,
    pub primary_model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub primary_error: Option<ErrorEnvelope>,
    pub failover_used: bool,
    pub attempt_count: usize,
    pub final_status: FailoverFinalStatus,
    pub failover_policy_version: String,
    pub attempts: Vec<FailoverAttempt>,
}

