// ============================================================================
// Nano Route - Google Gemini Provider Error Normalization & Sanitization
// File: src-tauri/src/providers/gemini/error.rs
// ============================================================================
// Maps upstream HTTP status codes and Google Gemini error payloads into
// canonical `ProviderError` structures with safe sanitization and zero secret leaks.
// ============================================================================

use crate::providers::errors::{sanitize_error_text, ProviderError, ProviderErrorKind};
use crate::providers::identity::ProviderId;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct GeminiErrorEnvelope {
    pub error: Option<GeminiErrorDetail>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GeminiErrorDetail {
    pub code: Option<u16>,
    pub message: Option<String>,
    pub status: Option<String>,
}

/// Helper to scrub Google API keys (e.g. AIzaSy...) from error strings.
pub fn scrub_gemini_secrets(input: &str) -> String {
    let sanitized = sanitize_error_text(input);
    let mut result = String::with_capacity(sanitized.len());

    let text = sanitized;
    let mut start_idx = 0;
    while let Some(found_idx) = text[start_idx..].find("AIza") {
        let abs_idx = start_idx + found_idx;
        result.push_str(&text[start_idx..abs_idx]);

        let token_slice = &text[abs_idx..];
        let end_idx = token_slice
            .find(|c: char| !c.is_alphanumeric() && c != '_' && c != '-')
            .unwrap_or(token_slice.len());

        let token = &token_slice[..end_idx];
        if token.len() >= 30 {
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
pub fn map_gemini_http_error(
    status_code: u16,
    body: &str,
    retry_after_header: Option<&str>,
) -> ProviderError {
    let provider_id = Some(ProviderId::new(ProviderId::GEMINI).unwrap());

    let retry_after_ms = retry_after_header.and_then(|val| {
        val.trim().parse::<u64>().ok().map(|secs| secs * 1000)
    });

    let parsed: Option<GeminiErrorEnvelope> = serde_json::from_str(body).ok();
    let (raw_message, raw_status) = if let Some(env) = parsed {
        if let Some(err) = env.error {
            (err.message, err.status)
        } else {
            (None, None)
        }
    } else {
        (None, None)
    };

    let error_code = raw_status.clone();
    let msg_str = raw_message.unwrap_or_else(|| {
        if body.trim().is_empty() {
            format!("Google Gemini HTTP request failed with status code {}", status_code)
        } else {
            body.to_string()
        }
    });

    let sanitized_msg = scrub_gemini_secrets(&msg_str);

    match status_code {
        400 => ProviderError::new(
            provider_id,
            ProviderErrorKind::InvalidRequest,
            sanitized_msg,
            Some(400),
            None,
            error_code,
        ),
        403 => ProviderError::new(
            provider_id,
            ProviderErrorKind::AuthenticationFailed,
            "Invalid Google Gemini API key or permission denied. Check configured credentials in Nano Route settings.",
            Some(403),
            None,
            error_code,
        ),
        404 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ModelNotFound,
            sanitized_msg,
            Some(404),
            None,
            error_code,
        ),
        429 => {
            if sanitized_msg.to_lowercase().contains("quota") {
                ProviderError::new(
                    provider_id,
                    ProviderErrorKind::QuotaExceeded,
                    "Google Gemini quota exceeded. Check plan and billing limits in Google AI Studio or Cloud Console.",
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
        499 => ProviderError::new(
            provider_id,
            ProviderErrorKind::Cancelled,
            "Operation cancelled by client or gateway",
            Some(499),
            None,
            error_code,
        ),
        500 | 502 | 503 => ProviderError::new(
            provider_id,
            ProviderErrorKind::ProviderUnavailable,
            format!("Google Gemini service unavailable (HTTP {}): {}", status_code, sanitized_msg),
            Some(status_code),
            retry_after_ms,
            error_code,
        ),
        504 => ProviderError::new(
            provider_id,
            ProviderErrorKind::Timeout,
            "Google Gemini gateway timed out (HTTP 504)",
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

