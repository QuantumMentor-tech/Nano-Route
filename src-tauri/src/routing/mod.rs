//! Nano Route — Intelligent Router & Policy Engine
//!
//! Responsibility:
//! - Multi-factor candidate scoring (quality, cost, latency, availability).
//! - Policy evaluation, user preference weighting, and threshold filtering.
//! - Resilient fallback cascade coordination.
//! - Must NOT own UI components, plaintext secret storage, or raw provider HTTP details.

pub mod explanation;
pub mod policy;
pub mod scoring;

pub use explanation::{RoutingExplanation, RoutingExplanationService};
pub use policy::{
    CandidateSelectionStatus, FallbackCandidate, ManualOverrideEvaluator, ManualRouteOverride,
    OverrideRejectionReason, OverrideResolution, OverrideState, OverrideValidationResult,
    PolicySelector, RankedCandidate, RoutingConfidenceMetadata, RoutingDecision,
    RoutingDecisionExplanation, RoutingPolicyConfig, RoutingPolicyDiagnostics,
    RoutingPolicyEngine, RoutingPolicyError, RoutingPolicyErrorKind, RoutingPolicyRequest,
    SelectedRouteCandidate, SelectionMode, DEFAULT_POLICY_VERSION,
};

pub use scoring::{
    CandidateEligibility, CandidateScore, IneligibilityReason, ModelRoutingProfile, ModelTier,
    RoutingScoreRequest, RoutingScoreResult, RoutingScoringEngine, RoutingScoringError,
    RoutingScoringStatus, RoutingScoringWeights, ScoreAdjustment, ScoreBreakdown,
};
