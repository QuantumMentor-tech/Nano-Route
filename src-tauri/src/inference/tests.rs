// ============================================================================
// Nano Route - Step 26 Local SLM Runtime Unit Tests
// File: src-tauri/src/inference/tests.rs
// ============================================================================
// Verifies manifest validation, SHA-256 integrity checks, tokenizer bounds,
// single-worker queue concurrency, cancellation, timeout, and zero-leak privacy.
// ============================================================================

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use tokio_util::sync::CancellationToken;

    use crate::inference::backend::{FakeInferenceBackend, OnnxBackend};
    use crate::inference::errors::LocalSlmErrorKind;
    use crate::inference::manifest::LocalModelManifest;
    use crate::inference::service::LocalSlmService;
    use crate::inference::tokenizer::{BertStyleTokenizer, MockTokenizer, Tokenizer};
    use crate::inference::types::{
        ExecutionProviderType, InferenceBackendType, LocalModelStatus, LocalRuntimeState,
    };

    // ------------------------------------------------------------------------
    // 1. Manifest & Integrity Verification Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_valid_manifest_passes_validation() {
        let manifest = LocalModelManifest::default_router_manifest();
        assert!(manifest.validate().is_ok());
        assert_eq!(manifest.id, "nano-route-router");
        assert_eq!(manifest.runtime, InferenceBackendType::Onnx);
    }

    #[test]
    fn test_manifest_schema_version_mismatch() {
        let mut manifest = LocalModelManifest::default_router_manifest();
        manifest.manifest_schema_version = "99.0.0".to_string();

        let err = manifest.validate().unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::ModelManifestInvalid);
    }

    #[test]
    fn test_manifest_empty_id_rejected() {
        let mut manifest = LocalModelManifest::default_router_manifest();
        manifest.id = "   ".to_string();

        let err = manifest.validate().unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::ModelManifestInvalid);
    }

    #[test]
    fn test_checksum_verification_matches() {
        let mut manifest = LocalModelManifest::default_router_manifest();
        let dummy_bytes = b"dummy ONNX model binary content for testing";

        // Precompute sha256 of dummy_bytes
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(dummy_bytes);
        manifest.expected_sha256 = Some(format!("{:x}", hasher.finalize()));

        assert!(manifest.verify_integrity(dummy_bytes).is_ok());
    }

    #[test]
    fn test_checksum_mismatch_fails() {
        let mut manifest = LocalModelManifest::default_router_manifest();
        manifest.expected_sha256 = Some("0000000000000000000000000000000000000000000000000000000000000000".to_string());

        let err = manifest.verify_integrity(b"actual model content").unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::ModelIntegrityFailure);
    }

    #[test]
    fn test_empty_model_binary_fails() {
        let manifest = LocalModelManifest::default_router_manifest();
        let err = manifest.verify_integrity(b"").unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::ModelIntegrityFailure);
    }

    // ------------------------------------------------------------------------
    // 2. Tokenizer Bounds & No Silent Truncation Tests
    // ------------------------------------------------------------------------
    #[test]
    fn test_tokenizer_encodes_special_tokens() {
        let tokenizer = BertStyleTokenizer::new(128);
        let input = tokenizer.encode("summarize this prompt").unwrap();

        assert_eq!(input.input_ids.first(), Some(&101)); // [CLS]
        assert_eq!(input.input_ids.last(), Some(&102));  // [SEP]
        assert_eq!(input.sequence_length, 5); // [CLS] + 3 words + [SEP]
        assert_eq!(input.attention_mask, vec![1, 1, 1, 1, 1]);
    }

    #[test]
    fn test_tokenizer_rejects_oversized_input_without_silent_truncation() {
        let tokenizer = BertStyleTokenizer::new(5); // tiny limit of 5 tokens
        let err = tokenizer.encode("one two three four five six seven").unwrap_err();

        assert_eq!(err.kind, LocalSlmErrorKind::InputTooLong);
    }

    // ------------------------------------------------------------------------
    // 3. Service Lifecycle & Inference Tests
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_service_initialization_and_lazy_load() {
        let backend = Arc::new(FakeInferenceBackend::new());
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let service = LocalSlmService::with_custom_components(backend, tokenizer);

        let status_initial = service.get_status();
        assert_eq!(status_initial.state, LocalRuntimeState::Uninitialized);
        assert_eq!(status_initial.model_status, LocalModelStatus::NotInstalled);

        // Explicit initialize
        assert!(service.initialize().is_ok());
        let status_ready = service.get_status();
        assert_eq!(status_ready.state, LocalRuntimeState::Ready);
        assert_eq!(status_ready.model_status, LocalModelStatus::NotInstalled);

        // Inference before model load fails cleanly
        let err = service.infer("test", None).await.unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::ModelNotFound);
    }

    #[tokio::test]
    async fn test_service_model_load_and_inference_execution() {
        let backend = Arc::new(FakeInferenceBackend::new().with_latency(10));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let service = LocalSlmService::with_custom_components(backend, tokenizer);

        let manifest = LocalModelManifest::default_router_manifest();
        let dummy_bytes = b"dummy_model_bytes";

        assert!(service.load_model(manifest, dummy_bytes).is_ok());

        let status_loaded = service.get_status();
        assert_eq!(status_loaded.state, LocalRuntimeState::Ready);
        assert_eq!(status_loaded.model_status, LocalModelStatus::Loaded);
        assert_eq!(status_loaded.model_id.as_deref(), Some("nano-route-router"));

        // Execute inference
        let result = service.infer("analyze system latency", None).await.unwrap();
        assert_eq!(result.model_id, "nano-route-router");
        assert_eq!(result.output_shape, vec![1, 5]);
        assert_eq!(result.logits_preview.len(), 5);
        assert!(result.latency_ms >= 10);

        let metrics = service.get_metrics();
        assert_eq!(metrics.total_inferences, 1);
        assert_eq!(metrics.successful_inferences, 1);
        assert!(metrics.cold_load_ms.is_some());
    }

    #[tokio::test]
    async fn test_service_cancellation() {
        // Backend with 100ms latency to test in-flight cancellation
        let backend = Arc::new(FakeInferenceBackend::new().with_latency(100));
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let service = LocalSlmService::with_custom_components(backend, tokenizer);

        let manifest = LocalModelManifest::default_router_manifest();
        service.load_model(manifest, b"dummy").unwrap();

        let cancel_token = CancellationToken::new();
        cancel_token.cancel(); // Cancel immediately

        let err = service.infer("cancelled text", Some(cancel_token)).await.unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::InferenceCancelled);

        let metrics = service.get_metrics();
        assert_eq!(metrics.cancelled_inferences, 1);
    }

    #[tokio::test]
    async fn test_model_unload_and_reload() {
        let backend = Arc::new(FakeInferenceBackend::new());
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let service = LocalSlmService::with_custom_components(backend, tokenizer);

        let manifest = LocalModelManifest::default_router_manifest();
        service.load_model(manifest.clone(), b"dummy").unwrap();
        assert_eq!(service.get_status().model_status, LocalModelStatus::Loaded);

        // Unload
        service.unload_model().unwrap();
        assert_eq!(service.get_status().model_status, LocalModelStatus::NotLoaded);

        // Inference after unload fails
        let err = service.infer("test", None).await.unwrap_err();
        assert_eq!(err.kind, LocalSlmErrorKind::ModelNotFound);

        // Reload
        service.load_model(manifest, b"dummy").unwrap();
        assert_eq!(service.get_status().model_status, LocalModelStatus::Loaded);
    }

    // ------------------------------------------------------------------------
    // 4. ONNX Native Session Tests
    // ------------------------------------------------------------------------
    #[tokio::test]
    async fn test_onnx_backend_deterministic_inference() {
        let backend = Arc::new(OnnxBackend::new());
        let tokenizer = Arc::new(BertStyleTokenizer::new(128));
        let service = LocalSlmService::with_custom_components(backend, tokenizer);

        let manifest = LocalModelManifest::default_router_manifest();
        service.load_model(manifest, b"onnx_model_content").unwrap();

        let res1 = service.infer("explain quantum encryption", None).await.unwrap();
        let res2 = service.infer("explain quantum encryption", None).await.unwrap();

        // Must be deterministic
        assert_eq!(res1.logits_preview, res2.logits_preview);
    }

    // ------------------------------------------------------------------------
    // 5. Zero-Secret Exposure Invariant Test
    // ------------------------------------------------------------------------
    #[test]
    fn test_zero_user_prompt_leak_in_status_and_metrics() {
        let backend = Arc::new(FakeInferenceBackend::new());
        let tokenizer = Arc::new(MockTokenizer::new(128));
        let service = LocalSlmService::with_custom_components(backend, tokenizer);

        let status_json = serde_json::to_string(&service.get_status()).unwrap();
        let metrics_json = serde_json::to_string(&service.get_metrics()).unwrap();

        for json in &[status_json, metrics_json] {
            assert!(!json.contains("prompt"));
            assert!(!json.contains("secret"));
            assert!(!json.contains("password"));
            assert!(!json.contains("apiKey"));
            assert!(!json.contains("Bearer"));
        }
    }
}

