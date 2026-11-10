// ============================================================================
// Nano Route - Task Analysis Policy
// File: src-tauri/src/analysis/policy.rs
// ============================================================================
// Configurable policy governing complexity scoring boundaries, domain candidate
// filtering, capability requirement selection, and deterministic sorting.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::analysis::types::{
    AnalysisEvidence, DomainCandidate, RequirementStrength, TaskCapabilityAssessment,
    TaskComplexity,
};

pub const DEFAULT_MAX_DOMAINS: usize = 3;
pub const DEFAULT_MAX_CAPABILITIES: usize = 8;
pub const DEFAULT_DOMAIN_THRESHOLD: f64 = 0.20;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskAnalysisPolicy {
    pub max_domains: usize,
    pub max_capabilities: usize,
    pub domain_threshold: f64,
    pub complexity_trivial_cutoff: f64,
    pub complexity_low_cutoff: f64,
    pub complexity_moderate_cutoff: f64,
    pub complexity_high_cutoff: f64,
}

impl Default for TaskAnalysisPolicy {
    fn default() -> Self {
        Self {
            max_domains: DEFAULT_MAX_DOMAINS,
            max_capabilities: DEFAULT_MAX_CAPABILITIES,
            domain_threshold: DEFAULT_DOMAIN_THRESHOLD,
            complexity_trivial_cutoff: 0.18,
            complexity_low_cutoff: 0.38,
            complexity_moderate_cutoff: 0.65,
            complexity_high_cutoff: 0.88,
        }
    }
}

impl TaskAnalysisPolicy {
    /// Maps a normalized scalar score in [0.0, 1.0] to a qualitative TaskComplexity level.
    pub fn score_to_complexity(&self, score: f64) -> TaskComplexity {
        if score <= 0.0 || score.is_nan() {
            TaskComplexity::Unknown
        } else if score < self.complexity_trivial_cutoff {
            TaskComplexity::Trivial
        } else if score < self.complexity_low_cutoff {
            TaskComplexity::Low
        } else if score < self.complexity_moderate_cutoff {
            TaskComplexity::Moderate
        } else if score < self.complexity_high_cutoff {
            TaskComplexity::High
        } else {
            TaskComplexity::VeryHigh
        }
    }

    /// Deterministically sorts domain candidates.
    /// Primary: confidence DESC.
    /// Secondary: source precedence rank DESC.
    /// Tie-breaker: domain canonical string ASC.
    pub fn sort_domains(&self, domains: &mut [DomainCandidate]) {
        domains.sort_by(|a, b| {
            b.confidence
                .partial_cmp(&a.confidence)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| b.source.precedence_rank().cmp(&a.source.precedence_rank()))
                .then_with(|| a.domain.as_str().cmp(b.domain.as_str()))
        });
    }

    /// Deterministically sorts capability assessments.
    /// Primary: strength rank (Required > Preferred > NotRequired > Unknown).
    /// Secondary: confidence DESC.
    /// Tertiary: source precedence rank DESC.
    /// Tie-breaker: capability canonical string ASC.
    pub fn sort_capabilities(&self, caps: &mut [TaskCapabilityAssessment]) {
        let strength_rank = |s: RequirementStrength| match s {
            RequirementStrength::Required => 3,
            RequirementStrength::Preferred => 2,
            RequirementStrength::Unknown => 1,
            RequirementStrength::NotRequired => 0,
        };

        caps.sort_by(|a, b| {
            strength_rank(b.strength)
                .cmp(&strength_rank(a.strength))
                .then_with(|| {
                    b.confidence
                        .partial_cmp(&a.confidence)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .then_with(|| b.source.precedence_rank().cmp(&a.source.precedence_rank()))
                .then_with(|| a.capability.as_str().cmp(b.capability.as_str()))
        });
    }

    /// Deterministically sorts machine-readable evidence items.
    /// Primary: weight DESC.
    /// Secondary: source precedence DESC.
    /// Tie-breaker: evidence code string ASC.
    pub fn sort_evidence(&self, evidence: &mut [AnalysisEvidence]) {
        evidence.sort_by(|a, b| {
            b.weight
                .partial_cmp(&a.weight)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| b.source.precedence_rank().cmp(&a.source.precedence_rank()))
                .then_with(|| a.code.cmp(&b.code))
        });
    }
}

