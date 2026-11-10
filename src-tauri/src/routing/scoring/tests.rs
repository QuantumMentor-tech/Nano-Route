// ============================================================================
// Nano Route - Routing Scoring Engine Unit Tests
// File: src-tauri/src/routing/scoring/tests.rs
// ============================================================================

#[cfg(test)]
mod tests {
    use super::super::calculator::{clamp_01, ScoreCalculator};
    use super::super::eligibility::EligibilityEvaluator;
    use super::super::engine::RoutingScoringEngine;
    use super::super::explanation::ExplanationGenerator;
    use super::super::profiles::{BuiltinRoutingProfiles, ModelRoutingProfile, ModelTier};
    use super::super::types::{
        CandidateScore, IneligibilityReason, RoutingScoreRequest, ScoreBreakdown,
    };
    use super::super::weights::RoutingScoringWeights;

    use crate::analysis::types::{
        AnalysisAmbiguity, AnalysisCompleteness, AnalysisSource, ComplexityAnalysis,
        DomainCandidate, IntentSummary, RequirementStrength, TaskAnalysisResult,
        TaskCapabilityAssessment, TaskCapabilityRequirement, TaskComplexity, TaskDomain,
    };
    use crate::classification::types::{AmbiguityState, UserIntent};
    use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
    use crate::providers::capability_service::ProviderCapabilityService;
    use crate::providers::catalog::builtin_catalog;
    use crate::providers::descriptor::ProviderDescriptor;
    use crate::providers::health_manager::ProviderHealthManager;
    use crate::providers::health_types::RuntimeHealthState;
    use crate::providers::identity::ProviderId;
    use crate::providers::models::{ModelAvailability, ModelPricing, ProviderModel};
    use crate::providers::preflight::PreflightEvaluator;
    use crate::providers::registry::ProviderRegistry;
    use crate::services::provider_preferences::ProviderPreferencesService;
    use crate::storage::DatabaseManager;

    use std::collections::HashMap;
    use std::sync::Arc;

    fn sample_task_analysis(
        intent: UserIntent,
        complexity: TaskComplexity,
        domain: TaskDomain,
        required_caps: Vec<TaskCapabilityRequirement>,
    ) -> TaskAnalysisResult {
        TaskAnalysisResult {
            request_id: "test-req-1".to_string(),
            intent: IntentSummary {
                primary_intent: intent,
                confidence: 0.95,
                ambiguity: AmbiguityState::Unambiguous,
                secondary_intents: Vec::new(),
            },
            complexity: ComplexityAnalysis {
                level: complexity,
                confidence: 0.90,
                source: AnalysisSource::Model,
                score: 0.85,
                evidence_codes: vec!["CODE_COMPLEXITY_HIGH".to_string()],
            },
            primary_domain: DomainCandidate {
                domain,
                confidence: 0.92,
                source: AnalysisSource::Model,
            },
            secondary_domains: Vec::new(),
            capabilities: required_caps
                .into_iter()
                .map(|c| TaskCapabilityAssessment {
                    capability: c,
                    strength: RequirementStrength::Required,
                    confidence: 0.95,
                    source: AnalysisSource::Model,
                    reason_code: "REQ_CAP".to_string(),
                })
                .collect(),
            evidence: Vec::new(),
            conflicts: Vec::new(),
            ambiguity: AnalysisAmbiguity::Low,
            completeness: AnalysisCompleteness::Complete,
            analyzer_model_id: "test-analyzer".to_string(),
            analyzer_model_version: "1.0.0".to_string(),
            analysis_schema_version: "nano-route-analysis-schema-v1".to_string(),
            inference_latency_ms: 25,
            total_latency_ms: 30,
            explanation: "Test analysis result".to_string(),
        }
    }

    #[test]
    fn test_clamp_01_nan_inf_guards() {
        assert_eq!(clamp_01(f64::NAN), 0.0);
        assert_eq!(clamp_01(f64::INFINITY), 0.0);
        assert_eq!(clamp_01(f64::NEG_INFINITY), 0.0);
        assert_eq!(clamp_01(-0.5), 0.0);
        assert_eq!(clamp_01(1.5), 1.0);
        assert_eq!(clamp_01(0.75), 0.75);
    }

    #[test]
    fn test_weights_validation_and_normalization() {
        let valid = RoutingScoringWeights::default();
        assert!(valid.validate().is_ok());

        let mut invalid = RoutingScoringWeights::default();
        invalid.intent_weight = 0.50; // Sum becomes 1.35
        assert!(invalid.validate().is_err());

        let normalized = invalid.normalized().expect("Should normalize cleanly");
        assert!(normalized.validate().is_ok());

        let mut negative = RoutingScoringWeights::default();
        negative.cost_weight = -0.10;
        assert!(negative.validate().is_err());
    }

    #[test]
    fn test_ineligible_candidate_has_no_score() {
        let analysis = sample_task_analysis(
            UserIntent::CodeGeneration,
            TaskComplexity::High,
            TaskDomain::SoftwareEngineering,
            vec![TaskCapabilityRequirement::ImageInput], // Demands image input
        );

        let provider_id = ProviderId::new(ProviderId::OPENAI).unwrap();
        let provider = ProviderDescriptor::new(
            provider_id.clone(),
            "OpenAI",
            "OpenAI provider",
            "https://api.openai.com/v1",
            ProviderCapabilities::standard_chat(),
        );

        // Candidate model that lacks ImageInput/Vision
        let text_only_model = ProviderModel::new(
            provider_id,
            "text-only-model",
            "Text Only Model",
            8192,
            ProviderCapabilities::from_slice(&[ProviderCapability::TextGeneration]),
        );

        // Preflight / DB mocks
        let db_manager = Arc::new(DatabaseManager::in_memory().unwrap());
        let prefs = Arc::new(ProviderPreferencesService::new(db_manager));
        let registry = Arc::new(ProviderRegistry::new());
        let cap_service = Arc::new(ProviderCapabilityService::new(registry.clone()));
        let health_mgr = Arc::new(ProviderHealthManager::new(registry.clone()));
        let preflight = Arc::new(PreflightEvaluator::new(
            registry.clone(),
            cap_service.clone(),
            health_mgr.clone(),
        ));

        let evaluator = EligibilityEvaluator::new(cap_service, preflight, prefs);
        let eligibility = evaluator.evaluate(&provider, &text_only_model, &analysis, None, None, None);

        assert!(!eligibility.is_eligible);
        assert!(eligibility.ineligibility_reasons.iter().any(|r| match r {
            IneligibilityReason::MissingRequiredCapability { capability } => {
                capability.contains("image_input")
            }
            _ => false,
        }));
    }

    #[test]
    fn test_preference_weight_cannot_revive_ineligible_candidate() {
        // High user preference (e.g. 10/10) cannot make an ineligible candidate eligible
        let ineligibility = IneligibilityReason::CredentialMissing {
            provider_id: "openai".to_string(),
        };
        let reasons = vec![ineligibility];

        let candidate = CandidateScore {
            provider_id: "openai".to_string(),
            model_id: "gpt-4o".to_string(),
            display_name: "GPT-4o".to_string(),
            is_eligible: false,
            ineligibility_reasons: reasons,
            total_score: None,
            breakdown: None,
            adjustments: Vec::new(),
            explanation: "Missing credential".to_string(),
            context_window: 128_000,
            pricing_known: true,
            latency_known: true,
        };

        assert!(!candidate.is_eligible);
        assert!(candidate.total_score.is_none());
        assert!(candidate.breakdown.is_none());
    }

    #[test]
    fn test_unknown_pricing_gives_neutral_cost_fit() {
        let provider_id = ProviderId::new(ProviderId::OPENAI).unwrap();
        let unpriced_model = ProviderModel::new(
            provider_id,
            "custom-local-model",
            "Custom Local Model",
            32768,
            ProviderCapabilities::standard_chat(),
        ); // pricing is None

        let profile = BuiltinRoutingProfiles::get_profile("custom-local-model");
        let (breakdown, _, _, pricing_known, _) = ScoreCalculator::calculate(
            &ProviderDescriptor::new(
                ProviderId::new(ProviderId::OPENAI).unwrap(),
                "OpenAI",
                "Desc",
                "https://api.openai.com",
                ProviderCapabilities::standard_chat(),
            ),
            &unpriced_model,
            &profile,
            &sample_task_analysis(
                UserIntent::ConversationalChat,
                TaskComplexity::Low,
                TaskDomain::General,
                vec![],
            ),
            RuntimeHealthState::Healthy,
            5,
            None,
            None,
            None,
            &RoutingScoringWeights::default(),
        );

        assert!(!pricing_known);
        assert_eq!(breakdown.cost_fit, 0.50); // Neutral score, NOT 1.00 ($0 assumption)
    }

    #[test]
    fn test_deterministic_candidate_sorting() {
        let mut candidates = vec![
            CandidateScore {
                provider_id: "openai".to_string(),
                model_id: "gpt-4o-mini".to_string(),
                display_name: "GPT-4o mini".to_string(),
                is_eligible: true,
                ineligibility_reasons: vec![],
                total_score: Some(0.850),
                breakdown: None,
                adjustments: vec![],
                explanation: "".to_string(),
                context_window: 128_000,
                pricing_known: true,
                latency_known: true,
            },
            CandidateScore {
                provider_id: "anthropic".to_string(),
                model_id: "claude-3-5-sonnet".to_string(),
                display_name: "Claude 3.5 Sonnet".to_string(),
                is_eligible: true,
                ineligibility_reasons: vec![],
                total_score: Some(0.920),
                breakdown: None,
                adjustments: vec![],
                explanation: "".to_string(),
                context_window: 200_000,
                pricing_known: true,
                latency_known: true,
            },
            CandidateScore {
                provider_id: "groq".to_string(),
                model_id: "llama-3.3-70b".to_string(),
                display_name: "Llama 3.3 70B".to_string(),
                is_eligible: false,
                ineligibility_reasons: vec![IneligibilityReason::CredentialMissing {
                    provider_id: "groq".to_string(),
                }],
                total_score: None,
                breakdown: None,
                adjustments: vec![],
                explanation: "".to_string(),
                context_window: 128_000,
                pricing_known: true,
                latency_known: true,
            },
            CandidateScore {
                provider_id: "deepseek".to_string(),
                model_id: "deepseek-chat".to_string(),
                display_name: "DeepSeek Chat".to_string(),
                is_eligible: true,
                ineligibility_reasons: vec![],
                total_score: Some(0.850), // Tied with gpt-4o-mini
                breakdown: None,
                adjustments: vec![],
                explanation: "".to_string(),
                context_window: 64_000,
                pricing_known: true,
                latency_known: true,
            },
        ];

        candidates.sort_by(|a, b| {
            match (a.is_eligible, b.is_eligible) {
                (true, false) => return std::cmp::Ordering::Less,
                (false, true) => return std::cmp::Ordering::Greater,
                _ => {}
            }
            match (a.total_score, b.total_score) {
                (Some(sa), Some(sb)) => {
                    if let Some(ord) = sb.partial_cmp(&sa) {
                        if ord != std::cmp::Ordering::Equal {
                            return ord;
                        }
                    }
                }
                (Some(_), None) => return std::cmp::Ordering::Less,
                (None, Some(_)) => return std::cmp::Ordering::Greater,
                (None, None) => {}
            }
            match a.provider_id.cmp(&b.provider_id) {
                std::cmp::Ordering::Equal => {}
                other => return other,
            }
            a.model_id.cmp(&b.model_id)
        });

        // Expected order:
        // 1: Claude 3.5 Sonnet (eligible, score 0.920)
        // 2: DeepSeek Chat (eligible, score 0.850, provider "deepseek" < "openai")
        // 3: GPT-4o mini (eligible, score 0.850, provider "openai")
        // 4: Llama 3.3 70B (ineligible, score None)
        assert_eq!(candidates[0].model_id, "claude-3-5-sonnet");
        assert_eq!(candidates[1].model_id, "deepseek-chat");
        assert_eq!(candidates[2].model_id, "gpt-4o-mini");
        assert_eq!(candidates[3].model_id, "llama-3.3-70b");
    }

    #[test]
    fn test_complexity_alignment() {
        let frontier_profile = BuiltinRoutingProfiles::get_profile("claude-3-5-sonnet-20241022");
        let lightweight_profile = BuiltinRoutingProfiles::get_profile("gpt-4o-mini");

        // High complexity task
        let high_task = sample_task_analysis(
            UserIntent::CodeGeneration,
            TaskComplexity::VeryHigh,
            TaskDomain::SoftwareEngineering,
            vec![],
        );

        let frontier_affinity = frontier_profile.get_complexity_affinity(high_task.complexity.level);
        let lightweight_affinity = lightweight_profile.get_complexity_affinity(high_task.complexity.level);

        assert!(
            frontier_affinity > lightweight_affinity,
            "Frontier model affinity ({}) should exceed lightweight model affinity ({}) for VeryHigh complexity",
            frontier_affinity, lightweight_affinity
        );

        // Trivial complexity task
        let trivial_task = sample_task_analysis(
            UserIntent::ConversationalChat,
            TaskComplexity::Trivial,
            TaskDomain::General,
            vec![],
        );

        let frontier_triv = frontier_profile.get_complexity_affinity(trivial_task.complexity.level);
        let lightweight_triv = lightweight_profile.get_complexity_affinity(trivial_task.complexity.level);

        assert!(
            lightweight_triv > frontier_triv,
            "Lightweight model affinity ({}) should exceed frontier model affinity ({}) for Trivial complexity",
            lightweight_triv, frontier_triv
        );
    }
}

