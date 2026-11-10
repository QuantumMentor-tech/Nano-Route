// ============================================================================
// Nano Route - OpenAI Provider Error Normalization & Sanitization
// File: src-tauri/src/providers/openai/error.rs
// ============================================================================
// Maps upstream HTTP status codes and OpenAI error JSON payloads into
// canonical `ProviderError` structures with safe sanitization and zero secret leaks.
// ============================================================================

use crate::providers::errors::{sanitize_error_text, ProviderError, ProviderErrorKind};
use crate::providers::identity::ProviderId;
use serde::Deserialize;

/// Raw OpenAI error response wrapper.
#[derive(Debug, Clone, Deserialize)]
pub struct OpenAiErrorEnvelope {
    pub error: Option<OpenAiErrorPayload>,
}

/// Detailed error payload returned by OpenAI APIs.
#[derive(Debug, Clone, Deserialize)]
pub struct OpenAiErrorPayload {
    pub message: Option<String>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub param: Option<String>,
    pub code: Option<String>,
}

/// Helper to scrub OpenAI-specific secret patterns (e.g. "sk-...") from arbitrary text.
pub fn scrub_openai_secrets(input: &str) -> String {
    let sanitized = sanitize_error_text(input);
    
    // Additional defense-in-depth against OpenAI API key format leaks
    let mut result = String::with_capacity(sanitized.len());
    let mut chars = sanitized.chars().peekable();

    // Check for "sk-" prefixes followed by alphanumeric tokens
    let text = sanitized;
    let mut start_idx = 0;
    while let Some(found_idx) = text[start_idx..].find("sk-") {
        let abs_idx = start_idx + found_idx;
        result.push_str(&text[start_idx..abs_idx]);
        
        // Find end of token
        let token_slice = &text[abs_idx..];
        let end_idx = token_slice
            .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
            .unwrap_or(token_slice.len());

        let token = &token_slice[..end_idx];
        if token.len() >= 8 {
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
pub fn map_openai_http_error(
    status_code: u16,
    body: &str,
    retry_after_header: Option<&str>,
) -> ProviderError {
    let provider_id = Some(ProviderId::new(ProviderId::OPENAI).unwrap());

    // Parse Retry-After header (in seconds) to milliseconds
    let retry_after_ms = retry_after_header.and_then(|val| {
        val.trim().parse::<u64>().ok().map(|secs| secs * 1000)
    });

    // Parse JSON error payload if available
    let parsed: Option<OpenAiErrorEnvelope> = serde_json::from_str(body).ok();
    let (raw_message, raw_code) = if let Some(env) = parsed {
        if let Some(err) = env.error {
            (err.message, err.code)
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let error_code = raw_code.clone();
    let msg_str = raw_message.unwrap_or_else(|| {
        if body.trim().is_empty() {
            format!("OpenAI HTTP request failed with status code {}", status_code)
        } else {
            body.to_string()
        }
    });

    let sanitized_msg = scrub_openai_secrets(&msg_str);

    match status_code {
        401 => ProviderError::new(
            provider_id,
            ProviderErrorKind::AuthenticationFailed,
            "Invalid or missing OpenAI API key. Check configured credentials in Nano Route settings.",
            Some(401),
            None,
            error_code,
        ),
        403 => ProviderError::new(
            provider_id,
            ProviderErrorKind::AuthenticationFailed,
            "OpenAI API access forbidden. Verify project/organization permissions and key scopes.",
            Some(403),
            None,
            error_code,
        ),
        429 => {
            if error_code.as_deref() == Some("insufficient_quota")
                || sanitized_msg.contains("quota")
            {
                ProviderError::new(
                    provider_id,
                    ProviderErrorKind::QuotaExceeded,
                    "OpenAI account quota exceeded. Check billing and usage limits on platform.openai.com.",
                    Some(429),
                    None,
                    error_code,
                )
            } else {
                ProviderError::new(
                    provider_id,
                    ProviderErrorKind::RateLimited,
                    sanitized_msg,
                    Some(429),
                    retry_after_ms,
                    error_code,
                )
            }
        }
        404 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ModelNotFound,
            sanitized_msg,
            Some(404),
            None,
            error_code,
        ),
        400 => {
            if sanitized_msg.contains("context_length_exceeded")
                || sanitized_msg.contains("maximum context length")
            {
                ProviderError::new(
                    provider_id,
                    ProviderErrorKind::ContextLengthExceeded,
                    sanitized_msg,
                    Some(400),
                    None,
                    error_code,
                )
            } else {
                ProviderError::new(
                    provider_id,
                    ProviderErrorKind::InvalidRequest,
                    sanitized_msg,
                    Some(400),
                    None,
                    error_code,
                )
            }
        }
        500 | 502 | 503 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ProviderUnavailable,
            format!("OpenAI upstream service unavailable (HTTP {}): {}", status_code, sanitized_msg),
            Some(status_code),
            retry_after_ms,
            error_code,
        ),
        504 => ProviderError::new(
            provider_id,
            ProviderErrorKind::Timeout,
            "OpenAI upstream gateway timed out (HTTP 504)",
            Some(504),
            retry_after_ms,
            error_code,
        ),
        _ => ProviderError::new(
            provider_id,
            ProviderErrorKind::Internal,
            sanitized_msg,
            Some(status_code),
            retry_after_ms,
            error_code,
        ),
    }
}

