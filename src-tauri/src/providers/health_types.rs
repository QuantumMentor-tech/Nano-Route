// ============================================================================
// Nano Route - Provider Runtime Health & Capability Types
// File: src-tauri/src/providers/health_types.rs
// ============================================================================
// Authoritative domain types for provider runtime health, observations,
// rate-limit metadata, and immutable read-safe snapshots.
// Contains zero secret credentials, auth headers, prompts, or completion tokens.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use crate::providers::identity::ProviderId;

/// Granular, typed runtime health state for an AI provider or model.
/// Preserves explicit semantics rather than collapsing into a boolean.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeHealthState {
    /// Initial or unobserved state. No request has completed yet.
    /// This is NOT a failure condition.
    Unknown,
    /// Provider has recently completed a valid request or explicit check.
    Ready,
    /// Experiencing elevated operational issues (e.g., timeout, transport failures, intermittent 5xx).
    /// May still be usable for execution.
    Degraded,
    /// Explicitly rate-limited (HTTP 429) with optional cooldown timestamp.
    RateLimited,
    /// API key was rejected by remote provider (HTTP 401/403).
    AuthenticationFailed,
    /// Credential exists but lacks permissions for the requested resource.
    AuthorizationFailed,
    /// Endpoint is unreachable, network connection refused, or returning 502/503/504 outages.
    ProviderUnavailable,
    /// Local configuration or custom base URL is malformed or invalid.
    EndpointMisconfigured,
    /// No API key or credential is configured for a provider requiring authentication.
    CredentialMissing,
    /// User or policy has explicitly disabled this provider.
    ProviderDisabled,
    /// Provider is operational, but the specific requested model is 404, retired, or unavailable.
    ModelUnavailable,
    /// Provider rejected the request due to malformed arguments or excessive context (HTTP 400).
    /// Does NOT indicate a provider outage.
    RequestRejected,
    /// Rate limit cooldown expired; awaiting positive verification from next real request.
    ReadyPendingVerification,
    /// Observation is older than freshness TTL window; status cannot be guaranteed fresh.
    Stale,
}

impl RuntimeHealthState {
    /// Returns true if this state represents a definitive, hard local blocker for preflight.
    #[inline]
    pub fn is_definitive_blocker(&self) -> bool {
        matches!(
            self,
            Self::AuthenticationFailed
                | Self::EndpointMisconfigured
                | Self::CredentialMissing
                | Self::ProviderDisabled
                | Self::ProviderUnavailable
        )
    }

    /// Returns a machine-readable string representation.
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Ready => "ready",
            Self::Degraded => "degraded",
            Self::RateLimited => "rate_limited",
            Self::AuthenticationFailed => "authentication_failed",
            Self::AuthorizationFailed => "authorization_failed",
            Self::ProviderUnavailable => "provider_unavailable",
            Self::EndpointMisconfigured => "endpoint_misconfigured",
            Self::CredentialMissing => "credential_missing",
            Self::ProviderDisabled => "provider_disabled",
            Self::ModelUnavailable => "model_unavailable",
            Self::RequestRejected => "request_rejected",
            Self::ReadyPendingVerification => "ready_pending_verification",
            Self::Stale => "stale",
        }
    }
}

impl fmt::Display for RuntimeHealthState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Default for RuntimeHealthState {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Source that generated a health observation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthObservationSource {
    /// Passive observation from an actual user or application request.
    PassiveRequestOutcome,
    /// Explicit, user- or diagnostics-triggered health probe.
    ExplicitHealthCheck,
    /// User updated provider preferences or base URL.
    ConfigurationChange,
    /// Credential was added, removed, or updated in DPAPI vault.
    CredentialStateChange,
    /// Provider was toggled active or inactive.
    ProviderEnabledStateChange,
    /// Static registry initialization during application bootstrap.
    RegistryInitialization,
}

/// Outcome category of an observed provider interaction.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthObservationOutcome {
    Success,
    RateLimited {
        retry_after_ms: Option<u64>,
    },
    AuthenticationFailed,
    AuthorizationFailed,
    ProviderUnavailable,
    ModelUnavailable {
        reason: String,
    },
    TransportFailure {
        category: String,
    },
    Timeout {
        timeout_ms: u64,
    },
    RequestRejected {
        reason: String,
    },
    CancelledByUser,
}

/// Immutable record of a single operational observation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ProviderHealthObservation {
    pub provider_id: ProviderId,
    pub model_id: Option<String>,
    pub timestamp_ms: u64,
    pub sequence_number: u64,
    pub source: HealthObservationSource,
    pub outcome: HealthObservationOutcome,
    pub latency_ms: Option<u64>,
    pub http_status: Option<u16>,
    pub provider_error_code: Option<String>,
    pub provider_request_id: Option<String>,
    pub retry_after_ms: Option<u64>,
}

/// Normalized rate limit metadata where available from provider response headers.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub is_limited: bool,
    pub retry_after_at_ms: Option<u64>,
    pub remaining_requests: Option<u32>,
    pub remaining_tokens: Option<u32>,
    pub reset_requests_at_ms: Option<u64>,
    pub reset_tokens_at_ms: Option<u64>,
}

impl RateLimitInfo {
    /// Creates an active rate-limited record with defensive cooldown timestamp.
    pub fn limited(now_ms: u64, retry_after_ms: Option<u64>) -> Self {
        // Clamp retry_after_ms to max 24 hours to prevent absurd remote values
        let clamped_retry_ms = retry_after_ms.map(|ms| ms.min(86_400_000));
        let retry_after_at_ms = clamped_retry_ms.map(|ms| now_ms.saturating_add(ms));

        Self {
            is_limited: true,
            retry_after_at_ms,
            remaining_requests: Some(0),
            remaining_tokens: None,
            reset_requests_at_ms: retry_after_at_ms,
            reset_tokens_at_ms: None,
        }
    }

    /// Checks if a rate-limit cooldown has elapsed relative to current wall time.
    pub fn is_cooldown_expired(&self, now_ms: u64) -> bool {
        if !self.is_limited {
            return true;
        }
        match self.retry_after_at_ms {
            Some(expiry) => now_ms >= expiry,
            None => false,
        }
    }
}

/// Safe, immutable runtime health snapshot for a single model under a provider.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ModelHealthSnapshot {
    pub provider_id: String,
    pub model_id: String,
    pub state: RuntimeHealthState,
    pub last_observed_at_ms: Option<u64>,
    pub last_success_at_ms: Option<u64>,
    pub last_failure_at_ms: Option<u64>,
    pub last_error_category: Option<String>,
}

/// Safe, read-only runtime health snapshot for an entire provider.
/// Contains zero secret material, keys, prompts, or completion tokens.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderHealthSnapshot {
    pub provider_id: String,
    pub display_name: String,
    pub state: RuntimeHealthState,
    pub is_enabled: bool,
    pub is_credential_configured: bool,
    pub is_adapter_implemented: bool,
    pub reason_code: Option<String>,
    pub last_observed_at_ms: Option<u64>,
    pub last_success_at_ms: Option<u64>,
    pub last_failure_at_ms: Option<u64>,
    pub last_latency_ms: Option<u64>,
    pub last_http_status: Option<u16>,
    pub last_provider_request_id: Option<String>,
    pub rate_limit_info: RateLimitInfo,
    pub models: Vec<ModelHealthSnapshot>,
}

