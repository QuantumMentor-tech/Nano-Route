// ============================================================================
// Nano Route - Local Budget & Provider Quota Guard
// File: src-tauri/src/reliability/quota.rs
// ============================================================================
// Tracks local spend limits against encrypted DPAPI credentials and observes
// provider quota exhaustion states with advisory reset tracking.
// Blocks exhausted candidates with zero physical network requests.
// ============================================================================

use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};

use crate::domain::credentials::ProviderCredentialStatus;
use crate::reliability::types::CandidateRejectionReason;

/// Target scope of quota or budget governance.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuotaScope {
    Provider,
    Model,
    Account,
}

/// Point-in-time snapshot of quota and budget posture.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuotaSnapshot {
    pub scope: QuotaScope,
    pub provider_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub monthly_budget_limit: Option<f64>,
    pub current_month_spend: f64,
    pub is_exhausted: bool,
    pub is_stale: bool,
    pub observed_at_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reset_at_ms: Option<u64>,
}

#[derive(Debug, Clone)]
struct QuotaTrackingRecord {
    pub provider_id: String,
    pub model_id: Option<String>,
    pub is_exhausted: bool,
    pub observed_at_ms: u64,
    pub reset_at_ms: Option<u64>,
}

/// Runtime guard managing local budget headroom and provider quota exhaustion tracking.
pub struct BudgetGuard {
    tracked_quotas: Arc<RwLock<HashMap<String, QuotaTrackingRecord>>>,
}

impl BudgetGuard {
    /// Initializes a new thread-safe BudgetGuard.
    pub fn new() -> Self {
        Self {
            tracked_quotas: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64
    }

    /// Records an observed quota exhaustion event (e.g., HTTP 429 quota exhausted or response header).
    pub fn record_quota_exhaustion(
        &self,
        provider_id: &str,
        model_id: Option<&str>,
        reset_at_ms: Option<u64>,
    ) {
        let key = provider_id.trim().to_lowercase();
        let record = QuotaTrackingRecord {
            provider_id: key.clone(),
            model_id: model_id.map(|s| s.to_string()),
            is_exhausted: true,
            observed_at_ms: Self::now_ms(),
            reset_at_ms,
        };
        if let Ok(mut map) = self.tracked_quotas.write() {
            map.insert(key, record);
        }
    }

    /// Clears observed quota exhaustion for a provider.
    pub fn clear_quota_exhaustion(&self, provider_id: &str) {
        let key = provider_id.trim().to_lowercase();
        if let Ok(mut map) = self.tracked_quotas.write() {
            map.remove(&key);
        }
    }

    /// Retrieves an authoritative quota snapshot.
    pub fn get_quota_snapshot(
        &self,
        provider_id: &str,
        model_id: Option<&str>,
        cred_status: Option<&ProviderCredentialStatus>,
    ) -> QuotaSnapshot {
        let key = provider_id.trim().to_lowercase();
        let now = Self::now_ms();

        let (is_exhausted, is_stale, observed_at_ms, reset_at_ms) = {
            if let Ok(map) = self.tracked_quotas.read() {
                if let Some(record) = map.get(&key) {
                    let mut exhausted = record.is_exhausted;
                    let mut stale = false;

                    // If reset time passed, mark stale and not exhausted
                    if let Some(reset) = record.reset_at_ms {
                        if now >= reset {
                            exhausted = false;
                            stale = true;
                        }
                    } else if now.saturating_sub(record.observed_at_ms) > 3_600_000 {
                        // Older than 1 hour without reset time is treated as stale advisory
                        stale = true;
                    }

                    (exhausted, stale, record.observed_at_ms, record.reset_at_ms)
                } else {
                    (false, false, now, None)
                }
            } else {
                (false, false, now, None)
            }
        };

        let (monthly_budget_limit, current_month_spend) = match cred_status {
            Some(status) => (status.monthly_budget_limit, status.current_month_spend),
            None => (None, 0.0),
        };

        QuotaSnapshot {
            scope: QuotaScope::Provider,
            provider_id: key,
            model_id: model_id.map(|s| s.to_string()),
            monthly_budget_limit,
            current_month_spend,
            is_exhausted,
            is_stale,
            observed_at_ms,
            reset_at_ms,
        }
    }

    /// Evaluates budget headroom and provider quota exhaustion.
    pub fn check_quota_and_budget(
        &self,
        provider_id: &str,
        _model_id: Option<&str>,
        estimated_cost_usd: Option<f64>,
        cred_status: Option<&ProviderCredentialStatus>,
    ) -> Result<(), CandidateRejectionReason> {
        let key = provider_id.trim().to_lowercase();
        let now = Self::now_ms();

        // 1. Check provider quota exhaustion state
        if let Ok(map) = self.tracked_quotas.read() {
            if let Some(record) = map.get(&key) {
                if record.is_exhausted {
                    if let Some(reset) = record.reset_at_ms {
                        if now < reset {
                            return Err(CandidateRejectionReason::ProviderQuotaExhausted {
                                provider_id: key,
                            });
                        }
                    } else {
                        // Exhausted without definite reset time
                        return Err(CandidateRejectionReason::ProviderQuotaExhausted {
                            provider_id: key,
                        });
                    }
                }
            }
        }

        // 2. Check local monthly budget limit
        if let Some(status) = cred_status {
            if let Some(limit) = status.monthly_budget_limit {
                let est_cost = estimated_cost_usd.unwrap_or(0.0);
                if status.current_month_spend + est_cost > limit {
                    return Err(CandidateRejectionReason::LocalBudgetExceeded {
                        provider_id: key,
                        spend: status.current_month_spend,
                        limit,
                    });
                }
            }
        }

        Ok(())
    }
}

impl Default for BudgetGuard {
    fn default() -> Self {
        Self::new()
    }
}

