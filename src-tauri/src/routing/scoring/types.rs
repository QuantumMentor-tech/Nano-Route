// ============================================================================
// Nano Route - Routing Scoring Types
// File: src-tauri/src/routing/scoring/types.rs
// ============================================================================
// Authoritative data types for multi-dimensional candidate scoring, eligibility
// filtering, score breakdowns, adjustments, and explainable scoring results.
// Strictly decoupled from final routing policy and dispatch (Step 30).
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::analysis::types::TaskAnalysisResult;
use super::weights::RoutingScoringWeights;

/// Discrete reasons why a provider/model candidate is disqualified from eligibility.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IneligibilityReason {
    ProviderNotFound { provider_id: String },
    AdapterNotImplemented { provider_id: String },
    ProviderDisabled { provider_id: String },
    CredentialMissing { provider_id: String },
    EndpointMisconfigured { message: String },
    ModelNotFound { model_id: String },
    ModelRetiredOrUnavailable { model_id: String },
    MissingRequiredCapability { capability: String },
    ContextLengthExceeded { requested: u64, limit: u64 },
    AuthenticationFailed { provider_id: String },
    RateLimited { provider_id: String, retry_after_ms: Option<u64> },
    ProviderUnavailable { provider_id: String },
    ModelRuntimeUnavailable { model_id: String },
    PreflightBlocked { reason: String },
    ExplicitlyExcluded { reason: String },
}

impl IneligibilityReason {
    pub fn description(&self) -> String {
        match self {
            Self::ProviderNotFound { provider_id } => {
                format!("Provider '{}' is not registered in the catalog", provider_id)
            }
            Self::AdapterNotImplemented { provider_id } => {
                format!("Native runtime adapter for provider '{}' is not implemented", provider_id)
            }
            Self::ProviderDisabled { provider_id } => {
                format!("Provider '{}' is deactivated in user preferences", provider_id)
            }
            Self::CredentialMissing { provider_id } => {
                format!("API credential for provider '{}' is not configured", provider_id)
            }
            Self::EndpointMisconfigured { message } => {
                format!("Custom endpoint misconfigured: {}", message)
            }
            Self::ModelNotFound { model_id } => {
                format!("Model '{}' not found in provider catalog", model_id)
            }
            Self::ModelRetiredOrUnavailable { model_id } => {
                format!("Model '{}' is marked deprecated, preview-only, or unavailable", model_id)
            }
            Self::MissingRequiredCapability { capability } => {
                format!("Task requires capability '{}' which candidate does not support", capability)
            }
            Self::ContextLengthExceeded { requested, limit } => {
                format!("Estimated tokens ({}) exceed candidate context window ({})", requested, limit)
            }
            Self::AuthenticationFailed { provider_id } => {
                format!("Provider '{}' authentication failed during preflight health check", provider_id)
            }
            Self::RateLimited { provider_id, retry_after_ms } => {
                match retry_after_ms {
                    Some(ms) => format!("Provider '{}' is actively rate limited (retry in {}ms)", provider_id, ms),
                    None => format!("Provider '{}' is actively rate limited", provider_id),
                }
            }
            Self::ProviderUnavailable { provider_id } => {
                format!("Provider '{}' service is currently unavailable or unhealthy", provider_id)
            }
            Self::ModelRuntimeUnavailable { model_id } => {
                format!("Model runtime for '{}' is currently unavailable", model_id)
            }
            Self::PreflightBlocked { reason } => {
                format!("Preflight evaluation blocked candidate: {}", reason)
            }
            Self::ExplicitlyExcluded { reason } => {
                format!("Candidate explicitly excluded: {}", reason)
            }
        }
    }
}

/// Evaluation of candidate hard eligibility constraints.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CandidateEligibility {
    pub is_eligible: bool,
    pub ineligibility_reasons: Vec<IneligibilityReason>,
}

impl CandidateEligibility {
    pub fn eligible() -> Self {
        Self {
            is_eligible: true,
            ineligibility_reasons: Vec::new(),
        }
    }

    pub fn ineligible(reasons: Vec<IneligibilityReason>) -> Self {
        Self {
            is_eligible: false,
            ineligibility_reasons: reasons,
        }
    }
}

/// Normalized [0.0, 1.0] score breakdown across all analytical scoring dimensions.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScoreBreakdown {
    pub intent_fit: f64,
    pub complexity_fit: f64,
    pub domain_fit: f64,
    pub capability_fit: f64,
    pub context_fit: f64,
    pub modality_fit: f64,
    pub preference_fit: f64,
    pub cost_fit: f64,
    pub latency_fit: f64,
    pub reliability_fit: f64,
    pub profile_fit: f64,
}

/// An audit entry representing a score modification or bonus/penalty.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ScoreAdjustment {
    pub dimension: String,
    pub delta: f64,
    pub reason: String,
}

/// Fully evaluated provider/model candidate suitability score.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CandidateScore {
    pub provider_id: String,
    pub model_id: String,
    pub display_name: String,
    pub is_eligible: bool,
    pub ineligibility_reasons: Vec<IneligibilityReason>,
    pub total_score: Option<f64>,
    pub breakdown: Option<ScoreBreakdown>,
    pub adjustments: Vec<ScoreAdjustment>,
    pub explanation: String,
    pub context_window: u32,
    pub pricing_known: bool,
    pub latency_known: bool,
}

/// Input request for multi-candidate scoring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingScoreRequest {
    pub request_id: Option<String>,
    pub task_analysis: TaskAnalysisResult,
    pub required_capabilities_override: Option<Vec<String>>,
    pub preferred_providers: Option<Vec<String>>,
    pub estimated_input_tokens: Option<u64>,
    pub estimated_output_tokens: Option<u64>,
    pub max_candidates: Option<usize>,
}

/// Aggregated result of routing scoring across all evaluated candidates.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingScoreResult {
    pub request_id: String,
    pub candidates: Vec<CandidateScore>,
    pub eligible_count: usize,
    pub ineligible_count: usize,
    pub evaluated_candidates_count: usize,
    pub weights_applied: RoutingScoringWeights,
    pub scoring_latency_ms: u64,
    pub explanation_summary: String,
}

/// Diagnostic status of the Routing Scoring Engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingScoringStatus {
    pub is_available: bool,
    pub registered_models_count: usize,
    pub configured_profiles_count: usize,
    pub active_weights: RoutingScoringWeights,
    pub last_scoring_latency_ms: Option<u64>,
}

