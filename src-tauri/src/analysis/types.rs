// ============================================================================
// Nano Route - Task Analysis Types
// File: src-tauri/src/analysis/types.rs
// ============================================================================
// Authoritative types for task complexity, domain taxonomy, task capability
// requirements, evidence provenance, conflict resolution, and analysis results.
// Strictly provider-neutral: describes WHAT the task requires, NOT WHO executes it.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::classification::types::{AmbiguityState, UserIntent};

pub const DEFAULT_ANALYSIS_SCHEMA_VERSION: &str = "nano-route-analysis-schema-v1";

/// Qualitative workload complexity level.
/// Describes the computational and reasoning depth required, NOT provider quality.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskComplexity {
    /// Single-step lookups, simple greetings, brief definitions, single-word translation.
    Trivial,
    /// Simple summarization, straightforward Q&A, short single-function generation without constraints.
    Low,
    /// Multi-condition comparison, structured parsing, multi-paragraph document drafting.
    Moderate,
    /// Multi-file refactoring, formal mathematical proofs, complex systems architecture, deep debugging.
    High,
    /// Multi-stage multi-domain technical workflows, exhaustive verification, massive context with strict constraints.
    VeryHigh,
    /// Task is insufficiently specified, conflicting, or undecidable.
    Unknown,
}

impl TaskComplexity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Trivial => "trivial",
            Self::Low => "low",
            Self::Moderate => "moderate",
            Self::High => "high",
            Self::VeryHigh => "very_high",
            Self::Unknown => "unknown",
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            Self::Trivial => "Trivial (Direct)",
            Self::Low => "Low (Simple)",
            Self::Moderate => "Moderate (Standard)",
            Self::High => "High (Demanding)",
            Self::VeryHigh => "Very High (Complex)",
            Self::Unknown => "Unknown Complexity",
        }
    }

    pub fn from_str_canonical(s: &str) -> Option<Self> {
        match s.trim().to_lowercase().as_str() {
            "trivial" => Some(Self::Trivial),
            "low" => Some(Self::Low),
            "moderate" | "medium" => Some(Self::Moderate),
            "high" => Some(Self::High),
            "very_high" | "expert" | "veryhigh" => Some(Self::VeryHigh),
            "unknown" => Some(Self::Unknown),
            _ => None,
        }
    }
}

/// Knowledge and operational domain taxonomy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskDomain {
    SoftwareEngineering,
    Mathematics,
    Research,
    LongFormWriting,
    Business,
    DataAnalysis,
    Education,
    Translation,
    Planning,
    TechnicalDocumentation,
    Creative,
    General,
    Other,
    Unknown,
}

impl TaskDomain {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::SoftwareEngineering => "software_engineering",
            Self::Mathematics => "mathematics",
            Self::Research => "research",
            Self::LongFormWriting => "long_form_writing",
            Self::Business => "business",
            Self::DataAnalysis => "data_analysis",
            Self::Education => "education",
            Self::Translation => "translation",
            Self::Planning => "planning",
            Self::TechnicalDocumentation => "technical_documentation",
            Self::Creative => "creative",
            Self::General => "general",
            Self::Other => "other",
            Self::Unknown => "unknown",
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            Self::SoftwareEngineering => "Software Engineering",
            Self::Mathematics => "Mathematics & Logic",
            Self::Research => "Academic & Technical Research",
            Self::LongFormWriting => "Long-Form Writing",
            Self::Business => "Business & Finance",
            Self::DataAnalysis => "Data & Statistical Analysis",
            Self::Education => "Education & Tutoring",
            Self::Translation => "Linguistic Translation",
            Self::Planning => "Project & Strategic Planning",
            Self::TechnicalDocumentation => "Technical Documentation",
            Self::Creative => "Creative Writing & Ideation",
            Self::General => "General Knowledge",
            Self::Other => "Other Domain",
            Self::Unknown => "Unknown Domain",
        }
    }

    pub fn from_canonical(id: &str) -> Option<Self> {
        match id.trim().to_lowercase().as_str() {
            "software_engineering" | "software" | "coding" => Some(Self::SoftwareEngineering),
            "mathematics" | "math" | "logic" => Some(Self::Mathematics),
            "research" | "academic" => Some(Self::Research),
            "long_form_writing" | "writing" | "prose" => Some(Self::LongFormWriting),
            "business" | "finance" | "commercial" => Some(Self::Business),
            "data_analysis" | "data" | "tabular" => Some(Self::DataAnalysis),
            "education" | "tutoring" => Some(Self::Education),
            "translation" | "linguistics" => Some(Self::Translation),
            "planning" | "roadmap" => Some(Self::Planning),
            "technical_documentation" | "docs" => Some(Self::TechnicalDocumentation),
            "creative" | "fiction" | "poetry" => Some(Self::Creative),
            "general" | "chat" => Some(Self::General),
            "other" => Some(Self::Other),
            "unknown" => Some(Self::Unknown),
            _ => None,
        }
    }
}

/// Provenance identifying the evidence source for an analytical dimension.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisSource {
    /// Derived from on-device local neural SLM output tensor.
    Model,
    /// Explicitly and directly mandated in user input (e.g., "return valid JSON", "cite sources").
    ExplicitUserRequirement,
    /// Derived from unambiguous structural elements (code fences, stack traces, formulas).
    StrongStructuralSignal,
    /// Deterministic pattern/keyword heuristic.
    Heuristic,
    /// Deduced from cross-dimensional synthesis (e.g. intent + domain).
    Derived,
    /// Unknown provenance or uncertain origin.
    Unknown,
}

impl AnalysisSource {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Model => "model",
            Self::ExplicitUserRequirement => "explicit_user_requirement",
            Self::StrongStructuralSignal => "strong_structural_signal",
            Self::Heuristic => "heuristic",
            Self::Derived => "derived",
            Self::Unknown => "unknown",
        }
    }

    /// Precedence rank: Higher value indicates higher authority when resolving conflicts.
    pub fn precedence_rank(&self) -> u8 {
        match self {
            Self::ExplicitUserRequirement => 5,
            Self::Model => 4,
            Self::StrongStructuralSignal => 3,
            Self::Heuristic => 2,
            Self::Derived => 1,
            Self::Unknown => 0,
        }
    }
}

/// Operational capability requirement demanded by the user's task.
/// Note: Distinct from ProviderCapability (Step 25). Describes task demand, not provider supply.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskCapabilityRequirement {
    TextGeneration,
    LongContext,
    MultiTurnContext,
    CodeUnderstanding,
    CodeGeneration,
    MathematicalReasoning,
    DeepReasoning,
    StructuredOutput,
    DocumentAnalysis,
    LargeDocumentIngestion,
    WebRetrieval,
    ImageInput,
    AudioInput,
    VideoInput,
    ToolCalling,
    FileHandling,
    CitationSupport,
    SearchGrounding,
    Translation,
    Summarization,
}

impl TaskCapabilityRequirement {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::TextGeneration => "text_generation",
            Self::LongContext => "long_context",
            Self::MultiTurnContext => "multi_turn_context",
            Self::CodeUnderstanding => "code_understanding",
            Self::CodeGeneration => "code_generation",
            Self::MathematicalReasoning => "mathematical_reasoning",
            Self::DeepReasoning => "deep_reasoning",
            Self::StructuredOutput => "structured_output",
            Self::DocumentAnalysis => "document_analysis",
            Self::LargeDocumentIngestion => "large_document_ingestion",
            Self::WebRetrieval => "web_retrieval",
            Self::ImageInput => "image_input",
            Self::AudioInput => "audio_input",
            Self::VideoInput => "video_input",
            Self::ToolCalling => "tool_calling",
            Self::FileHandling => "file_handling",
            Self::CitationSupport => "citation_support",
            Self::SearchGrounding => "search_grounding",
            Self::Translation => "translation",
            Self::Summarization => "summarization",
        }
    }

    pub fn display_label(&self) -> &'static str {
        match self {
            Self::TextGeneration => "Text Generation",
            Self::LongContext => "Long Context Window (>16k tokens)",
            Self::MultiTurnContext => "Multi-Turn Conversational Memory",
            Self::CodeUnderstanding => "Code Syntax & Semantics Understanding",
            Self::CodeGeneration => "Source Code Generation",
            Self::MathematicalReasoning => "Mathematical & Symbolic Reasoning",
            Self::DeepReasoning => "Deep Deductive Multi-Step Reasoning",
            Self::StructuredOutput => "Structured Output (JSON/Schema/Table)",
            Self::DocumentAnalysis => "Document Inspection & Synthesis",
            Self::LargeDocumentIngestion => "Large Document Ingestion (>64k tokens)",
            Self::WebRetrieval => "Live External Web Retrieval",
            Self::ImageInput => "Vision / Image Input Analysis",
            Self::AudioInput => "Audio Input Transcription/Analysis",
            Self::VideoInput => "Video Input Multimodal Processing",
            Self::ToolCalling => "External Tool / Function Invocation",
            Self::FileHandling => "Direct File Attachment Processing",
            Self::CitationSupport => "Explicit Grounded Citations & Sources",
            Self::SearchGrounding => "Factual Grounding & Retrieval",
            Self::Translation => "Linguistic Natural Language Translation",
            Self::Summarization => "Condensation & Document Summarization",
        }
    }

    pub fn from_canonical(id: &str) -> Option<Self> {
        match id.trim().to_lowercase().as_str() {
            "text_generation" => Some(Self::TextGeneration),
            "long_context" => Some(Self::LongContext),
            "multi_turn_context" => Some(Self::MultiTurnContext),
            "code_understanding" => Some(Self::CodeUnderstanding),
            "code_generation" => Some(Self::CodeGeneration),
            "mathematical_reasoning" => Some(Self::MathematicalReasoning),
            "deep_reasoning" => Some(Self::DeepReasoning),
            "structured_output" => Some(Self::StructuredOutput),
            "document_analysis" => Some(Self::DocumentAnalysis),
            "large_document_ingestion" => Some(Self::LargeDocumentIngestion),
            "web_retrieval" => Some(Self::WebRetrieval),
            "image_input" => Some(Self::ImageInput),
            "audio_input" => Some(Self::AudioInput),
            "video_input" => Some(Self::VideoInput),
            "tool_calling" => Some(Self::ToolCalling),
            "file_handling" => Some(Self::FileHandling),
            "citation_support" => Some(Self::CitationSupport),
            "search_grounding" => Some(Self::SearchGrounding),
            "translation" => Some(Self::Translation),
            "summarization" => Some(Self::Summarization),
            _ => None,
        }
    }
}

/// Strength / urgency of a capability requirement.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequirementStrength {
    /// Non-negotiable constraint: eventual execution path MUST support this.
    Required,
    /// Preferred or conditionally beneficial capability.
    Preferred,
    /// Explicitly negated or not needed (e.g. "Do not search the web").
    NotRequired,
    /// Uncertain requirement strength.
    Unknown,
}

/// A specific capability requirement assessment with strength, confidence, and source provenance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskCapabilityAssessment {
    pub capability: TaskCapabilityRequirement,
    pub strength: RequirementStrength,
    pub confidence: f64,
    pub source: AnalysisSource,
    pub reason_code: String,
}

/// Domain candidate with confidence and provenance.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DomainCandidate {
    pub domain: TaskDomain,
    pub confidence: f64,
    pub source: AnalysisSource,
}

/// Machine-readable evidence supporting a classification or analytical determination.
/// Never holds raw user prompt text.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnalysisEvidence {
    pub code: String,
    pub description: String,
    pub source: AnalysisSource,
    pub weight: f64,
}

/// Conflict detected between analytical signals.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AnalysisConflict {
    pub dimension: String,
    pub model_signal: Option<String>,
    pub explicit_signal: String,
    pub resolution: String,
}

/// Assessment of overall analysis completeness.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisCompleteness {
    /// All analytical dimensions evaluated with high confidence.
    Complete,
    /// Intent and primary capabilities resolved; secondary dimensions heuristic or partial.
    Partial,
    /// Elevated uncertainty across multiple dimensions.
    Uncertain,
    /// Analysis failed unrecoverably.
    Failed,
}

/// Ambiguity level of the overall task analysis.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AnalysisAmbiguity {
    Low,
    Medium,
    High,
    Unknown,
}

/// Summary of intent classification imported from Step 27.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct IntentSummary {
    pub primary_intent: UserIntent,
    pub confidence: f64,
    pub ambiguity: AmbiguityState,
    pub secondary_intents: Vec<UserIntent>,
}

/// Complexity assessment component of the task analysis.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ComplexityAnalysis {
    pub level: TaskComplexity,
    pub confidence: f64,
    pub source: AnalysisSource,
    pub score: f64,
    pub evidence_codes: Vec<String>,
}

/// Request to perform multi-dimensional task analysis.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskAnalysisRequest {
    pub request_id: Option<String>,
    pub text: String,
    pub conversation_context: Option<Vec<String>>,
    pub attachment_count: Option<usize>,
    pub language_hint: Option<String>,
}

/// Comprehensive, provider-neutral Task Analysis Result produced by Step 28.
/// Strictly immutable once constructed; contains zero cloud provider targets.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskAnalysisResult {
    pub request_id: String,
    pub intent: IntentSummary,
    pub complexity: ComplexityAnalysis,
    pub primary_domain: DomainCandidate,
    pub secondary_domains: Vec<DomainCandidate>,
    pub capabilities: Vec<TaskCapabilityAssessment>,
    pub evidence: Vec<AnalysisEvidence>,
    pub conflicts: Vec<AnalysisConflict>,
    pub ambiguity: AnalysisAmbiguity,
    pub completeness: AnalysisCompleteness,
    pub analyzer_model_id: String,
    pub analyzer_model_version: String,
    pub analysis_schema_version: String,
    pub inference_latency_ms: u64,
    pub total_latency_ms: u64,
    pub explanation: String,
}

/// Read-safe operational status DTO for task analyzer diagnostics.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaskAnalyzerStatus {
    pub is_available: bool,
    pub model_id: Option<String>,
    pub model_version: Option<String>,
    pub schema_version: String,
    pub supported_domains: Vec<TaskDomain>,
    pub supported_capabilities: Vec<TaskCapabilityRequirement>,
    pub last_latency_ms: Option<u64>,
    pub last_error: Option<String>,
}

