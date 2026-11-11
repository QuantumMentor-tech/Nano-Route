// ============================================================================
// Nano Route - Central Error Classifier
// File: src-tauri/src/errors/classifier.rs
// ============================================================================
// Single provider-neutral entry point for normalizing failures into canonical
// ErrorEnvelope instances with strict precedence and zero secret leaks (Step 36).
// ============================================================================

use crate::errors::envelope::ErrorEnvelope;
use crate::errors::provider_mapping::{
    map_anthropic_error_evidence, map_gemini_error_evidence, map_http_status_fallback,
    map_openai_error_evidence,
};
use crate::errors::taxonomy::{ClassificationProvenance, ErrorCategory};
use crate::errors::AppError;
use crate::providers::errors::{ProviderError, ProviderErrorKind};

/// Centralized error classifier for Nano Route.
///
/// Rule: Step 36 classifies errors. It does NOT decide what to do about them.
pub struct ErrorClassifier;

impl ErrorClassifier {
    /// Classifies an intentional user or system cooperative cancellation.
    /// Invariant: Cancellation takes absolute precedence over generic transport errors.
    pub fn classify_cancellation(
        execution_id: Option<String>,
        correlation_id: Option<String>,
        provider_id: Option<String>,
        model_id: Option<String>,
    ) -> ErrorEnvelope {
        ErrorEnvelope::new(
            ErrorCategory::Cancelled,
            "Prompt generation was cancelled.",
            "Execution halted cooperatively via CancellationToken or user request",
            ClassificationProvenance::Cancellation,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
        .with_provider(provider_id, model_id)
    }

    /// Classifies a typed ProviderError from any provider client adapter.
    pub fn classify_provider_error(
        err: &ProviderError,
        execution_id: Option<String>,
        correlation_id: Option<String>,
        model_id: Option<String>,
    ) -> ErrorEnvelope {
        let provider_str = err.provider_id.as_ref().map(|p| p.as_str().to_string());

        // 1. Check for cooperative cancellation first (highest precedence)
        if err.kind == ProviderErrorKind::Cancelled {
            return Self::classify_cancellation(
                execution_id,
                correlation_id,
                provider_str,
                model_id,
            );
        }

        // 2. Provider-specific evidence mapping
        let mapping = match provider_str.as_deref() {
            Some("openai") | Some("deepseek") | Some("groq") | Some("mistral") => {
                map_openai_error_evidence(
                    err.status_code,
                    None,
                    err.source_code.as_deref(),
                    Some(&err.message),
                )
            }
            Some("anthropic") => map_anthropic_error_evidence(
                err.status_code,
                err.source_code.as_deref(),
                Some(&err.message),
            ),
            Some("gemini") => map_gemini_error_evidence(
                err.status_code,
                err.source_code.as_deref(),
                Some(&err.message),
            ),
            _ => map_http_status_fallback(
                err.status_code,
                Some(&err.message),
                err.source_code.clone(),
            ),
        };

        // 3. Fall back to kind-specific mapping if generic unknown was returned
        let final_category = if mapping.category == ErrorCategory::Unknown {
            match err.kind {
                ProviderErrorKind::AuthenticationFailed => ErrorCategory::AuthenticationFailed,
                ProviderErrorKind::RateLimited => ErrorCategory::RateLimited,
                ProviderErrorKind::QuotaExceeded => ErrorCategory::RateLimited,
                ProviderErrorKind::ModelNotFound => ErrorCategory::ModelUnavailable,
                ProviderErrorKind::InvalidRequest => ErrorCategory::InvalidRequest,
                ProviderErrorKind::ContextLengthExceeded => ErrorCategory::ContextLimitExceeded,
                ProviderErrorKind::ProviderUnavailable => ErrorCategory::ProviderUnavailable,
                ProviderErrorKind::NetworkError => ErrorCategory::NetworkUnknown,
                ProviderErrorKind::Timeout => ErrorCategory::Timeout,
                ProviderErrorKind::CapabilityUnsupported => ErrorCategory::UnsupportedCapability,
                ProviderErrorKind::ResponseParsingFailed => {
                    ErrorCategory::ProviderResponseParseFailed
                }
                ProviderErrorKind::Internal => ErrorCategory::InternalError,
                ProviderErrorKind::Cancelled => ErrorCategory::Cancelled,
            }
        } else {
            mapping.category
        };

        let user_msg = if mapping.user_message.is_empty() {
            err.message.clone()
        } else {
            mapping.user_message
        };

        let tech_msg = format!("[{}] {}", err.kind, err.message);

        ErrorEnvelope::new(
            final_category,
            user_msg,
            tech_msg,
            ClassificationProvenance::ProviderSpecific,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
        .with_provider(provider_str, model_id)
        .with_provider_error_code(err.source_code.clone())
        .with_http_status(err.status_code)
        .with_retry_after_ms(err.retry_after_ms)
    }

    /// Classifies low-level transport errors (DNS, TLS, connection resets, network drops).
    pub fn classify_transport_error(
        err_msg: &str,
        execution_id: Option<String>,
        correlation_id: Option<String>,
        provider_id: Option<String>,
        model_id: Option<String>,
    ) -> ErrorEnvelope {
        let lower = err_msg.to_lowercase();

        let (category, user_msg) = if lower.contains("dns") || lower.contains("resolve") {
            (
                ErrorCategory::DnsResolutionFailed,
                "DNS lookup failed for provider host. Check network connection.",
            )
        } else if lower.contains("tls") || lower.contains("ssl") || lower.contains("certificate") {
            (
                ErrorCategory::TlsFailed,
                "Secure TLS connection handshake failed.",
            )
        } else if lower.contains("connection reset") || lower.contains("forcibly closed") {
            (
                ErrorCategory::ConnectionReset,
                "Connection was reset by the peer or network gateway.",
            )
        } else if lower.contains("connection refused") || lower.contains("connect error") {
            (
                ErrorCategory::ConnectionFailed,
                "Failed to establish connection to the provider endpoint.",
            )
        } else if lower.contains("timed out") || lower.contains("timeout") {
            (
                ErrorCategory::Timeout,
                "Network request timed out waiting for provider response.",
            )
        } else if lower.contains("network unreachable") || lower.contains("no route to host") {
            (
                ErrorCategory::NetworkUnreachable,
                "Network host unreachable. Verify internet connectivity.",
            )
        } else {
            (
                ErrorCategory::NetworkUnknown,
                "A network transport failure occurred communicating with the provider.",
            )
        };

        ErrorEnvelope::new(
            category,
            user_msg,
            err_msg,
            ClassificationProvenance::Transport,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
        .with_provider(provider_id, model_id)
    }

    /// Classifies streaming protocol interruptions and malformed SSE events.
    pub fn classify_stream_error(
        raw_code: &str,
        raw_msg: &str,
        execution_id: Option<String>,
        correlation_id: Option<String>,
        provider_id: Option<String>,
        model_id: Option<String>,
    ) -> ErrorEnvelope {
        let code_lower = raw_code.to_lowercase();
        let msg_lower = raw_msg.to_lowercase();

        if code_lower.contains("cancel") || msg_lower.contains("cancel") {
            return Self::classify_cancellation(
                execution_id,
                correlation_id,
                provider_id,
                model_id,
            );
        }

        let category = if code_lower.contains("parse") || msg_lower.contains("parse") {
            ErrorCategory::ProviderResponseParseFailed
        } else if code_lower.contains("timeout") || msg_lower.contains("timeout") {
            ErrorCategory::Timeout
        } else if code_lower.contains("rate") || msg_lower.contains("rate") {
            ErrorCategory::RateLimited
        } else {
            ErrorCategory::StreamInterrupted
        };

        ErrorEnvelope::new(
            category,
            "The live response stream was interrupted before completion.",
            format!("[stream_error:{}] {}", raw_code, raw_msg),
            ClassificationProvenance::StreamProtocol,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
        .with_provider(provider_id, model_id)
    }

    /// Classifies routing and analysis pipeline failures.
    pub fn classify_routing_error(
        stage: &str,
        err_msg: &str,
        execution_id: Option<String>,
        correlation_id: Option<String>,
    ) -> ErrorEnvelope {
        let category = match stage {
            "intent" => ErrorCategory::IntentClassificationFailed,
            "task_analysis" => ErrorCategory::TaskAnalysisFailed,
            "scoring" => ErrorCategory::RoutingScoringFailed,
            "policy" => ErrorCategory::RoutingPolicyFailed,
            "no_route" => ErrorCategory::NoEligibleRoute,
            _ => ErrorCategory::RoutingPolicyFailed,
        };

        let user_msg = match category {
            ErrorCategory::NoEligibleRoute => {
                "No eligible AI model was available that satisfies the request requirements."
            }
            _ => "The local routing pipeline encountered an internal evaluation failure.",
        };

        ErrorEnvelope::new(
            category,
            user_msg,
            format!("[routing_stage:{}] {}", stage, err_msg),
            ClassificationProvenance::Routing,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
    }

    /// Classifies local SLM and ONNX runtime failures.
    pub fn classify_local_slm_error(
        err_msg: &str,
        execution_id: Option<String>,
        correlation_id: Option<String>,
    ) -> ErrorEnvelope {
        let lower = err_msg.to_lowercase();
        let category = if lower.contains("load") || lower.contains("file not found") {
            ErrorCategory::LocalModelLoadFailed
        } else if lower.contains("inference") || lower.contains("onnx") {
            ErrorCategory::LocalInferenceFailed
        } else {
            ErrorCategory::LocalModelRuntimeUnavailable
        };

        ErrorEnvelope::new(
            category,
            "Local SLM runtime failure. Model routing could not be evaluated on-device.",
            err_msg,
            ClassificationProvenance::LocalRuntime,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
    }

    /// Classifies database and local persistence failures.
    pub fn classify_persistence_error(
        err_msg: &str,
        is_telemetry: bool,
        execution_id: Option<String>,
        correlation_id: Option<String>,
    ) -> ErrorEnvelope {
        let category = if is_telemetry {
            ErrorCategory::TelemetryWriteFailed
        } else {
            ErrorCategory::ChatHistoryWriteFailed
        };

        ErrorEnvelope::new(
            category,
            "Failed to persist record to local database storage.",
            err_msg,
            ClassificationProvenance::Persistence,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
    }

    /// Classifies general application-level AppError instances.
    pub fn classify_app_error(
        app_err: &AppError,
        execution_id: Option<String>,
        correlation_id: Option<String>,
    ) -> ErrorEnvelope {
        let (category, user_msg) = match app_err {
            AppError::InvalidInput(msg) => {
                (ErrorCategory::InvalidRequest, format!("Invalid input: {}", msg))
            }
            AppError::NotFound(msg) => {
                (ErrorCategory::ModelUnavailable, format!("Resource not found: {}", msg))
            }
            AppError::ServiceUnavailable(msg) => (
                ErrorCategory::ProviderUnavailable,
                format!("Service unavailable: {}", msg),
            ),
            AppError::InitializationFailed(msg) => (
                ErrorCategory::InternalError,
                format!("System initialization failed: {}", msg),
            ),
            AppError::Internal(msg) => {
                (ErrorCategory::InternalError, format!("Internal error: {}", msg))
            }
        };

        ErrorEnvelope::new(
            category,
            user_msg,
            app_err.to_string(),
            ClassificationProvenance::Application,
        )
        .with_execution_id(execution_id)
        .with_correlation_id(correlation_id)
    }
}

