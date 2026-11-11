// ============================================================================
// Nano Route - Timeout Policy & Deadline Tracker
// File: src-tauri/src/reliability/timeout.rs
// ============================================================================
// Enforces physical attempt timeouts, stream idle timeouts, and overall
// logical request execution deadlines (Step 38).
// ============================================================================

use std::time::Instant;
use serde::{Deserialize, Serialize};

/// Default operational timeout configuration.
pub const DEFAULT_CONNECT_TIMEOUT_MS: u64 = 10_000;
pub const DEFAULT_REQUEST_TIMEOUT_MS: u64 = 30_000;
pub const DEFAULT_STREAM_IDLE_TIMEOUT_MS: u64 = 20_000;
pub const DEFAULT_LOGICAL_DEADLINE_MS: u64 = 60_000;
pub const DEFAULT_MIN_EXECUTION_WINDOW_MS: u64 = 3_000;

/// Structured timeout configuration for execution orchestration.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimeoutConfig {
    pub connect_timeout_ms: u64,
    pub request_timeout_ms: u64,
    pub stream_idle_timeout_ms: u64,
    pub logical_deadline_ms: u64,
    pub min_execution_window_ms: u64,
}

impl Default for TimeoutConfig {
    fn default() -> Self {
        Self {
            connect_timeout_ms: DEFAULT_CONNECT_TIMEOUT_MS,
            request_timeout_ms: DEFAULT_REQUEST_TIMEOUT_MS,
            stream_idle_timeout_ms: DEFAULT_STREAM_IDLE_TIMEOUT_MS,
            logical_deadline_ms: DEFAULT_LOGICAL_DEADLINE_MS,
            min_execution_window_ms: DEFAULT_MIN_EXECUTION_WINDOW_MS,
        }
    }
}

/// Tracks elapsed execution time against the logical request deadline.
#[derive(Debug, Clone)]
pub struct DeadlineTracker {
    started_at: Instant,
    logical_deadline_ms: u64,
    min_execution_window_ms: u64,
}

impl DeadlineTracker {
    pub fn new(logical_deadline_ms: u64, min_execution_window_ms: u64) -> Self {
        Self {
            started_at: Instant::now(),
            logical_deadline_ms,
            min_execution_window_ms,
        }
    }

    /// Returns the remaining duration before the logical request deadline expires, in milliseconds.
    pub fn remaining_deadline_ms(&self) -> u64 {
        let elapsed_ms = self.started_at.elapsed().as_millis() as u64;
        self.logical_deadline_ms.saturating_sub(elapsed_ms)
    }

    /// Checks if the logical request deadline has elapsed.
    pub fn is_deadline_exceeded(&self) -> bool {
        self.remaining_deadline_ms() == 0
    }

    /// Evaluates if there is sufficient time remaining to wait for `delay_ms`
    /// plus a minimal execution window to run the subsequent attempt.
    pub fn can_accommodate_retry(&self, delay_ms: u64) -> bool {
        let remaining = self.remaining_deadline_ms();
        remaining >= delay_ms.saturating_add(self.min_execution_window_ms)
    }

    /// Allocates the physical timeout for the next attempt, clamped by remaining deadline.
    pub fn allocate_attempt_timeout_ms(&self, preferred_timeout_ms: u64) -> u64 {
        let remaining = self.remaining_deadline_ms();
        preferred_timeout_ms.min(remaining)
    }

    pub fn elapsed_ms(&self) -> u64 {
        self.started_at.elapsed().as_millis() as u64
    }
}

