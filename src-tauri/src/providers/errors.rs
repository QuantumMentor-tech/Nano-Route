// ============================================================================
// Nano Route - Provider Error Contract
// File: src-tauri/src/providers/errors.rs
// ============================================================================
// Normalized error classification, retry hints, and security sanitization
// for all AI provider interactions.
// ============================================================================

use crate::errors::AppError;
use crate::providers::identity::ProviderId;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Classification of errors encountered during AI provider operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderErrorKind {
    /// Authentication or authorization failure (e.g. 401 Unauthorized, 403 Forbidden, invalid API key).
    AuthenticationFailed,
    /// Rate limit or velocity quota reached (e.g. 429 Too Many Requests).
    RateLimited,
    /// Account balance or usage quota exhausted (e.g. insufficient credits/quota).
    QuotaExceeded,
    /// Requested model identifier does not exist or is not available on this provider account.
    ModelNotFound,
    /// Request payload was malformed, failed validation, or rejected by provider API (400 Bad Request).
    InvalidRequest,
    /// Input prompt or max tokens exceeded the model's physical context window.
    ContextLengthExceeded,
    /// Provider infrastructure is offline, down, or experiencing 5xx server errors.
    ProviderUnavailable,
    /// Low-level transport or socket error (e.g. connection reset, TLS failure, DNS failure).
    NetworkError,
    /// Operation timed out before the upstream provider responded.
    Timeout,
    /// Operation was cancelled by cooperative token or user request.
    Cancelled,
    /// The provider or requested model lacks support for an essential feature (e.g. vision, tool use).
    CapabilityUnsupported,
    /// Response payload could not be decoded, deserialized, or parsed.
    ResponseParsingFailed,
    /// Unexpected internal failure within the client wrapper or translation layer.
    Internal,
}

impl ProviderErrorKind {
    /// Determines default retryability for this error classification.
    #[inline]
    pub fn is_retryable_by_default(&self) -> bool {
        matches!(
            self,
            Self::RateLimited | Self::ProviderUnavailable | Self::NetworkError | Self::Timeout
        )
    }

    /// Returns a static string slice representing the error kind.
    #[inline]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::AuthenticationFailed => "authentication_failed",
            Self::RateLimited => "rate_limited",
            Self::QuotaExceeded => "quota_exceeded",
            Self::ModelNotFound => "model_not_found",
            Self::InvalidRequest => "invalid_request",
            Self::ContextLengthExceeded => "context_length_exceeded",
            Self::ProviderUnavailable => "provider_unavailable",
            Self::NetworkError => "network_error",
            Self::Timeout => "timeout",
            Self::Cancelled => "cancelled",
            Self::CapabilityUnsupported => "capability_unsupported",
            Self::ResponseParsingFailed => "response_parsing_failed",
            Self::Internal => "internal",
        }
    }
}

impl fmt::Display for ProviderErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Normalized, sanitized error returned by all provider client implementations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProviderError {
    /// Identifier of the provider where the error occurred, if known.
    pub provider_id: Option<ProviderId>,
    /// Normalized classification of the error.
    pub kind: ProviderErrorKind,
    /// Sanitized error message safe for IPC transmission and telemetry logging.
    pub message: String,
    /// Upstream HTTP status code, if applicable.
    pub status_code: Option<u16>,
    /// Upstream retry delay hint in milliseconds (e.g. from Retry-After header).
    pub retry_after_ms: Option<u64>,
    /// Raw upstream error code string (e.g. "insufficient_quota", "rate_limit_exceeded").
    pub source_code: Option<String>,
    /// Whether the operation is safe and appropriate to retry.
    pub is_retryable: bool,
}

impl ProviderError {
    /// Core constructor that automatically sanitizes the message and source code.
    pub fn new(
        provider_id: Option<ProviderId>,
        kind: ProviderErrorKind,
        message: impl Into<String>,
        status_code: Option<u16>,
        retry_after_ms: Option<u64>,
        source_code: Option<String>,
    ) -> Self {
        let is_retryable = kind.is_retryable_by_default();
        Self {
            provider_id,
            kind,
            message: sanitize_error_text(&message.into()),
            status_code,
            retry_after_ms,
            source_code: source_code.map(|s| sanitize_error_text(&s)),
            is_retryable,
        }
    }

    /// Builder method to override retryability.
    pub fn with_retryable(mut self, retryable: bool) -> Self {
        self.is_retryable = retryable;
        self
    }

    /// Builder method to set retry-after hint.
    pub fn with_retry_after_ms(mut self, delay_ms: u64) -> Self {
        self.retry_after_ms = Some(delay_ms);
        self
    }

    // --- Common Helper Constructors ---

    /// Invalid request constructor (HTTP 400 or schema validation failure).
    pub fn invalid_request(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::InvalidRequest, msg, Some(400), None, None)
    }

    /// Authentication failure constructor (HTTP 401/403 or bad credentials).
    pub fn authentication_failure(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::AuthenticationFailed, msg, Some(401), None, None)
    }

    /// Rate limited constructor (HTTP 429).
    pub fn rate_limited(
        provider_id: Option<ProviderId>,
        msg: impl Into<String>,
        retry_after_ms: Option<u64>,
    ) -> Self {
        Self::new(provider_id, ProviderErrorKind::RateLimited, msg, Some(429), retry_after_ms, None)
    }

    /// Quota exceeded constructor.
    pub fn quota_exceeded(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::QuotaExceeded, msg, Some(402), None, None)
    }

    /// Model not found constructor (HTTP 404).
    pub fn model_not_found(provider_id: Option<ProviderId>, model: impl Into<String>) -> Self {
        let model_str = model.into();
        Self::new(
            provider_id,
            ProviderErrorKind::ModelNotFound,
            format!("Requested model '{}' is not available", model_str),
            Some(404),
            None,
            None,
        )
    }

    /// Network error constructor.
    pub fn network_error(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::NetworkError, msg, None, None, None)
    }

    /// Timeout constructor (HTTP 408 / 504).
    pub fn timeout(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::Timeout, msg, Some(504), None, None)
    }

    /// Cancelled constructor.
    pub fn cancelled(provider_id: Option<ProviderId>) -> Self {
        let mut err = Self::new(
            provider_id,
            ProviderErrorKind::Cancelled,
            "Operation was cancelled by user or system",
            None,
            None,
            None,
        );
        err.is_retryable = false;
        err
    }

    /// Provider unavailable constructor (HTTP 500/502/503).
    pub fn provider_unavailable(
        provider_id: Option<ProviderId>,
        status_code: Option<u16>,
        msg: impl Into<String>,
    ) -> Self {
        Self::new(
            provider_id,
            ProviderErrorKind::ProviderUnavailable,
            msg,
            status_code.or(Some(503)),
            None,
            None,
        )
    }

    /// Capability unsupported constructor.
    pub fn capability_unsupported(provider_id: Option<ProviderId>, cap: impl Into<String>) -> Self {
        let cap_str = cap.into();
        Self::new(
            provider_id,
            ProviderErrorKind::CapabilityUnsupported,
            format!("Required capability '{}' is not supported by provider", cap_str),
            None,
            None,
            None,
        )
    }

    /// Response parsing failed constructor.
    pub fn response_parsing_failed(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::ResponseParsingFailed, msg, None, None, None)
    }

    /// Internal wrapper error constructor.
    pub fn internal(provider_id: Option<ProviderId>, msg: impl Into<String>) -> Self {
        Self::new(provider_id, ProviderErrorKind::Internal, msg, None, None, None)
    }
}

impl fmt::Display for ProviderError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let provider_str = match &self.provider_id {
            Some(pid) => pid.as_str(),
            None => "unknown-provider",
        };
        write!(f, "[{}:{}] {}", provider_str, self.kind, self.message)
    }
}

impl std::error::Error for ProviderError {}

/// Convert a ProviderError into the application-wide AppError hierarchy.
impl From<ProviderError> for AppError {
    fn from(err: ProviderError) -> Self {
        let formatted = err.to_string();
        match err.kind {
            ProviderErrorKind::InvalidRequest
            | ProviderErrorKind::CapabilityUnsupported
            | ProviderErrorKind::ModelNotFound
            | ProviderErrorKind::ContextLengthExceeded => AppError::InvalidInput(formatted),

            ProviderErrorKind::ProviderUnavailable
            | ProviderErrorKind::NetworkError
            | ProviderErrorKind::Timeout
            | ProviderErrorKind::RateLimited => AppError::ServiceUnavailable(formatted),

            ProviderErrorKind::AuthenticationFailed
            | ProviderErrorKind::QuotaExceeded
            | ProviderErrorKind::Cancelled
            | ProviderErrorKind::ResponseParsingFailed
            | ProviderErrorKind::Internal => AppError::Internal(formatted),
        }
    }
}

/// Scrub sensitive authentication tokens, API keys, and bearer credentials from error text.
pub fn sanitize_error_text(input: &str) -> String {
    let mut result = input.to_string();

    // Standard patterns of tokens to redact
    let prefix_patterns = [
        "sk-", "key-", "Bearer ", "bearer ", "AIzaSy", "ghp_", "api_key=", "apikey=", "key=",
    ];

    for prefix in prefix_patterns {
        let mut start_idx = 0;
        while let Some(found) = result[start_idx..].find(prefix) {
            let actual_start = start_idx + found;
            let token_start = actual_start + prefix.len();

            // Find end of the secret token (whitespace, comma, quote, or end of string)
            let token_end = result[token_start..]
                .find(|c: char| c.is_whitespace() || c == ',' || c == '"' || c == '\'' || c == '&' || c == ';')
                .map(|offset| token_start + offset)
                .unwrap_or(result.len());

            // If token has significant length (> 6 chars), redact it
            if token_end > token_start + 4 {
                let prefix_part = &result[..token_start];
                let suffix_part = &result[token_end..];
                result = format!("{}[REDACTED]{}", prefix_part, suffix_part);
                start_idx = token_start + "[REDACTED]".len();
            } else {
                start_idx = token_start;
            }

            if start_idx >= result.len() {
                break;
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation_and_defaults() {
        let err = ProviderError::rate_limited(Some(ProviderId::OPENAI), "Rate limit exceeded", Some(2500));
        assert_eq!(err.kind, ProviderErrorKind::RateLimited);
        assert!(err.is_retryable);
        assert_eq!(err.retry_after_ms, Some(2500));
        assert_eq!(err.status_code, Some(429));
    }

    #[test]
    fn test_error_sanitization() {
        let raw = "Failed request with sk-proj-1234567890abcdefghijklmn and Bearer secret_token_xyz_12345";
        let sanitized = sanitize_error_text(raw);
        assert!(!sanitized.contains("1234567890abcdefghijklmn"));
        assert!(!sanitized.contains("secret_token_xyz_12345"));
        assert!(sanitized.contains("[REDACTED]"));
    }

    #[test]
    fn test_app_error_conversion() {
        let err = ProviderError::invalid_request(Some(ProviderId::ANTHROPIC), "temperature out of range");
        let app_err: AppError = err.into();
        match app_err {
            AppError::InvalidInput(msg) => {
                assert!(msg.contains("anthropic:invalid_request"));
                assert!(msg.contains("temperature out of range"));
            }
            _ => panic!("Expected InvalidInput variant"),
        }
    }
}

