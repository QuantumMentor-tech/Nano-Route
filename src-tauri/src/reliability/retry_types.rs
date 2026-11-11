// ============================================================================
// Nano Route - Retry & Timeout Control Subsystem Types
// File: src-tauri/src/reliability/retry_types.rs
// ============================================================================
// Authoritative type definitions for retry safety classifications, request
// transmission tracking, timeout boundaries, and structured retry decisions (Step 38).
// ============================================================================

use serde::{Deserialize, Serialize};

/// Explicit safety classification determining whether repeating a request is safe.
/// Prioritizes duplicate-billing prevention over optimistic retry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RetrySafety {
    /// Request was rejected locally or connection failed before any data was sent.
    /// Safe to retry without risk of duplicate execution or billing.
    DefinitelySafe,
    /// Provider adapter guarantees idempotency or request deduplication.
    ConditionallySafe,
    /// Request may have reached the provider, but the local outcome is unknown.
    /// (e.g. timeout after send, TCP reset after transmission).
    /// Automatic replay is disallowed to prevent duplicate provider billing.
    Ambiguous,
    /// Repeating the request would create duplicate externally visible or billable work
    /// (e.g. stream tokens already emitted, response body partially received).
    Unsafe,
    /// Not applicable (e.g. user cancelled, permanent invalid input, auth failure).
    NotApplicable,
}

impl RetrySafety {
    pub fn is_safe_for_retry(&self) -> bool {
        matches!(self, Self::DefinitelySafe | Self::ConditionallySafe)
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::DefinitelySafe => "definitely_safe",
            Self::ConditionallySafe => "conditionally_safe",
            Self::Ambiguous => "ambiguous",
            Self::Unsafe => "unsafe",
            Self::NotApplicable => "not_applicable",
        }
    }
}

/// Request transmission lifecycle state used to determine retry safety.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RequestTransmissionState {
    /// Request not started or not yet transmitted.
    NotSent,
    /// Request body is currently being transmitted to the upstream provider.
    Sending,
    /// Request body transmission completed, but response status/header is pending.
    SentUnknownOutcome,
    /// Upstream response headers received, waiting for body chunks.
    ResponsePending,
    /// Response started; one or more tokens/chunks emitted by upstream provider.
    ResponseStarted,
    /// Complete response successfully received.
    ResponseCompleted,
    /// User or system cancelled before any bytes were sent.
    LocallyCancelledBeforeSend,
    /// User or system cancelled after request transmission began.
    LocallyCancelledAfterSend,
    /// Failure occurred before request body was transmitted (e.g. DNS or connect error).
    FailedBeforeSend,
    /// Failure occurred after request body was transmitted.
    FailedAfterSend,
}

impl RequestTransmissionState {
    pub fn had_provider_output(&self) -> bool {
        matches!(self, Self::ResponseStarted | Self::ResponseCompleted)
    }

    pub fn was_sent_or_ambiguous(&self) -> bool {
        matches!(
            self,
            Self::Sending
                | Self::SentUnknownOutcome
                | Self::ResponsePending
                | Self::ResponseStarted
                | Self::ResponseCompleted
                | Self::LocallyCancelledAfterSend
                | Self::FailedAfterSend
        )
    }
}

/// Machine-readable reason for a retry decision.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RetryReason {
    TransientNetworkFailure,
    ProviderUnavailable,
    RateLimitRetryAfter,
    RateLimitBackoff,
    ConnectionFailureBeforeSend,
    TimeoutBeforeSend,
    Other(String),
}

impl RetryReason {
    pub fn as_str(&self) -> &str {
        match self {
            Self::TransientNetworkFailure => "transient_network_failure",
            Self::ProviderUnavailable => "provider_unavailable",
            Self::RateLimitRetryAfter => "rate_limit_retry_after",
            Self::RateLimitBackoff => "rate_limit_backoff",
            Self::ConnectionFailureBeforeSend => "connection_failure_before_send",
            Self::TimeoutBeforeSend => "timeout_before_send",
            Self::Other(s) => s.as_str(),
        }
    }
}

/// Authoritative decision emitted by the RetryPolicy engine.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "decision", rename_all = "snake_case")]
pub enum RetryDecision {
    /// Attempt retry immediately (0ms delay).
    RetryNow {
        attempt: u32,
        max_retries: u32,
        safety: RetrySafety,
        reason: RetryReason,
    },
    /// Attempt retry after a calculated, bounded backoff or Retry-After delay.
    RetryAfterDelay {
        attempt: u32,
        max_retries: u32,
        delay_ms: u64,
        safety: RetrySafety,
        reason: RetryReason,
        deadline_remaining_ms: u64,
    },
    /// Do not retry on the same provider/model, and do NOT failover (e.g. permanent failure, cancel).
    DoNotRetry {
        reason: String,
        safety: RetrySafety,
    },
    /// Same provider/model retry is not permitted or exhausted; hand off cleanly to Step 37 failover.
    DeferToFailover {
        reason: String,
        safety: RetrySafety,
    },
}

impl RetryDecision {
    pub fn is_retry(&self) -> bool {
        matches!(self, Self::RetryNow { .. } | Self::RetryAfterDelay { .. })
    }

    pub fn delay_ms(&self) -> u64 {
        match self {
            Self::RetryNow { .. } => 0,
            Self::RetryAfterDelay { delay_ms, .. } => *delay_ms,
            Self::DoNotRetry { .. } | Self::DeferToFailover { .. } => 0,
        }
    }
}

/// Specific timeout boundary that was triggered.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimeoutType {
    /// Failed to establish TCP/TLS connection within allowed window.
    Connect,
    /// Overall physical request exceeded per-attempt duration limit.
    Request,
    /// Provider did not emit response headers / first byte in time.
    FirstByte,
    /// Active stream was silent without new chunks beyond stream idle limit.
    StreamIdle,
    /// Total execution duration reached logical request deadline.
    LogicalDeadline,
}

impl TimeoutType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Connect => "connect",
            Self::Request => "request",
            Self::FirstByte => "first_byte",
            Self::StreamIdle => "stream_idle",
            Self::LogicalDeadline => "logical_deadline",
        }
    }
}

