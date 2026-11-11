// ============================================================================
// Nano Route - Reliability Subsystem (Step 37 + Step 38 + Step 39)
// File: src-tauri/src/reliability/mod.rs
// ============================================================================
// Automatic failover, candidate eligibility validation, retry policy, timeout
// enforcement, rate limit backoff, context feasibility checks, local budget
// guards, provider quota tracking, and preflight execution coordination.
// ============================================================================

pub mod context;
pub mod manager;
pub mod policy;
pub mod preflight;
pub mod quota;
pub mod rate_limit;
pub mod retry_policy;
pub mod retry_types;
pub mod timeout;
pub mod types;
pub mod validator;

pub use context::{
    ContextCheckResult, ContextChecker, ContextStatus, TokenCountProvenance,
    DEFAULT_ESTIMATED_OUTPUT_TOKENS, DEFAULT_MIN_SAFETY_MARGIN_TOKENS,
    DEFAULT_SAFETY_MARGIN_RATIO,
};
pub use manager::{FailoverManager, LogicalRequestTracker};
pub use policy::FailoverPolicy;
pub use preflight::{ExecutionPreflight, PreflightCoordinator, PreflightReasonCode};
pub use quota::{BudgetGuard, QuotaScope, QuotaSnapshot};
pub use rate_limit::{RateLimitMetadata, RateLimitParser, DEFAULT_MAX_RETRY_DELAY_CAP_MS};
pub use retry_policy::{
    RetryConfig, RetryPolicy, DEFAULT_BACKOFF_MULTIPLIER, DEFAULT_BASE_DELAY_MS,
    DEFAULT_JITTER_RATIO, DEFAULT_MAX_RETRIES_PER_CANDIDATE, DEFAULT_MAX_RETRY_DELAY_MS,
    DEFAULT_MAX_TOTAL_ATTEMPTS,
};
pub use retry_types::{RequestTransmissionState, RetryDecision, RetryReason, RetrySafety, TimeoutType};
pub use timeout::{
    DeadlineTracker, TimeoutConfig, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_LOGICAL_DEADLINE_MS,
    DEFAULT_MIN_EXECUTION_WINDOW_MS, DEFAULT_REQUEST_TIMEOUT_MS, DEFAULT_STREAM_IDLE_TIMEOUT_MS,
};
pub use types::{
    AttemptStatus, CandidateRejectionReason, FailoverAttempt, FailoverFinalStatus, FailoverResult,
    DEFAULT_FAILOVER_POLICY_VERSION,
};
pub use validator::CandidateValidator;
