// ============================================================================
// Nano Route - Failover Orchestration Manager
// File: src-tauri/src/reliability/manager.rs
// ============================================================================
// Authoritative coordinator tracking execution attempts, evaluating fallback
// candidate sequences, preventing infinite failover loops, and maintaining
// single logical request integrity.
// ============================================================================

use std::collections::HashSet;
use std::sync::{Arc, RwLock};

use crate::analysis::types::TaskAnalysisResult;
use crate::errors::ErrorEnvelope;
use crate::reliability::policy::FailoverPolicy;
use crate::reliability::types::{
    AttemptStatus, CandidateRejectionReason, FailoverAttempt, FailoverFinalStatus, FailoverResult,
    DEFAULT_FAILOVER_POLICY_VERSION,
};
use crate::reliability::validator::CandidateValidator;
use crate::routing::policy::types::{FallbackCandidate, SelectionMode};
use crate::services::telemetry::TelemetryService;

/// Central coordinator for automatic failover and attempt tracking.
pub struct FailoverManager {
    validator: Arc<CandidateValidator>,
    telemetry_service: Arc<TelemetryService>,
}

impl FailoverManager {
    /// Creates a new FailoverManager instance.
    pub fn new(
        validator: Arc<CandidateValidator>,
        telemetry_service: Arc<TelemetryService>,
    ) -> Self {
        Self {
            validator,
            telemetry_service,
        }
    }

    /// Accessor for the candidate validator.
    pub fn validator(&self) -> &Arc<CandidateValidator> {
        &self.validator
    }

    /// Accessor for the telemetry service.
    pub fn telemetry_service(&self) -> &Arc<TelemetryService> {
        &self.telemetry_service
    }

    /// Evaluates whether an error permits failover for the specified selection mode.
    pub fn should_permit_failover(
        &self,
        error: &ErrorEnvelope,
        selection_mode: &SelectionMode,
    ) -> bool {
        FailoverPolicy::should_permit_failover(error, selection_mode)
    }

    /// Selects the next eligible fallback candidate from the candidate plan.
    /// Skips any candidate already attempted, disqualified by capability, or missing credentials.
    pub fn select_next_fallback(
        &self,
        fallback_candidates: &[FallbackCandidate],
        attempted_candidates: &HashSet<(String, String)>,
        task_analysis: Option<&TaskAnalysisResult>,
        estimated_tokens: Option<u64>,
    ) -> Option<(FallbackCandidate, usize)> {
        for (idx, candidate) in fallback_candidates.iter().enumerate() {
            let prov_id = candidate.provider_id.trim().to_lowercase();
            let model_id = candidate.model_id.trim();

            if attempted_candidates.contains(&(prov_id, model_id.to_string())) {
                continue;
            }

            if self
                .validator
                .validate_candidate(candidate, attempted_candidates, task_analysis, estimated_tokens)
                .is_ok()
            {
                return Some((candidate.clone(), idx));
            }
        }
        None
    }
}

/// Thread-safe tracker maintaining attempt state across the lifetime of a single logical request.
pub struct LogicalRequestTracker {
    pub logical_request_id: String,
    pub primary_provider_id: String,
    pub primary_model_id: String,
    attempted_candidates: RwLock<HashSet<(String, String)>>,
    attempts: RwLock<Vec<FailoverAttempt>>,
}

impl LogicalRequestTracker {
    /// Initializes a new tracker for a logical request.
    pub fn new(
        logical_request_id: impl Into<String>,
        primary_provider_id: impl Into<String>,
        primary_model_id: impl Into<String>,
    ) -> Self {
        let req_id = logical_request_id.into();
        let p_id = primary_provider_id.into();
        let m_id = primary_model_id.into();

        let mut attempted = HashSet::new();
        attempted.insert((p_id.clone().to_lowercase(), m_id.clone()));

        Self {
            logical_request_id: req_id,
            primary_provider_id: p_id,
            primary_model_id: m_id,
            attempted_candidates: RwLock::new(attempted),
            attempts: RwLock::new(Vec::new()),
        }
    }

    /// Checks if a candidate (provider, model) has already been attempted in this request.
    pub fn has_attempted(&self, provider_id: &str, model_id: &str) -> bool {
        if let Ok(lock) = self.attempted_candidates.read() {
            lock.contains(&(provider_id.to_lowercase(), model_id.to_string()))
        } else {
            true
        }
    }

    /// Atomically marks a candidate as attempted. Returns true if newly marked, false if already present.
    pub fn mark_attempted(&self, provider_id: &str, model_id: &str) -> bool {
        if let Ok(mut lock) = self.attempted_candidates.write() {
            lock.insert((provider_id.to_lowercase(), model_id.to_string()))
        } else {
            false
        }
    }

    /// Snapshot copy of all attempted candidate identifiers.
    pub fn attempted_set(&self) -> HashSet<(String, String)> {
        self.attempted_candidates
            .read()
            .map(|l| l.clone())
            .unwrap_or_default()
    }

    /// Appends a recorded attempt.
    pub fn record_attempt(&self, attempt: FailoverAttempt) {
        if let Ok(mut lock) = self.attempts.write() {
            lock.push(attempt);
        }
    }

    /// Total number of recorded attempts so far.
    pub fn attempt_count(&self) -> usize {
        self.attempts.read().map(|l| l.len()).unwrap_or(0)
    }

    /// Constructs the final FailoverResult.
    pub fn build_result(
        &self,
        final_provider_id: String,
        final_model_id: String,
        primary_error: Option<ErrorEnvelope>,
        final_status: FailoverFinalStatus,
    ) -> FailoverResult {
        let attempts = self.attempts.read().map(|l| l.clone()).unwrap_or_default();
        let failover_used = final_status == FailoverFinalStatus::Succeeded
            && (final_provider_id != self.primary_provider_id
                || final_model_id != self.primary_model_id);

        FailoverResult {
            logical_request_id: self.logical_request_id.clone(),
            final_provider_id,
            final_model_id,
            primary_provider_id: self.primary_provider_id.clone(),
            primary_model_id: self.primary_model_id.clone(),
            primary_error,
            failover_used,
            attempt_count: attempts.len(),
            final_status,
            failover_policy_version: DEFAULT_FAILOVER_POLICY_VERSION.to_string(),
            attempts,
        }
    }
}

