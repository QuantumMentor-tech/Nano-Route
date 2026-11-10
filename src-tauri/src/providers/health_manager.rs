// ============================================================================
// Nano Route - Provider Health State Manager
// File: src-tauri/src/providers/health_manager.rs
// ============================================================================
// Centralized, thread-safe runtime health manager observing provider outcomes,
// managing model-scoped and provider-scoped health states, normalizing rate limits,
// and producing sanitized, read-only snapshots.
// Contains zero secret persistence, routing heuristics, or automatic retry loops.
// ============================================================================

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::providers::descriptor::ProviderImplementationState;
use crate::providers::errors::{ProviderError, ProviderErrorKind};
use crate::providers::health_types::{
    HealthObservationOutcome, HealthObservationSource, ModelHealthSnapshot,
    ProviderHealthObservation, ProviderHealthSnapshot, RateLimitInfo, RuntimeHealthState,
};
use crate::providers::identity::ProviderId;
use crate::providers::registry::ProviderRegistry;
use crate::providers::response::ProviderResponse;

/// Default freshness TTL: 30 minutes. If no observation arrives within this window,
/// snapshots are marked `Stale`.
pub const DEFAULT_HEALTH_FRESHNESS_TTL_MS: u64 = 30 * 60 * 1000;

/// Returns current Unix epoch time in milliseconds.
pub fn current_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Internal mutable model record.
#[derive(Debug, Clone)]
struct InternalModelHealth {
    model_id: String,
    state: RuntimeHealthState,
    last_observed_at_ms: Option<u64>,
    last_success_at_ms: Option<u64>,
    last_failure_at_ms: Option<u64>,
    last_error_category: Option<String>,
    last_sequence: u64,
}

/// Internal mutable provider record.
#[derive(Debug, Clone)]
struct InternalProviderHealth {
    provider_id: ProviderId,
    display_name: String,
    state: RuntimeHealthState,
    is_enabled: bool,
    is_credential_configured: bool,
    is_adapter_implemented: bool,
    reason_code: Option<String>,
    last_observed_at_ms: Option<u64>,
    last_success_at_ms: Option<u64>,
    last_failure_at_ms: Option<u64>,
    last_latency_ms: Option<u64>,
    last_http_status: Option<u16>,
    last_provider_request_id: Option<String>,
    rate_limit_info: RateLimitInfo,
    last_sequence: u64,
    models: HashMap<String, InternalModelHealth>,
}

/// Authoritative Provider Health Manager.
pub struct ProviderHealthManager {
    records: RwLock<HashMap<ProviderId, InternalProviderHealth>>,
    sequence_counter: AtomicU64,
    freshness_ttl_ms: u64,
}

impl ProviderHealthManager {
    /// Creates a new health manager initialized purely from static registry facts.
    /// Performs ZERO network calls at startup; initial runtime state is `Unknown`.
    pub fn new(registry: &ProviderRegistry) -> Self {
        let mut records = HashMap::new();

        for desc in registry.list_providers() {
            let pid = &desc.provider_id;
            let models_for_p = registry.list_models_for_provider(pid);

            let mut model_map = HashMap::new();
            for m in models_for_p {
                model_map.insert(
                    m.model_id.clone(),
                    InternalModelHealth {
                        model_id: m.model_id.clone(),
                        state: RuntimeHealthState::Unknown,
                        last_observed_at_ms: None,
                        last_success_at_ms: None,
                        last_failure_at_ms: None,
                        last_error_category: None,
                        last_sequence: 0,
                    },
                );
            }

            let is_implemented = desc.implementation_state == ProviderImplementationState::Implemented;
            // Local SLM does not require credentials; cloud providers default to missing until loaded
            let is_credential_configured = !desc.credential_required;

            records.insert(
                pid.clone(),
                InternalProviderHealth {
                    provider_id: pid.clone(),
                    display_name: desc.display_name.clone(),
                    state: RuntimeHealthState::Unknown,
                    is_enabled: true,
                    is_credential_configured,
                    is_adapter_implemented: is_implemented,
                    reason_code: None,
                    last_observed_at_ms: None,
                    last_success_at_ms: None,
                    last_failure_at_ms: None,
                    last_latency_ms: None,
                    last_http_status: None,
                    last_provider_request_id: None,
                    rate_limit_info: RateLimitInfo::default(),
                    last_sequence: 0,
                    models: model_map,
                },
            );
        }

        Self {
            records: RwLock::new(records),
            sequence_counter: AtomicU64::new(1),
            freshness_ttl_ms: DEFAULT_HEALTH_FRESHNESS_TTL_MS,
        }
    }

    /// Custom freshness TTL builder.
    pub fn with_freshness_ttl_ms(mut self, ttl_ms: u64) -> Self {
        self.freshness_ttl_ms = ttl_ms;
        self
    }

    /// Next monotonic sequence number for ordering observations.
    pub fn next_sequence(&self) -> u64 {
        self.sequence_counter.fetch_add(1, Ordering::Relaxed)
    }

    /// Records an operational observation into the health manager state.
    pub fn record_observation(&self, obs: ProviderHealthObservation) {
        let mut lock = match self.records.write() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };

        let record = match lock.get_mut(&obs.provider_id) {
            Some(r) => r,
            None => return, // Unknown provider, drop cleanly
        };

        // Out-of-order check: if older than the last observation sequence and timestamp,
        // do not allow an older failure to overwrite newer positive state
        let is_stale_observation = obs.sequence_number > 0
            && obs.sequence_number < record.last_sequence
            && obs.timestamp_ms <= record.last_observed_at_ms.unwrap_or(0);

        if is_stale_observation && !matches!(obs.outcome, HealthObservationOutcome::Success) {
            return;
        }

        record.last_sequence = record.last_sequence.max(obs.sequence_number);
        record.last_observed_at_ms = Some(obs.timestamp_ms);
        if let Some(lat) = obs.latency_ms {
            record.last_latency_ms = Some(lat);
        }
        if let Some(status) = obs.http_status {
            record.last_http_status = Some(status);
        }
        if let Some(ref req_id) = obs.provider_request_id {
            record.last_provider_request_id = Some(req_id.clone());
        }

        match &obs.outcome {
            HealthObservationOutcome::Success => {
                record.state = RuntimeHealthState::Ready;
                record.reason_code = None;
                record.last_success_at_ms = Some(obs.timestamp_ms);
                record.rate_limit_info = RateLimitInfo::default();

                if let Some(ref mid) = obs.model_id {
                    if let Some(model_rec) = record.models.get_mut(mid) {
                        model_rec.state = RuntimeHealthState::Ready;
                        model_rec.last_observed_at_ms = Some(obs.timestamp_ms);
                        model_rec.last_success_at_ms = Some(obs.timestamp_ms);
                        model_rec.last_error_category = None;
                        model_rec.last_sequence = model_rec.last_sequence.max(obs.sequence_number);
                    }
                }
            }

            HealthObservationOutcome::RateLimited { retry_after_ms } => {
                record.state = RuntimeHealthState::RateLimited;
                record.reason_code = Some("rate_limited".to_string());
                record.last_failure_at_ms = Some(obs.timestamp_ms);
                record.rate_limit_info = RateLimitInfo::limited(
                    obs.timestamp_ms,
                    *retry_after_ms.as_ref().or(obs.retry_after_ms.as_ref()),
                );

                if let Some(ref mid) = obs.model_id {
                    if let Some(model_rec) = record.models.get_mut(mid) {
                        model_rec.state = RuntimeHealthState::RateLimited;
                        model_rec.last_observed_at_ms = Some(obs.timestamp_ms);
                        model_rec.last_failure_at_ms = Some(obs.timestamp_ms);
                        model_rec.last_error_category = Some("rate_limited".to_string());
                    }
                }
            }

            HealthObservationOutcome::AuthenticationFailed => {
                record.state = RuntimeHealthState::AuthenticationFailed;
                record.reason_code = Some("authentication_failed".to_string());
                record.last_failure_at_ms = Some(obs.timestamp_ms);
            }

            HealthObservationOutcome::AuthorizationFailed => {
                record.state = RuntimeHealthState::AuthorizationFailed;
                record.reason_code = Some("authorization_failed".to_string());
                record.last_failure_at_ms = Some(obs.timestamp_ms);
            }

            HealthObservationOutcome::ProviderUnavailable => {
                record.state = RuntimeHealthState::ProviderUnavailable;
                record.reason_code = Some("provider_unavailable".to_string());
                record.last_failure_at_ms = Some(obs.timestamp_ms);
            }

            HealthObservationOutcome::ModelUnavailable { reason } => {
                // Section 40: Model failures do NOT mark provider unavailable!
                record.last_failure_at_ms = Some(obs.timestamp_ms);
                if let Some(ref mid) = obs.model_id {
                    if let Some(model_rec) = record.models.get_mut(mid) {
                        model_rec.state = RuntimeHealthState::ModelUnavailable;
                        model_rec.last_observed_at_ms = Some(obs.timestamp_ms);
                        model_rec.last_failure_at_ms = Some(obs.timestamp_ms);
                        model_rec.last_error_category = Some(reason.clone());
                    }
                }
            }

            HealthObservationOutcome::TransportFailure { category } => {
                record.state = RuntimeHealthState::Degraded;
                record.reason_code = Some(category.clone());
                record.last_failure_at_ms = Some(obs.timestamp_ms);
            }

            HealthObservationOutcome::Timeout { .. } => {
                record.state = RuntimeHealthState::Degraded;
                record.reason_code = Some("timeout".to_string());
                record.last_failure_at_ms = Some(obs.timestamp_ms);
            }

            HealthObservationOutcome::RequestRejected { .. } => {
                // Section 39: Bad request (400, length exceeded) does NOT damage provider health
                // We record metadata but keep current state operational
            }

            HealthObservationOutcome::CancelledByUser => {
                // Section 76, 106: User cancellation must NEVER damage provider health
            }
        }
    }

    /// Convenience bridge mapping provider execution outcome to an observation.
    pub fn record_request_result(
        &self,
        provider_id: &ProviderId,
        model_id: Option<&str>,
        start_time_ms: u64,
        end_time_ms: u64,
        result: Result<&ProviderResponse, &ProviderError>,
    ) {
        let latency_ms = end_time_ms.saturating_sub(start_time_ms);
        let seq = self.next_sequence();

        let observation = match result {
            Ok(resp) => ProviderHealthObservation {
                provider_id: provider_id.clone(),
                model_id: model_id.map(|s| s.to_string()),
                timestamp_ms: end_time_ms,
                sequence_number: seq,
                source: HealthObservationSource::PassiveRequestOutcome,
                outcome: HealthObservationOutcome::Success,
                latency_ms: Some(latency_ms),
                http_status: Some(200),
                provider_error_code: None,
                provider_request_id: resp.metadata.system_fingerprint.clone(),
                retry_after_ms: None,
            },
            Err(err) => {
                let outcome = match err.kind {
                    ProviderErrorKind::Cancelled => HealthObservationOutcome::CancelledByUser,
                    ProviderErrorKind::InvalidRequest => HealthObservationOutcome::RequestRejected {
                        reason: err.message.clone(),
                    },
                    ProviderErrorKind::ModelNotFound => HealthObservationOutcome::ModelUnavailable {
                        reason: err.message.clone(),
                    },
                    ProviderErrorKind::AuthenticationFailed => HealthObservationOutcome::AuthenticationFailed,
                    ProviderErrorKind::RateLimited => HealthObservationOutcome::RateLimited {
                        retry_after_ms: err.retry_after_ms,
                    },
                    ProviderErrorKind::ProviderUnavailable => HealthObservationOutcome::ProviderUnavailable,
                    ProviderErrorKind::Timeout => HealthObservationOutcome::Timeout {
                        timeout_ms: latency_ms,
                    },
                    ProviderErrorKind::NetworkError => HealthObservationOutcome::TransportFailure {
                        category: "network_error".to_string(),
                    },
                    ProviderErrorKind::ContextLengthExceeded => {
                        HealthObservationOutcome::RequestRejected {
                            reason: "context_length_exceeded".to_string(),
                        }
                    }
                    _ => HealthObservationOutcome::TransportFailure {
                        category: "internal_or_parse_error".to_string(),
                    },
                };

                ProviderHealthObservation {
                    provider_id: provider_id.clone(),
                    model_id: model_id.map(|s| s.to_string()),
                    timestamp_ms: end_time_ms,
                    sequence_number: seq,
                    source: HealthObservationSource::PassiveRequestOutcome,
                    outcome,
                    latency_ms: Some(latency_ms),
                    http_status: err.status_code,
                    provider_error_code: err.source_code.clone(),
                    provider_request_id: None,
                    retry_after_ms: err.retry_after_ms,
                }
            }
        };

        self.record_observation(observation);
    }

    /// Updates credential status in response to vault change.
    pub fn update_credential_status(&self, provider_id: &ProviderId, is_configured: bool) {
        let mut lock = match self.records.write() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        if let Some(record) = lock.get_mut(provider_id) {
            record.is_credential_configured = is_configured;
            if !is_configured {
                record.state = RuntimeHealthState::CredentialMissing;
                record.reason_code = Some("credential_missing".to_string());
            } else if record.state == RuntimeHealthState::CredentialMissing
                || record.state == RuntimeHealthState::AuthenticationFailed
            {
                // Invalidate failure; transition to Unknown for fresh observation
                record.state = RuntimeHealthState::Unknown;
                record.reason_code = None;
            }
        }
    }

    /// Updates provider enabled status in response to preferences change.
    pub fn update_provider_enabled(&self, provider_id: &ProviderId, is_enabled: bool) {
        let mut lock = match self.records.write() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        if let Some(record) = lock.get_mut(provider_id) {
            record.is_enabled = is_enabled;
            if !is_enabled {
                record.state = RuntimeHealthState::ProviderDisabled;
                record.reason_code = Some("provider_disabled".to_string());
            } else if record.state == RuntimeHealthState::ProviderDisabled {
                record.state = RuntimeHealthState::Unknown;
                record.reason_code = None;
            }
        }
    }

    /// Updates endpoint configuration status.
    pub fn update_endpoint_validity(&self, provider_id: &ProviderId, is_valid: bool) {
        let mut lock = match self.records.write() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        if let Some(record) = lock.get_mut(provider_id) {
            if !is_valid {
                record.state = RuntimeHealthState::EndpointMisconfigured;
                record.reason_code = Some("endpoint_misconfigured".to_string());
            } else if record.state == RuntimeHealthState::EndpointMisconfigured {
                record.state = RuntimeHealthState::Unknown;
                record.reason_code = None;
            }
        }
    }

    /// Retrieves an immutable, safe health snapshot for a provider at a specific wall-clock timestamp.
    pub fn get_provider_health(
        &self,
        provider_id: &ProviderId,
        now_ms: u64,
    ) -> Option<ProviderHealthSnapshot> {
        let lock = match self.records.read() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        lock.get(provider_id).map(|r| self.build_snapshot(r, now_ms))
    }

    /// Retrieves all provider health snapshots at a specific wall-clock timestamp.
    pub fn get_all_provider_health(&self, now_ms: u64) -> Vec<ProviderHealthSnapshot> {
        let lock = match self.records.read() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        lock.values().map(|r| self.build_snapshot(r, now_ms)).collect()
    }

    /// Retrieves the health snapshot for a specific model under a provider.
    pub fn get_model_health(
        &self,
        provider_id: &ProviderId,
        model_id: &str,
        now_ms: u64,
    ) -> Option<ModelHealthSnapshot> {
        let lock = match self.records.read() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };

        let provider_rec = lock.get(provider_id)?;
        let model_rec = provider_rec.models.get(model_id)?;

        let effective_state = self.resolve_effective_state(
            model_rec.state,
            model_rec.last_observed_at_ms,
            &provider_rec.rate_limit_info,
            now_ms,
        );

        Some(ModelHealthSnapshot {
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            state: effective_state,
            last_observed_at_ms: model_rec.last_observed_at_ms,
            last_success_at_ms: model_rec.last_success_at_ms,
            last_failure_at_ms: model_rec.last_failure_at_ms,
            last_error_category: model_rec.last_error_category.clone(),
        })
    }

    /// Resolves effective health state taking into account rate-limit expiration and freshness TTL.
    fn resolve_effective_state(
        &self,
        base_state: RuntimeHealthState,
        last_observed_at_ms: Option<u64>,
        rate_limit_info: &RateLimitInfo,
        now_ms: u64,
    ) -> RuntimeHealthState {
        // 1. Rate-limit cooldown expiration check (Section 35, 108)
        if base_state == RuntimeHealthState::RateLimited {
            if rate_limit_info.is_cooldown_expired(now_ms) {
                return RuntimeHealthState::ReadyPendingVerification;
            } else {
                return RuntimeHealthState::RateLimited;
            }
        }

        // 2. Freshness check: if base state was Ready but observation is older than TTL, mark Stale
        if base_state == RuntimeHealthState::Ready {
            if let Some(observed_at) = last_observed_at_ms {
                if now_ms.saturating_sub(observed_at) > self.freshness_ttl_ms {
                    return RuntimeHealthState::Stale;
                }
            }
        }

        base_state
    }

    /// Builds an external, read-safe snapshot from internal record.
    fn build_snapshot(
        &self,
        record: &InternalProviderHealth,
        now_ms: u64,
    ) -> ProviderHealthSnapshot {
        let effective_provider_state = self.resolve_effective_state(
            record.state,
            record.last_observed_at_ms,
            &record.rate_limit_info,
            now_ms,
        );

        let mut model_snapshots = Vec::new();
        for (m_id, m_rec) in &record.models {
            let eff_m_state = self.resolve_effective_state(
                m_rec.state,
                m_rec.last_observed_at_ms,
                &record.rate_limit_info,
                now_ms,
            );

            model_snapshots.push(ModelHealthSnapshot {
                provider_id: record.provider_id.to_string(),
                model_id: m_id.clone(),
                state: eff_m_state,
                last_observed_at_ms: m_rec.last_observed_at_ms,
                last_success_at_ms: m_rec.last_success_at_ms,
                last_failure_at_ms: m_rec.last_failure_at_ms,
                last_error_category: m_rec.last_error_category.clone(),
            });
        }

        // Sort models by ID for deterministic output
        model_snapshots.sort_by(|a, b| a.model_id.cmp(&b.model_id));

        ProviderHealthSnapshot {
            provider_id: record.provider_id.to_string(),
            display_name: record.display_name.clone(),
            state: effective_provider_state,
            is_enabled: record.is_enabled,
            is_credential_configured: record.is_credential_configured,
            is_adapter_implemented: record.is_adapter_implemented,
            reason_code: record.reason_code.clone(),
            last_observed_at_ms: record.last_observed_at_ms,
            last_success_at_ms: record.last_success_at_ms,
            last_failure_at_ms: record.last_failure_at_ms,
            last_latency_ms: record.last_latency_ms,
            last_http_status: record.last_http_status,
            last_provider_request_id: record.last_provider_request_id.clone(),
            rate_limit_info: record.rate_limit_info.clone(),
            models: model_snapshots,
        }
    }
}

