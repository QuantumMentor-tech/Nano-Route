// ============================================================================
// Nano Route - Execution Preflight Coordinator
// File: src-tauri/src/reliability/preflight.rs
// ============================================================================
// Unified coordinator executing context window headroom verification, local
// budget and provider quota checks, credential status, endpoint syntax, and
// capability validation before physical network dispatch.
// Disqualifies ineligible candidates with ZERO network requests.
// ============================================================================

use std::collections::HashSet;
use std::sync::Arc;
use serde::{Deserialize, Serialize};

use crate::analysis::types::{RequirementStrength, TaskAnalysisResult, TaskCapabilityRequirement};
use crate::domain::chat::ChatMessage;
use crate::providers::capabilities::ProviderCapability;
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ProviderModel};
use crate::providers::registry::ProviderRegistry;
use crate::reliability::context::{ContextCheckResult, ContextChecker, ContextStatus};
use crate::reliability::quota::BudgetGuard;
use crate::reliability::types::CandidateRejectionReason;
use crate::services::credentials::CredentialVaultService;

/// Canonical reason code for preflight rejection.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreflightReasonCode {
    ContextExceeded,
    OutputLimitExceeded,
    CapabilityMismatch,
    CredentialMissing,
    ProviderDisabled,
    ModelUnavailable,
    EndpointMisconfigured,
    LocalBudgetExceeded,
    ProviderQuotaExhausted,
    ProviderUnavailable,
    AlreadyAttempted,
}

impl PreflightReasonCode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ContextExceeded => "context_exceeded",
            Self::OutputLimitExceeded => "output_limit_exceeded",
            Self::CapabilityMismatch => "capability_mismatch",
            Self::CredentialMissing => "credential_missing",
            Self::ProviderDisabled => "provider_disabled",
            Self::ModelUnavailable => "model_unavailable",
            Self::EndpointMisconfigured => "endpoint_misconfigured",
            Self::LocalBudgetExceeded => "local_budget_exceeded",
            Self::ProviderQuotaExhausted => "provider_quota_exhausted",
            Self::ProviderUnavailable => "provider_unavailable",
            Self::AlreadyAttempted => "already_attempted",
        }
    }
}

/// Comprehensive preflight evaluation outcome.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionPreflight {
    pub eligible: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason_code: Option<PreflightReasonCode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rejection_reason: Option<CandidateRejectionReason>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context_check: Option<ContextCheckResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_cost_usd: Option<f64>,
}

impl ExecutionPreflight {
    pub fn pass(context_check: Option<ContextCheckResult>, estimated_cost_usd: Option<f64>) -> Self {
        Self {
            eligible: true,
            reason_code: None,
            rejection_reason: None,
            user_message: None,
            context_check,
            estimated_cost_usd,
        }
    }

    pub fn reject(
        reason_code: PreflightReasonCode,
        rejection_reason: CandidateRejectionReason,
        context_check: Option<ContextCheckResult>,
        estimated_cost_usd: Option<f64>,
    ) -> Self {
        let msg = rejection_reason.description();
        Self {
            eligible: false,
            reason_code: Some(reason_code),
            rejection_reason: Some(rejection_reason),
            user_message: Some(msg),
            context_check,
            estimated_cost_usd,
        }
    }
}

/// Central coordinator validating candidate readiness across context, quota, credentials, and endpoints.
pub struct PreflightCoordinator {
    provider_registry: Arc<ProviderRegistry>,
    credential_vault: Arc<CredentialVaultService>,
    budget_guard: Arc<BudgetGuard>,
}

impl PreflightCoordinator {
    /// Initializes a new PreflightCoordinator.
    pub fn new(
        provider_registry: Arc<ProviderRegistry>,
        credential_vault: Arc<CredentialVaultService>,
        budget_guard: Arc<BudgetGuard>,
    ) -> Self {
        Self {
            provider_registry,
            credential_vault,
            budget_guard,
        }
    }

    /// Accessor for the budget guard.
    pub fn budget_guard(&self) -> &Arc<BudgetGuard> {
        &self.budget_guard
    }

    /// Accessor for the credential vault.
    pub fn credential_vault(&self) -> &Arc<CredentialVaultService> {
        &self.credential_vault
    }

    /// Accessor for the provider registry.
    pub fn provider_registry(&self) -> &Arc<ProviderRegistry> {
        &self.provider_registry
    }

    /// Estimates candidate cost using model pricing specifications.
    pub fn estimate_candidate_cost(
        model: &ProviderModel,
        input_tokens: u64,
        output_tokens: u64,
    ) -> Option<f64> {
        if let Some(ref pricing) = model.pricing {
            if let (Some(in_rate), Some(out_rate)) = (
                pricing.input_cost_per_million,
                pricing.output_cost_per_million,
            ) {
                let in_cost = (input_tokens as f64 / 1_000_000.0) * in_rate;
                let out_cost = (output_tokens as f64 / 1_000_000.0) * out_rate;
                return Some(in_cost + out_cost);
            }
        }
        None
    }

    /// Validates an endpoint URL string format (must be valid http/https and have a host).
    pub fn validate_endpoint_url(base_url: &str) -> Result<(), String> {
        let trimmed = base_url.trim();
        if trimmed.is_empty() {
            return Ok(());
        }

        if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
            return Err("Endpoint URL must specify 'http://' or 'https://' protocol".to_string());
        }

        let after_scheme = if trimmed.starts_with("https://") {
            &trimmed[8..]
        } else {
            &trimmed[7..]
        };

        if after_scheme.trim().is_empty() || after_scheme.contains(' ') {
            return Err("Endpoint URL host is missing or invalid".to_string());
        }

        Ok(())
    }

    /// Evaluates preflight conditions for a candidate route immediately prior to physical dispatch.
    pub fn evaluate_preflight(
        &self,
        provider_id: &str,
        model_id: &str,
        history: &[ChatMessage],
        prompt: &str,
        system_instruction: Option<&str>,
        task_analysis: Option<&TaskAnalysisResult>,
        attempted_candidates: &HashSet<(String, String)>,
        requested_output_tokens: Option<u64>,
    ) -> ExecutionPreflight {
        let prov_id = provider_id.trim().to_lowercase();
        let mod_id = model_id.trim().to_string();

        // 1. Guard against duplicate execution in this logical request
        if attempted_candidates.contains(&(prov_id.clone(), mod_id.clone())) {
            return ExecutionPreflight::reject(
                PreflightReasonCode::AlreadyAttempted,
                CandidateRejectionReason::AlreadyAttempted {
                    provider_id: prov_id,
                    model_id: mod_id,
                },
                None,
                None,
            );
        }

        // 2. Validate Provider Registration
        let provider_id_typed = match ProviderId::new(&prov_id) {
            Ok(p) => p,
            Err(_) => {
                return ExecutionPreflight::reject(
                    PreflightReasonCode::ProviderUnavailable,
                    CandidateRejectionReason::ProviderNotFound {
                        provider_id: prov_id,
                    },
                    None,
                    None,
                );
            }
        };

        // 3. Validate DPAPI Credential Status
        let cred_status = match self.credential_vault.get_credential_status(&prov_id) {
            Ok(Some(status)) => status,
            Ok(None) => {
                return ExecutionPreflight::reject(
                    PreflightReasonCode::CredentialMissing,
                    CandidateRejectionReason::CredentialMissing {
                        provider_id: prov_id,
                    },
                    None,
                    None,
                );
            }
            Err(e) => {
                return ExecutionPreflight::reject(
                    PreflightReasonCode::CredentialMissing,
                    CandidateRejectionReason::PolicyRejected(e.to_string()),
                    None,
                    None,
                );
            }
        };

        if !cred_status.is_configured {
            return ExecutionPreflight::reject(
                PreflightReasonCode::CredentialMissing,
                CandidateRejectionReason::CredentialMissing {
                    provider_id: prov_id,
                },
                None,
                None,
            );
        }

        if !cred_status.is_active {
            return ExecutionPreflight::reject(
                PreflightReasonCode::ProviderDisabled,
                CandidateRejectionReason::ProviderDisabled {
                    provider_id: prov_id,
                },
                None,
                None,
            );
        }

        // 4. Validate Endpoint Configuration
        if let Some(ref base_url) = cred_status.base_url {
            if let Err(err_msg) = Self::validate_endpoint_url(base_url) {
                return ExecutionPreflight::reject(
                    PreflightReasonCode::EndpointMisconfigured,
                    CandidateRejectionReason::EndpointMisconfigured {
                        provider_id: prov_id,
                        reason: err_msg,
                    },
                    None,
                    None,
                );
            }
        }

        // 5. Validate Model Registration & Availability
        let catalog_model = match self.provider_registry.get_model(&provider_id_typed, &mod_id) {
            Some(m) => m,
            None => {
                return ExecutionPreflight::reject(
                    PreflightReasonCode::ModelUnavailable,
                    CandidateRejectionReason::ModelNotFound {
                        provider_id: prov_id,
                        model_id: mod_id,
                    },
                    None,
                    None,
                );
            }
        };

        if catalog_model.availability == ModelAvailability::Unavailable
            || catalog_model.availability == ModelAvailability::Deprecated
        {
            return ExecutionPreflight::reject(
                PreflightReasonCode::ModelUnavailable,
                CandidateRejectionReason::PolicyRejected(format!(
                    "Model '{}' under provider '{}' is marked {:?}",
                    mod_id, prov_id, catalog_model.availability
                )),
                None,
                None,
            );
        }

        // 6. Capability Check against Task Requirements
        if let Some(analysis) = task_analysis {
            for req in &analysis.capabilities {
                if req.strength == RequirementStrength::Required {
                    if let Some(needed_cap) = map_task_to_provider_capability(&req.capability) {
                        if !catalog_model.capabilities.supports(needed_cap) {
                            return ExecutionPreflight::reject(
                                PreflightReasonCode::CapabilityMismatch,
                                CandidateRejectionReason::MissingRequiredCapability {
                                    capability: format!("{:?}", req.capability),
                                },
                                None,
                                None,
                            );
                        }
                    }
                }
            }
        }

        // 7. Context & Output Limits Check
        let context_result = ContextChecker::check_context(
            &catalog_model,
            history,
            prompt,
            system_instruction,
            requested_output_tokens,
        );

        if context_result.status == ContextStatus::ExceedsLimit {
            let (code, rej) = if context_result.requested_output_tokens > context_result.max_output_tokens_limit {
                (
                    PreflightReasonCode::OutputLimitExceeded,
                    CandidateRejectionReason::OutputLimitExceeded {
                        requested: context_result.requested_output_tokens,
                        limit: context_result.max_output_tokens_limit,
                    },
                )
            } else {
                (
                    PreflightReasonCode::ContextExceeded,
                    CandidateRejectionReason::ContextLengthExceeded {
                        requested: context_result.total_required_tokens,
                        limit: context_result.context_window_limit,
                    },
                )
            };
            return ExecutionPreflight::reject(code, rej, Some(context_result), None);
        }

        // 8. Cost Estimation & Local Budget / Provider Quota Check
        let estimated_cost = Self::estimate_candidate_cost(
            &catalog_model,
            context_result.input_tokens,
            context_result.requested_output_tokens,
        );

        if let Err(rejection) = self.budget_guard.check_quota_and_budget(
            &prov_id,
            Some(&mod_id),
            estimated_cost,
            Some(&cred_status),
        ) {
            let code = match &rejection {
                CandidateRejectionReason::LocalBudgetExceeded { .. } => {
                    PreflightReasonCode::LocalBudgetExceeded
                }
                CandidateRejectionReason::ProviderQuotaExhausted { .. } => {
                    PreflightReasonCode::ProviderQuotaExhausted
                }
                _ => PreflightReasonCode::ProviderUnavailable,
            };
            return ExecutionPreflight::reject(code, rejection, Some(context_result), estimated_cost);
        }

        // All checks passed cleanly
        ExecutionPreflight::pass(Some(context_result), estimated_cost)
    }
}

/// Helper mapping task capability requirements to provider capability flags.
fn map_task_to_provider_capability(task_cap: &TaskCapabilityRequirement) -> Option<ProviderCapability> {
    match task_cap {
        TaskCapabilityRequirement::CodeGeneration
        | TaskCapabilityRequirement::CodeUnderstanding => Some(ProviderCapability::CodeGeneration),

        TaskCapabilityRequirement::DeepReasoning
        | TaskCapabilityRequirement::MathematicalReasoning => Some(ProviderCapability::Reasoning),

        TaskCapabilityRequirement::StructuredOutput => Some(ProviderCapability::StructuredOutput),

        TaskCapabilityRequirement::ImageInput => Some(ProviderCapability::ImageInput),

        TaskCapabilityRequirement::AudioInput => Some(ProviderCapability::AudioInput),

        TaskCapabilityRequirement::ToolCalling => Some(ProviderCapability::ToolCalling),

        TaskCapabilityRequirement::LongContext
        | TaskCapabilityRequirement::LargeDocumentIngestion => Some(ProviderCapability::LargeContext),

        _ => None,
    }
}

