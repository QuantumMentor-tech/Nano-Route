// ============================================================================
// Nano Route - Routing Scoring Weights
// File: src-tauri/src/routing/scoring/weights.rs
// ============================================================================
// Configurable and validated weighting parameters for multi-criteria candidate
// suitability scoring. Strictly enforces normalized non-negative coefficients.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::errors::AppError;

/// Multi-factor weights applied during routing candidate scoring.
/// All coefficients must be non-negative, finite, and sum to 1.0 (within epsilon tolerance).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingScoringWeights {
    pub intent_weight: f64,
    pub complexity_weight: f64,
    pub domain_weight: f64,
    pub capability_weight: f64,
    pub context_weight: f64,
    pub modality_weight: f64,
    pub preference_weight: f64,
    pub cost_weight: f64,
    pub latency_weight: f64,
    pub reliability_weight: f64,
    pub profile_weight: f64,
}

impl Default for RoutingScoringWeights {
    fn default() -> Self {
        Self {
            intent_weight: 0.15,
            complexity_weight: 0.15,
            domain_weight: 0.10,
            capability_weight: 0.15,
            context_weight: 0.05,
            modality_weight: 0.05,
            preference_weight: 0.10,
            cost_weight: 0.08,
            latency_weight: 0.07,
            reliability_weight: 0.05,
            profile_weight: 0.05,
        }
    }
}

impl RoutingScoringWeights {
    pub const EPSILON: f64 = 1e-4;

    /// Validates that all weights are non-negative, finite numbers and sum to 1.0.
    pub fn validate(&self) -> Result<(), AppError> {
        let weights = [
            ("intent_weight", self.intent_weight),
            ("complexity_weight", self.complexity_weight),
            ("domain_weight", self.domain_weight),
            ("capability_weight", self.capability_weight),
            ("context_weight", self.context_weight),
            ("modality_weight", self.modality_weight),
            ("preference_weight", self.preference_weight),
            ("cost_weight", self.cost_weight),
            ("latency_weight", self.latency_weight),
            ("reliability_weight", self.reliability_weight),
            ("profile_weight", self.profile_weight),
        ];

        let mut sum = 0.0;
        for (name, val) in weights {
            if !val.is_finite() || val < 0.0 {
                return Err(AppError::InvalidInput(format!(
                    "Routing scoring weight '{}' must be a finite, non-negative number; got {}",
                    name, val
                )));
            }
            sum += val;
        }

        if (sum - 1.0).abs() > Self::EPSILON {
            return Err(AppError::InvalidInput(format!(
                "Routing scoring weights must sum to 1.0 (+/- {}); got {}",
                Self::EPSILON,
                sum
            )));
        }

        Ok(())
    }

    /// Normalizes weights so that their sum equals 1.0.
    pub fn normalized(&self) -> Result<Self, AppError> {
        let sum = self.intent_weight
            + self.complexity_weight
            + self.domain_weight
            + self.capability_weight
            + self.context_weight
            + self.modality_weight
            + self.preference_weight
            + self.cost_weight
            + self.latency_weight
            + self.reliability_weight
            + self.profile_weight;

        if !sum.is_finite() || sum <= 0.0 {
            return Err(AppError::InvalidInput(
                "Cannot normalize routing scoring weights with non-positive sum".to_string(),
            ));
        }

        let normalized = Self {
            intent_weight: self.intent_weight / sum,
            complexity_weight: self.complexity_weight / sum,
            domain_weight: self.domain_weight / sum,
            capability_weight: self.capability_weight / sum,
            context_weight: self.context_weight / sum,
            modality_weight: self.modality_weight / sum,
            preference_weight: self.preference_weight / sum,
            cost_weight: self.cost_weight / sum,
            latency_weight: self.latency_weight / sum,
            reliability_weight: self.reliability_weight / sum,
            profile_weight: self.profile_weight / sum,
        };

        normalized.validate()?;
        Ok(normalized)
    }
}

