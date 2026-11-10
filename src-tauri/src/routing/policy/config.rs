// ============================================================================
// Nano Route - Routing Policy Configuration
// File: src-tauri/src/routing/policy/config.rs
// ============================================================================
// Authoritative, validated configuration parameters governing route selection,
// score thresholds, tie-breaking margins, and override capability enforcement.
// ============================================================================

use serde::{Deserialize, Serialize};
use crate::domain::settings::RoutingPreferenceMode;
use crate::errors::AppError;
use super::types::DEFAULT_POLICY_VERSION;

/// Configurable parameters for the Routing Policy Engine.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RoutingPolicyConfig {
    pub policy_version: String,
    pub minimum_accepted_score: f64,
    pub tie_tolerance: f64,
    pub max_fallback_candidates: usize,
    pub allow_degraded_providers: bool,
    pub enforce_strict_override_capabilities: bool,
    pub preference_profile: RoutingPreferenceMode,
    pub fallback_on_rejected_override: bool,
}

impl Default for RoutingPolicyConfig {
    fn default() -> Self {
        Self {
            policy_version: DEFAULT_POLICY_VERSION.to_string(),
            minimum_accepted_score: 0.35,
            tie_tolerance: 0.015,
            max_fallback_candidates: 5,
            allow_degraded_providers: true,
            enforce_strict_override_capabilities: true,
            preference_profile: RoutingPreferenceMode::Balanced,
            fallback_on_rejected_override: false,
        }
    }
}

impl RoutingPolicyConfig {
    /// Validates all configuration invariants.
    pub fn validate(&self) -> Result<(), AppError> {
        if self.policy_version.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "Policy version string must not be empty".to_string(),
            ));
        }

        if !self.minimum_accepted_score.is_finite()
            || self.minimum_accepted_score < 0.0
            || self.minimum_accepted_score > 1.0
        {
            return Err(AppError::InvalidInput(format!(
                "minimum_accepted_score must be a finite number in [0.0, 1.0]; got {}",
                self.minimum_accepted_score
            )));
        }

        if !self.tie_tolerance.is_finite()
            || self.tie_tolerance < 0.0
            || self.tie_tolerance > 0.5
        {
            return Err(AppError::InvalidInput(format!(
                "tie_tolerance must be a finite number in [0.0, 0.5]; got {}",
                self.tie_tolerance
            )));
        }

        if self.max_fallback_candidates == 0 || self.max_fallback_candidates > 50 {
            return Err(AppError::InvalidInput(format!(
                "max_fallback_candidates must be between 1 and 50; got {}",
                self.max_fallback_candidates
            )));
        }

        Ok(())
    }
}

