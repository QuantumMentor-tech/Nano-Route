// ============================================================================
// Nano Route - Routing Explanation Module
// File: src-tauri/src/routing/explanation/mod.rs
// ============================================================================
// Explainability subsystem exposing structured route breakdowns, confidence
// semantics, task analysis summaries, and selection margins.
// ============================================================================

pub mod service;
pub mod types;

pub use service::RoutingExplanationService;
pub use types::{
    AlternativeCandidateExplanation, ConfidenceSummaryExplanation, ExplanationEvidence,
    PolicyFactorExplanation, RoutingExplanation, ScoreAdjustmentExplanation,
    ScoreBreakdownExplanation, ScoreDimensionExplanation, SelectedRouteExplanation,
    SelectionMarginExplanation, TaskAnalysisSummary, TaskRequirementExplanation,
    DEFAULT_EXPLANATION_SCHEMA_VERSION,
};

