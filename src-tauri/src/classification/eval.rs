// ============================================================================
// Nano Route - Classifier Evaluation & Gold Dataset
// File: src-tauri/src/classification/eval.rs
// ============================================================================
// Deterministic synthetic evaluation dataset and benchmarking runner.
// Contains representative test prompts for all workload groups, code blocks,
// reasoning, translations, multi-intent, and deliberately ambiguous inputs.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::time::Instant;

use crate::classification::service::IntentClassifier;
use crate::classification::types::{AmbiguityState, IntentClassificationRequest, UserIntent};

/// Gold benchmark sample definition.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GoldEvaluationSample {
    pub prompt: &'static str,
    pub expected_intent: UserIntent,
    pub expected_ambiguity: AmbiguityState,
    pub secondary_intents: &'static [UserIntent],
    pub notes: &'static str,
}

/// Comprehensive gold evaluation dataset version 1 (Section 90, 150).
pub const EVAL_DATASET_VERSION: &str = "1.0.0";

pub static GOLD_EVALUATION_SET: &[GoldEvaluationSample] = &[
    // 1. Software Engineering
    GoldEvaluationSample {
        prompt: "Implement a thread-safe LRU cache in Rust with O(1) get and put operations using RwLock.",
        expected_intent: UserIntent::SoftwareEngineering,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Clear systems programming and data structure task",
    },
    GoldEvaluationSample {
        prompt: "Refactor this TypeScript React hook to eliminate redundant re-renders and clean up the WebSocket connection on unmount.",
        expected_intent: UserIntent::SoftwareEngineering,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Frontend architecture and refactoring task",
    },

    // 2. Code Debugging
    GoldEvaluationSample {
        prompt: "Why is this Tokio select! loop causing a memory leak when cancellation tokens are triggered in flight?",
        expected_intent: UserIntent::CodeDebugging,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[UserIntent::SoftwareEngineering],
        notes: "Debugging async concurrency and leak issue",
    },
    GoldEvaluationSample {
        prompt: "Fix this panic: 'called Result::unwrap() on an Err value: PoisonError { .. }' at line 142 in worker.rs",
        expected_intent: UserIntent::CodeDebugging,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[UserIntent::SoftwareEngineering],
        notes: "Concrete stack trace and panic diagnostic",
    },

    // 3. Reasoning & Math
    GoldEvaluationSample {
        prompt: "Prove by contradiction that the square root of 2 is irrational.",
        expected_intent: UserIntent::ReasoningMath,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Classical formal mathematical proof",
    },
    GoldEvaluationSample {
        prompt: "Calculate the eigenvalues and corresponding eigenvectors of a 3x3 symmetric matrix.",
        expected_intent: UserIntent::ReasoningMath,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Multi-step linear algebra derivation",
    },

    // 4. General Conversation
    GoldEvaluationSample {
        prompt: "Good morning! How are you doing today? Can you give me a quick thought of the day?",
        expected_intent: UserIntent::GeneralConversation,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Friendly daily conversational greeting",
    },
    GoldEvaluationSample {
        prompt: "Hello there, what is your name and how does pair programming work?",
        expected_intent: UserIntent::GeneralConversation,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Casual introductory inquiry",
    },

    // 5. Research & Retrieval
    GoldEvaluationSample {
        prompt: "Compare the architectural differences and memory bandwidth tradeoffs between LPDDR5X and HBM3e.",
        expected_intent: UserIntent::ResearchRetrieval,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Comparative technical hardware survey",
    },
    GoldEvaluationSample {
        prompt: "Survey recent literature on sparse attention mechanisms in modern transformer architectures.",
        expected_intent: UserIntent::ResearchRetrieval,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Broad academic research overview query",
    },

    // 6. Long-Form Writing
    GoldEvaluationSample {
        prompt: "Draft an executive summary proposal for our cloud migration strategy to present to the board of directors.",
        expected_intent: UserIntent::Writing,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Formal corporate proposal drafting",
    },
    GoldEvaluationSample {
        prompt: "Write a formal cover letter applying for a Principal Systems Engineer position highlighting distributed systems experience.",
        expected_intent: UserIntent::Writing,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Professional document composition",
    },

    // 7. Data Analysis
    GoldEvaluationSample {
        prompt: "Given this CSV table of quarterly regional sales, calculate the percentage growth and identify outliers.",
        expected_intent: UserIntent::DataAnalysis,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Tabular numerical and statistical interpretation",
    },

    // 8. Translation
    GoldEvaluationSample {
        prompt: "Translate this technical privacy notice into French with professional legal phrasing.",
        expected_intent: UserIntent::Translation,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Explicit natural language translation",
    },
    GoldEvaluationSample {
        prompt: "براہ کرم اس انگریزی جملے کا اردو میں ترجمہ کریں: 'Security and privacy are core engineering values.'",
        expected_intent: UserIntent::Translation,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Multilingual Urdu translation request",
    },

    // 9. Summarization
    GoldEvaluationSample {
        prompt: "Summarize this 10-page terms of service agreement into 5 concise executive bullet points.",
        expected_intent: UserIntent::Summarization,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Condensing long document into bullet summary",
    },

    // 10. Creative Generation
    GoldEvaluationSample {
        prompt: "Write a short cyberpunk story about an autonomous local router AI living inside a vintage terminal.",
        expected_intent: UserIntent::CreativeGeneration,
        expected_ambiguity: AmbiguityState::NotAmbiguous,
        secondary_intents: &[],
        notes: "Fictional creative worldbuilding",
    },

    // 11. Multi-Intent Complex Workload
    GoldEvaluationSample {
        prompt: "Analyze this CSV dataset of user logs, summarize the findings, and draft an executive email to management.",
        expected_intent: UserIntent::DataAnalysis,
        expected_ambiguity: AmbiguityState::MultiIntent,
        secondary_intents: &[UserIntent::Summarization, UserIntent::Writing],
        notes: "Multi-workload intent sequence",
    },

    // 12. Deliberately Ambiguous / Uncertain
    GoldEvaluationSample {
        prompt: "Can you help with this?",
        expected_intent: UserIntent::Unknown,
        expected_ambiguity: AmbiguityState::Unknown,
        secondary_intents: &[],
        notes: "Under-specified prompt with zero domain context",
    },
    GoldEvaluationSample {
        prompt: "Tell me something useful.",
        expected_intent: UserIntent::GeneralConversation,
        expected_ambiguity: AmbiguityState::Ambiguous,
        secondary_intents: &[],
        notes: "Extremely open-ended inquiry",
    },
];

/// Evaluation run report summary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClassifierEvaluationReport {
    pub dataset_version: String,
    pub total_samples: usize,
    pub correct_primary_count: usize,
    pub accuracy_percentage: f64,
    pub ambiguity_count: usize,
    pub multi_intent_count: usize,
    pub unknown_count: usize,
    pub average_latency_ms: f64,
    pub p95_latency_ms: u64,
}

impl ClassifierEvaluationReport {
    /// Executes the gold evaluation benchmark set against the specified classifier.
    pub async fn run_evaluation(classifier: &IntentClassifier) -> Self {
        let total = GOLD_EVALUATION_SET.len();
        let mut correct = 0;
        let mut ambiguity_count = 0;
        let mut multi_intent_count = 0;
        let mut unknown_count = 0;
        let mut latencies = Vec::with_capacity(total);

        for sample in GOLD_EVALUATION_SET {
            let start = Instant::now();
            let req = IntentClassificationRequest {
                request_id: None,
                text: sample.prompt.to_string(),
                conversation_context: None,
                language_hint: None,
            };

            let res = classifier.classify(req, None).await;
            let elapsed_ms = start.elapsed().as_millis().max(1) as u64;
            latencies.push(elapsed_ms);

            if let Ok(result) = res {
                if result.primary_intent == sample.expected_intent {
                    correct += 1;
                }
                match result.ambiguity {
                    AmbiguityState::Ambiguous => ambiguity_count += 1,
                    AmbiguityState::MultiIntent => multi_intent_count += 1,
                    AmbiguityState::Unknown => unknown_count += 1,
                    AmbiguityState::NotAmbiguous => {}
                }
            }
        }

        latencies.sort_unstable();
        let p95_idx = ((total as f64) * 0.95).floor() as usize;
        let p95_latency_ms = *latencies.get(p95_idx.min(total.saturating_sub(1))).unwrap_or(&0);
        let average_latency_ms = if total > 0 {
            latencies.iter().sum::<u64>() as f64 / total as f64
        } else {
            0.0
        };

        Self {
            dataset_version: EVAL_DATASET_VERSION.to_string(),
            total_samples: total,
            correct_primary_count: correct,
            accuracy_percentage: if total > 0 { (correct as f64 / total as f64) * 100.0 } else { 0.0 },
            ambiguity_count,
            multi_intent_count,
            unknown_count,
            average_latency_ms,
            p95_latency_ms,
        }
    }
}

