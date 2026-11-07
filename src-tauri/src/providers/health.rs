// ============================================================================
// Nano Route - Provider Health State
// File: src-tauri/src/providers/health.rs
// ============================================================================
// Normalized operational health assessment for AI providers.
// Used by routing, failover, telemetry, and UI status badges.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::fmt;

/// Normalized health state of an AI execution provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderHealth {
    /// Initial or unchecked state; connectivity has not yet been established.
    Unknown,
    /// Provider is online, authenticated, and accepting inference requests normally.
    Available,
    /// Provider endpoints are unreachable, offline, or experiencing major outages.
    Unavailable,
    /// Provider is functioning but experiencing high latency, partial error rates, or degraded SLAs.
    Degraded,
    /// Credentials / API keys are missing, rejected, expired, or lacking required scopes.
    Unauthorized,
    /// Provider tier quota or velocity rate limit (429) has been reached.
    RateLimited,
    /// Base URL, model mappings, or configuration flags are invalid or malformed.
    Misconfigured,
    /// Provider has been manually disabled by user configuration or governance policy.
    Disabled,
}

impl ProviderHealth {
    /// Returns whether the provider can be considered for candidate routing and execution.
    /// Only `Available` and `Degraded` are operational (Degraded may receive lower routing weight).
    #[inline]
    pub fn is_operational(&self) -> bool {
        matches!(self, Self::Available | Self::Degraded)
    }

    /// Returns a static string slice representing the health status.
    #[inline]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Unknown => "unknown",
            Self::Available => "available",
            Self::Unavailable => "unavailable",
            Self::Degraded => "degraded",
            Self::Unauthorized => "unauthorized",
            Self::RateLimited => "rate_limited",
            Self::Misconfigured => "misconfigured",
            Self::Disabled => "disabled",
        }
    }
}

impl fmt::Display for ProviderHealth {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl Default for ProviderHealth {
    #[inline]
    fn default() -> Self {
        Self::Unknown
    }
}

/// Detailed health check report returned by provider probes.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderHealthReport {
    /// High-level normalized health status.
    pub status: ProviderHealth,
    /// Unix timestamp in milliseconds when health was verified.
    pub checked_at_ms: u64,
    /// Round-trip ping or probe latency in milliseconds, if measured.
    pub latency_ms: Option<u64>,
    /// Human-readable diagnostic message (scrubbed of sensitive credentials).
    pub message: Option<String>,
}

impl ProviderHealthReport {
    /// Construct a new health report.
    pub fn new(
        status: ProviderHealth,
        checked_at_ms: u64,
        latency_ms: Option<u64>,
        message: Option<String>,
    ) -> Self {
        Self {
            status,
            checked_at_ms,
            latency_ms,
            message,
        }
    }

    /// Convenience constructor for operational available state.
    pub fn available(checked_at_ms: u64, latency_ms: Option<u64>) -> Self {
        Self::new(ProviderHealth::Available, checked_at_ms, latency_ms, None)
    }

    /// Convenience constructor for unavailable state with sanitized diagnostic message.
    pub fn unavailable(checked_at_ms: u64, message: impl Into<String>) -> Self {
        Self::new(ProviderHealth::Unavailable, checked_at_ms, None, Some(message.into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_operational_states() {
        assert!(ProviderHealth::Available.is_operational());
        assert!(ProviderHealth::Degraded.is_operational());

        assert!(!ProviderHealth::Unknown.is_operational());
        assert!(!ProviderHealth::Unavailable.is_operational());
        assert!(!ProviderHealth::Unauthorized.is_operational());
        assert!(!ProviderHealth::RateLimited.is_operational());
        assert!(!ProviderHealth::Misconfigured.is_operational());
        assert!(!ProviderHealth::Disabled.is_operational());
    }

    #[test]
    fn test_health_serialization() {
        let json = serde_json::to_string(&ProviderHealth::RateLimited).unwrap();
        assert_eq!(json, "\"rate_limited\"");

        let deserialized: ProviderHealth = serde_json::from_str("\"degraded\"").unwrap();
        assert_eq!(deserialized, ProviderHealth::Degraded);
    }

    #[test]
    fn test_health_report() {
        let report = ProviderHealthReport::available(1700000000000, Some(45));
        assert!(report.status.is_operational());
        assert_eq!(report.latency_ms, Some(45));
    }
}

