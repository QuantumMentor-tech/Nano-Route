// ============================================================================
// Nano Route - Local Semantic Intent Classification Engine
// File: src-tauri/src/classification/mod.rs
// ============================================================================
// Exposes the authoritative local intent classifier, taxonomy definitions,
// label mapper, policy evaluation, and gold dataset benchmarking.
// Provider-neutral; contains zero cloud provider logic, API keys, or routing scoring.
// ============================================================================

pub mod errors;
pub mod eval;
pub mod label_map;
pub mod mapper;
pub mod policy;
pub mod preprocessor;
pub mod service;
pub mod taxonomy;
#[cfg(test)]
pub mod tests;
pub mod types;

pub use errors::{ClassificationError, ClassificationErrorKind, ClassificationStage};
pub use eval::{ClassifierEvaluationReport, GOLD_EVALUATION_SET};
pub use label_map::ClassifierLabelMap;
pub use policy::ClassificationPolicy;
pub use service::IntentClassifier;
pub use taxonomy::{get_intent_definition, ALL_INTENTS};
pub use types::{
    AmbiguityState, ClassifierAvailability, ClassifierStatus, IntentCandidate,
    IntentClassificationRequest, IntentClassificationResult, UserIntent,
};

