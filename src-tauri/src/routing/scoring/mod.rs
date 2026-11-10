// ============================================================================
// Nano Route - Routing Scoring Engine Module
// File: src-tauri/src/routing/scoring/mod.rs
// ============================================================================
// Multi-factor candidate scoring, hard eligibility evaluation, normalized
// scoring weights, model routing profiles, and deterministic explainability.
// ============================================================================

pub mod calculator;
pub mod eligibility;
pub mod engine;
pub mod errors;
pub mod explanation;
pub mod profiles;
#[cfg(test)]
pub mod tests;
pub mod types;
pub mod weights;

pub use engine::RoutingScoringEngine;
pub use errors::{RoutingScoringError, RoutingScoringErrorKind};
pub use profiles::{BuiltinRoutingProfiles, ModelRoutingProfile, ModelTier};
pub use types::{
    CandidateEligibility, CandidateScore, IneligibilityReason, RoutingScoreRequest,
    RoutingScoreResult, RoutingScoringStatus, ScoreAdjustment, ScoreBreakdown,
};
pub use weights::RoutingScoringWeights;

