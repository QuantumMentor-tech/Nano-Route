// ============================================================================
// Nano Route - Routing Scoring Engine
// File: src-tauri/src/routing/scoring/engine.rs
// ============================================================================
// Central orchestration service for multi-candidate suitability scoring.
// Evaluates hard eligibility constraints and calculates normalized [0.0, 1.0]
// multi-factor scores for eligible catalog candidates.
// Strictly decoupled from final routing dispatch and policy selection (Step 30).
// ============================================================================

use std::cmp::Ordering;
use std::sync::{Arc, RwLock};
use std::time::Instant;

use crate::providers::capability_service::ProviderCapabilityService;
use crate::providers::health_manager::ProviderHealthManager;
use crate::providers::health_types::RuntimeHealthState;
use crate::providers::preflight::PreflightEvaluator;
use crate::providers::registry::ProviderRegistry;
use crate::routing::scoring::calculator::ScoreCalculator;
use crate::routing::scoring::eligibility::EligibilityEvaluator;
use crate::routing::scoring::errors::RoutingScoringError;
use crate::routing::scoring::explanation::ExplanationGenerator;
use crate::routing::scoring::profiles::BuiltinRoutingProfiles;
use crate::routing::scoring::types::{
    CandidateScore, RoutingScoreRequest, RoutingScoreResult, RoutingScoringStatus,
};
use crate::routing::scoring::weights::RoutingScoringWeights;
use crate::services::provider_preferences::ProviderPreferencesService;

pub struct RoutingScoringEngine {
    registry: Arc<ProviderRegistry>,
    health_manager: Arc<ProviderHealthManager>,
    capability_service: Arc<ProviderCapabilityService>,
    preflight_evaluator: Arc<PreflightEvaluator>,
    provider_preferences: Arc<ProviderPreferencesService>,
    eligibility_evaluator: EligibilityEvaluator,
    weights: RwLock<RoutingScoringWeights>,
    last_latency_ms: RwLock<Option<u64>>,
}

impl RoutingScoringEngine {
    pub fn new(
        registry: Arc<ProviderRegistry>,
        health_manager: Arc<ProviderHealthManager>,
        capability_service: Arc<ProviderCapabilityService>,
        preflight_evaluator: Arc<PreflightEvaluator>,
        provider_preferences: Arc<ProviderPreferencesService>,
    ) -> Self {
        let eligibility_evaluator = EligibilityEvaluator::new(
            capability_service.clone(),
            preflight_evaluator.clone(),
            provider_preferences.clone(),
        );

        Self {
            registry,
            health_manager,
            capability_service,
            preflight_evaluator,
            provider_preferences,
            eligibility_evaluator,
            weights: RwLock::new(RoutingScoringWeights::default()),
            last_latency_ms: RwLock::new(None),
        }
    }

    /// Evaluates and scores all registered candidates against a task analysis result.
    pub fn score_candidates(
        &self,
        request: RoutingScoreRequest,
    ) -> Result<RoutingScoreResult, RoutingScoringError> {
        let start = Instant::now();
        let request_id = request
            .request_id
            .clone()
            .unwrap_or_else(|| format!("score-{}", uuid_or_timestamp()));

        let active_weights = self.get_weights();
        active_weights.validate()?;

        let all_models = self.registry.list_all_models();
        let mut evaluated_candidates: Vec<CandidateScore> = Vec::with_capacity(all_models.len());

        let preferred_providers_ref = request.preferred_providers.as_deref();
        let required_caps_ref = request.required_capabilities_override.as_deref();

        for model in all_models {
            let provider = match self.registry.get_provider(&model.provider_id) {
                Some(p) => p,
                None => continue,
            };

            // 1. Evaluate Hard Eligibility
            let eligibility = self.eligibility_evaluator.evaluate(
                &provider,
                &model,
                &request.task_analysis,
                request.estimated_input_tokens,
                request.estimated_output_tokens,
                required_caps_ref,
            );

            if eligibility.is_eligible {
                // 2. Load Profile and Runtime Health
                let profile = BuiltinRoutingProfiles::get_profile(&model.model_id);
                let health_state = self
                    .health_manager
                    .get_model_health(&model.provider_id, &model.model_id)
                    .map(|h| h.health_state)
                    .unwrap_or_else(|| {
                        self.health_manager
                            .get_provider_health(&model.provider_id)
                            .map(|h| h.health_state)
                            .unwrap_or(RuntimeHealthState::Unknown)
                    });

                let user_priority_weight = self
                    .provider_preferences
                    .get_provider_configuration(model.provider_id.as_str())
                    .ok()
                    .flatten()
                    .map(|s| s.priority_weight)
                    .unwrap_or(5);

                // 3. Calculate Soft Multi-Criteria Score
                let (breakdown, total_score, adjustments, pricing_known, latency_known) =
                    ScoreCalculator::calculate(
                        &provider,
                        &model,
                        &profile,
                        &request.task_analysis,
                        health_state,
                        user_priority_weight,
                        preferred_providers_ref,
                        request.estimated_input_tokens,
                        request.estimated_output_tokens,
                        &active_weights,
                    );

                let explanation = ExplanationGenerator::explain_candidate(
                    &model.display_name,
                    true,
                    &[],
                    Some(total_score),
                    Some(&breakdown),
                    &request.task_analysis,
                );

                evaluated_candidates.push(CandidateScore {
                    provider_id: model.provider_id.as_str().to_string(),
                    model_id: model.model_id.clone(),
                    display_name: model.display_name.clone(),
                    is_eligible: true,
                    ineligibility_reasons: Vec::new(),
                    total_score: Some(total_score),
                    breakdown: Some(breakdown),
                    adjustments,
                    explanation,
                    context_window: model.context_window,
                    pricing_known,
                    latency_known,
                });
            } else {
                // Ineligible: strictly NO score and NO breakdown
                let explanation = ExplanationGenerator::explain_candidate(
                    &model.display_name,
                    false,
                    &eligibility.ineligibility_reasons,
                    None,
                    None,
                    &request.task_analysis,
                );

                evaluated_candidates.push(CandidateScore {
                    provider_id: model.provider_id.as_str().to_string(),
                    model_id: model.model_id.clone(),
                    display_name: model.display_name.clone(),
                    is_eligible: false,
                    ineligibility_reasons: eligibility.ineligibility_reasons,
                    total_score: None,
                    breakdown: None,
                    adjustments: Vec::new(),
                    explanation,
                    context_window: model.context_window,
                    pricing_known: model.pricing.is_some(),
                    latency_known: false,
                });
            }
        }

        // 4. Deterministic Sort:
        //    a. Eligible before Ineligible (is_eligible descending)
        //    b. Total Score descending (Some before None, higher before lower)
        //    c. Provider ID ascending (lexicographical)
        //    d. Model ID ascending (lexicographical)
        evaluated_candidates.sort_by(|a, b| {
            // First by eligibility
            match (a.is_eligible, b.is_eligible) {
                (true, false) => return Ordering::Less,
                (false, true) => return Ordering::Greater,
                _ => {}
            }

            // Second by total_score descending
            match (a.total_score, b.total_score) {
                (Some(score_a), Some(score_b)) => {
                    // Descending float comparison
                    if let Some(ord) = score_b.partial_cmp(&score_a) {
                        if ord != Ordering::Equal {
                            return ord;
                        }
                    }
                }
                (Some(_), None) => return Ordering::Less,
                (None, Some(_)) => return Ordering::Greater,
                (None, None) => {}
            }

            // Third by provider_id ascending
            match a.provider_id.cmp(&b.provider_id) {
                Ordering::Equal => {}
                other => return other,
            }

            // Fourth by model_id ascending
            a.model_id.cmp(&b.model_id)
        });

        let eligible_count = evaluated_candidates.iter().filter(|c| c.is_eligible).count();
        let ineligible_count = evaluated_candidates.len() - eligible_count;
        let total_evaluated = evaluated_candidates.len();

        let top_candidate = evaluated_candidates.first();
        let explanation_summary = ExplanationGenerator::explain_batch_summary(
            total_evaluated,
            eligible_count,
            ineligible_count,
            top_candidate,
        );

        // Apply max_candidates truncation if requested
        if let Some(max) = request.max_candidates {
            if max > 0 && max < evaluated_candidates.len() {
                evaluated_candidates.truncate(max);
            }
        }

        let elapsed_ms = start.elapsed().as_millis() as u64;
        if let Ok(mut lock) = self.last_latency_ms.write() {
            *lock = Some(elapsed_ms);
        }

        Ok(RoutingScoreResult {
            request_id,
            candidates: evaluated_candidates,
            eligible_count,
            ineligible_count,
            evaluated_candidates_count: total_evaluated,
            weights_applied: active_weights,
            scoring_latency_ms: elapsed_ms,
            explanation_summary,
        })
    }

    /// Queries current active scoring weights.
    pub fn get_weights(&self) -> RoutingScoringWeights {
        self.weights
            .read()
            .map(|w| w.clone())
            .unwrap_or_default()
    }

    /// Updates active scoring weights after validation.
    pub fn update_weights(&self, weights: RoutingScoringWeights) -> Result<(), RoutingScoringError> {
        weights.validate()?;
        if let Ok(mut lock) = self.weights.write() {
            *lock = weights;
        }
        Ok(())
    }

    /// Queries diagnostic status of the scoring engine.
    pub fn get_status(&self) -> RoutingScoringStatus {
        let models = self.registry.list_all_models();
        let last_latency = self.last_latency_ms.read().ok().and_then(|v| *v);

        RoutingScoringStatus {
            is_available: true,
            registered_models_count: models.len(),
            configured_profiles_count: 12, // Canonical profiles registered
            active_weights: self.get_weights(),
            last_scoring_latency_ms: last_latency,
        }
    }
}

fn uuid_or_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{:x}", now)
}

