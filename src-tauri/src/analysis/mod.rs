// ============================================================================
// Nano Route - Task Analysis Engine
// File: src-tauri/src/analysis/mod.rs
// ============================================================================
// Multidimensional task analysis engine evaluating complexity, domain taxonomy,
// and task capability requirements. Strictly provider-neutral.
// ============================================================================

pub mod capabilities;
pub mod complexity;
pub mod conflict;
pub mod domain;
pub mod errors;
pub mod policy;
pub mod service;
#[cfg(test)]
pub mod tests;
pub mod types;

pub use errors::{AnalysisError, AnalysisErrorKind, AnalysisStage};
pub use policy::TaskAnalysisPolicy;
pub use service::TaskAnalyzer;
pub use types::{
    AnalysisAmbiguity, AnalysisCompleteness, AnalysisConflict, AnalysisEvidence, AnalysisSource,
    ComplexityAnalysis, DomainCandidate, IntentSummary, RequirementStrength, TaskAnalysisRequest,
    TaskAnalysisResult, TaskAnalyzerStatus, TaskCapabilityAssessment, TaskCapabilityRequirement,
    TaskComplexity, TaskDomain, DEFAULT_ANALYSIS_SCHEMA_VERSION,
};

