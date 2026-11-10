// ============================================================================
// Nano Route - Step 28 Task Analyzer Unit Tests
// File: src-tauri/src/analysis/tests.rs
// ============================================================================
// Exhaustive unit tests for task complexity, domain taxonomy, capability
// requirements, negation handling, attachment distinctions, conflict resolution,
// determinism, cooperative cancellation, and strict provider neutrality.
// ============================================================================

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tokio_util::sync::CancellationToken;

    use crate::analysis::policy::TaskAnalysisPolicy;
    use crate::analysis::service::TaskAnalyzer;
    use crate::analysis::types::{
        AnalysisAmbiguity, AnalysisCompleteness, RequirementStrength, TaskAnalysisRequest,
        TaskCapabilityRequirement, TaskComplexity, TaskDomain,
    };
    use crate::classification::service::IntentClassifier;
    use crate::classification::types::UserIntent;
    use crate::inference::backend::FakeInferenceBackend;
    use crate::inference::manifest::LocalModelManifest;
    use crate::inference::service::LocalSlmService;
    use crate::inference::tokenizer::MockTokenizer;

    fn setup_test_analyzer(mock_logits: Vec<f32>) -> TaskAnalyzer {
        let backend = Arc::new(FakeInferenceBackend::new().with_logits(mock_logits));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let slm_service = Arc::new(LocalSlmService::with_custom_components(backend, tokenizer));

        let manifest = LocalModelManifest::default_router_manifest();
        slm_service.load_model(manifest, b"mock_weights").unwrap();

        let classifier = Arc::new(IntentClassifier::new(slm_service.clone(), None));
        TaskAnalyzer::new(classifier, slm_service, None)
    }

    // ------------------------------------------------------------------------
    // 1. Simple Translation Task Test (Section 117)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_simple_translation_task() {
        // Logits favoring index 7 (translation)
        let mut logits = vec![0.05f32; 16];
        logits[7] = 4.0;

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: Some("req_trans_1".to_string()),
            text: "Translate this sentence into English: Bonjour le monde".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert_eq!(result.intent.primary_intent, UserIntent::Translation);
        assert!(matches!(
            result.complexity.level,
            TaskComplexity::Trivial | TaskComplexity::Low
        ));
        assert_eq!(result.primary_domain.domain, TaskDomain::Translation);
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::Translation
                && c.strength == RequirementStrength::Required));
        assert_eq!(result.completeness, AnalysisCompleteness::Complete);
    }

    // ------------------------------------------------------------------------
    // 2. Complex Software Engineering Task Test (Section 118)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_complex_software_engineering_task() {
        // Logits favoring index 0 (software_engineering)
        let mut logits = vec![0.05f32; 16];
        logits[0] = 5.0;

        let analyzer = setup_test_analyzer(logits);

        let prompt = "Refactor these five Rust modules so the async worker can cancel cleanly and add tests.\n```rust\nfn spawn_worker() {}\n```";
        let req = TaskAnalysisRequest {
            request_id: None,
            text: prompt.to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert_eq!(result.intent.primary_intent, UserIntent::SoftwareEngineering);
        assert_eq!(result.primary_domain.domain, TaskDomain::SoftwareEngineering);
        assert!(matches!(
            result.complexity.level,
            TaskComplexity::High | TaskComplexity::VeryHigh
        ));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::CodeUnderstanding
                && c.strength == RequirementStrength::Required));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::CodeGeneration
                && c.strength == RequirementStrength::Required));
        assert!(result.evidence.iter().any(|e| e.code == "code_block_detected"));
        assert!(result.evidence.iter().any(|e| e.code == "cross_file_reasoning"));
    }

    // ------------------------------------------------------------------------
    // 3. Mathematical Reasoning Test (Section 119)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_mathematical_reasoning_task() {
        // Logits favoring index 2 (reasoning_math)
        let mut logits = vec![0.05f32; 16];
        logits[2] = 5.0;

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Prove this identity by contradiction and calculate the matrix eigenvalues.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert_eq!(result.intent.primary_intent, UserIntent::ReasoningMath);
        assert_eq!(result.primary_domain.domain, TaskDomain::Mathematics);
        assert!(matches!(
            result.complexity.level,
            TaskComplexity::High | TaskComplexity::VeryHigh
        ));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::MathematicalReasoning
                && c.strength == RequirementStrength::Required));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::DeepReasoning
                && c.strength == RequirementStrength::Required));
        assert!(result
            .evidence
            .iter()
            .any(|e| e.code == "mathematical_proof_requested"));
    }

    // ------------------------------------------------------------------------
    // 4. General Conversation Task Test (Section 120)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_general_conversation_task() {
        // Logits favoring index 3 (general_conversation)
        let mut logits = vec![0.05f32; 16];
        logits[3] = 4.0;

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Write a friendly message thanking my friend for dinner last night.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert_eq!(result.primary_domain.domain, TaskDomain::General);
        assert!(matches!(
            result.complexity.level,
            TaskComplexity::Trivial | TaskComplexity::Low
        ));
        assert_eq!(result.ambiguity, AnalysisAmbiguity::Low);
    }

    // ------------------------------------------------------------------------
    // 5. Large Context Synthesis Test (Section 121)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_large_context_cross_document_task() {
        let mut logits = vec![0.05f32; 16];
        logits[4] = 4.0; // research_retrieval

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Compare the conclusions across these three long reports and identify all contradictions across all 5 files.".to_string(),
            conversation_context: None,
            attachment_count: Some(3),
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert_eq!(result.primary_domain.domain, TaskDomain::Research);
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::LongContext
                && c.strength == RequirementStrength::Required));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::DocumentAnalysis
                && c.strength == RequirementStrength::Required));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::FileHandling
                && c.strength == RequirementStrength::Required));
    }

    // ------------------------------------------------------------------------
    // 6. Web Retrieval & Citations Test (Section 122)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_web_retrieval_and_citations_task() {
        let mut logits = vec![0.05f32; 16];
        logits[4] = 4.0; // research_retrieval

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Research today's latest developments in AI hardware, search the web, and cite your sources.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::WebRetrieval
                && c.strength == RequirementStrength::Required));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::CitationSupport
                && c.strength == RequirementStrength::Required));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::SearchGrounding
                && c.strength == RequirementStrength::Required));
    }

    // ------------------------------------------------------------------------
    // 7. Structured Output Test (Section 123)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_structured_output_mandate() {
        let mut logits = vec![0.05f32; 16];
        logits[6] = 4.0; // data_analysis

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Extract user details and return the final answer as valid JSON using schema keys.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::StructuredOutput
                && c.strength == RequirementStrength::Required));
    }

    // ------------------------------------------------------------------------
    // 8. Image Discussion vs Image Input Test (Section 124)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_image_discussion_vs_image_input() {
        let mut logits = vec![0.05f32; 16];
        logits[3] = 4.0; // general

        let analyzer = setup_test_analyzer(logits);

        // Prompt A: Discussion only -> ImageInput NOT required
        let req_a = TaskAnalysisRequest {
            request_id: None,
            text: "Explain how image generation and diffusion models work mathematically.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };
        let res_a = analyzer.analyze(req_a, None).await.unwrap();
        assert!(!res_a
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::ImageInput
                && c.strength == RequirementStrength::Required));

        // Prompt B: Execution required -> ImageInput IS required
        let req_b = TaskAnalysisRequest {
            request_id: None,
            text: "Analyze the attached image and describe defects in this picture.".to_string(),
            conversation_context: None,
            attachment_count: Some(1),
            language_hint: None,
        };
        let res_b = analyzer.analyze(req_b, None).await.unwrap();
        assert!(res_b
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::ImageInput
                && c.strength == RequirementStrength::Required));
    }

    // ------------------------------------------------------------------------
    // 9. Attachment Mention Without Attachment Test (Section 125)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_attachment_mention_without_attachment() {
        let mut logits = vec![0.05f32; 16];
        logits[5] = 4.0; // writing/analysis

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Analyze the PDF I uploaded and extract the contract dates.".to_string(),
            conversation_context: None,
            attachment_count: Some(0), // No physical file!
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::DocumentAnalysis));
        assert!(!result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::FileHandling));
        assert!(result
            .evidence
            .iter()
            .any(|e| e.code == "attachment_mention_without_file"));
    }

    // ------------------------------------------------------------------------
    // 10. Negation Handling Test (Section 126)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_web_retrieval_negation() {
        let mut logits = vec![0.05f32; 16];
        logits[4] = 4.0; // research

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Do not search the web. Explain the concept of zero-knowledge proofs from general knowledge only.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        let web_cap = result
            .capabilities
            .iter()
            .find(|c| c.capability == TaskCapabilityRequirement::WebRetrieval);
        assert!(web_cap.is_some());
        assert_eq!(web_cap.unwrap().strength, RequirementStrength::NotRequired);
    }

    // ------------------------------------------------------------------------
    // 11. Multi-Step Task Test (Section 127)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_multi_step_compound_task() {
        let mut logits = vec![0.05f32; 16];
        logits[6] = 4.0; // data_analysis

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "First analyze this CSV, then summarize the findings, and finally draft an executive report.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert!(matches!(
            result.complexity.level,
            TaskComplexity::Moderate | TaskComplexity::High
        ));
        assert!(result
            .evidence
            .iter()
            .any(|e| e.code == "multi_step_instruction"));
        assert!(result
            .capabilities
            .iter()
            .any(|c| c.capability == TaskCapabilityRequirement::Summarization));
    }

    // ------------------------------------------------------------------------
    // 12. Ambiguous Task Test (Section 128)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_ambiguous_task_handling() {
        let mut logits = vec![0.05f32; 16];
        logits[15] = 4.0; // unknown

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Can you help with this?".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert_eq!(result.intent.primary_intent, UserIntent::Unknown);
        assert_eq!(result.ambiguity, AnalysisAmbiguity::High);
        assert_eq!(result.completeness, AnalysisCompleteness::Uncertain);
    }

    // ------------------------------------------------------------------------
    // 13. Signal Conflict Detection Test (Section 129)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_conflicting_signals_detection() {
        let mut logits = vec![0.05f32; 16];
        logits[3] = 4.0; // general_conversation

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Hello! Return valid JSON with keys for user metrics.".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();

        assert!(!result.conflicts.is_empty());
        assert!(result.conflicts.iter().any(|c| c.dimension == "capability:structured_output"));
        assert_eq!(result.ambiguity, AnalysisAmbiguity::Medium);
    }

    // ------------------------------------------------------------------------
    // 14. Cooperative Cancellation Test (Section 136)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_analyzer_cancellation() {
        let analyzer = setup_test_analyzer(vec![0.1f32; 16]);

        let cancel_token = CancellationToken::new();
        cancel_token.cancel(); // Pre-cancel

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Refactor async worker".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let err = analyzer.analyze(req, Some(cancel_token)).await.unwrap_err();
        assert_eq!(err.kind, crate::analysis::errors::AnalysisErrorKind::AnalysisCancelled);
    }

    // ------------------------------------------------------------------------
    // 15. Strict Provider Neutrality Invariant Test (Section 147, 148)
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_strict_provider_neutrality_in_result() {
        let mut logits = vec![0.05f32; 16];
        logits[0] = 5.0; // software_engineering

        let analyzer = setup_test_analyzer(logits);

        let req = TaskAnalysisRequest {
            request_id: None,
            text: "Implement a thread-safe LRU cache in Rust".to_string(),
            conversation_context: None,
            attachment_count: None,
            language_hint: None,
        };

        let result = analyzer.analyze(req, None).await.unwrap();
        let json = serde_json::to_string(&result).unwrap();

        // Must NOT contain provider brand names, scoring, or cost
        for forbidden in &[
            "anthropic", "openai", "claude", "gpt-4", "gemini", "deepseek", "groq", "mistral",
            "provider_score", "selected_provider", "selected_model", "cost_usd", "provider_price",
        ] {
            assert!(
                !json.to_lowercase().contains(forbidden),
                "TaskAnalysisResult must not contain provider assignment '{}'",
                forbidden
            );
        }
    }
}

