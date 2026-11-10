// ============================================================================
// Nano Route - Canonical Intent Taxonomy
// File: src-tauri/src/classification/taxonomy.rs
// ============================================================================
// Authoritative definitions and metadata for Nano Route's canonical intent
// categories. Derived from the product workload matrix. Provider-neutral.
// ============================================================================

use crate::classification::types::UserIntent;

/// Structural definition and operational metadata for a single intent category.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntentDefinition {
    pub intent: UserIntent,
    pub canonical_id: &'static str,
    pub display_name: &'static str,
    pub description: &'static str,
    pub positive_signals: &'static [&'static str],
    pub negative_signals: &'static [&'static str],
}

/// The complete canonical list of 12 supported intents.
pub const ALL_INTENTS: [UserIntent; 12] = [
    UserIntent::SoftwareEngineering,
    UserIntent::CodeDebugging,
    UserIntent::ReasoningMath,
    UserIntent::GeneralConversation,
    UserIntent::ResearchRetrieval,
    UserIntent::Writing,
    UserIntent::DataAnalysis,
    UserIntent::Translation,
    UserIntent::Summarization,
    UserIntent::CreativeGeneration,
    UserIntent::Other,
    UserIntent::Unknown,
];

/// Returns the full definition metadata for a given intent.
pub fn get_intent_definition(intent: UserIntent) -> IntentDefinition {
    match intent {
        UserIntent::SoftwareEngineering => IntentDefinition {
            intent,
            canonical_id: "software_engineering",
            display_name: "Software Engineering",
            description: "Implementing, refactoring, architecting, or designing code and systems.",
            positive_signals: &["fn", "struct", "class", "impl", "refactor", "algorithm", "architecture", "API", "compile", "Git"],
            negative_signals: &["simple bug fix with stack trace (use code_debugging)", "general programming trivia"],
        },
        UserIntent::CodeDebugging => IntentDefinition {
            intent,
            canonical_id: "code_debugging",
            display_name: "Code Debugging",
            description: "Investigating crashes, panics, compiler errors, stack traces, and runtime bugs.",
            positive_signals: &["stack trace", "panic", "error code", "segfault", "NullPointerException", "leak", "fix this error"],
            negative_signals: &["large architectural refactoring without specific error", "general code generation"],
        },
        UserIntent::ReasoningMath => IntentDefinition {
            intent,
            canonical_id: "reasoning_math",
            display_name: "Reasoning & Math",
            description: "Formal logic, mathematical proof, arithmetic derivation, or multi-step deductive problem solving.",
            positive_signals: &["proof", "theorem", "calculate", "eigenvalue", "matrix", "integral", "derivative", "equation", "logic"],
            negative_signals: &["informal opinions", "casual conversation"],
        },
        UserIntent::GeneralConversation => IntentDefinition {
            intent,
            canonical_id: "general_conversation",
            display_name: "General Conversation",
            description: "Chit-chat, greetings, casual questions, and quick everyday inquiries.",
            positive_signals: &["hello", "hi", "how are you", "what is your name", "good morning", "thank you", "tell me about yourself"],
            negative_signals: &["technical tasks", "document drafting", "code snippets"],
        },
        UserIntent::ResearchRetrieval => IntentDefinition {
            intent,
            canonical_id: "research_retrieval",
            display_name: "Research & Retrieval",
            description: "Comparative literature analysis, historical exploration, or multi-source knowledge synthesis.",
            positive_signals: &["compare", "survey", "history of", "tradeoffs between", "literature review", "overview of recent developments"],
            negative_signals: &["short factual trivia", "single-step calculations"],
        },
        UserIntent::Writing => IntentDefinition {
            intent,
            canonical_id: "writing",
            display_name: "Long-Form Writing",
            description: "Drafting, editing, or polishing essays, business proposals, articles, emails, or formal documents.",
            positive_signals: &["draft", "essay", "proposal", "executive summary", "cover letter", "rephrase", "tone adjustment"],
            negative_signals: &["summarizing existing text into bullets (use summarization)", "fiction/poetry (use creative_generation)"],
        },
        UserIntent::DataAnalysis => IntentDefinition {
            intent,
            canonical_id: "data_analysis",
            display_name: "Data Analysis",
            description: "Interpreting tabular data, calculating metrics, identifying trends, or parsing structured datasets.",
            positive_signals: &["CSV", "JSON dataset", "aggregate", "trend", "correlation", "percentage change", "outlier", "table"],
            negative_signals: &["general math without dataset", "code generation"],
        },
        UserIntent::Translation => IntentDefinition {
            intent,
            canonical_id: "translation",
            display_name: "Translation",
            description: "Translating words, passages, or documents between natural human languages.",
            positive_signals: &["translate", "in French", "to Spanish", "Urdu translation", "how do you say in German", "tarjuma"],
            negative_signals: &["code transpilation", "language explanation without translation task"],
        },
        UserIntent::Summarization => IntentDefinition {
            intent,
            canonical_id: "summarization",
            display_name: "Summarization",
            description: "Condensing large documents, articles, meeting transcripts, or text blocks into concise points.",
            positive_signals: &["summarize", "TL;DR", "key takeaways", "bullet points summary", "condense", "overview of text"],
            negative_signals: &["long-form expansion", "translation"],
        },
        UserIntent::CreativeGeneration => IntentDefinition {
            intent,
            canonical_id: "creative_generation",
            display_name: "Creative Generation",
            description: "Inventive storytelling, poetry, fiction, character design, humor, and world-building.",
            positive_signals: &["write a story", "compose a poem", "character dialogue", "cyberpunk tale", "brainstorm fiction ideas"],
            negative_signals: &["formal business proposal", "factual article"],
        },
        UserIntent::Other => IntentDefinition {
            intent,
            canonical_id: "other",
            display_name: "Other Workload",
            description: "An understood task or domain that falls outside the primary 10 canonical categories.",
            positive_signals: &["recipe cooking instructions", "legal contract drafting", "diet plan"],
            negative_signals: &["unintelligible gibberish (use unknown)"],
        },
        UserIntent::Unknown => IntentDefinition {
            intent,
            canonical_id: "unknown",
            display_name: "Unknown / Uncertain",
            description: "Input cannot be reliably classified, score is below acceptance threshold, or input is ambiguous.",
            positive_signals: &["help", "what should I do", "do it", "???", "empty or unparseable text"],
            negative_signals: &["clearly articulated tasks"],
        },
    }
}

