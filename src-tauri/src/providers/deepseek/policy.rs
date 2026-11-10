// ============================================================================
// Nano Route - DeepSeek Provider Policy & Error Mapping
// File: src-tauri/src/providers/deepseek/policy.rs
// ============================================================================

use crate::providers::errors::{sanitize_error_text, ProviderError, ProviderErrorKind};
use crate::providers::identity::ProviderId;
use crate::providers::shared::compatible_chat::ChatCompletionPolicy;
use crate::security::SecretString;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct DeepSeekErrorEnvelope {
    pub error: Option<DeepSeekErrorDetail>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeepSeekErrorDetail {
    pub message: Option<String>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub code: Option<String>,
}

pub fn scrub_deepseek_secrets(input: &str) -> String {
    let sanitized = sanitize_error_text(input);
    let mut result = String::with_capacity(sanitized.len());

    let text = sanitized;
    let mut start_idx = 0;
    while let Some(found_idx) = text[start_idx..].find("sk-") {
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

#[derive(Debug, Clone, Default)]
pub struct DeepSeekPolicy;

impl ChatCompletionPolicy for DeepSeekPolicy {
    fn provider_id(&self) -> &ProviderId {
        static ID: std::sync::OnceLock<ProviderId> = std::sync::OnceLock::new();
        ID.get_or_init(|| ProviderId::new(ProviderId::DEEPSEEK).unwrap())
    }

    fn default_base_url(&self) -> &str {
        "https://api.deepseek.com"
    }

    fn format_endpoint_url(&self, base_url: &str) -> String {
        let trimmed = base_url.trim_end_matches('/');
        if trimmed.ends_with("/chat/completions") {
            trimmed.to_string()
        } else {
            format!("{}/chat/completions", trimmed)
        }
    }

    fn build_headers<'a>(
        &self,
        api_key: &'a SecretString,
        auth_buf: &'a mut String,
    ) -> Vec<(&'a str, &'a str)> {
        *auth_buf = format!("Bearer {}", api_key.expose_secret());
        vec![
            ("Content-Type", "application/json"),
            ("Authorization", auth_buf.as_str()),
        ]
    }

    fn map_http_error(
        &self,
        status_code: u16,
        body: &str,
        retry_after: Option<&str>,
    ) -> ProviderError {
        let provider_id = Some(self.provider_id().clone());
        let retry_after_ms = retry_after.and_then(|val| {
            val.trim().parse::<u64>().ok().map(|secs| secs * 1000)
        });

        let parsed: Option<DeepSeekErrorEnvelope> = serde_json::from_str(body).ok();
        let (raw_message, raw_code) = if let Some(env) = parsed {
            if let Some(err) = env.error {
                (err.message, err.code)
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        let msg = raw_message.unwrap_or_else(|| {
            if body.trim().is_empty() {
                format!("DeepSeek HTTP request failed with status code {}", status_code)
            } else {
                body.to_string()
            }
        });

        let sanitized = scrub_deepseek_secrets(&msg);

        match status_code {
            400 => ProviderError::new(
                provider_id,
                ProviderErrorKind::InvalidRequest,
                sanitized,
                Some(400),
                None,
                raw_code,
            ),
            401 | 403 => ProviderError::new(
                provider_id,
                ProviderErrorKind::AuthenticationFailed,
                "Invalid or missing DeepSeek API key. Check configured credentials in Nano Route settings.",
                Some(status_code),
                None,
                raw_code,
            ),
            404 => ProviderError::new(
                provider_id,
                ProviderErrorKind::ModelNotFound,
                sanitized,
                Some(404),
                None,
                raw_code,
            ),
            429 => {
                if raw_code.as_deref() == Some("insufficient_quota") || sanitized.contains("quota") {
                    ProviderError::new(
                        provider_id,
                        ProviderErrorKind::QuotaExceeded,
                        "DeepSeek account balance or quota exhausted.",
                        Some(429),
                        None,
                        raw_code,
                    )
                } else {
                    ProviderError::new(
                        provider_id,
                        ProviderErrorKind::RateLimited,
                        sanitized,
                        Some(429),
                        retry_after_ms,
                        raw_code,
                    )
                }
            }
            500 | 502 | 503 => ProviderError::new(
                provider_id,
                ProviderErrorKind::ProviderUnavailable,
                format!("DeepSeek service unavailable (HTTP {}): {}", status_code, sanitized),
                Some(status_code),
                retry_after_ms,
                raw_code,
            ),
            504 => ProviderError::new(
                provider_id,
                ProviderErrorKind::Timeout,
                "DeepSeek gateway timed out (HTTP 504)",
                Some(504),
                retry_after_ms,
                raw_code,
            ),
            _ => ProviderError::new(
                provider_id,
                ProviderErrorKind::Internal,
                sanitized,
                Some(status_code),
                retry_after_ms,
                raw_code,
            ),
        }
    }
}

