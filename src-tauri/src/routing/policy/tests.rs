// ============================================================================
// Nano Route - Routing Policy Engine Unit Tests
// File: src-tauri/src/routing/policy/tests.rs
// ============================================================================

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Arc;

    use super::super::config::RoutingPolicyConfig;
    use super::super::engine::RoutingPolicyEngine;
    use super::super::selection::PolicySelector;
    use super::super::types::{
        CandidateSelectionStatus, ManualRouteOverride, OverrideRejectionReason,
        RoutingPolicyRequest, SelectionMode,
    };

    use crate::analysis::types::{
        AnalysisAmbiguity, AnalysisCompleteness, AnalysisSource, ComplexityAnalysis,
        DomainCandidate, IntentSummary, RequirementStrength, TaskAnalysisResult,
        TaskCapabilityAssessment, TaskCapabilityRequirement, TaskComplexity, TaskDomain,
    };
    use crate::classification::types::{AmbiguityState, UserIntent};
    use crate::domain::settings::RoutingPreferenceMode;
    use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
    use crate::providers::capability_service::ProviderCapabilityService;
    use crate::providers::descriptor::ProviderDescriptor;
    use crate::providers::health_manager::ProviderHealthManager;
    use crate::providers::identity::ProviderId;
    use crate::providers::models::{ModelAvailability, ProviderModel};
    use crate::providers::preflight::PreflightEvaluator;
    use crate::providers::registry::ProviderRegistry;
    use crate::routing::scoring::engine::RoutingScoringEngine;
    use crate::routing::scoring::types::{
        CandidateScore, IneligibilityReason, RoutingScoreResult, ScoreBreakdown,
    };
    use crate::routing::scoring::weights::RoutingScoringWeights;
    use crate::services::provider_preferences::ProviderPreferencesService;
    use crate::services::settings::AppSettingsService;
    use crate::storage::DatabaseManager;

    fn sample_candidate_score(
        provider_id: &str,
        model_id: &str,
        display_name: &str,
        is_eligible: bool,
        total_score: Option<f64>,
        cost_fit: f64,
        context_window: u32,
    ) -> CandidateScore {
        let breakdown = total_score.map(|s| ScoreBreakdown {
            intent_fit: s,
            complexity_fit: s,
            domain_fit: s,
            capability_fit: s,
            context_fit: 0.95,
            modality_fit: 0.90,
            preference_fit: 0.50,
            cost_fit,
            latency_fit: 0.85,
            reliability_fit: 1.00,
            profile_fit: 0.85,
        });

        CandidateScore {
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            display_name: display_name.to_string(),
            is_eligible,
            ineligibility_reasons: if is_eligible {
                Vec::new()
            } else {
                vec![IneligibilityReason::CredentialMissing {
                    provider_id: provider_id.to_string(),
                }]
            },
            total_score,
            breakdown,
            adjustments: Vec::new(),
            explanation: format!("{}: test score", display_name),
            context_window,
            pricing_known: true,
            latency_known: true,
        }
    }

    #[test]
    fn test_automatic_selection_highest_valid_candidate() {
        let candidates = vec![
            sample_candidate_score("anthropic", "claude-3-5-sonnet", "Claude 3.5 Sonnet", true, Some(0.920), 0.70, 200_000),
            sample_candidate_score("openai", "gpt-4o", "GPT-4o", true, Some(0.890), 0.75, 128_000),
            sample_candidate_score("deepseek", "deepseek-chat", "DeepSeek Chat", true, Some(0.860), 0.95, 64_000),
            sample_candidate_score("groq", "llama-3.3-70b", "Llama 3.3 70B", false, None, 0.90, 128_000),
        ];

        let config = RoutingPolicyConfig::default();
        let priorities = HashMap::new();

        let (mode, selected, fallbacks, ranking, reason, explanation, confidence) =
            PolicySelector::select_automatic_route(&candidates, &config, None, &priorities);

        assert_eq!(mode, SelectionMode::Automatic);
        assert!(selected.is_some());
        let sel = selected.unwrap();
        assert_eq!(sel.provider_id, "anthropic");
        assert_eq!(sel.model_id, "claude-3-5-sonnet");
        assert_eq!(sel.score, Some(0.920));
        assert!(sel.selection_margin.is_some());
        assert_eq!(sel.selection_margin.unwrap(), 0.920 - 0.890);

        // Fallbacks must exclude primary and include remaining eligible candidates in order
        assert_eq!(fallbacks.len(), 2);
        assert_eq!(fallbacks[0].model_id, "gpt-4o");
        assert_eq!(fallbacks[1].model_id, "deepseek-chat");

        // Primary + 2 fallbacks + 1 hard-ineligible
        assert_eq!(ranking.len(), 4);
        assert_eq!(ranking[0].status, CandidateSelectionStatus::SelectedPrimary);
        assert_eq!(ranking[1].status, CandidateSelectionStatus::EligibleFallback);
        assert_eq!(ranking[2].status, CandidateSelectionStatus::EligibleFallback);
        assert_eq!(ranking[3].status, CandidateSelectionStatus::DisqualifiedHardConstraint);
    }

    #[test]
    fn test_cost_saving_preference_breaks_close_score_ties() {
        // Candidates with close scores (delta <= 4 * tie_tolerance = 0.06):
        // Model A score 0.880, cost_fit 0.60
        // Model B score 0.870, cost_fit 0.95 (far cheaper)
        let candidates = vec![
            sample_candidate_score("openai", "gpt-4o", "GPT-4o", true, Some(0.880), 0.60, 128_000),
            sample_candidate_score("deepseek", "deepseek-chat", "DeepSeek Chat", true, Some(0.870), 0.95, 64_000),
        ];

        let mut config = RoutingPolicyConfig::default();
        config.preference_profile = RoutingPreferenceMode::CostSaving;
        let priorities = HashMap::new();

        let (mode, selected, _, _, _, _, _) =
            PolicySelector::select_automatic_route(&candidates, &config, None, &priorities);

        assert_eq!(mode, SelectionMode::Automatic);
        let sel = selected.unwrap();
        // DeepSeek Chat should win under CostSaving mode due to superior cost_fit
        assert_eq!(sel.model_id, "deepseek-chat");
    }

    #[test]
    fn test_deterministic_tie_breaking_by_provider_priority_and_id() {
        // Tied scores exactly: 0.850 and 0.850
        let candidates = vec![
            sample_candidate_score("openai", "model-b", "Model B", true, Some(0.850), 0.80, 128_000),
            sample_candidate_score("anthropic", "model-a", "Model A", true, Some(0.850), 0.80, 128_000),
        ];

        let config = RoutingPolicyConfig::default();
        let mut priorities = HashMap::new();
        priorities.insert("anthropic".to_string(), 8); // higher priority weight
        priorities.insert("openai".to_string(), 5);

        let (_, selected, _, _, _, _, _) =
            PolicySelector::select_automatic_route(&candidates, &config, None, &priorities);

        let sel = selected.unwrap();
        assert_eq!(sel.provider_id, "anthropic");
    }

    #[test]
    fn test_threshold_filtering_returns_no_route_available() {
        let candidates = vec![
            sample_candidate_score("openai", "gpt-4o-mini", "GPT-4o mini", true, Some(0.250), 0.90, 128_000),
        ];

        let mut config = RoutingPolicyConfig::default();
        config.minimum_accepted_score = 0.50; // Threshold is 0.50, candidate score is 0.250
        let priorities = HashMap::new();

        let (mode, selected, fallbacks, ranking, reason, _, _) =
            PolicySelector::select_automatic_route(&candidates, &config, None, &priorities);

        assert_eq!(mode, SelectionMode::NoRouteAvailable);
        assert!(selected.is_none());
        assert!(fallbacks.is_empty());
        assert_eq!(ranking[0].status, CandidateSelectionStatus::FilteredPolicyThreshold);
        assert!(reason.contains("below minimum policy threshold"));
    }

    #[test]
    fn test_no_eligible_candidate_returns_no_route_available() {
        let candidates = vec![
            sample_candidate_score("groq", "llama-3.3-70b", "Llama 3.3 70B", false, None, 0.90, 128_000),
            sample_candidate_score("openai", "gpt-4o", "GPT-4o", false, None, 0.70, 128_000),
        ];

        let config = RoutingPolicyConfig::default();
        let priorities = HashMap::new();

        let (mode, selected, fallbacks, _, reason, _, _) =
            PolicySelector::select_automatic_route(&candidates, &config, None, &priorities);

        assert_eq!(mode, SelectionMode::NoRouteAvailable);
        assert!(selected.is_none());
        assert!(fallbacks.is_empty());
        assert!(reason.contains("No candidates satisfied"));
    }

    #[test]
    fn test_manual_override_validation_rejects_missing_capability() {
        let db_manager = Arc::new(DatabaseManager::in_memory().unwrap());
        let prefs = Arc::new(ProviderPreferencesService::new(db_manager.clone()));
        let registry = Arc::new(ProviderRegistry::new());
        let cap_service = Arc::new(ProviderCapabilityService::new(registry.clone()));
        let health_mgr = Arc::new(ProviderHealthManager::new(registry.clone()));
        let preflight = Arc::new(PreflightEvaluator::new(
            registry.clone(),
            cap_service.clone(),
            health_mgr.clone(),
        ));

        let evaluator = super::super::override_evaluator::ManualOverrideEvaluator::new(
            registry.clone(),
            cap_service.clone(),
            preflight.clone(),
            prefs.clone(),
        );

        // Task requires ImageInput
        let task_analysis = TaskAnalysisResult {
            request_id: "req-1".to_string(),
            intent: IntentSummary {
                primaryIntent: UserIntent::SoftwareEngineering,
                confidence: 0.95,
                ambiguity: AmbiguityState::NotAmbiguous,
                secondaryIntents: Vec::new(),
            },
            complexity: ComplexityAnalysis {
                level: TaskComplexity::Moderate,
                confidence: 0.90,
                source: AnalysisSource::Model,
                score: 0.80,
                evidence_codes: vec![],
            },
            primary_domain: DomainCandidate {
                domain: TaskDomain::SoftwareEngineering,
                confidence: 0.90,
                source: AnalysisSource::Model,
            },
            secondary_domains: vec![],
            capabilities: vec![TaskCapabilityAssessment {
                capability: TaskCapabilityRequirement::ImageInput,
                strength: RequirementStrength::Required,
                confidence: 0.98,
                source: AnalysisSource::Model,
                reason_code: "IMAGE_INPUT_DEMANDED".to_string(),
            }],
            evidence: vec![],
            conflicts: vec![],
            ambiguity: AnalysisAmbiguity::Low,
            completeness: AnalysisCompleteness::Complete,
            analyzer_model_id: "test".to_string(),
            analyzer_model_version: "1.0".to_string(),
            analysis_schema_version: "v1".to_string(),
            inference_latency_ms: 5,
            total_latency_ms: 10,
            explanation: "".to_string(),
        };

        // Try to override to DeepSeek Chat (which lacks ImageInput / Vision)
        let override_req = ManualRouteOverride {
            provider_id: "deepseek".to_string(),
            model_id: "deepseek-chat".to_string(),
            enabled: true,
            reason: Some("User requested DeepSeek".to_string()),
        };

        let result = evaluator.validate(&override_req, Some(&task_analysis), None, None);
        assert!(!result.is_valid);
        assert!(result.rejection_reason.is_some());
        match result.rejection_reason.unwrap() {
            OverrideRejectionReason::MissingRequiredCapability { capability } => {
                assert_eq!(capability, "image_input");
            }
            other => panic!("Expected MissingRequiredCapability, got {:?}", other),
        }
    }

    #[test]
    fn test_manual_override_validation_rejects_unknown_provider_and_model() {
        let db_manager = Arc::new(DatabaseManager::in_memory().unwrap());
        let prefs = Arc::new(ProviderPreferencesService::new(db_manager.clone()));
        let registry = Arc::new(ProviderRegistry::new());
        let cap_service = Arc::new(ProviderCapabilityService::new(registry.clone()));
        let health_mgr = Arc::new(ProviderHealthManager::new(registry.clone()));
        let preflight = Arc::new(PreflightEvaluator::new(
            registry.clone(),
            cap_service.clone(),
            health_mgr.clone(),
        ));

        let evaluator = super::super::override_evaluator::ManualOverrideEvaluator::new(
            registry.clone(),
            cap_service.clone(),
            preflight.clone(),
            prefs.clone(),
        );

        // Unknown provider
        let bad_provider = ManualRouteOverride {
            provider_id: "unknown_provider".to_string(),
            model_id: "some_model".to_string(),
            enabled: true,
            reason: None,
        };
        let res_prov = evaluator.validate(&bad_provider, None, None, None);
        assert!(!res_prov.is_valid);

        // Unknown model
        let bad_model = ManualRouteOverride {
            provider_id: "openai".to_string(),
            model_id: "nonexistent-model-xyz".to_string(),
            enabled: true,
            reason: None,
        };
        let res_mod = evaluator.validate(&bad_model, None, None, None);
        assert!(!res_mod.is_valid);
    }
}

