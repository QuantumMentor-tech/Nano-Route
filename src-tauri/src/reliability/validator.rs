// ============================================================================
// Nano Route - Fallback Candidate Validator
// File: src-tauri/src/reliability/validator.rs
// ============================================================================
// Authoritative pre-dispatch validation verifying runtime eligibility,
// DPAPI credential availability, catalog registration, context headroom,
// local budget headroom, provider quota, and task capability satisfaction.
// ============================================================================

use std::collections::HashSet;
use std::sync::Arc;

use crate::analysis::types::{RequirementStrength, TaskAnalysisResult, TaskCapabilityRequirement};
use crate::providers::capabilities::ProviderCapability;
use crate::providers::identity::ProviderId;
use crate::providers::models::ModelAvailability;
use crate::providers::registry::ProviderRegistry;
use crate::reliability::preflight::PreflightCoordinator;
use crate::reliability::quota::BudgetGuard;
use crate::reliability::types::CandidateRejectionReason;
use crate::routing::policy::types::FallbackCandidate;
use crate::services::credentials::CredentialVaultService;

/// Validates runtime eligibility of fallback candidates before dispatch.
pub struct CandidateValidator {
    provider_registry: Arc<ProviderRegistry>,
    credential_vault: Arc<CredentialVaultService>,
    budget_guard: Option<Arc<BudgetGuard>>,
}

impl CandidateValidator {
    /// Creates a new CandidateValidator backed by provider registry and DPAPI vault.
    pub fn new(
        provider_registry: Arc<ProviderRegistry>,
        credential_vault: Arc<CredentialVaultService>,
    ) -> Self {
        Self {
            provider_registry,
            credential_vault,
            budget_guard: None,
        }
    }

    /// Creates a new CandidateValidator with an active BudgetGuard.
    pub fn with_budget_guard(
        provider_registry: Arc<ProviderRegistry>,
        credential_vault: Arc<CredentialVaultService>,
        budget_guard: Arc<BudgetGuard>,
    ) -> Self {
        Self {
            provider_registry,
            credential_vault,
            budget_guard: Some(budget_guard),
        }
    }

    /// Validates an authoritative FallbackCandidate at runtime immediately before attempt.
    pub fn validate_candidate(
        &self,
        candidate: &FallbackCandidate,
        attempted_candidates: &HashSet<(String, String)>,
        task_analysis: Option<&TaskAnalysisResult>,
        estimated_tokens: Option<u64>,
    ) -> Result<(), CandidateRejectionReason> {
        let prov_id = candidate.provider_id.trim().to_lowercase();
        let model_id = candidate.model_id.trim();

        // 1. Guard against duplicate execution in this logical request
        if attempted_candidates.contains(&(prov_id.clone(), model_id.to_string())) {
            return Err(CandidateRejectionReason::AlreadyAttempted {
                provider_id: prov_id,
                model_id: model_id.to_string(),
            });
        }

        // 2. Validate Provider Registration
        let provider_id_typed = ProviderId::new(&prov_id).map_err(|_| {
            CandidateRejectionReason::ProviderNotFound {
                provider_id: prov_id.clone(),
            }
        })?;

        // 3. Validate Provider Credentials & Active Status in Vault
        let cred_status = self
            .credential_vault
            .get_credential_status(&prov_id)
            .map_err(|e| CandidateRejectionReason::PolicyRejected(e.to_string()))?;

        let status = match cred_status {
            Some(ref s) if s.is_configured && s.is_active => s,
            Some(ref s) if !s.is_active => {
                return Err(CandidateRejectionReason::ProviderDisabled {
                    provider_id: prov_id,
                });
            }
            _ => {
                return Err(CandidateRejectionReason::CredentialMissing {
                    provider_id: prov_id,
                });
            }
        };

        // 4. Validate Endpoint Configuration
        if let Some(ref base_url) = status.base_url {
            if let Err(reason) = PreflightCoordinator::validate_endpoint_url(base_url) {
                return Err(CandidateRejectionReason::EndpointMisconfigured {
                    provider_id: prov_id,
                    reason,
                });
            }
        }

        // 5. Validate Model in Provider Catalog
        let catalog_model = self
            .provider_registry
            .get_model(&provider_id_typed, model_id)
            .ok_or_else(|| CandidateRejectionReason::ModelNotFound {
                provider_id: prov_id.clone(),
                model_id: model_id.to_string(),
            })?;

        // 6. Ensure model is available (not deprecated or offline)
        if catalog_model.availability == ModelAvailability::Unavailable
            || catalog_model.availability == ModelAvailability::Deprecated
        {
            return Err(CandidateRejectionReason::PolicyRejected(format!(
                "Model '{}' under provider '{}' is marked {:?}",
                model_id, prov_id, catalog_model.availability
            )));
        }

        // 7. Context Window Capacity Check
        if let Some(tokens) = estimated_tokens {
            if (catalog_model.context_window as u64) < tokens {
                return Err(CandidateRejectionReason::ContextLengthExceeded {
                    requested: tokens,
                    limit: catalog_model.context_window as u64,
                });
            }
        }

        // 8. Task Capabilities Check
        if let Some(analysis) = task_analysis {
            for req in &analysis.capabilities {
                if req.strength == RequirementStrength::Required {
                    if let Some(needed_cap) = map_task_to_provider_capability(&req.capability) {
                        if !catalog_model.capabilities.supports(needed_cap) {
                            return Err(CandidateRejectionReason::MissingRequiredCapability {
                                capability: format!("{:?}", req.capability),
                            });
                        }
                    }
                }
            }
        }

        // 9. Budget and Quota Evaluation
        if let Some(ref guard) = self.budget_guard {
            let estimated_cost = estimated_tokens.and_then(|tokens| {
                PreflightCoordinator::estimate_candidate_cost(&catalog_model, tokens, 1024)
            });
            guard.check_quota_and_budget(&prov_id, Some(model_id), estimated_cost, Some(status))?;
        }

        Ok(())
    }
}

/// Maps task requirement capability to provider capability specification.
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
