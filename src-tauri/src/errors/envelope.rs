// ============================================================================
// Nano Route - Normalized Error Envelope
// File: src-tauri/src/errors/envelope.rs
// ============================================================================
// Standardized, frontend-safe error envelope carrying classification metadata,
// user-facing messages, technical diagnostics, and correlation tracking (Step 36).
// ============================================================================

use crate::errors::sanitizer::sanitize_error_text;
use crate::errors::taxonomy::{
    ClassificationProvenance, ErrorCategory, ErrorSeverity, FailoverHint, RetryabilityHint,
    UserAction,
};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

pub const ERROR_SCHEMA_VERSION: u32 = 1;

/// Standardized, provider-neutral error envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEnvelope {
    /// Unique identifier for this error instance.
    pub error_id: String,
    /// Authoritative machine-readable error code.
    pub error_code: String,
    /// Semantic category of the failure.
    pub category: ErrorCategory,
    /// Operational severity level.
    pub severity: ErrorSeverity,
    /// Sanitized user-facing explanation suitable for UI presentation.
    pub user_message: String,
    /// Sanitized technical diagnostics safe for logs and debugging.
    pub technical_message: String,
    /// Optional correlation with Step 35 execution lifecycle.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub execution_id: Option<String>,
    /// Optional IPC request correlation ID.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    /// Target provider ID, if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    /// Target model ID, if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    /// Upstream provider request identifier, if captured.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_request_id: Option<String>,
    /// Upstream raw provider error code, if provided.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_error_code: Option<String>,
    /// Upstream HTTP status code, if applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub http_status: Option<u16>,
    /// Upstream retry delay hint in milliseconds (e.g. from Retry-After header).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
    /// Whether this failure is terminal for the current execution.
    pub is_terminal: bool,
    /// Informational retryability classification hint.
    pub retryability_hint: RetryabilityHint,
    /// Informational failover eligibility classification hint.
    pub failover_hint: FailoverHint,
    /// Recommended next user action.
    pub user_action: UserAction,
    /// Layer or source that determined the classification.
    pub provenance: ClassificationProvenance,
    /// Schema version for telemetry and storage compatibility.
    pub schema_version: u32,
    /// Epoch timestamp when the failure occurred in milliseconds.
    pub occurred_at_ms: u64,
}

impl ErrorEnvelope {
    /// Creates a new ErrorEnvelope with default category settings and sanitized messages.
    pub fn new(
        category: ErrorCategory,
        user_message: impl Into<String>,
        technical_message: impl Into<String>,
        provenance: ClassificationProvenance,
    ) -> Self {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let err_id = format!("err_{}_{}", now_ms, generate_short_id());
        let default_code = category.default_code().to_string();
        let severity = category.default_severity();
        let retryability = category.default_retryability();
        let failover = category.default_failover();
        let user_action = category.default_user_action();

        Self {
            error_id: err_id,
            error_code: default_code,
            category,
            severity,
            user_message: sanitize_error_text(&user_message.into()),
            technical_message: sanitize_error_text(&technical_message.into()),
            execution_id: None,
            correlation_id: None,
            provider_id: None,
            model_id: None,
            provider_request_id: None,
            provider_error_code: None,
            http_status: None,
            retry_after_ms: None,
            is_terminal: true,
            retryability_hint: retryability,
            failover_hint: failover,
            user_action,
            provenance,
            schema_version: ERROR_SCHEMA_VERSION,
            occurred_at_ms: now_ms,
        }
    }

    pub fn with_error_code(mut self, code: impl Into<String>) -> Self {
        self.error_code = code.into();
        self
    }

    pub fn with_execution_id(mut self, execution_id: Option<String>) -> Self {
        self.execution_id = execution_id;
        self
    }

    pub fn with_correlation_id(mut self, correlation_id: Option<String>) -> Self {
        self.correlation_id = correlation_id;
        self
    }

    pub fn with_provider(mut self, provider_id: Option<String>, model_id: Option<String>) -> Self {
        self.provider_id = provider_id;
        self.model_id = model_id;
        self
    }

    pub fn with_provider_request_id(mut self, req_id: Option<String>) -> Self {
        self.provider_request_id = req_id.map(|s| sanitize_error_text(&s));
        self
    }

    pub fn with_provider_error_code(mut self, code: Option<String>) -> Self {
        self.provider_error_code = code.map(|s| sanitize_error_text(&s));
        self
    }

    pub fn with_http_status(mut self, status: Option<u16>) -> Self {
        self.http_status = status;
        self
    }

    pub fn with_retry_after_ms(mut self, delay_ms: Option<u64>) -> Self {
        self.retry_after_ms = delay_ms;
        self
    }

    pub fn with_severity(mut self, severity: ErrorSeverity) -> Self {
        self.severity = severity;
        self
    }

    pub fn with_retryability_hint(mut self, hint: RetryabilityHint) -> Self {
        self.retryability_hint = hint;
        self
    }

    pub fn with_failover_hint(mut self, hint: FailoverHint) -> Self {
        self.failover_hint = hint;
        self
    }

    pub fn with_user_action(mut self, action: UserAction) -> Self {
        self.user_action = action;
        self
    }

    pub fn with_terminal(mut self, terminal: bool) -> Self {
        self.is_terminal = terminal;
        self
    }
}

fn generate_short_id() -> String {
    use std::sync::atomic::{AtomicU32, Ordering};
    static COUNTER: AtomicU32 = AtomicU32::new(1);
    let count = COUNTER.fetch_add(1, Ordering::SeqCst);
    format!("{:04x}", count)
}

