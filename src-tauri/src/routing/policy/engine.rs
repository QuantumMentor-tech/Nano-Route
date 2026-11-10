// ============================================================================
// Nano Route - Routing Policy Engine
// File: src-tauri/src/routing/policy/engine.rs
// ============================================================================
// Central orchestration service for final route determination and manual overrides.
// Evaluates candidate suitability scores from Step 29, applies routing policy,
// validates manual model overrides, and determines the authoritative final route.
// Strictly decoupled from provider HTTP networking and streaming execution.
// ============================================================================

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::Instant;

use crate::analysis::types::TaskAnalysisResult;
use crate::providers::capability_service::ProviderCapabilityService;
use crate::providers::health_manager::ProviderHealthManager;
use crate::providers::identity::ProviderId;
use crate::providers::preflight::PreflightEvaluator;
use crate::providers::registry::ProviderRegistry;
use crate::routing::policy::config::RoutingPolicyConfig;
use crate::routing::policy::errors::RoutingPolicyError;
use crate::routing::policy::override_evaluator::ManualOverrideEvaluator;
use crate::routing::policy::selection::PolicySelector;
use crate::routing::policy::types::{
    CandidateSelectionStatus, FallbackCandidate, ManualRouteOverride, OverrideResolution,
    OverrideState, OverrideValidationResult, RankedCandidate, RoutingConfidenceMetadata,
    RoutingDecision, RoutingDecisionExplanation, RoutingPolicyDiagnostics, RoutingPolicyRequest,
    SelectedRouteCandidate, SelectionMode,
};
use crate::routing::scoring::engine::RoutingScoringEngine;
use crate::routing::scoring::types::{RoutingScoreRequest, RoutingScoreResult};
use crate::services::provider_preferences::ProviderPreferencesService;
use crate::services::settings::AppSettingsService;

pub struct RoutingPolicyEngine {
    registry: Arc<ProviderRegistry>,
    health_manager: Arc<ProviderHealthManager>,
    capability_service: Arc<ProviderCapabilityService>,
    preflight_evaluator: Arc<PreflightEvaluator>,
    provider_preferences: Arc<ProviderPreferencesService>,
    scoring_engine: Arc<RoutingScoringEngine>,
    app_settings: Arc<AppSettingsService>,
    override_evaluator: ManualOverrideEvaluator,
    config: RwLock<RoutingPolicyConfig>,
    last_duration_ms: RwLock<Option<u64>>,
}

impl RoutingPolicyEngine {
    pub fn new(
        registry: Arc<ProviderRegistry>,
        health_manager: Arc<ProviderHealthManager>,
        capability_service: Arc<ProviderCapabilityService>,
        preflight_evaluator: Arc<PreflightEvaluator>,
        provider_preferences: Arc<ProviderPreferencesService>,
        scoring_engine: Arc<RoutingScoringEngine>,
        app_settings: Arc<AppSettingsService>,
    ) -> Self {
        let override_evaluator = ManualOverrideEvaluator::new(
            registry.clone(),
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
            scoring_engine,
            app_settings,
            override_evaluator,
            config: RwLock::new(RoutingPolicyConfig::default()),
            last_duration_ms: RwLock::new(None),
        }
    }

    /// Evaluates final route selection based on candidate scores, policy rules, and optional manual override.
    pub fn evaluate_route(
        &self,
        request: RoutingPolicyRequest,
    ) -> Result<RoutingDecision, RoutingPolicyError> {
        let start = Instant::now();
        let now_ms = current_epoch_ms();

        // 1. Capture Policy Configuration Snapshot
        let mut policy_config = self.get_config();
        policy_config.validate()?;

        // Synchronize preference profile with AppSettings if available
        if let Ok(settings_snapshot) = self.app_settings.get_settings() {
            policy_config.preference_profile = settings_snapshot.routing_preference_mode;
        }

        let request_id = request
            .request_id
            .clone()
            .unwrap_or_else(|| format!("req-{}", uuid_or_timestamp()));
        let decision_id = format!("dec-{}", uuid_or_timestamp());

        // 2. Resolve Candidate Scoring Result (from request or evaluate on-the-fly)
        let scoring_result: RoutingScoreResult = match request.scoring_result {
            Some(res) => res,
            None => {
                let analysis = request.task_analysis.as_ref().ok_or_else(|| {
                    RoutingPolicyError::missing_input(
                        "Must provide either scoring_result or task_analysis for routing policy evaluation",
                    )
                })?;

                let scoring_req = RoutingScoreRequest {
                    request_id: Some(request_id.clone()),
                    task_analysis: analysis.clone(),
                    required_capabilities_override: None,
                    preferred_providers: None,
                    estimated_input_tokens: request.estimated_input_tokens,
                    estimated_output_tokens: request.estimated_output_tokens,
                    max_candidates: None,
                };

                self.scoring_engine
                    .score_candidates(scoring_req)
                    .map_err(|e| RoutingPolicyError::internal(e.to_string()))?
            }
        };

        // 3. Load User Provider Priority Weights
        let mut provider_priorities = HashMap::new();
        if let Ok(statuses) = self.provider_preferences.list_provider_configurations() {
            for status in statuses {
                provider_priorities.insert(status.provider_id, status.priority_weight);
            }
        }

        let total_candidates_evaluated = scoring_result.candidates.len();
        let eligible_candidates_count = scoring_result
            .candidates
            .iter()
            .filter(|c| c.is_eligible)
            .count();

        // 4. Check for Explicit Manual Route Override
        if let Some(manual_override) = &request.manual_override {
            if manual_override.enabled {
                let validation = self.override_evaluator.validate(
                    manual_override,
                    request.task_analysis.as_ref(),
                    request.estimated_input_tokens,
                    request.estimated_output_tokens,
                );

                if validation.is_valid {
                    // Manual Override Valid and Accepted
                    return self.build_accepted_override_decision(
                        decision_id,
                        request_id,
                        policy_config,
                        manual_override,
                        &scoring_result,
                        request.task_analysis.as_ref(),
                        start.elapsed().as_millis() as u64,
                        now_ms,
                    );
                } else {
                    // Manual Override Rejected
                    if policy_config.fallback_on_rejected_override {
                        // Fall back to automatic routing with explicit override rejection audit
                        let (mode, selected, fallbacks, ranking, reason, explanation, confidence) =
                            PolicySelector::select_automatic_route(
                                &scoring_result.candidates,
                                &policy_config,
                                request.task_analysis.as_ref(),
                                &provider_priorities,
                            );

                        let override_meta = Some(OverrideResolution {
                            requested_provider_id: manual_override.provider_id.clone(),
                            requested_model_id: manual_override.model_id.clone(),
                            state: OverrideState::Rejected,
                            reason: validation.message.clone(),
                        });

                        let duration = start.elapsed().as_millis() as u64;
                        self.record_duration(duration);

                        return Ok(RoutingDecision {
                            decision_id,
                            request_id,
                            policy_version: policy_config.policy_version.clone(),
                            scoring_algorithm_version: scoring_result.weights_applied.intent_weight.to_string(),
                            selection_mode: mode,
                            selected_candidate: selected,
                            fallback_candidates: fallbacks,
                            candidate_ranking: ranking,
                            decision_reason: format!(
                                "Override rejected ({}); fell back to automatic: {}",
                                validation.message, reason
                            ),
                            structured_explanation: explanation,
                            override_metadata: override_meta,
                            confidence_metadata: confidence,
                            diagnostics: RoutingPolicyDiagnostics {
                                total_candidates_evaluated,
                                eligible_candidates_count,
                                policy_filtered_count: 0,
                                decision_duration_ms: duration,
                                policy_version: policy_config.policy_version,
                            },
                            generated_at_ms: now_ms,
                        });
                    } else {
                        // Strict rejection without automatic fallback
                        return self.build_rejected_override_decision(
                            decision_id,
                            request_id,
                            policy_config,
                            manual_override,
                            validation,
                            &scoring_result,
                            request.task_analysis.as_ref(),
                            start.elapsed().as_millis() as u64,
                            now_ms,
                        );
                    }
                }
            }
        }

        // 5. Automatic Route Selection Flow
        let (selection_mode, selected, fallbacks, ranking, decision_reason, explanation, confidence) =
            PolicySelector::select_automatic_route(
                &scoring_result.candidates,
                &policy_config,
                request.task_analysis.as_ref(),
                &provider_priorities,
            );

        let duration = start.elapsed().as_millis() as u64;
        self.record_duration(duration);

        Ok(RoutingDecision {
            decision_id,
            request_id,
            policy_version: policy_config.policy_version.clone(),
            scoring_algorithm_version: "nano-route-scoring-v1".to_string(),
            selection_mode,
            selected_candidate: selected,
            fallback_candidates: fallbacks,
            candidate_ranking: ranking,
            decision_reason,
            structured_explanation: explanation,
            override_metadata: None,
            confidence_metadata: confidence,
            diagnostics: RoutingPolicyDiagnostics {
                total_candidates_evaluated,
                eligible_candidates_count,
                policy_filtered_count: 0,
                decision_duration_ms: duration,
                policy_version: policy_config.policy_version,
            },
            generated_at_ms: now_ms,
        })
    }

    /// Builds a RoutingDecision when a manual override is validated and accepted.
    fn build_accepted_override_decision(
        &self,
        decision_id: String,
        request_id: String,
        policy_config: RoutingPolicyConfig,
        manual_override: &ManualRouteOverride,
        scoring_result: &RoutingScoreResult,
        task_analysis: Option<&TaskAnalysisResult>,
        duration_ms: u64,
        now_ms: u64,
    ) -> Result<RoutingDecision, RoutingPolicyError> {
        let canonical_id = ProviderId::new(&manual_override.provider_id)
            .map_err(|e| RoutingPolicyError::invalid_config(e.to_string()))?;

        let model = self
            .registry
            .get_model(&canonical_id, &manual_override.model_id)
            .ok_or_else(|| {
                RoutingPolicyError::model_not_found(format!(
                    "Model '{}' not found",
                    manual_override.model_id
                ))
            })?;

        // Find candidate score if present in scoring result
        let matched_candidate = scoring_result
            .candidates
            .iter()
            .find(|c| c.provider_id == manual_override.provider_id && c.model_id == manual_override.model_id);

        let score = matched_candidate.and_then(|c| c.total_score);

        let selected = SelectedRouteCandidate {
            provider_id: manual_override.provider_id.clone(),
            model_id: manual_override.model_id.clone(),
            display_name: model.display_name.clone(),
            score,
            selection_margin: None,
            context_window: model.context_window,
        };

        // Prepare fallbacks from remaining eligible candidates
        let mut fallbacks = Vec::new();
        let eligible_others: Vec<&crate::routing::scoring::types::CandidateScore> = scoring_result
            .candidates
            .iter()
            .filter(|c| {
                c.is_eligible
                    && !(c.provider_id == manual_override.provider_id
                        && c.model_id == manual_override.model_id)
            })
            .take(policy_config.max_fallback_candidates)
            .collect();

        for (idx, fb) in eligible_others.iter().enumerate() {
            fallbacks.push(FallbackCandidate {
                rank: idx + 1,
                provider_id: fb.provider_id.clone(),
                model_id: fb.model_id.clone(),
                display_name: fb.display_name.clone(),
                score: fb.total_score.unwrap_or(0.0),
                reason: format!("Eligible fallback candidate #{} under manual override", idx + 1),
            });
        }

        // Diagnostic ranking
        let mut ranking = Vec::new();
        ranking.push(RankedCandidate {
            rank: 1,
            provider_id: manual_override.provider_id.clone(),
            model_id: manual_override.model_id.clone(),
            display_name: model.display_name.clone(),
            score,
            status: CandidateSelectionStatus::SelectedPrimary,
            rejection_reasons: Vec::new(),
        });

        for (idx, fb) in fallbacks.iter().enumerate() {
            ranking.push(RankedCandidate {
                rank: idx + 2,
                provider_id: fb.provider_id.clone(),
                model_id: fb.model_id.clone(),
                display_name: fb.display_name.clone(),
                score: Some(fb.score),
                status: CandidateSelectionStatus::EligibleFallback,
                rejection_reasons: Vec::new(),
            });
        }

        let decision_reason = format!(
            "Manually routed to '{}' ({}/{}) per explicit user override",
            model.display_name, manual_override.provider_id, manual_override.model_id
        );

        let explanation = RoutingDecisionExplanation {
            mode: SelectionMode::ManualOverride,
            summary: format!(
                "Selected '{}' via accepted explicit manual override",
                model.display_name
            ),
            primary_reason: "User explicitly configured route override".to_string(),
            score_reason: score.map(|s| format!("Candidate suitability score: {:.3}", s)),
            policy_reason: Some("Manual override permitted by policy".to_string()),
            override_reason: manual_override.reason.clone().or_else(|| {
                Some("Explicit user selection from UI control".to_string())
            }),
            eligibility_reason: Some("Passed manual override safety validation".to_string()),
            fallback_reason: Some(format!("Prepared {} fallback candidates", fallbacks.len())),
        };

        let confidence = RoutingConfidenceMetadata {
            slm_analysis_confidence: task_analysis.map(|a| a.complexity.confidence),
            selected_score: score,
            selection_margin: None,
            is_ambiguous: false,
        };

        self.record_duration(duration_ms);

        Ok(RoutingDecision {
            decision_id,
            request_id,
            policy_version: policy_config.policy_version.clone(),
            scoring_algorithm_version: "nano-route-scoring-v1".to_string(),
            selection_mode: SelectionMode::ManualOverride,
            selected_candidate: Some(selected),
            fallback_candidates: fallbacks,
            candidate_ranking: ranking,
            decision_reason,
            structured_explanation: explanation,
            override_metadata: Some(OverrideResolution {
                requested_provider_id: manual_override.provider_id.clone(),
                requested_model_id: manual_override.model_id.clone(),
                state: OverrideState::Accepted,
                reason: "Manual route override validated and applied".to_string(),
            }),
            confidence_metadata: confidence,
            diagnostics: RoutingPolicyDiagnostics {
                total_candidates_evaluated: scoring_result.candidates.len(),
                eligible_candidates_count: scoring_result.candidates.iter().filter(|c| c.is_eligible).count(),
                policy_filtered_count: 0,
                decision_duration_ms: duration_ms,
                policy_version: policy_config.policy_version,
            },
            generated_at_ms: now_ms,
        })
    }

    /// Builds a RoutingDecision when a manual override is rejected and fallback is disabled.
    fn build_rejected_override_decision(
        &self,
        decision_id: String,
        request_id: String,
        policy_config: RoutingPolicyConfig,
        manual_override: &ManualRouteOverride,
        validation: OverrideValidationResult,
        scoring_result: &RoutingScoreResult,
        task_analysis: Option<&TaskAnalysisResult>,
        duration_ms: u64,
        now_ms: u64,
    ) -> Result<RoutingDecision, RoutingPolicyError> {
        let decision_reason = format!(
            "Manual route override for '{}/{}' rejected: {}",
            manual_override.provider_id, manual_override.model_id, validation.message
        );

        let ranking = vec![RankedCandidate {
            rank: 1,
            provider_id: manual_override.provider_id.clone(),
            model_id: manual_override.model_id.clone(),
            display_name: manual_override.model_id.clone(),
            score: None,
            status: CandidateSelectionStatus::OverrideRejectedConflict,
            rejection_reasons: vec![validation.message.clone()],
        }];

        let explanation = RoutingDecisionExplanation {
            mode: SelectionMode::OverrideRejected,
            summary: format!(
                "Manual route override for '{}/{}' was rejected by policy safeguards",
                manual_override.provider_id, manual_override.model_id
            ),
            primary_reason: validation.message.clone(),
            score_reason: None,
            policy_reason: Some("Override rejected due to hard capability/health violation".to_string()),
            override_reason: Some(format!("Override rejected: {}", validation.message)),
            eligibility_reason: Some(validation.message.clone()),
            fallback_reason: Some("Automatic fallback on rejected override is disabled".to_string()),
        };

        let confidence = RoutingConfidenceMetadata {
            slm_analysis_confidence: task_analysis.map(|a| a.complexity.confidence),
            selected_score: None,
            selection_margin: None,
            is_ambiguous: false,
        };

        self.record_duration(duration_ms);

        Ok(RoutingDecision {
            decision_id,
            request_id,
            policy_version: policy_config.policy_version.clone(),
            scoring_algorithm_version: "nano-route-scoring-v1".to_string(),
            selection_mode: SelectionMode::OverrideRejected,
            selected_candidate: None,
            fallback_candidates: Vec::new(),
            candidate_ranking: ranking,
            decision_reason,
            structured_explanation: explanation,
            override_metadata: Some(OverrideResolution {
                requested_provider_id: manual_override.provider_id.clone(),
                requested_model_id: manual_override.model_id.clone(),
                state: OverrideState::Rejected,
                reason: validation.message,
            }),
            confidence_metadata: confidence,
            diagnostics: RoutingPolicyDiagnostics {
                total_candidates_evaluated: scoring_result.candidates.len(),
                eligible_candidates_count: scoring_result.candidates.iter().filter(|c| c.is_eligible).count(),
                policy_filtered_count: 0,
                decision_duration_ms: duration_ms,
                policy_version: policy_config.policy_version,
            },
            generated_at_ms: now_ms,
        })
    }

    /// Queries the current active policy configuration snapshot.
    pub fn get_config(&self) -> RoutingPolicyConfig {
        self.config
            .read()
            .map(|c| c.clone())
            .unwrap_or_default()
    }

    /// Updates the policy configuration after validating invariants.
    pub fn update_config(&self, config: RoutingPolicyConfig) -> Result<(), RoutingPolicyError> {
        config.validate()?;
        if let Ok(mut lock) = self.config.write() {
            *lock = config;
        }
        Ok(())
    }

    /// Directly validates a proposed manual route override without dispatching a decision.
    pub fn validate_override(
        &self,
        override_req: &ManualRouteOverride,
        task_analysis: Option<&TaskAnalysisResult>,
    ) -> OverrideValidationResult {
        self.override_evaluator
            .validate(override_req, task_analysis, None, None)
    }

    fn record_duration(&self, ms: u64) {
        if let Ok(mut lock) = self.last_duration_ms.write() {
            *lock = Some(ms);
        }
    }
}

fn current_epoch_ms() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn uuid_or_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{:x}", now)
}

