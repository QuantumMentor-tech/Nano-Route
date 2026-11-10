// ============================================================================
// Nano Route - Conflict Resolution & Signal Alignment
// File: src-tauri/src/analysis/conflict.rs
// ============================================================================
// Detects contradictions between intent, explicit constraints, and structural
// signals. Resolves conflicts deterministically with documented provenance precedence.
// Precedence: ExplicitUserRequirement > ValidatedModel > StrongStructuralSignal > Heuristic.
// ============================================================================

use crate::analysis::types::{
    AnalysisConflict, ComplexityAnalysis, RequirementStrength, TaskCapabilityAssessment,
    TaskCapabilityRequirement, TaskComplexity, TaskDomain,
};
use crate::classification::types::{IntentClassificationResult, UserIntent};

/// Detects and documents analytical conflicts across task dimensions.
pub fn detect_and_resolve_conflicts(
    intent_result: &IntentClassificationResult,
    complexity: &ComplexityAnalysis,
    primary_domain: TaskDomain,
    capabilities: &[TaskCapabilityAssessment],
) -> Vec<AnalysisConflict> {
    let mut conflicts = Vec::new();

    // 1. Conflict: Intent vs Explicit Structured Output
    // If intent is general conversation or writing, but user strictly mandates JSON output
    let has_structured_req = capabilities.iter().any(|c| {
        c.capability == TaskCapabilityRequirement::StructuredOutput
            && c.strength == RequirementStrength::Required
    });

    if has_structured_req
        && (intent_result.primary_intent == UserIntent::GeneralConversation
            || intent_result.primary_intent == UserIntent::CreativeGeneration)
    {
        conflicts.push(AnalysisConflict {
            dimension: "capability:structured_output".to_string(),
            model_signal: Some(format!("intent:{}", intent_result.primary_intent.as_str())),
            explicit_signal: "strict_structured_output_mandated".to_string(),
            resolution: "Explicit requirement for structured output overrides loose conversational intent format"
                .to_string(),
        });
    }

    // 2. Conflict: Intent vs Technical Complexity
    // If intent is GeneralConversation, but complexity is High or VeryHigh due to code blocks
    if intent_result.primary_intent == UserIntent::GeneralConversation
        && (complexity.level == TaskComplexity::High || complexity.level == TaskComplexity::VeryHigh)
    {
        conflicts.push(AnalysisConflict {
            dimension: "complexity:technical_depth".to_string(),
            model_signal: Some("intent:general_conversation".to_string()),
            explicit_signal: "high_technical_depth_detected".to_string(),
            resolution: "Complexity elevated to reflect structural constraints despite conversational opening"
                .to_string(),
        });
    }

    // 3. Conflict: Web Retrieval Negation
    let web_negated = capabilities.iter().any(|c| {
        c.capability == TaskCapabilityRequirement::WebRetrieval
            && c.strength == RequirementStrength::NotRequired
    });

    if web_negated && primary_domain == TaskDomain::Research {
        conflicts.push(AnalysisConflict {
            dimension: "capability:web_retrieval".to_string(),
            model_signal: Some("domain:research".to_string()),
            explicit_signal: "web_search_explicitly_negated".to_string(),
            resolution: "Explicit user negation respected; research domain constrained to local/knowledge synthesis"
                .to_string(),
        });
    }

    conflicts
}

