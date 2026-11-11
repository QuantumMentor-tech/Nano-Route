// ============================================================================
// Nano Route - Failover Policy Engine
// File: src-tauri/src/reliability/policy.rs
// ============================================================================
// Authoritative decision logic evaluating whether an operational failure
// is eligible to trigger fallback continuation to an alternate candidate.
// ============================================================================

use crate::errors::{ErrorCategory, ErrorEnvelope, FailoverHint};
use crate::reliability::types::DEFAULT_FAILOVER_POLICY_VERSION;
use crate::routing::policy::types::SelectionMode;

/// Policy governing when an error permits failover continuation.
pub struct FailoverPolicy;

impl FailoverPolicy {
    /// Returns the active semantic version of the failover policy engine.
    pub fn version() -> &'static str {
        DEFAULT_FAILOVER_POLICY_VERSION
    }

    /// Evaluates whether an error permits failover continuation for the given selection mode.
    ///
    /// Precedence Rules:
    /// 1. Cooperative cancellation -> NEVER permit failover.
    /// 2. Explicit manual model override -> NEVER silently substitute another model.
    /// 3. Persistence failures (DB write failed after provider success) -> NEVER failover.
    /// 4. Hard user/payload invalidity -> NEVER failover.
    /// 5. Eligible provider failures (rate limits, timeouts, 5xx, auth, stream drops) -> Permit failover!
    pub fn should_permit_failover(
        error: &ErrorEnvelope,
        selection_mode: &SelectionMode,
    ) -> bool {
        // Rule 1: User cancellation has absolute precedence.
        if error.category == ErrorCategory::Cancelled {
            return false;
        }

        // Rule 2: Manual override is explicit user choice. Do not silently override user choice.
        if *selection_mode == SelectionMode::ManualOverride {
            return false;
        }

        // Rule 3: Database and persistence failures must not trigger provider re-execution.
        if matches!(
            error.category,
            ErrorCategory::DatabaseFailure
                | ErrorCategory::PersistenceFailure
                | ErrorCategory::ChatHistoryWriteFailed
                | ErrorCategory::TelemetryWriteFailed
        ) {
            return false;
        }

        // Rule 4: Universally invalid user requests should not be repeated.
        if error.category == ErrorCategory::InvalidRequest {
            return false;
        }

        // Rule 5: Step 36 authoritative failover hint.
        match error.failover_hint {
            FailoverHint::PotentiallyEligible => true,
            FailoverHint::UsuallyNotEligible => false,
            FailoverHint::NotApplicable => false,
            FailoverHint::Unknown => {
                // For unknown hint classifications, whitelist verified safe transient errors
                matches!(
                    error.category,
                    ErrorCategory::RateLimited
                        | ErrorCategory::ProviderUnavailable
                        | ErrorCategory::ModelUnavailable
                        | ErrorCategory::Timeout
                        | ErrorCategory::StreamInterrupted
                        | ErrorCategory::NetworkUnreachable
                        | ErrorCategory::ConnectionFailed
                        | ErrorCategory::ConnectionReset
                        | ErrorCategory::TransportClosed
                        | ErrorCategory::AuthenticationFailed
                        | ErrorCategory::AuthorizationFailed
                )
            }
        }
    }
}

