// ============================================================================
// Nano Route - Anthropic Provider Error Normalization & Sanitization
// File: src-tauri/src/providers/anthropic/error.rs
// ============================================================================
// Maps upstream HTTP status codes and Anthropic error JSON payloads into
// canonical `ProviderError` structures with safe sanitization and zero secret leaks.
// ============================================================================

use crate::providers::errors::{sanitize_error_text, ProviderError, ProviderErrorKind};
use crate::providers::identity::ProviderId;
use serde::Deserialize;

/// Raw Anthropic error envelope.
#[derive(Debug, Clone, Deserialize)]
pub struct AnthropicErrorEnvelope {
    #[serde(rename = "type")]
    pub envelope_type: Option<String>,
    pub error: Option<AnthropicErrorDetail>,
}

/// Detailed error payload returned by Anthropic APIs.
#[derive(Debug, Clone, Deserialize)]
pub struct AnthropicErrorDetail {
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub message: Option<String>,
}

/// Helper to scrub Anthropic-specific API key patterns (e.g. "sk-ant-...") from arbitrary text.
pub fn scrub_anthropic_secrets(input: &str) -> String {
    let sanitized = sanitize_error_text(input);
    let mut result = String::with_capacity(sanitized.len());

    let text = sanitized;
    let mut start_idx = 0;
    while let Some(found_idx) = text[start_idx..].find("sk-ant-") {
        let abs_idx = start_idx + found_idx;
        result.push_str(&text[start_idx..abs_idx]);

        let token_slice = &text[abs_idx..];
        let end_idx = token_slice
            .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
            .unwrap_or(token_slice.len());

        let token = &token_slice[..end_idx];
        if token.len() >= 10 {
            result.push_str("[REDACTED_API_KEY]");
        } else {
            result.push_str(token);
        }

        start_idx = abs_idx + end_idx;
    }
    result.push_str(&text[start_idx..]);
    result
}

/// Maps an HTTP status code, response body, and optional retry-after header to `ProviderError`.
pub fn map_anthropic_http_error(
    status_code: u16,
    body: &str,
    retry_after_header: Option<&str>,
) -> ProviderError {
    let provider_id = Some(ProviderId::new(ProviderId::ANTHROPIC).unwrap());

    let retry_after_ms = retry_after_header.and_then(|val| {
        val.trim().parse::<u64>().ok().map(|secs| secs * 1000)
    });

    let parsed: Option<AnthropicErrorEnvelope> = serde_json::from_str(body).ok();
    let (raw_message, raw_type) = if let Some(env) = parsed {
        if let Some(err) = env.error {
            (err.message, err.error_type)
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let error_type = raw_type.clone();
    let msg_str = raw_message.unwrap_or_else(|| {
        if body.trim().is_empty() {
            format!("Anthropic HTTP request failed with status code {}", status_code)
        } else {
            body.to_string()
        }
    });

    let sanitized_msg = scrub_anthropic_secrets(&msg_str);

    match status_code {
        400 => ProviderError::new(
            provider_id,
            ProviderErrorKind::InvalidRequest,
            sanitized_msg,
            Some(400),
            None,
            error_type,
        ),
        401 => ProviderError::new(
            provider_id,
            ProviderErrorKind::AuthenticationFailed,
            "Invalid or missing Anthropic API key. Check configured credentials in Nano Route settings.",
            Some(401),
            None,
            error_type,
        ),
        403 => ProviderError::new(
            provider_id,
            ProviderErrorKind::AuthenticationFailed,
            "Anthropic API access forbidden. Verify project/workspace permissions and key scopes.",
            Some(403),
            None,
            error_type,
        ),
        404 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ModelNotFound,
            sanitized_msg,
            Some(404),
            None,
            error_type,
        ),
        413 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ContextLengthExceeded,
            format!("Anthropic request too large: {}", sanitized_msg),
            Some(413),
            None,
            error_type,
        ),
        429 => ProviderError::new(
            provider_id,
            ProviderErrorKind::RateLimited,
            sanitized_msg,
            Some(429),
            retry_after_ms,
            error_type,
        ),
        500 | 502 | 503 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ProviderUnavailable,
            format!("Anthropic upstream service unavailable (HTTP {}): {}", status_code, sanitized_msg),
            Some(status_code),
            retry_after_ms,
            error_type,
        ),
        504 => ProviderError::new(
            provider_id,
            ProviderErrorKind::Timeout,
            "Anthropic gateway timed out (HTTP 504)",
            Some(504),
            retry_after_ms,
            error_type,
        ),
        529 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ProviderUnavailable,
            format!("Anthropic service overloaded (HTTP 529): {}", sanitized_msg),
            Some(529),
            retry_after_ms,
            error_type,
        ),
        _ => ProviderError::new(
            provider_id,
            ProviderErrorKind::Internal,
            sanitized_msg,
            Some(status_code),
            retry_after_ms,
            error_type,
        ),
    }
}

