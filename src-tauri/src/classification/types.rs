// ============================================================================
// Nano Route - Intent Classification Types
// File: src-tauri/src/classification/types.rs
// ============================================================================
// Authoritative types for semantic task classification, candidate ranking,
// ambiguity modeling, runtime availability, and safe IPC representations.
// Provider-neutral; contains zero cloud provider targets or credentials.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::inference::types::LocalRuntimeState;

/// Canonical task intent taxonomy representing the primary requested workload.
/// Provider-neutral: describes WHAT task the user wants, NOT WHO executes it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserIntent {
    /// Writing, refactoring, designing, and inspecting software architectures.
    SoftwareEngineering,
    /// Troubleshooting errors, investigating bugs, stack traces, and crashes.
    CodeDebugging,
    /// Formal mathematical proofs, arithmetic, logic, and multi-step reasoning.
    ReasoningMath,
    /// Fast everyday conversational dialog, chit-chat, greetings, and generic Q&A.
    GeneralConversation,
    /// Large-context information gathering, literature survey, and comparative queries.
    ResearchRetrieval,
    /// Nuanced, long-form creative or professional writing, drafting, and editing.
    Writing,
    /// Processing tabular datasets, calculating statistical aggregations, and extracting metrics.
    DataAnalysis,
    /// Translating text between human natural languages.
    Translation,
    /// Condensing long documents, transcripts, or conversations into concise summaries.
    Summarization,
    /// Brainstorming, poetry, fiction, roleplay, and creative ideation.
    CreativeGeneration,
    /// A clearly articulated task that falls outside the primary canonical taxonomy.
    Other,
    /// Uncertain, ambiguous, below confidence threshold, or malformed input.
    Unknown,
}

impl UserIntent {
    /// Returns the stable, machine-readable canonical identifier string.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SoftwareEngineering => "software_engineering",
            Self::CodeDebugging => "code_debugging",
            Self::ReasoningMath => "reasoning_math",
            Self::GeneralConversation => "general_conversation",
            Self::ResearchRetrieval => "research_retrieval",
            Self::Writing => "writing",
            Self::DataAnalysis => "data_analysis",
            Self::Translation => "translation",
            Self::Summarization => "summarization",
            Self::CreativeGeneration => "creative_generation",
            Self::Other => "other",
            Self::Unknown => "unknown",
        }
    }

    /// Returns the human-readable display label for presentation surfaces.
    pub fn display_label(&self) -> &'static str {
        match self {
            Self::SoftwareEngineering => "Software Engineering",
            Self::CodeDebugging => "Code Debugging",
            Self::ReasoningMath => "Reasoning & Math",
            Self::GeneralConversation => "General Conversation",
            Self::ResearchRetrieval => "Research & Retrieval",
            Self::Writing => "Long-Form Writing",
            Self::DataAnalysis => "Data Analysis",
            Self::Translation => "Translation",
            Self::Summarization => "Summarization",
            Self::CreativeGeneration => "Creative Generation",
            Self::Other => "Other Workload",
            Self::Unknown => "Unknown / Uncertain",
        }
    }

    /// Parses a canonical string identifier into the typed enum.
    pub fn from_canonical(id: &str) -> Option<Self> {
        match id.trim().to_lowercase().as_str() {
            "software_engineering" | "coding" | "software" => Some(Self::SoftwareEngineering),
            "code_debugging" | "debugging" | "troubleshooting" => Some(Self::CodeDebugging),
            "reasoning_math" | "math" | "reasoning" | "mathematics" => Some(Self::ReasoningMath),
            "general_conversation" | "general" | "conversation" | "chat" => Some(Self::GeneralConversation),
            "research_retrieval" | "research" | "retrieval" | "search" => Some(Self::ResearchRetrieval),
            "writing" | "long_form_writing" | "essay" => Some(Self::Writing),
            "data_analysis" | "analysis" | "data" | "tabular" => Some(Self::DataAnalysis),
            "translation" | "translate" => Some(Self::Translation),
            "summarization" | "summary" => Some(Self::Summarization),
            "creative_generation" | "creative" | "story" => Some(Self::CreativeGeneration),
            "other" => Some(Self::Other),
            "unknown" => Some(Self::Unknown),
            _ => None,
        }
    }
}

/// Ambiguity assessment for a classification evaluation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AmbiguityState {
    /// High-confidence single-intent match with adequate margin over alternatives.
    NotAmbiguous,
    /// Score margin between top candidates is narrow; intent cannot be decisively separated.
    Ambiguous,
    /// Two or more distinct candidate intents exceed the multi-intent threshold.
    MultiIntent,
    /// Overall scores are below threshold or input is completely undecidable.
    Unknown,
}

/// Operational availability of the intent classification engine.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClassifierAvailability {
    /// Ready for on-device inference and classification.
    Available,
    /// Model artifact is not installed on disk.
    NotInstalled,
    /// Model manifest or binary integrity failed verification.
    ModelInvalid,
    /// Underlying ONNX/SLM runtime is uninitialized or failed.
    RuntimeUnavailable,
    /// Loaded model does not declare intent classification capability.
    ModelIncompatible,
    /// Unrecoverable classification engine error.
    Failed,
}

/// A candidate intent with normalized probability and raw score.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IntentCandidate {
    /// Classified intent category.
    pub intent: UserIntent,
    /// Normalized calibrated confidence score in range [0.0, 1.0].
    pub normalized_score: f64,
    /// Raw unnormalized model output score or logit.
    pub raw_score: f32,
}

/// Request to classify the semantic task intent of user input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentClassificationRequest {
    /// Optional correlation ID for this classification request.
    pub request_id: Option<String>,
    /// Primary text prompt to classify.
    pub text: String,
    /// Optional limited recent conversation context turns (max 2-3 turns).
    pub conversation_context: Option<Vec<String>>,
    /// Optional language hint (e.g., "en", "ur").
    pub language_hint: Option<String>,
}

/// Authoritative classification result produced by the local SLM engine.
/// Strictly immutable once produced; provider-neutral.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IntentClassificationResult {
    /// Request correlation ID.
    pub request_id: String,
    /// Primary classified workload intent.
    pub primary_intent: UserIntent,
    /// Normalized confidence score in [0.0, 1.0].
    pub confidence: f64,
    /// Alternative intent candidates above threshold, ordered descending by score.
    pub alternatives: Vec<IntentCandidate>,
    /// Ambiguity assessment.
    pub ambiguity: AmbiguityState,
    /// Model identifier that executed inference.
    pub classifier_model_id: String,
    /// Model semantic version.
    pub classifier_model_version: String,
    /// Label schema version used to map outputs.
    pub classifier_schema_version: String,
    /// On-device neural inference duration in milliseconds.
    pub inference_latency_ms: u64,
    /// Total classification pipeline latency (tokenization + inference + mapping) in ms.
    pub total_latency_ms: u64,
    /// Deterministic, feature-based machine explanation of the outcome.
    pub explanation: String,
}

/// Read-safe status DTO for diagnostics and monitoring.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClassifierStatus {
    pub availability: ClassifierAvailability,
    pub model_id: Option<String>,
    pub model_version: Option<String>,
    pub schema_version: String,
    pub supported_intents: Vec<UserIntent>,
    pub runtime_state: LocalRuntimeState,
    pub last_latency_ms: Option<u64>,
    pub last_error: Option<String>,
}

