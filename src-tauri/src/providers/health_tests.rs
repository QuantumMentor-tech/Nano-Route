// ============================================================================
// Nano Route - Step 25 Provider Health & Capability Unit Tests
// File: src-tauri/src/providers/health_tests.rs
// ============================================================================
// Verifies runtime health state transitions, model-scoped health, capability
// calculations, request preflight evaluation, rate-limit expiration, staleness,
// out-of-order observation protection, concurrency, and zero secret leakage.
// ============================================================================

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::thread;

    use crate::providers::capability_service::{
        ProviderCapabilityService, RequestRequirements,
    };
    use crate::providers::health_manager::ProviderHealthManager;
    use crate::providers::health_types::{
        HealthObservationOutcome, HealthObservationSource, ProviderHealthObservation,
        RuntimeHealthState,
    };
    use crate::providers::identity::ProviderId;
    use crate::providers::preflight::{PreflightBlockReason, PreflightEvaluator};
    use crate::providers::probe::{HealthCheckResult, HealthProbeRunner, ProviderHealthProbeService};
    use crate::providers::registry::ProviderRegistry;

    fn setup_test_services() -> (
        Arc<ProviderRegistry>,
        Arc<ProviderHealthManager>,
        Arc<ProviderCapabilityService>,
        Arc<PreflightEvaluator>,
    ) {
        let registry = Arc::new(ProviderRegistry::builtin().expect("registry builtin failed"));
        let health_manager = Arc::new(ProviderHealthManager::new(&registry));
        let capability_service = Arc::new(ProviderCapabilityService::new(registry.clone()));
        let preflight = Arc::new(PreflightEvaluator::new(
            registry.clone(),
            capability_service.clone(),
            health_manager.clone(),
        ));

        (registry, health_manager, capability_service, preflight)
    }

    // ------------------------------------------------------------------------
    // 1. Initial State & Credential / Disabled Scenarios
    // ------------------------------------------------------------------------
    #[test]
    fn test_initial_state_is_unknown_without_network() {
        let (_reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::OPENAI).unwrap();

        let snap = hm.get_provider_health(&pid, 1000).expect("provider missing");
        assert_eq!(snap.state, RuntimeHealthState::Unknown);
        assert!(snap.is_enabled);
        assert_eq!(snap.last_observed_at_ms, None);
        assert_eq!(snap.last_success_at_ms, None);
    }

    #[test]
    fn test_credential_missing_state() {
        let (_reg, hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::OPENAI).unwrap();

        hm.update_credential_status(&pid, false);
        let snap = hm.get_provider_health(&pid, 1000).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::CredentialMissing);

        // Preflight must block with CredentialMissing
        let req = RequestRequirements::streaming_chat();
        let eval = pf.evaluate(&pid, "gpt-4o", &req, Some(1000));
        assert!(!eval.allowed);
        assert_eq!(eval.block_reason, Some(PreflightBlockReason::CredentialMissing));
    }

    #[test]
    fn test_provider_disabled_state() {
        let (_reg, hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::GROQ).unwrap();

        hm.update_provider_enabled(&pid, false);
        let snap = hm.get_provider_health(&pid, 1000).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::ProviderDisabled);
        assert!(!snap.is_enabled);

        let req = RequestRequirements::streaming_chat();
        let eval = pf.evaluate(&pid, "llama-3.3-70b-versatile", &req, Some(1000));
        assert!(!eval.allowed);
        assert_eq!(eval.block_reason, Some(PreflightBlockReason::ProviderDisabled));
    }

    // ------------------------------------------------------------------------
    // 2. Health State Transitions
    // ------------------------------------------------------------------------
    #[test]
    fn test_success_transition_moves_to_ready() {
        let (_reg, hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::ANTHROPIC).unwrap();
        let seq = hm.next_sequence();

        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("claude-3-5-sonnet-20241022".to_string()),
            timestamp_ms: 5000,
            sequence_number: seq,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::Success,
            latency_ms: Some(340),
            http_status: Some(200),
            provider_error_code: None,
            provider_request_id: Some("req-anthropic-123".to_string()),
            retry_after_ms: None,
        });

        let snap = hm.get_provider_health(&pid, 5500).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::Ready);
        assert_eq!(snap.last_latency_ms, Some(340));
        assert_eq!(snap.last_success_at_ms, Some(5000));

        let model_snap = hm
            .get_model_health(&pid, "claude-3-5-sonnet-20241022", 5500)
            .unwrap();
        assert_eq!(model_snap.state, RuntimeHealthState::Ready);

        // Preflight is allowed
        let req = RequestRequirements::streaming_chat();
        let eval = pf.evaluate(&pid, "claude-3-5-sonnet-20241022", &req, Some(5500));
        assert!(eval.allowed);
    }

    #[test]
    fn test_auth_failure_blocks_provider() {
        let (_reg, hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::GEMINI).unwrap();
        let seq = hm.next_sequence();

        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: None,
            timestamp_ms: 6000,
            sequence_number: seq,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::AuthenticationFailed,
            latency_ms: Some(120),
            http_status: Some(401),
            provider_error_code: Some("API_KEY_INVALID".to_string()),
            provider_request_id: None,
            retry_after_ms: None,
        });

        let snap = hm.get_provider_health(&pid, 6100).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::AuthenticationFailed);

        let req = RequestRequirements::text();
        let eval = pf.evaluate(&pid, "gemini-1.5-pro", &req, Some(6100));
        assert!(!eval.allowed);
        assert_eq!(eval.block_reason, Some(PreflightBlockReason::AuthenticationFailed));
    }

    #[test]
    fn test_rate_limit_and_cooldown_expiration() {
        let (_reg, hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::DEEPSEEK).unwrap();
        let seq = hm.next_sequence();

        // 429 with 30s retry after
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("deepseek-chat".to_string()),
            timestamp_ms: 10_000,
            sequence_number: seq,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::RateLimited {
                retry_after_ms: Some(30_000),
            },
            latency_ms: Some(85),
            http_status: Some(429),
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: Some(30_000),
        });

        // 1. While within cooldown (t = 20,000 < 40,000)
        let snap_during = hm.get_provider_health(&pid, 20_000).unwrap();
        assert_eq!(snap_during.state, RuntimeHealthState::RateLimited);

        let eval_during = pf.evaluate(&pid, "deepseek-chat", &RequestRequirements::text(), Some(20_000));
        assert!(!eval_during.allowed);
        assert!(matches!(eval_during.block_reason, Some(PreflightBlockReason::RateLimited { .. })));

        // 2. Once cooldown expires (t = 45,000 >= 40,000), state becomes ReadyPendingVerification
        let snap_after = hm.get_provider_health(&pid, 45_000).unwrap();
        assert_eq!(snap_after.state, RuntimeHealthState::ReadyPendingVerification);

        // Preflight is allowed once cooldown elapsed (not blocked)
        let eval_after = pf.evaluate(&pid, "deepseek-chat", &RequestRequirements::text(), Some(45_000));
        assert!(eval_after.allowed);
    }

    #[test]
    fn test_model_not_found_does_not_break_provider() {
        let (_reg, hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::MISTRAL).unwrap();

        // First, record a successful provider request to establish Ready
        let seq1 = hm.next_sequence();
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("mistral-large-latest".to_string()),
            timestamp_ms: 1000,
            sequence_number: seq1,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::Success,
            latency_ms: Some(200),
            http_status: Some(200),
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        // Now, record a model failure on another model
        let seq2 = hm.next_sequence();
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("codestral-latest".to_string()),
            timestamp_ms: 2000,
            sequence_number: seq2,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::ModelUnavailable {
                reason: "model_retired_or_not_found".to_string(),
            },
            latency_ms: Some(150),
            http_status: Some(404),
            provider_error_code: Some("model_not_found".to_string()),
            provider_request_id: None,
            retry_after_ms: None,
        });

        // Provider health remains Ready!
        let prov_snap = hm.get_provider_health(&pid, 2500).unwrap();
        assert_eq!(prov_snap.state, RuntimeHealthState::Ready);

        // But codestral-latest is ModelUnavailable!
        let codestral_snap = hm.get_model_health(&pid, "codestral-latest", 2500).unwrap();
        assert_eq!(codestral_snap.state, RuntimeHealthState::ModelUnavailable);

        // mistral-large-latest preflight still succeeds
        let eval_large = pf.evaluate(&pid, "mistral-large-latest", &RequestRequirements::text(), Some(2500));
        assert!(eval_large.allowed);

        // codestral-latest preflight is blocked
        let eval_codestral = pf.evaluate(&pid, "codestral-latest", &RequestRequirements::text(), Some(2500));
        assert!(!eval_codestral.allowed);
        assert_eq!(eval_codestral.block_reason, Some(PreflightBlockReason::ModelRuntimeUnavailable));
    }

    #[test]
    fn test_invalid_request_does_not_damage_health() {
        let (_reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::OPENAI).unwrap();

        // Establish Ready
        let seq1 = hm.next_sequence();
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("gpt-4o".to_string()),
            timestamp_ms: 1000,
            sequence_number: seq1,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::Success,
            latency_ms: Some(150),
            http_status: Some(200),
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        // Client sends 400 Bad Request (e.g. malformed JSON or invalid temperature)
        let seq2 = hm.next_sequence();
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("gpt-4o".to_string()),
            timestamp_ms: 2000,
            sequence_number: seq2,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::RequestRejected {
                reason: "invalid_temperature_parameter".to_string(),
            },
            latency_ms: Some(50),
            http_status: Some(400),
            provider_error_code: Some("invalid_request_error".to_string()),
            provider_request_id: None,
            retry_after_ms: None,
        });

        let snap = hm.get_provider_health(&pid, 2500).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::Ready);
    }

    #[test]
    fn test_cancellation_does_not_damage_health() {
        let (_reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::ANTHROPIC).unwrap();

        let seq1 = hm.next_sequence();
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("claude-3-5-sonnet-20241022".to_string()),
            timestamp_ms: 1000,
            sequence_number: seq1,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::Success,
            latency_ms: Some(200),
            http_status: Some(200),
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        // User cancels in-flight stream
        let seq2 = hm.next_sequence();
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("claude-3-5-sonnet-20241022".to_string()),
            timestamp_ms: 2000,
            sequence_number: seq2,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::CancelledByUser,
            latency_ms: Some(150),
            http_status: None,
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        let snap = hm.get_provider_health(&pid, 2500).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::Ready);
    }

    #[test]
    fn test_stale_health_evaluation() {
        let (reg, _hm, _cap, _pf) = setup_test_services();
        let hm_short_ttl = ProviderHealthManager::new(&reg).with_freshness_ttl_ms(10_000); // 10s TTL
        let pid = ProviderId::new(ProviderId::GROQ).unwrap();

        let seq = hm_short_ttl.next_sequence();
        hm_short_ttl.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("llama-3.3-70b-versatile".to_string()),
            timestamp_ms: 1000,
            sequence_number: seq,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::Success,
            latency_ms: Some(50),
            http_status: Some(200),
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        // Fresh at t = 5000 (< 1000 + 10000)
        let fresh_snap = hm_short_ttl.get_provider_health(&pid, 5000).unwrap();
        assert_eq!(fresh_snap.state, RuntimeHealthState::Ready);

        // Stale at t = 20000 (> 1000 + 10000)
        let stale_snap = hm_short_ttl.get_provider_health(&pid, 20_000).unwrap();
        assert_eq!(stale_snap.state, RuntimeHealthState::Stale);
    }

    #[test]
    fn test_out_of_order_observation_protection() {
        let (_reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::GEMINI).unwrap();

        // 1. Newer observation (seq = 20, time = 5000) succeeds
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("gemini-1.5-pro".to_string()),
            timestamp_ms: 5000,
            sequence_number: 20,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::Success,
            latency_ms: Some(250),
            http_status: Some(200),
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        // 2. Older delayed observation (seq = 10, time = 4000) arrives late reporting failure
        hm.record_observation(ProviderHealthObservation {
            provider_id: pid.clone(),
            model_id: Some("gemini-1.5-pro".to_string()),
            timestamp_ms: 4000,
            sequence_number: 10,
            source: HealthObservationSource::PassiveRequestOutcome,
            outcome: HealthObservationOutcome::TransportFailure {
                category: "late_connection_reset".to_string(),
            },
            latency_ms: Some(1000),
            http_status: None,
            provider_error_code: None,
            provider_request_id: None,
            retry_after_ms: None,
        });

        // The newer success MUST remain authoritative!
        let snap = hm.get_provider_health(&pid, 5500).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::Ready);
    }

    // ------------------------------------------------------------------------
    // 3. Capabilities & Preflight Intersection
    // ------------------------------------------------------------------------
    #[test]
    fn test_effective_capability_intersection() {
        let (_reg, _hm, cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::OPENAI).unwrap();

        let eff = cap
            .compute_effective_capabilities(&pid, "gpt-4o")
            .expect("effective caps failed");

        // Text, Streaming, and SystemMessages are implemented by native adapter
        assert!(eff.supports(crate::providers::capabilities::ProviderCapability::TextGeneration));
        assert!(eff.supports(crate::providers::capabilities::ProviderCapability::Streaming));
        assert!(eff.supports(crate::providers::capabilities::ProviderCapability::SystemMessages));

        // Tool calling is not implemented in MVP adapter, so effective capability is false
        assert!(!eff.supports(crate::providers::capabilities::ProviderCapability::ToolCalling));
    }

    #[test]
    fn test_preflight_blocks_unsupported_capabilities() {
        let (_reg, _hm, _cap, pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::ANTHROPIC).unwrap();

        // Request requires tools
        let req = RequestRequirements {
            requires_text: true,
            requires_streaming: true,
            requires_system_messages: true,
            requires_tools: true, // Not implemented in MVP adapter
            requires_vision: false,
            requires_audio: false,
            requires_structured_output: false,
            required_context_tokens: None,
        };

        let eval = pf.evaluate(&pid, "claude-3-5-sonnet-20241022", &req, Some(1000));
        assert!(!eval.allowed);
        assert!(matches!(eval.block_reason, Some(PreflightBlockReason::CapabilityUnsupported { .. })));
    }

    // ------------------------------------------------------------------------
    // 4. Concurrency & Thread-Safety
    // ------------------------------------------------------------------------
    #[test]
    fn test_concurrent_observations_no_data_race() {
        let (_reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::DEEPSEEK).unwrap();

        let mut handles = vec![];
        for i in 0..10 {
            let hm_clone = hm.clone();
            let pid_clone = pid.clone();
            handles.push(thread::spawn(move || {
                let seq = hm_clone.next_sequence();
                let outcome = if i % 2 == 0 {
                    HealthObservationOutcome::Success
                } else {
                    HealthObservationOutcome::TransportFailure {
                        category: "transient".to_string(),
                    }
                };

                hm_clone.record_observation(ProviderHealthObservation {
                    provider_id: pid_clone,
                    model_id: Some("deepseek-chat".to_string()),
                    timestamp_ms: 1000 + i * 10,
                    sequence_number: seq,
                    source: HealthObservationSource::PassiveRequestOutcome,
                    outcome,
                    latency_ms: Some(100 + i * 5),
                    http_status: Some(200),
                    provider_error_code: None,
                    provider_request_id: None,
                    retry_after_ms: None,
                });
            }));
        }

        for h in handles {
            h.join().unwrap();
        }

        let snap = hm.get_provider_health(&pid, 2000).unwrap();
        assert!(snap.last_observed_at_ms.is_some());
    }

    // ------------------------------------------------------------------------
    // 5. Explicit Health Probe Tests
    // ------------------------------------------------------------------------
    struct MockProbeRunner {
        result: Result<(u64, Option<u16>), (RuntimeHealthState, Option<u16>, String)>,
    }

    impl HealthProbeRunner for MockProbeRunner {
        fn run_probe(
            &self,
            _provider_id: &ProviderId,
            _model_id: Option<&str>,
        ) -> Result<(u64, Option<u16>), (RuntimeHealthState, Option<u16>, String)> {
            self.result.clone()
        }
    }

    #[tokio::test]
    async fn test_explicit_health_probe_success() {
        let (reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::OPENAI).unwrap();

        let runner = Arc::new(MockProbeRunner {
            result: Ok((42, Some(200))),
        });

        let probe_service = ProviderHealthProbeService::new(reg, hm.clone()).with_runner(runner);
        let check_res = probe_service.check_provider_health(&pid).await;

        assert_eq!(check_res.status, RuntimeHealthState::Ready);
        assert_eq!(check_res.latency_ms, Some(42));

        let snap = hm.get_provider_health(&pid, check_res.checked_at_ms + 10).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::Ready);
        assert_eq!(snap.last_latency_ms, Some(42));
    }

    #[tokio::test]
    async fn test_explicit_health_probe_failure() {
        let (reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::ANTHROPIC).unwrap();

        let runner = Arc::new(MockProbeRunner {
            result: Err((
                RuntimeHealthState::AuthenticationFailed,
                Some(401),
                "invalid_api_key".to_string(),
            )),
        });

        let probe_service = ProviderHealthProbeService::new(reg, hm.clone()).with_runner(runner);
        let check_res = probe_service.check_provider_health(&pid).await;

        assert_eq!(check_res.status, RuntimeHealthState::AuthenticationFailed);
        assert_eq!(check_res.http_status, Some(401));

        let snap = hm.get_provider_health(&pid, check_res.checked_at_ms + 10).unwrap();
        assert_eq!(snap.state, RuntimeHealthState::AuthenticationFailed);
    }

    // ------------------------------------------------------------------------
    // 6. Zero Secret Leakage Invariant
    // ------------------------------------------------------------------------
    #[test]
    fn test_zero_secret_leak_in_snapshot_serialization() {
        let (_reg, hm, _cap, _pf) = setup_test_services();
        let pid = ProviderId::new(ProviderId::GEMINI).unwrap();

        let snap = hm.get_provider_health(&pid, 1000).unwrap();
        let json = serde_json::to_string(&snap).unwrap();

        assert!(!json.contains("apiKey"));
        assert!(!json.contains("api_key"));
        assert!(!json.contains("password"));
        assert!(!json.contains("secret"));
        assert!(!json.contains("Bearer"));
        assert!(!json.contains("AIza"));
    }
}

