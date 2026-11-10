// ============================================================================
// Nano Route - Explicit Provider Health Probe
// File: src-tauri/src/providers/probe.rs
// ============================================================================
// Safe, opt-in explicit health check mechanism for AI providers.
// Never transmits conversational transcripts or user data.
// Never invoked automatically at application startup.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::providers::health_manager::{current_time_ms, ProviderHealthManager};
use crate::providers::health_types::{
    HealthObservationOutcome, HealthObservationSource, ProviderHealthObservation,
    RuntimeHealthState,
};
use crate::providers::identity::ProviderId;
use crate::providers::registry::ProviderRegistry;

/// Result returned from an explicit health check probe.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub provider_id: String,
    pub model_id: Option<String>,
    pub status: RuntimeHealthState,
    pub latency_ms: Option<u64>,
    pub http_status: Option<u16>,
    pub error_category: Option<String>,
    pub checked_at_ms: u64,
}

/// Abstract probe runner allowing deterministic unit testing without hitting real APIs.
pub trait HealthProbeRunner: Send + Sync {
    fn run_probe(
        &self,
        provider_id: &ProviderId,
        model_id: Option<&str>,
    ) -> Result<(u64, Option<u16>), (RuntimeHealthState, Option<u16>, String)>;
}

/// Default offline / simulated probe runner when real credentials are not being tested.
#[derive(Default)]
pub struct DefaultHealthProbeRunner;

impl HealthProbeRunner for DefaultHealthProbeRunner {
    fn run_probe(
        &self,
        _provider_id: &ProviderId,
        _model_id: Option<&str>,
    ) -> Result<(u64, Option<u16>), (RuntimeHealthState, Option<u16>, String)> {
        // Safe default: simulates a 35ms response
        Ok((35, Some(200)))
    }
}

/// Coordinator for explicit health check probes.
pub struct ProviderHealthProbeService {
    registry: Arc<ProviderRegistry>,
    health_manager: Arc<ProviderHealthManager>,
    runner: Arc<dyn HealthProbeRunner>,
}

impl ProviderHealthProbeService {
    pub fn new(
        registry: Arc<ProviderRegistry>,
        health_manager: Arc<ProviderHealthManager>,
    ) -> Self {
        Self {
            registry,
            health_manager,
            runner: Arc::new(DefaultHealthProbeRunner),
        }
    }

    pub fn with_runner(mut self, runner: Arc<dyn HealthProbeRunner>) -> Self {
        self.runner = runner;
        self
    }

    /// Executes an explicit health probe for a provider.
    pub async fn check_provider_health(
        &self,
        provider_id: &ProviderId,
    ) -> HealthCheckResult {
        let now = current_time_ms();

        // 1. Validate provider in registry
        let provider_desc = match self.registry.get_provider(provider_id) {
            Some(d) => d,
            None => {
                return HealthCheckResult {
                    provider_id: provider_id.to_string(),
                    model_id: None,
                    status: RuntimeHealthState::ProviderUnavailable,
                    latency_ms: None,
                    http_status: Some(404),
                    error_category: Some("provider_not_found".to_string()),
                    checked_at_ms: now,
                };
            }
        };

        // 2. Check if provider is enabled and credential configured
        let snapshot = self.health_manager.get_provider_health(provider_id, now);
        if let Some(snap) = snapshot {
            if !snap.is_enabled {
                return HealthCheckResult {
                    provider_id: provider_id.to_string(),
                    model_id: None,
                    status: RuntimeHealthState::ProviderDisabled,
                    latency_ms: None,
                    http_status: None,
                    error_category: Some("provider_disabled".to_string()),
                    checked_at_ms: now,
                };
            }
            if provider_desc.credential_required && !snap.is_credential_configured {
                return HealthCheckResult {
                    provider_id: provider_id.to_string(),
                    model_id: None,
                    status: RuntimeHealthState::CredentialMissing,
                    latency_ms: None,
                    http_status: None,
                    error_category: Some("credential_missing".to_string()),
                    checked_at_ms: now,
                };
            }
        }

        let model_id = provider_desc.default_model_id.as_deref();
        let seq = self.health_manager.next_sequence();

        // 3. Run probe using injected probe runner
        match self.runner.run_probe(provider_id, model_id) {
            Ok((latency_ms, http_status)) => {
                self.health_manager.record_observation(ProviderHealthObservation {
                    provider_id: provider_id.clone(),
                    model_id: model_id.map(|s| s.to_string()),
                    timestamp_ms: now,
                    sequence_number: seq,
                    source: HealthObservationSource::ExplicitHealthCheck,
                    outcome: HealthObservationOutcome::Success,
                    latency_ms: Some(latency_ms),
                    http_status,
                    provider_error_code: None,
                    provider_request_id: None,
                    retry_after_ms: None,
                });

                HealthCheckResult {
                    provider_id: provider_id.to_string(),
                    model_id: model_id.map(|s| s.to_string()),
                    status: RuntimeHealthState::Ready,
                    latency_ms: Some(latency_ms),
                    http_status,
                    error_category: None,
                    checked_at_ms: now,
                }
            }
            Err((failed_state, http_status, error_cat)) => {
                let outcome = match failed_state {
                    RuntimeHealthState::AuthenticationFailed => {
                        HealthObservationOutcome::AuthenticationFailed
                    }
                    RuntimeHealthState::RateLimited => {
                        HealthObservationOutcome::RateLimited { retry_after_ms: None }
                    }
                    RuntimeHealthState::ProviderUnavailable => {
                        HealthObservationOutcome::ProviderUnavailable
                    }
                    _ => HealthObservationOutcome::TransportFailure {
                        category: error_cat.clone(),
                    },
                };

                self.health_manager.record_observation(ProviderHealthObservation {
                    provider_id: provider_id.clone(),
                    model_id: model_id.map(|s| s.to_string()),
                    timestamp_ms: now,
                    sequence_number: seq,
                    source: HealthObservationSource::ExplicitHealthCheck,
                    outcome,
                    latency_ms: None,
                    http_status,
                    provider_error_code: Some(error_cat.clone()),
                    provider_request_id: None,
                    retry_after_ms: None,
                });

                HealthCheckResult {
                    provider_id: provider_id.to_string(),
                    model_id: model_id.map(|s| s.to_string()),
                    status: failed_state,
                    latency_ms: None,
                    http_status,
                    error_category: Some(error_cat),
                    checked_at_ms: now,
                }
            }
        }
    }
}

