// ============================================================================
// Nano Route - Provider Error Mapping
// File: src-tauri/src/errors/provider_mapping.rs
// ============================================================================
// Deterministic mapping of provider-specific error payloads, error codes,
// and HTTP status codes into canonical ErrorCategory and user messages (Step 36).
// ============================================================================

use crate::errors::taxonomy::ErrorCategory;

/// Result of evaluating provider-specific error evidence.
#[derive(Debug, Clone)]
pub struct ProviderMappingResult {
    pub category: ErrorCategory,
    pub user_message: String,
    pub technical_message: String,
    pub provider_error_code: Option<String>,
}

/// Evaluates OpenAI-specific error evidence (also used by DeepSeek, Groq, Mistral).
pub fn map_openai_error_evidence(
    status_code: Option<u16>,
    error_type: Option<&str>,
    error_code: Option<&str>,
    raw_message: Option<&str>,
) -> ProviderMappingResult {
    let msg_lower = raw_message.unwrap_or("").to_lowercase();
    let code_str = error_code.map(|s| s.to_string());

    // 1. Check specific error codes
    if let Some(code) = error_code {
        let code_lower = code.to_lowercase();
        if code_lower == "context_length_exceeded" || code_lower == "string_above_max_length" {
            return ProviderMappingResult {
                category: ErrorCategory::ContextLimitExceeded,
                user_message: "The request exceeds the selected model's context window limit."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI context length exceeded")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
        if code_lower == "model_not_found" {
            return ProviderMappingResult {
                category: ErrorCategory::ModelUnavailable,
                user_message: "The requested model is not accessible or does not exist."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI model not found")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
        if code_lower == "insufficient_quota" {
            return ProviderMappingResult {
                category: ErrorCategory::RateLimited,
                user_message: "The provider account has exhausted its usage quota or credits."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI insufficient quota")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
        if code_lower == "invalid_api_key" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthenticationFailed,
                user_message: "The configured API key was rejected by the provider.".to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI invalid API key")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
    }

    // 2. Check error types
    if let Some(err_type) = error_type {
        let type_lower = err_type.to_lowercase();
        if type_lower == "authentication_error" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthenticationFailed,
                user_message: "The configured API key was rejected by the provider.".to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI authentication error")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
        if type_lower == "permission_error" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthorizationFailed,
                user_message: "Access to the requested resource or model is forbidden.".to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI permission error")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
        if type_lower == "rate_limit_error" {
            return ProviderMappingResult {
                category: ErrorCategory::RateLimited,
                user_message: "The provider is currently rate limiting requests. Please wait."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI rate limit exceeded")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
        if type_lower == "server_error" {
            return ProviderMappingResult {
                category: ErrorCategory::ProviderUnavailable,
                user_message: "The provider service is temporarily unavailable.".to_string(),
                technical_message: raw_message
                    .unwrap_or("OpenAI internal server error")
                    .to_string(),
                provider_error_code: code_str,
            };
        }
    }

    // 3. Message heuristics
    if msg_lower.contains("maximum context length") || msg_lower.contains("token count") {
        return ProviderMappingResult {
            category: ErrorCategory::ContextLimitExceeded,
            user_message: "The request exceeds the selected model's context window limit."
                .to_string(),
            technical_message: raw_message.unwrap_or("Context length exceeded").to_string(),
            provider_error_code: code_str,
        };
    }
    if msg_lower.contains("does not exist") || msg_lower.contains("you do not have access to model")
    {
        return ProviderMappingResult {
            category: ErrorCategory::ModelUnavailable,
            user_message: "The requested model is not accessible or does not exist.".to_string(),
            technical_message: raw_message.unwrap_or("Model not found").to_string(),
            provider_error_code: code_str,
        };
    }

    // 4. HTTP status fallback
    map_http_status_fallback(status_code, raw_message, code_str)
}

/// Evaluates Anthropic-specific error evidence.
pub fn map_anthropic_error_evidence(
    status_code: Option<u16>,
    error_type: Option<&str>,
    raw_message: Option<&str>,
) -> ProviderMappingResult {
    let msg_lower = raw_message.unwrap_or("").to_lowercase();
    let type_str = error_type.map(|s| s.to_string());

    if let Some(err_type) = error_type {
        let type_lower = err_type.to_lowercase();
        if type_lower == "authentication_error" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthenticationFailed,
                user_message: "The configured Anthropic API credential was rejected.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Anthropic authentication error")
                    .to_string(),
                provider_error_code: type_str,
            };
        }
        if type_lower == "permission_error" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthorizationFailed,
                user_message: "Anthropic API access forbidden for this account or project."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("Anthropic permission error")
                    .to_string(),
                provider_error_code: type_str,
            };
        }
        if type_lower == "not_found_error" {
            return ProviderMappingResult {
                category: ErrorCategory::ModelUnavailable,
                user_message: "The requested Anthropic model was not found or is unavailable."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("Anthropic model not found")
                    .to_string(),
                provider_error_code: type_str,
            };
        }
        if type_lower == "rate_limit_error" {
            return ProviderMappingResult {
                category: ErrorCategory::RateLimited,
                user_message: "Anthropic API rate limit reached. Please wait and retry."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("Anthropic rate limit exceeded")
                    .to_string(),
                provider_error_code: type_str,
            };
        }
        if type_lower == "overloaded_error" || type_lower == "api_error" {
            return ProviderMappingResult {
                category: ErrorCategory::ProviderUnavailable,
                user_message: "Anthropic services are temporarily overloaded or unavailable."
                    .to_string(),
                technical_message: raw_message
                    .unwrap_or("Anthropic overloaded error")
                    .to_string(),
                provider_error_code: type_str,
            };
        }
        if type_lower == "invalid_request_error" {
            if msg_lower.contains("prompt is too long")
                || msg_lower.contains("max_tokens")
                || msg_lower.contains("context")
            {
                return ProviderMappingResult {
                    category: ErrorCategory::ContextLimitExceeded,
                    user_message: "The request exceeds the Anthropic model's context limit."
                        .to_string(),
                    technical_message: raw_message
                        .unwrap_or("Prompt exceeds context limit")
                        .to_string(),
                    provider_error_code: type_str,
                };
            }
            return ProviderMappingResult {
                category: ErrorCategory::InvalidRequest,
                user_message: "Anthropic rejected the request parameters.".to_string(),
                technical_message: raw_message.unwrap_or("Invalid request").to_string(),
                provider_error_code: type_str,
            };
        }
    }

    map_http_status_fallback(status_code, raw_message, type_str)
}

/// Evaluates Google Gemini-specific error evidence.
pub fn map_gemini_error_evidence(
    status_code: Option<u16>,
    status_string: Option<&str>,
    raw_message: Option<&str>,
) -> ProviderMappingResult {
    let msg_lower = raw_message.unwrap_or("").to_lowercase();
    let status_str = status_string.map(|s| s.to_string());

    if let Some(status) = status_string {
        let status_upper = status.to_uppercase();
        if status_upper == "UNAUTHENTICATED" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthenticationFailed,
                user_message: "The Gemini API key was rejected by Google.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Gemini unauthenticated error")
                    .to_string(),
                provider_error_code: status_str,
            };
        }
        if status_upper == "PERMISSION_DENIED" {
            return ProviderMappingResult {
                category: ErrorCategory::AuthorizationFailed,
                user_message: "Permission denied for this Gemini model or project.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Gemini permission denied")
                    .to_string(),
                provider_error_code: status_str,
            };
        }
        if status_upper == "RESOURCE_EXHAUSTED" {
            return ProviderMappingResult {
                category: ErrorCategory::RateLimited,
                user_message: "Gemini quota or rate limits exhausted.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Gemini resource exhausted")
                    .to_string(),
                provider_error_code: status_str,
            };
        }
        if status_upper == "NOT_FOUND" {
            return ProviderMappingResult {
                category: ErrorCategory::ModelUnavailable,
                user_message: "The Gemini model was not found or is unavailable.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Gemini model not found")
                    .to_string(),
                provider_error_code: status_str,
            };
        }
        if status_upper == "UNAVAILABLE" || status_upper == "INTERNAL" {
            return ProviderMappingResult {
                category: ErrorCategory::ProviderUnavailable,
                user_message: "Google Gemini services are temporarily unavailable.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Gemini internal service unavailable")
                    .to_string(),
                provider_error_code: status_str,
            };
        }
        if status_upper == "INVALID_ARGUMENT" {
            if msg_lower.contains("token") || msg_lower.contains("context") {
                return ProviderMappingResult {
                    category: ErrorCategory::ContextLimitExceeded,
                    user_message: "The prompt exceeds the Gemini model context limit.".to_string(),
                    technical_message: raw_message
                        .unwrap_or("Gemini token context limit exceeded")
                        .to_string(),
                    provider_error_code: status_str,
                };
            }
            return ProviderMappingResult {
                category: ErrorCategory::InvalidRequest,
                user_message: "Gemini rejected the request payload as invalid.".to_string(),
                technical_message: raw_message
                    .unwrap_or("Gemini invalid argument")
                    .to_string(),
                provider_error_code: status_str,
            };
        }
    }

    map_http_status_fallback(status_code, raw_message, status_str)
}

/// Fallback generic HTTP status code classifier when provider payload details are absent or ambiguous.
pub fn map_http_status_fallback(
    status_code: Option<u16>,
    raw_message: Option<&str>,
    error_code: Option<String>,
) -> ProviderMappingResult {
    let default_msg = raw_message.unwrap_or("HTTP request failed").to_string();

    match status_code {
        Some(401) => ProviderMappingResult {
            category: ErrorCategory::AuthenticationFailed,
            user_message: "Authentication failed. Check your configured API credentials."
                .to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(403) => ProviderMappingResult {
            category: ErrorCategory::AuthorizationFailed,
            user_message: "Access forbidden. Verify account permissions and key scopes."
                .to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(404) => ProviderMappingResult {
            category: ErrorCategory::ModelUnavailable,
            user_message: "The requested model or endpoint could not be found.".to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(408) => ProviderMappingResult {
            category: ErrorCategory::Timeout,
            user_message: "The request timed out waiting for the provider response.".to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(413) => ProviderMappingResult {
            category: ErrorCategory::InputTooLarge,
            user_message: "The prompt input payload is too large.".to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(429) => ProviderMappingResult {
            category: ErrorCategory::RateLimited,
            user_message: "The provider is rate limiting requests. Please wait before retrying."
                .to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(400) => ProviderMappingResult {
            category: ErrorCategory::InvalidRequest,
            user_message: "The provider rejected the request parameters as invalid.".to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        Some(500..=504) => ProviderMappingResult {
            category: ErrorCategory::ProviderUnavailable,
            user_message: "The provider service is currently unavailable or returning server errors."
                .to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
        _ => ProviderMappingResult {
            category: ErrorCategory::Unknown,
            user_message: "An unexpected error occurred during execution.".to_string(),
            technical_message: default_msg,
            provider_error_code: error_code,
        },
    }
}

