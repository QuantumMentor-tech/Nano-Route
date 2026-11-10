// ============================================================================
// Nano Route - Routing Scoring Explanation Generator
// File: src-tauri/src/routing/scoring/explanation.rs
// ============================================================================
// Deterministic synthesizer of human-readable and audit-friendly explanation strings
// for candidate scores and overall routing scoring evaluation batches.
// ============================================================================

use crate::analysis::types::TaskAnalysisResult;
use crate::routing::scoring::types::{CandidateScore, IneligibilityReason, ScoreBreakdown};

pub struct ExplanationGenerator;

impl ExplanationGenerator {
    /// Generates a deterministic explanation string for an individual candidate score.
    pub fn explain_candidate(
        display_name: &str,
        is_eligible: bool,
        ineligibility_reasons: &[IneligibilityReason],
        total_score: Option<f64>,
        breakdown: Option<&ScoreBreakdown>,
        analysis: &TaskAnalysisResult,
    ) -> String {
        if !is_eligible {
            let reasons_str: Vec<String> = ineligibility_reasons
                .iter()
                .map(|r| r.description())
                .collect();
            return format!(
                "Ineligible for routing: {}",
                if reasons_str.is_empty() {
                    "Disqualified by preflight requirements".to_string()
                } else {
                    reasons_str.join("; ")
                }
            );
        }

        let score = total_score.unwrap_or(0.0);
        let mut parts = Vec::new();
        parts.push(format!("Eligible (score: {:.3})", score));

        if let Some(b) = breakdown {
            // Highlight strongest dimensions
            if b.complexity_fit >= 0.90 {
                parts.push(format!(
                    "Strong {} complexity fit ({:.2})",
                    analysis.complexity.level.as_str(),
                    b.complexity_fit
                ));
            } else if b.complexity_fit <= 0.40 {
                parts.push(format!(
                    "Suboptimal {} complexity fit ({:.2})",
                    analysis.complexity.level.as_str(),
                    b.complexity_fit
                ));
            }

            if b.domain_fit >= 0.90 {
                parts.push(format!(
                    "High domain affinity ({:.2}) for {}",
                    b.domain_fit,
                    analysis.primary_domain.domain.as_str()
                ));
            }

            if b.cost_fit >= 0.95 {
                parts.push("Highly economical pricing".to_string());
            }

            if b.latency_fit >= 0.95 {
                parts.push("Ultra-low latency tier".to_string());
            }

            if b.preference_fit >= 0.70 {
                parts.push(format!("Elevated user priority weight ({:.2})", b.preference_fit));
            }
        }

        format!("{}: {}", display_name, parts.join(". "))
    }

    /// Generates a batch explanation summary across all evaluated candidates.
    pub fn explain_batch_summary(
        total_evaluated: usize,
        eligible_count: usize,
        ineligible_count: usize,
        top_candidate: Option<&CandidateScore>,
    ) -> String {
        if total_evaluated == 0 {
            return "No registered candidates evaluated".to_string();
        }

        let top_info = match top_candidate {
            Some(top) if top.is_eligible => {
                let score = top.total_score.unwrap_or(0.0);
                format!(
                    " Top candidate: '{}' ({}/{}) with suitability score {:.3}.",
                    top.display_name, top.provider_id, top.model_id, score
                )
            }
            _ => " No eligible candidates found meeting hard constraints.".to_string(),
        };

        format!(
            "Evaluated {} candidates ({} eligible, {} ineligible).{}",
            total_evaluated, eligible_count, ineligible_count, top_info
        )
    }
}

