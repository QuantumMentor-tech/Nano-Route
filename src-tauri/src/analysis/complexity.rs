// ============================================================================
// Nano Route - Complexity Analyzer
// File: src-tauri/src/analysis/complexity.rs
// ============================================================================
// Analyzes workload complexity based on intent signals, reasoning depth,
// multi-step operations, constraints, code volume, and mathematical formalisms.
// ============================================================================

use crate::analysis::policy::TaskAnalysisPolicy;
use crate::analysis::types::{
    AnalysisEvidence, AnalysisSource, ComplexityAnalysis, TaskAnalysisRequest, TaskComplexity,
};
use crate::classification::types::{IntentClassificationResult, UserIntent};

/// Evaluates workload complexity and produces machine-readable structural evidence.
pub fn analyze_task_complexity(
    request: &TaskAnalysisRequest,
    intent_result: &IntentClassificationResult,
    policy: &TaskAnalysisPolicy,
) -> (ComplexityAnalysis, Vec<AnalysisEvidence>) {
    let text = &request.text;
    let mut score = 0.0f64;
    let mut evidence = Vec::new();
    let mut evidence_codes = Vec::new();

    // 1. Base complexity derived from Step 27 Intent
    match intent_result.primary_intent {
        UserIntent::SoftwareEngineering => {
            score += 0.40;
            evidence_codes.push("intent_software_engineering_base".to_string());
        }
        UserIntent::CodeDebugging => {
            score += 0.45;
            evidence_codes.push("intent_code_debugging_base".to_string());
        }
        UserIntent::ReasoningMath => {
            score += 0.45;
            evidence_codes.push("intent_reasoning_math_base".to_string());
        }
        UserIntent::ResearchRetrieval => {
            score += 0.35;
            evidence_codes.push("intent_research_retrieval_base".to_string());
        }
        UserIntent::Writing => {
            score += 0.25;
            evidence_codes.push("intent_writing_base".to_string());
        }
        UserIntent::DataAnalysis => {
            score += 0.35;
            evidence_codes.push("intent_data_analysis_base".to_string());
        }
        UserIntent::Translation => {
            score += 0.15;
            evidence_codes.push("intent_translation_base".to_string());
        }
        UserIntent::Summarization => {
            score += 0.20;
            evidence_codes.push("intent_summarization_base".to_string());
        }
        UserIntent::CreativeGeneration => {
            score += 0.25;
            evidence_codes.push("intent_creative_generation_base".to_string());
        }
        UserIntent::GeneralConversation => {
            score += 0.08;
            evidence_codes.push("intent_general_conversation_base".to_string());
        }
        UserIntent::Other => {
            score += 0.20;
        }
        UserIntent::Unknown => {
            score += 0.10;
        }
    }

    let lower = text.to_lowercase();

    // 2. Multi-step / Sequential instructions
    let multi_step_signals = [
        "first", "then", "finally", "step 1", "step 2", "after that", "next,", "in addition", "and then",
    ];
    let step_count = multi_step_signals.iter().filter(|&&s| lower.contains(s)).count();
    if step_count >= 2 {
        score += 0.22;
        evidence_codes.push("multi_step_instruction".to_string());
        evidence.push(AnalysisEvidence {
            code: "multi_step_instruction".to_string(),
            description: "Task involves multi-step sequential dependencies".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.85,
        });
    }

    // 3. Multi-file / Cross-module / Architectural signals
    let multi_file_signals = [
        "refactor", "modules", "architecture", "cross-file", "multi-module", "microservices", "subsystem", "crate", "package",
    ];
    let file_sig_count = multi_file_signals.iter().filter(|&&s| lower.contains(s)).count();
    if file_sig_count >= 2 {
        score += 0.25;
        evidence_codes.push("cross_file_reasoning".to_string());
        evidence.push(AnalysisEvidence {
            code: "cross_file_reasoning".to_string(),
            description: "Refactoring across multiple modules or components".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.90,
        });
    }

    // 4. Code blocks & Syntax volume
    if text.contains("```") || text.contains("fn ") || text.contains("impl ") || text.contains("struct ") || text.contains("public class ") {
        score += 0.18;
        evidence_codes.push("code_block_detected".to_string());
        evidence.push(AnalysisEvidence {
            code: "code_block_detected".to_string(),
            description: "Formal source code or syntax blocks present in prompt".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.80,
        });
    }

    // 5. Explicit constraints & strict specifications
    let constraint_signals = [
        "o(1)", "o(n)", "thread-safe", "without mutating", "strict schema", "guarantee", "deterministic", "in-place", "lock-free",
    ];
    if constraint_signals.iter().any(|&c| lower.contains(c)) {
        score += 0.20;
        evidence_codes.push("explicit_constraints".to_string());
        evidence.push(AnalysisEvidence {
            code: "explicit_constraints".to_string(),
            description: "Strict algorithmic or memory constraints declared".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.85,
        });
    }

    // 6. Mathematical proof & symbolic derivation
    let proof_signals = [
        "prove by", "contradiction", "eigenvalue", "eigenvector", "theorem", "induction", "lemma", "matrix",
    ];
    if proof_signals.iter().any(|&p| lower.contains(p)) {
        score += 0.25;
        evidence_codes.push("mathematical_proof_requested".to_string());
        evidence.push(AnalysisEvidence {
            code: "mathematical_proof_requested".to_string(),
            description: "Formal deductive mathematical proof or symbolic derivation".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.90,
        });
    }

    // 7. Context length & conversation history volume
    let word_count = text.split_whitespace().count();
    let total_context_turns = request.conversation_context.as_ref().map(|c| c.len()).unwrap_or(0);
    if word_count > 400 || total_context_turns > 4 {
        score += 0.15;
        evidence_codes.push("large_context_payload".to_string());
        evidence.push(AnalysisEvidence {
            code: "large_context_payload".to_string(),
            description: "Extended context length or extensive conversation history".to_string(),
            source: AnalysisSource::StrongStructuralSignal,
            weight: 0.70,
        });
    }

    // Cap score at [0.05, 1.0]
    let normalized_score = score.clamp(0.05, 1.0);
    let level = policy.score_to_complexity(normalized_score);

    let complexity = ComplexityAnalysis {
        level,
        confidence: (0.75 + (intent_result.confidence * 0.20)).min(0.98),
        source: AnalysisSource::Derived,
        score: normalized_score,
        evidence_codes,
    };

    (complexity, evidence)
}

