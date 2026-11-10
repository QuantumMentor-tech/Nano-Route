// ============================================================================
// Nano Route - Routing Policy Types & Decision Contracts
// File: src-tauri/src/routing/policy/types.rs
// ============================================================================
// Authoritative data types for final route selection, manual overrides,
// fallback candidate ordering, and explainable routing decisions.
// Strictly decoupled from provider HTTP networking and streaming execution.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::analysis::types::TaskAnalysisResult;
use crate::routing::scoring::types::{CandidateScore, RoutingScoreResult};
use super::config::RoutingPolicyConfig;

pub const DEFAULT_POLICY_VERSION: &str = "nano-route-policy-v1";

/// Mode used to reach the final routing decision.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SelectionMode {
    /// Selected automatically by multi-criteria policy evaluation.
    Automatic,
    /// Selected through an explicit, validated user manual override.
    ManualOverride,
    /// No candidates met hard eligibility or policy threshold constraints.
    NoRouteAvailable,
    /// An explicit manual override was rejected due to capability or health violations.
    OverrideRejected,
    /// Execution blocked by preflight or safety constraints.
    Blocked,
}

impl SelectionMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Automatic => "automatic",
            Self::ManualOverride => "manual_override",
            Self::NoRouteAvailable => "no_route_available",
            Self::OverrideRejected => "override_rejected",
            Self::Blocked => "blocked",
        }
    }
}

/// Lifecycle state of a manual override request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverrideState {
    None,
    Requested,
    Validated,
    Accepted,
    Rejected,
}

/// Specific reasons why a user's manual route override was rejected.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverrideRejectionReason {
    ProviderNotFound { provider_id: String },
    ModelNotFound { model_id: String },
    ModelProviderMismatch { provider_id: String, model_id: String },
    ProviderDisabled { provider_id: String },
    ModelUnavailable { model_id: String },
    MissingRequiredCapability { capability: String },
    ContextLengthExceeded { requested: u64, limit: u64 },
    HealthCheckBlocked { message: String },
    MalformedRequest { message: String },
}

impl OverrideRejectionReason {
    pub fn description(&self) -> String {
        match self {
            Self::ProviderNotFound { provider_id } => {
                format!("Provider '{}' is not registered in the catalog", provider_id)
            }
            Self::ModelNotFound { model_id } => {
                format!("Model '{}' not found in provider catalog", model_id)
            }
            Self::ModelProviderMismatch { provider_id, model_id } => {
                format!("Model '{}' does not belong to provider '{}'", model_id, provider_id)
            }
            Self::ProviderDisabled { provider_id } => {
                format!("Provider '{}' is deactivated in user preferences", provider_id)
            }
            Self::ModelUnavailable { model_id } => {
                format!("Model '{}' is marked deprecated, preview-only, or unavailable", model_id)
            }
            Self::MissingRequiredCapability { capability } => {
                format!("Task requires capability '{}' which the selected model does not support", capability)
            }
            Self::ContextLengthExceeded { requested, limit } => {
                format!("Estimated tokens ({}) exceed model context window ({})", requested, limit)
            }
            Self::HealthCheckBlocked { message } => {
                format!("Provider health check blocked execution: {}", message)
            }
            Self::MalformedRequest { message } => {
                format!("Invalid manual override request: {}", message)
            }
        }
    }
}

/// Explicit user route override specification.
/// Contains only non-secret provider and model identifiers.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManualRouteOverride {
    pub provider_id: String,
    pub model_id: String,
    pub enabled: bool,
    pub reason: Option<String>,
}

/// Result of validating a manual route override specification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OverrideValidationResult {
    pub is_valid: bool,
    pub rejection_reason: Option<OverrideRejectionReason>,
    pub message: String,
}

impl OverrideValidationResult {
    pub fn valid(msg: impl Into<String>) -> Self {
        Self {
            is_valid: true,
            rejection_reason: None,
            message: msg.into(),
        }
    }

    pub fn invalid(reason: OverrideRejectionReason) -> Self {
        let msg = reason.description();
        Self {
            is_valid: false,
            rejection_reason: Some(reason),
            message: msg,
        }
    }
}

/// Selected primary route candidate descriptor.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SelectedRouteCandidate {
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub score: Option<f64>,
    pub selection_margin: Option<f64>,
    pub context_window: u32,
}

/// Post-policy eligible fallback candidate prepared for resilient failover.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FallbackCandidate {
    pub rank: usize,
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub score: f64,
    pub reason: String,
}

/// Status of an individual candidate within the policy ranking audit trail.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CandidateSelectionStatus {
    SelectedPrimary,
    EligibleFallback,
    DisqualifiedHardConstraint,
    FilteredPolicyThreshold,
    OverrideRejectedConflict,
}

/// Comprehensive candidate entry in the diagnostic policy ranking trail.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RankedCandidate {
    pub rank: usize,
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub score: Option<f64>,
    pub status: CandidateSelectionStatus,
    pub rejection_reasons: Vec<String>,
}

/// Structured explanation of the factors leading to the routing decision.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingDecisionExplanation {
    pub mode: SelectionMode,
    pub summary: String,
    pub primary_reason: String,
    pub score_reason: Option<String>,
    pub policy_reason: Option<String>,
    pub override_reason: Option<String>,
    pub eligibility_reason: Option<String>,
    pub fallback_reason: Option<String>,
}

/// Multi-source confidence metadata for policy evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingConfidenceMetadata {
    pub slm_analysis_confidence: Option<f64>,
    pub selected_score: Option<f64>,
    pub selection_margin: Option<f64>,
    pub is_ambiguous: bool,
}

/// Operational diagnostics and performance measurements of the policy evaluation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingPolicyDiagnostics {
    pub total_candidates_evaluated: usize,
    pub eligible_candidates_count: usize,
    pub policy_filtered_count: usize,
    pub decision_duration_ms: u64,
    pub policy_version: String,
}

/// Resolution metadata for manual override processing.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OverrideResolution {
    pub requested_provider_id: String,
    pub requested_model_id: String,
    pub state: OverrideState,
    pub reason: String,
}

/// Final authoritative route decision produced by Step 30.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingDecision {
    pub decision_id: String,
    pub request_id: String,
    pub policy_version: String,
    pub scoring_algorithm_version: String,
    pub selection_mode: SelectionMode,
    pub selected_candidate: Option<SelectedRouteCandidate>,
    pub fallback_candidates: Vec<FallbackCandidate>,
    pub candidate_ranking: Vec<RankedCandidate>,
    pub decision_reason: String,
    pub structured_explanation: RoutingDecisionExplanation,
    pub override_metadata: Option<OverrideResolution>,
    pub confidence_metadata: RoutingConfidenceMetadata,
    pub diagnostics: RoutingPolicyDiagnostics,
    pub generated_at_ms: u64,
}

/// Input request submitted to the Routing Policy Engine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingPolicyRequest {
    pub request_id: Option<String>,
    pub scoring_result: Option<RoutingScoreResult>,
    pub task_analysis: Option<TaskAnalysisResult>,
    pub manual_override: Option<ManualRouteOverride>,
    pub estimated_input_tokens: Option<u64>,
    pub estimated_output_tokens: Option<u64>,
}

