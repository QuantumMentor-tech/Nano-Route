// ============================================================================
// Nano Route - Classification Policy
// File: src-tauri/src/classification/policy.rs
// ============================================================================
// Configurable policy governing confidence thresholds, ambiguity margins,
// multi-intent extraction boundaries, and deterministic tie-breaking.
// Contains zero magic numbers buried inside tensor code.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::classification::types::{AmbiguityState, IntentCandidate, UserIntent};

/// Default confidence acceptance threshold. If top normalized probability is < 0.35,
/// the classification is considered uncertain and falls back to UserIntent::Unknown.
pub const DEFAULT_CONFIDENCE_THRESHOLD: f64 = 0.35;

/// Default ambiguity margin. If the difference between top candidate and second
/// candidate is less than 0.08, the state is evaluated as Ambiguous.
pub const DEFAULT_AMBIGUITY_MARGIN: f64 = 0.08;

/// Default threshold for qualifying a secondary intent candidate in a multi-intent request.
pub const DEFAULT_MULTI_INTENT_THRESHOLD: f64 = 0.25;

/// Default maximum number of alternative candidates to return.
pub const DEFAULT_MAX_ALTERNATIVES: usize = 3;

/// Policy configuration for intent classification acceptance and ranking.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClassificationPolicy {
    /// Minimum normalized confidence required for acceptance.
    /// Evaluated as: `score >= confidence_threshold`.
    pub confidence_threshold: f64,
    /// Minimum margin between top and runner-up candidate to rule out ambiguity.
    pub ambiguity_margin: f64,
    /// Minimum score for a non-primary candidate to trigger multi-intent detection.
    pub multi_intent_threshold: f64,
    /// Maximum alternative candidates preserved in result.
    pub max_alternatives: usize,
}

impl Default for ClassificationPolicy {
    fn default() -> Self {
        Self {
            confidence_threshold: DEFAULT_CONFIDENCE_THRESHOLD,
            ambiguity_margin: DEFAULT_AMBIGUITY_MARGIN,
            multi_intent_threshold: DEFAULT_MULTI_INTENT_THRESHOLD,
            max_alternatives: DEFAULT_MAX_ALTERNATIVES,
        }
    }
}

impl ClassificationPolicy {
    /// Deterministically sorts candidate intents.
    /// Primary sort: normalized score DESC.
    /// Secondary sort: raw score DESC.
    /// Tie-breaker: intent canonical string ASC (guarantees 100% stable ordering).
    pub fn sort_candidates(&self, candidates: &mut [IntentCandidate]) {
        candidates.sort_by(|a, b| {
            b.normalized_score
                .partial_cmp(&a.normalized_score)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| {
                    b.raw_score
                        .partial_cmp(&a.raw_score)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .then_with(|| a.intent.as_str().cmp(b.intent.as_str()))
        });
    }

    /// Evaluates ambiguity state and secondary alternatives based on candidate ranking.
    pub fn evaluate_ambiguity(
        &self,
        sorted_candidates: &[IntentCandidate],
    ) -> (UserIntent, f64, AmbiguityState, Vec<IntentCandidate>) {
        if sorted_candidates.is_empty() {
            return (UserIntent::Unknown, 0.0, AmbiguityState::Unknown, Vec::new());
        }

        let top = &sorted_candidates[0];
        let top_score = top.normalized_score;

        // 1. Below acceptance threshold -> Unknown
        if top_score < self.confidence_threshold {
            let alternatives = sorted_candidates
                .iter()
                .skip(1)
                .take(self.max_alternatives)
                .cloned()
                .collect();
            return (UserIntent::Unknown, top_score, AmbiguityState::Unknown, alternatives);
        }

        // 2. Single candidate available
        if sorted_candidates.len() == 1 {
            return (top.intent, top_score, AmbiguityState::NotAmbiguous, Vec::new());
        }

        let second = &sorted_candidates[1];
        let margin = (top_score - second.normalized_score).abs();

        // 3. Multi-intent check: if second candidate is distinct, non-unknown, and clears multi-intent threshold
        let is_multi_intent = second.normalized_score >= self.multi_intent_threshold
            && second.intent != UserIntent::Unknown
            && second.intent != UserIntent::Other
            && second.intent != top.intent;

        // 4. Ambiguity check: if margin is narrow
        let ambiguity = if is_multi_intent {
            AmbiguityState::MultiIntent
        } else if margin < self.ambiguity_margin && second.intent != top.intent {
            AmbiguityState::Ambiguous
        } else {
            AmbiguityState::NotAmbiguous
        };

        // Filter alternatives to unique intents distinct from primary
        let mut alternatives = Vec::new();
        for candidate in sorted_candidates.iter().skip(1) {
            if candidate.intent != top.intent && candidate.intent != UserIntent::Unknown {
                if !alternatives.iter().any(|c: &IntentCandidate| c.intent == candidate.intent) {
                    alternatives.push(candidate.clone());
                    if alternatives.len() >= self.max_alternatives {
                        break;
                    }
                }
            }
        }

        (top.intent, top_score, ambiguity, alternatives)
    }
}

