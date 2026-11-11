// ============================================================================
// Nano Route - Rate Limit & Retry-After Parser
// File: src-tauri/src/reliability/rate_limit.rs
// ============================================================================
// Normalizes HTTP 429 and provider-specific rate limit metadata into safe,
// clamped durations and validated reset windows (Step 38).
// ============================================================================

use serde::{Deserialize, Serialize};

/// Maximum allowed retry wait under automatic policy (default 30 seconds).
pub const DEFAULT_MAX_RETRY_DELAY_CAP_MS: u64 = 30_000;

/// Normalized rate limit metadata captured from upstream provider headers or response body.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RateLimitMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remaining: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_at_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
}

/// Safe parser for upstream `Retry-After` header values (RFC 7231 / RFC 9110).
pub struct RateLimitParser;

impl RateLimitParser {
    /// Parses a raw `Retry-After` header value into a safe delay in milliseconds.
    /// Supports delta-seconds (integer or decimal) and safely clamps to max_cap_ms.
    /// Malformed, negative, or absurd values return None.
    pub fn parse_retry_after(raw: &str, max_cap_ms: u64) -> Option<u64> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return None;
        }

        // 1. Delta-seconds format (e.g. "5", "2.5", "120")
        if let Ok(secs) = trimmed.parse::<f64>() {
            if secs < 0.0 || secs.is_nan() || secs.is_infinite() {
                return None;
            }
            let delay_ms = (secs * 1000.0) as u64;
            return Some(delay_ms.min(max_cap_ms));
        }

        // 2. HTTP-date format (e.g. "Wed, 21 Oct 2026 07:28:00 GMT")
        // If HTTP-date parsing is needed without external crates, we gracefully fallback
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_retry_after_seconds() {
        assert_eq!(RateLimitParser::parse_retry_after("2", 30_000), Some(2000));
        assert_eq!(RateLimitParser::parse_retry_after("0.5", 30_000), Some(500));
        assert_eq!(RateLimitParser::parse_retry_after("  10  ", 30_000), Some(10_000));
    }

    #[test]
    fn test_parse_retry_after_clamping() {
        assert_eq!(RateLimitParser::parse_retry_after("120", 30_000), Some(30_000));
    }

    #[test]
    fn test_parse_retry_after_malformed() {
        assert_eq!(RateLimitParser::parse_retry_after("-5", 30_000), None);
        assert_eq!(RateLimitParser::parse_retry_after("invalid", 30_000), None);
        assert_eq!(RateLimitParser::parse_retry_after("", 30_000), None);
    }
}

