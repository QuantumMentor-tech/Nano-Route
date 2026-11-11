// ============================================================================
// Nano Route - Retry Policy Engine
// File: src-tauri/src/reliability/retry_policy.rs
// ============================================================================
// Authoritative decision logic determining whether an operational failure
// qualifies for a safe, bounded retry on the SAME provider/model before Step 37 failover.
// Invariant: Prefers "Do Not Retry" over risking duplicate billable provider calls.
// ============================================================================

use serde::{Deserialize, Serialize};

use crate::errors::{ErrorCategory, ErrorEnvelope};
use crate::reliability::retry_types::{RequestTransmissionState, RetryDecision, RetryReason, RetrySafety};
use crate::reliability::timeout::DeadlineTracker;

/// Default configuration for candidate retries.
pub const DEFAULT_MAX_RETRIES_PER_CANDIDATE: u32 = 2;
pub const DEFAULT_MAX_TOTAL_ATTEMPTS: u32 = 5;
pub const DEFAULT_BASE_DELAY_MS: u64 = 1_000;
pub const DEFAULT_MAX_RETRY_DELAY_MS: u64 = 15_000;
pub const DEFAULT_BACKOFF_MULTIPLIER: f64 = 2.0;
pub const DEFAULT_JITTER_RATIO: f64 = 0.2;

/// Configuration governing retry limits, exponential backoff, and jitter.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RetryConfig {
    pub max_retries_per_candidate: u32,
    pub max_total_attempts: u32,
    pub base_delay_ms: u64,
    pub max_retry_delay_ms: u64,
    pub backoff_multiplier: f64,
    pub jitter_ratio: f64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_retries_per_candidate: DEFAULT_MAX_RETRIES_PER_CANDIDATE,
            max_total_attempts: DEFAULT_MAX_TOTAL_ATTEMPTS,
            base_delay_ms: DEFAULT_BASE_DELAY_MS,
            max_retry_delay_ms: DEFAULT_MAX_RETRY_DELAY_MS,
            backoff_multiplier: DEFAULT_BACKOFF_MULTIPLIER,
            jitter_ratio: DEFAULT_JITTER_RATIO,
        }
    }
}

/// Authoritative Retry Policy Engine.
pub struct RetryPolicy {
    config: RetryConfig,
}

impl RetryPolicy {
    pub fn new(config: RetryConfig) -> Self {
        Self { config }
    }

    pub fn with_defaults() -> Self {
        Self::new(RetryConfig::default())
    }

    pub fn config(&self) -> &RetryConfig {
        &self.config
    }

    /// Evaluates whether an execution failure qualifies for a safe retry on the same candidate.
    pub fn evaluate(
        &self,
        error: &ErrorEnvelope,
        transmission_state: RequestTransmissionState,
        candidate_retry_count: u32,
        total_attempts: u32,
        deadline_tracker: &DeadlineTracker,
        tokens_emitted: u64,
    ) -> RetryDecision {
        let remaining_deadline = deadline_tracker.remaining_deadline_ms();

        // 1. Cooperative Cancellation has absolute precedence
        if error.category == ErrorCategory::Cancelled
            || transmission_state == RequestTransmissionState::LocallyCancelledBeforeSend
            || transmission_state == RequestTransmissionState::LocallyCancelledAfterSend
        {
            return RetryDecision::DoNotRetry {
                reason: "Execution was cancelled by user".to_string(),
                safety: RetrySafety::NotApplicable,
            };
        }

        // 2. Database and local persistence failures must NEVER trigger provider replay
        if matches!(
            error.category,
            ErrorCategory::DatabaseFailure
                | ErrorCategory::PersistenceFailure
                | ErrorCategory::ChatHistoryWriteFailed
                | ErrorCategory::TelemetryWriteFailed
        ) {
            return RetryDecision::DoNotRetry {
                reason: "Persistence error must not trigger provider request replay".to_string(),
                safety: RetrySafety::NotApplicable,
            };
        }

        // 3. Streaming Safety Invariant: If provider tokens were already emitted, do NOT replay same prompt!
        if tokens_emitted > 0 || transmission_state == RequestTransmissionState::ResponseStarted {
            return RetryDecision::DeferToFailover {
                reason: "Provider stream emitted output tokens; same-model replay unsafe".to_string(),
                safety: RetrySafety::Unsafe,
            };
        }

        // 4. Ambiguous Post-Transmission Failure Invariant:
        // If request was transmitted but local outcome is unknown, do NOT blind replay on same candidate.
        if matches!(
            transmission_state,
            RequestTransmissionState::SentUnknownOutcome | RequestTransmissionState::FailedAfterSend
        ) {
            return RetryDecision::DeferToFailover {
                reason: "Request transmission outcome is ambiguous; automatic replay unsafe to prevent duplicate provider billing".to_string(),
                safety: RetrySafety::Ambiguous,
            };
        }

        // 5. Non-Retryable Error Categories (Replaying identical request will not change outcome)
        match error.category {
            ErrorCategory::AuthenticationFailed => {
                return RetryDecision::DeferToFailover {
                    reason: "Authentication failure cannot be resolved by retry".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            ErrorCategory::AuthorizationFailed => {
                return RetryDecision::DeferToFailover {
                    reason: "Authorization failure cannot be resolved by retry".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            ErrorCategory::InvalidRequest => {
                return RetryDecision::DoNotRetry {
                    reason: "Invalid request syntax will fail identically upon retry".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            ErrorCategory::ContextLimitExceeded => {
                return RetryDecision::DeferToFailover {
                    reason: "Context window exceeded; same model cannot satisfy token length".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            ErrorCategory::UnsupportedCapability => {
                return RetryDecision::DeferToFailover {
                    reason: "Candidate lacks required capability".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            ErrorCategory::ModelUnavailable => {
                return RetryDecision::DeferToFailover {
                    reason: "Model is unavailable in provider catalog".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            ErrorCategory::TlsFailed | ErrorCategory::EndpointMisconfigured => {
                return RetryDecision::DoNotRetry {
                    reason: "Transport endpoint configuration invalid; retrying will not resolve error".to_string(),
                    safety: RetrySafety::NotApplicable,
                };
            }
            _ => {}
        }

        // 6. Bounded Limits Verification
        if candidate_retry_count >= self.config.max_retries_per_candidate {
            return RetryDecision::DeferToFailover {
                reason: format!(
                    "Candidate retry limit of {} exhausted",
                    self.config.max_retries_per_candidate
                ),
                safety: RetrySafety::DefinitelySafe,
            };
        }

        if total_attempts >= self.config.max_total_attempts {
            return RetryDecision::DeferToFailover {
                reason: format!(
                    "Total execution attempt limit of {} reached",
                    self.config.max_total_attempts
                ),
                safety: RetrySafety::DefinitelySafe,
            };
        }

        // 7. Category-Specific Retry Evaluation
        match error.category {
            // Rate Limiting (429): Honor Retry-After or jittered backoff
            ErrorCategory::RateLimited => {
                let delay_ms = if let Some(retry_after) = error.retry_after_ms {
                    retry_after.min(self.config.max_retry_delay_ms)
                } else {
                    self.compute_backoff_delay(candidate_retry_count)
                };

                if deadline_tracker.can_accommodate_retry(delay_ms) {
                    RetryDecision::RetryAfterDelay {
                        attempt: candidate_retry_count + 1,
                        max_retries: self.config.max_retries_per_candidate,
                        delay_ms,
                        safety: RetrySafety::DefinitelySafe,
                        reason: if error.retry_after_ms.is_some() {
                            RetryReason::RateLimitRetryAfter
                        } else {
                            RetryReason::RateLimitBackoff
                        },
                        deadline_remaining_ms: remaining_deadline,
                    }
                } else {
                    RetryDecision::DeferToFailover {
                        reason: "Rate limit wait exceeds remaining logical deadline".to_string(),
                        safety: RetrySafety::DefinitelySafe,
                    }
                }
            }

            // Provider 502/503 Transient Outage
            ErrorCategory::ProviderUnavailable => {
                let delay_ms = self.compute_backoff_delay(candidate_retry_count);
                if deadline_tracker.can_accommodate_retry(delay_ms) {
                    RetryDecision::RetryAfterDelay {
                        attempt: candidate_retry_count + 1,
                        max_retries: self.config.max_retries_per_candidate,
                        delay_ms,
                        safety: RetrySafety::DefinitelySafe,
                        reason: RetryReason::ProviderUnavailable,
                        deadline_remaining_ms: remaining_deadline,
                    }
                } else {
                    RetryDecision::DeferToFailover {
                        reason: "Provider backoff delay exceeds remaining logical deadline".to_string(),
                        safety: RetrySafety::DefinitelySafe,
                    }
                }
            }

            // Pre-transmission Timeout
            ErrorCategory::Timeout
                if transmission_state == RequestTransmissionState::NotSent
                    || transmission_state == RequestTransmissionState::FailedBeforeSend =>
            {
                let delay_ms = self.compute_backoff_delay(candidate_retry_count);
                if deadline_tracker.can_accommodate_retry(delay_ms) {
                    RetryDecision::RetryAfterDelay {
                        attempt: candidate_retry_count + 1,
                        max_retries: self.config.max_retries_per_candidate,
                        delay_ms,
                        safety: RetrySafety::DefinitelySafe,
                        reason: RetryReason::TimeoutBeforeSend,
                        deadline_remaining_ms: remaining_deadline,
                    }
                } else {
                    RetryDecision::DeferToFailover {
                        reason: "Timeout retry exceeds remaining logical deadline".to_string(),
                        safety: RetrySafety::DefinitelySafe,
                    }
                }
            }

            // Pre-transmission Connection or Network Setup Failure
            ErrorCategory::NetworkUnreachable
            | ErrorCategory::ConnectionFailed
            | ErrorCategory::ConnectionReset
            | ErrorCategory::TransportClosed
            | ErrorCategory::StreamInterrupted
                if transmission_state == RequestTransmissionState::NotSent
                    || transmission_state == RequestTransmissionState::FailedBeforeSend =>
            {
                let delay_ms = self.compute_backoff_delay(candidate_retry_count);
                if deadline_tracker.can_accommodate_retry(delay_ms) {
                    RetryDecision::RetryAfterDelay {
                        attempt: candidate_retry_count + 1,
                        max_retries: self.config.max_retries_per_candidate,
                        delay_ms,
                        safety: RetrySafety::DefinitelySafe,
                        reason: RetryReason::ConnectionFailureBeforeSend,
                        deadline_remaining_ms: remaining_deadline,
                    }
                } else {
                    RetryDecision::DeferToFailover {
                        reason: "Network retry delay exceeds remaining logical deadline".to_string(),
                        safety: RetrySafety::DefinitelySafe,
                    }
                }
            }

            // All other non-whitelisted errors defer to Step 37 failover
            _ => RetryDecision::DeferToFailover {
                reason: format!("Error category '{:?}' does not permit automatic same-model retry", error.category),
                safety: RetrySafety::NotApplicable,
            },
        }
    }

    /// Computes bounded exponential backoff delay with pseudo-jitter.
    pub fn compute_backoff_delay(&self, attempt: u32) -> u64 {
        let factor = self.config.backoff_multiplier.powi(attempt as i32);
        let raw_delay = (self.config.base_delay_ms as f64 * factor) as u64;
        let clamped = raw_delay.min(self.config.max_retry_delay_ms);

        // Add deterministic bounded jitter: +/- 10%
        let jitter = ((clamped as f64) * self.config.jitter_ratio * 0.5) as u64;
        clamped.saturating_add(jitter)
    }
}

