// ============================================================================
// Nano Route - Routing Policy Module
// File: src-tauri/src/routing/policy/mod.rs
// ============================================================================
// Authoritative routing policy engine, manual model override validation,
// deterministic primary candidate selection, and ordered fallback planning.
// Strictly decoupled from network execution and failover dispatch (Step 32+).
// ============================================================================

pub mod config;
pub mod engine;
pub mod errors;
pub mod override_evaluator;
pub mod selection;
#[cfg(test)]
pub mod tests;
pub mod types;

pub use config::RoutingPolicyConfig;
pub use engine::RoutingPolicyEngine;
pub use errors::{RoutingPolicyError, RoutingPolicyErrorKind};
pub use override_evaluator::ManualOverrideEvaluator;
pub use selection::PolicySelector;
pub use types::{
    CandidateSelectionStatus, FallbackCandidate, ManualRouteOverride, OverrideRejectionReason,
    OverrideResolution, OverrideState, OverrideValidationResult, RankedCandidate,
    RoutingConfidenceMetadata, RoutingDecision, RoutingDecisionExplanation,
    RoutingPolicyDiagnostics, RoutingPolicyRequest, SelectedRouteCandidate, SelectionMode,
    DEFAULT_POLICY_VERSION,
};

