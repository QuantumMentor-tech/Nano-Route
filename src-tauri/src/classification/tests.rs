// ============================================================================
// Nano Route - Step 27 Intent Classifier Unit Tests
// File: src-tauri/src/classification/tests.rs
// ============================================================================
// Verifies intent taxonomy, label schemas, numerical safety (NaN/Inf protection),
// deterministic tie-breaking, threshold policies, ambiguity modeling,
// multi-intent handling, cooperative cancellation, and privacy invariants.
// ============================================================================

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tokio_util::sync::CancellationToken;

    use crate::classification::errors::{ClassificationError, ClassificationErrorKind, ClassificationStage};
    use crate::classification::eval::{ClassifierEvaluationReport, GOLD_EVALUATION_SET};
    use crate::classification::label_map::ClassifierLabelMap;
    use crate::classification::mapper::{compute_stable_softmax, map_inference_output};
    use crate::classification::policy::{ClassificationPolicy, DEFAULT_CONFIDENCE_THRESHOLD};
    use crate::classification::preprocessor::preprocess_classification_input;
    use crate::classification::service::IntentClassifier;
    use crate::classification::taxonomy::{get_intent_definition, ALL_INTENTS};
    use crate::classification::types::{
        AmbiguityState, ClassifierAvailability, IntentCandidate, IntentClassificationRequest,
        UserIntent,
    };
    use crate::inference::backend::FakeInferenceBackend;
    use crate::inference::manifest::LocalModelManifest;
    use crate::inference::service::LocalSlmService;
    use crate::inference::tokenizer::MockTokenizer;
    use crate::inference::types::InferenceOutput;

    // ------------------------------------------------------------------------
    // 1. Taxonomy Integrity & Serialization Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_taxonomy_all_intents_have_valid_metadata() {
        assert_eq!(ALL_INTENTS.len(), 12);

        for &intent in &ALL_INTENTS {
            let def = get_intent_definition(intent);
            assert_eq!(def.intent, intent);
            assert!(!def.canonical_id.is_empty());
            assert!(!def.display_name.is_empty());
            assert!(!def.description.is_empty());

            // Bidirectional round-trip parsing
            let parsed = UserIntent::from_canonical(def.canonical_id);
            assert_eq!(parsed, Some(intent));
        }
    }

    #[test]
    fn test_taxonomy_rejects_invented_intent_strings() {
        assert_eq!(UserIntent::from_canonical("claude_prompt"), None);
        assert_eq!(UserIntent::from_canonical("developer_profile"), None);
        assert_eq!(UserIntent::from_canonical("anthropic_intent"), None);
    }

    // ------------------------------------------------------------------------
    // 2. Label Map Validation & Schema Enforcement Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_default_label_map_structure() {
        let label_map = ClassifierLabelMap::default_router_label_map("nano-route-router", "1.0.0");
        assert_eq!(label_map.expected_dimension(), 16);
        assert!(label_map.validate_output_dimension(16).is_ok());

        // Dimension mismatch fails
        let err = label_map.validate_output_dimension(8).unwrap_err();
        assert_eq!(err.kind, ClassificationErrorKind::LabelSchemaMismatch);
    }

    #[test]
    fn test_label_map_resolves_canonical_intents() {
        let label_map = ClassifierLabelMap::default_router_label_map("test-model", "1.0.0");

        let (intent_0, label_0) = label_map.get_intent(0).unwrap();
        assert_eq!(intent_0, UserIntent::SoftwareEngineering);
        assert_eq!(label_0, "software_engineering");

        let (intent_2, label_2) = label_map.get_intent(2).unwrap();
        assert_eq!(intent_2, UserIntent::ReasoningMath);
        assert_eq!(label_2, "reasoning_math");

        // Out of bounds index
        let err = label_map.get_intent(999).unwrap_err();
        assert_eq!(err.kind, ClassificationErrorKind::UnknownIntentLabel);
    }

    // ------------------------------------------------------------------------
    // 3. Input Preprocessor & Bounds Enforcement Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_preprocessor_rejects_empty_and_whitespace_input() {
        let req_empty = IntentClassificationRequest {
            request_id: None,
            text: "".to_string(),
            conversation_context: None,
            language_hint: None,
        };
        let err_empty = preprocess_classification_input(&req_empty, 512).unwrap_err();
        assert_eq!(err_empty.kind, ClassificationErrorKind::EmptyInput);

        let req_whitespace = IntentClassificationRequest {
            request_id: None,
            text: "    \n\t   ".to_string(),
            conversation_context: None,
            language_hint: None,
        };
        let err_ws = preprocess_classification_input(&req_whitespace, 512).unwrap_err();
        assert_eq!(err_ws.kind, ClassificationErrorKind::EmptyInput);
    }

    #[test]
    fn test_preprocessor_preserves_code_blocks_and_unicode() {
        let code_prompt = "Refactor this Rust function:\n```rust\nfn calculate(x: i32) -> i32 { x * 2 }\n```\nاور اردو ٹیکسٹ";
        let req = IntentClassificationRequest {
            request_id: None,
            text: code_prompt.to_string(),
            conversation_context: None,
            language_hint: Some("ur".to_string()),
        };

        let processed = preprocess_classification_input(&req, 512).unwrap();
        assert!(processed.contains("fn calculate(x: i32)"));
        assert!(processed.contains("```rust"));
        assert!(processed.contains("اور اردو ٹیکسٹ"));
    }

    #[test]
    fn test_preprocessor_bounds_conversation_context() {
        let req = IntentClassificationRequest {
            request_id: None,
            text: "Now explain line 3".to_string(),
            conversation_context: Some(vec![
                "Turn 1 (old)".to_string(),
                "Turn 2 (old)".to_string(),
                "Turn 3 (recent)".to_string(),
                "Turn 4 (recent)".to_string(),
            ]),
            language_hint: None,
        };

        let processed = preprocess_classification_input(&req, 512).unwrap();
        // Should only preserve last 2 turns (Turn 3 and Turn 4)
        assert!(!processed.contains("Turn 1"));
        assert!(!processed.contains("Turn 2"));
        assert!(processed.contains("Turn 3"));
        assert!(processed.contains("Turn 4"));
        assert!(processed.contains("Now explain line 3"));
    }

    #[test]
    fn test_preprocessor_rejects_oversized_input_without_silent_truncation() {
        let long_prompt = "word ".repeat(600);
        let req = IntentClassificationRequest {
            request_id: None,
            text: long_prompt,
            conversation_context: None,
            language_hint: None,
        };

        let err = preprocess_classification_input(&req, 512).unwrap_err();
        assert_eq!(err.kind, ClassificationErrorKind::InputTooLong);
    }

    // ------------------------------------------------------------------------
    // 4. Numerical Safety & Stable Softmax Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_softmax_rejects_nan_and_infinity() {
        let nan_logits = vec![0.5, f32::NAN, 0.2];
        let err_nan = compute_stable_softmax(&nan_logits).unwrap_err();
        assert_eq!(err_nan.kind, ClassificationErrorKind::InvalidModelOutput);

        let inf_logits = vec![0.5, f32::INFINITY, 0.2];
        let err_inf = compute_stable_softmax(&inf_logits).unwrap_err();
        assert_eq!(err_inf.kind, ClassificationErrorKind::InvalidModelOutput);
    }

    #[test]
    fn test_softmax_numerical_stability_on_extreme_values() {
        // Very large logit values that would overflow naive exp()
        let extreme_logits = vec![1000.0, 1001.0, 999.0];
        let probs = compute_stable_softmax(&extreme_logits).unwrap();

        assert_eq!(probs.len(), 3);
        let sum: f64 = probs.iter().sum();
        assert!((sum - 1.0).abs() < 1e-6);
        assert!(probs[1] > probs[0]);
        assert!(probs[0] > probs[2]);
    }

    #[test]
    fn test_softmax_uniform_distribution() {
        let uniform_logits = vec![2.0, 2.0, 2.0, 2.0];
        let probs = compute_stable_softmax(&uniform_logits).unwrap();

        for &p in &probs {
            assert!((p - 0.25).abs() < 1e-6);
        }
    }

    // ------------------------------------------------------------------------
    // 5. Policy, Tie-Breaking & Ambiguity Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_policy_deterministic_tie_breaker() {
        let policy = ClassificationPolicy::default();

        let mut candidates = vec![
            IntentCandidate {
                intent: UserIntent::Writing,
                normalized_score: 0.40,
                raw_score: 1.0,
            },
            IntentCandidate {
                intent: UserIntent::CodeDebugging,
                normalized_score: 0.40,
                raw_score: 1.0,
            },
            IntentCandidate {
                intent: UserIntent::DataAnalysis,
                normalized_score: 0.20,
                raw_score: 0.5,
            },
        ];

        policy.sort_candidates(&mut candidates);

        // CodeDebugging ("code_debugging") sorts before Writing ("writing") alphabetically
        assert_eq!(candidates[0].intent, UserIntent::CodeDebugging);
        assert_eq!(candidates[1].intent, UserIntent::Writing);
    }

    #[test]
    fn test_policy_unknown_fallback_when_below_threshold() {
        let policy = ClassificationPolicy::default();

        let candidates = vec![
            IntentCandidate {
                intent: UserIntent::SoftwareEngineering,
                normalized_score: 0.20, // Below default 0.35 threshold
                raw_score: 0.2,
            },
            IntentCandidate {
                intent: UserIntent::GeneralConversation,
                normalized_score: 0.18,
                raw_score: 0.18,
            },
        ];

        let (primary, confidence, ambiguity, _) = policy.evaluate_ambiguity(&candidates);
        assert_eq!(primary, UserIntent::Unknown);
        assert_eq!(confidence, 0.20);
        assert_eq!(ambiguity, AmbiguityState::Unknown);
    }

    #[test]
    fn test_policy_threshold_exact_equality() {
        let policy = ClassificationPolicy::default();

        // Exactly equal to default confidence threshold (0.35)
        let candidates = vec![
            IntentCandidate {
                intent: UserIntent::SoftwareEngineering,
                normalized_score: DEFAULT_CONFIDENCE_THRESHOLD,
                raw_score: 1.0,
            },
            IntentCandidate {
                intent: UserIntent::GeneralConversation,
                normalized_score: 0.10,
                raw_score: 0.2,
            },
        ];

        let (primary, confidence, ambiguity, _) = policy.evaluate_ambiguity(&candidates);
        // >= threshold: accepted
        assert_eq!(primary, UserIntent::SoftwareEngineering);
        assert_eq!(confidence, DEFAULT_CONFIDENCE_THRESHOLD);
        assert_eq!(ambiguity, AmbiguityState::NotAmbiguous);
    }

    #[test]
    fn test_policy_ambiguity_narrow_margin() {
        let policy = ClassificationPolicy::default();

        let candidates = vec![
            IntentCandidate {
                intent: UserIntent::SoftwareEngineering,
                normalized_score: 0.42,
                raw_score: 1.5,
            },
            IntentCandidate {
                intent: UserIntent::CodeDebugging,
                normalized_score: 0.38, // Difference = 0.04 < 0.08 margin
                raw_score: 1.4,
            },
        ];

        let (primary, _, ambiguity, alternatives) = policy.evaluate_ambiguity(&candidates);
        assert_eq!(primary, UserIntent::SoftwareEngineering);
        assert_eq!(ambiguity, AmbiguityState::Ambiguous);
        assert_eq!(alternatives.len(), 1);
        assert_eq!(alternatives[0].intent, UserIntent::CodeDebugging);
    }

    #[test]
    fn test_policy_multi_intent_detection() {
        let policy = ClassificationPolicy::default();

        let candidates = vec![
            IntentCandidate {
                intent: UserIntent::DataAnalysis,
                normalized_score: 0.50,
                raw_score: 2.0,
            },
            IntentCandidate {
                intent: UserIntent::Writing,
                normalized_score: 0.30, // >= 0.25 multi-intent threshold
                raw_score: 1.2,
            },
            IntentCandidate {
                intent: UserIntent::GeneralConversation,
                normalized_score: 0.10,
                raw_score: 0.5,
            },
        ];

        let (primary, _, ambiguity, alternatives) = policy.evaluate_ambiguity(&candidates);
        assert_eq!(primary, UserIntent::DataAnalysis);
        assert_eq!(ambiguity, AmbiguityState::MultiIntent);
        assert!(alternatives.iter().any(|c| c.intent == UserIntent::Writing));
    }

    // ------------------------------------------------------------------------
    // 6. End-to-End Intent Classifier Service Tests
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_classifier_end_to_end_with_fake_backend() {
        // Set up 16-class logits where index 0 (software_engineering) dominates
        let mut mock_logits = vec![0.1f32; 16];
        mock_logits[0] = 5.0; // dominant software_engineering

        let backend = Arc::new(FakeInferenceBackend::new().with_logits(mock_logits));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let manifest = LocalModelManifest::default_router_manifest();
        slm_service.load_model(manifest, b"mock_model").unwrap();

        let classifier = IntentClassifier::new(slm_service, None);

        let req = IntentClassificationRequest {
            request_id: Some("req_test_123".to_string()),
            text: "Implement a thread-safe worker in Rust".to_string(),
            conversation_context: None,
            language_hint: None,
        };

        let result = classifier.classify(req, None).await.unwrap();

        assert_eq!(result.request_id, "req_test_123");
        assert_eq!(result.primary_intent, UserIntent::SoftwareEngineering);
        assert!(result.confidence > 0.80);
        assert_eq!(result.ambiguity, AmbiguityState::NotAmbiguous);
        assert_eq!(result.classifier_model_id, "nano-route-router");
        assert_eq!(result.classifier_schema_version, "nano-route-intent-schema-v1");
        assert!(result.explanation.contains("software_engineering"));
    }

    #[tokio::test]
    async fn test_classifier_rejects_incompatible_model_task_type() {
        let backend = Arc::new(FakeInferenceBackend::new());
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let mut manifest = LocalModelManifest::default_router_manifest();
        manifest.task_type = "embedding".to_string(); // Incompatible!

        slm_service.load_model(manifest, b"mock_model").unwrap();

        let classifier = IntentClassifier::new(slm_service, None);

        let req = IntentClassificationRequest {
            request_id: None,
            text: "Hello".to_string(),
            conversation_context: None,
            language_hint: None,
        };

        let err = classifier.classify(req, None).await.unwrap_err();
        assert_eq!(err.kind, ClassificationErrorKind::ClassifierModelIncompatible);
    }

    #[tokio::test]
    async fn test_classifier_rejects_when_model_missing() {
        let backend = Arc::new(FakeInferenceBackend::new());
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let classifier = IntentClassifier::new(slm_service, None);

        let req = IntentClassificationRequest {
            request_id: None,
            text: "Hello".to_string(),
            conversation_context: None,
            language_hint: None,
        };

        let err = classifier.classify(req, None).await.unwrap_err();
        assert_eq!(err.kind, ClassificationErrorKind::ClassifierModelMissing);
    }

    #[tokio::test]
    async fn test_classifier_cancellation() {
        let backend = Arc::new(FakeInferenceBackend::new().with_latency(100));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let manifest = LocalModelManifest::default_router_manifest();
        slm_service.load_model(manifest, b"mock_model").unwrap();

        let classifier = IntentClassifier::new(slm_service, None);

        let cancel_token = CancellationToken::new();
        cancel_token.cancel(); // cancel immediately

        let req = IntentClassificationRequest {
            request_id: None,
            text: "Cancelled task".to_string(),
            conversation_context: None,
            language_hint: None,
        };

        let err = classifier.classify(req, Some(cancel_token)).await.unwrap_err();
        assert_eq!(err.kind, ClassificationErrorKind::ClassificationCancelled);
    }

    #[tokio::test]
    async fn test_classifier_determinism_100_runs() {
        let mut mock_logits = vec![0.1f32; 16];
        mock_logits[2] = 4.0; // dominant reasoning_math

        let backend = Arc::new(FakeInferenceBackend::new().with_logits(mock_logits));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let manifest = LocalModelManifest::default_router_manifest();
        slm_service.load_model(manifest, b"mock_model").unwrap();

        let classifier = IntentClassifier::new(slm_service, None);

        let req = IntentClassificationRequest {
            request_id: None,
            text: "Prove that square root of 2 is irrational".to_string(),
            conversation_context: None,
            language_hint: None,
        };

        let first = classifier.classify(req.clone(), None).await.unwrap();

        for _ in 0..100 {
            let res = classifier.classify(req.clone(), None).await.unwrap();
            assert_eq!(res.primary_intent, first.primary_intent);
            assert_eq!(res.confidence, first.confidence);
            assert_eq!(res.ambiguity, first.ambiguity);
            assert_eq!(res.alternatives, first.alternatives);
        }
    }

    // ------------------------------------------------------------------------
    // 7. Gold Evaluation Dataset Benchmark Test
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_gold_dataset_benchmark_execution() {
        let mut mock_logits = vec![0.05f32; 16];
        mock_logits[0] = 3.0; // software engineering

        let backend = Arc::new(FakeInferenceBackend::new().with_logits(mock_logits));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let manifest = LocalModelManifest::default_router_manifest();
        slm_service.load_model(manifest, b"mock_model").unwrap();

        let classifier = IntentClassifier::new(slm_service, None);

        let report = ClassifierEvaluationReport::run_evaluation(&classifier).await;

        assert_eq!(report.dataset_version, "1.0.0");
        assert_eq!(report.total_samples, GOLD_EVALUATION_SET.len());
        assert!(report.total_samples >= 20);
        assert!(report.average_latency_ms >= 0.0);
    }
}

