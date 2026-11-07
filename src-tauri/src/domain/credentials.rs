// ============================================================================
// Nano Route - Credential Domain Models
// File: src-tauri/src/domain/credentials.rs
// ============================================================================
// Domain entities for encrypted provider credentials and non-secret status views.
// Plaintext secrets NEVER implement Serialize or Display.
// ============================================================================

use crate::security::SecretString;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Persisted record representing encrypted ciphertext and provider preferences.
#[derive(Debug, Clone, PartialEq)]
pub struct EncryptedCredentialRecord {
    pub provider_id: String,
    pub encrypted_api_key: Vec<u8>,
    pub base_url: Option<String>,
    pub is_active: bool,
    pub priority_weight: u8,
    pub monthly_budget_limit: Option<f64>,
    pub current_month_spend: f64,
    pub updated_at: i64,
}

/// Safe, non-secret credential metadata for UI presentation and IPC consumption.
/// Strictly excludes plaintext keys and encrypted ciphertext blobs.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCredentialStatus {
    pub provider_id: String,
    pub is_configured: bool,
    pub is_active: bool,
    pub priority_weight: u8,
    pub base_url: Option<String>,
    pub monthly_budget_limit: Option<f64>,
    pub current_month_spend: f64,
    pub updated_at: i64,
}

/// Transient native secret container scoped exclusively to provider client execution.
/// NEVER implements Serialize/Deserialize; Debug is strictly masked.
#[derive(Clone)]
pub struct DecryptedProviderCredential {
    pub provider_id: String,
    pub api_key: SecretString,
    pub base_url: Option<String>,
}

impl fmt::Debug for DecryptedProviderCredential {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("DecryptedProviderCredential")
            .field("provider_id", &self.provider_id)
            .field("api_key", &"***REDACTED***")
            .field("base_url", &self.base_url)
            .finish()
    }
}

