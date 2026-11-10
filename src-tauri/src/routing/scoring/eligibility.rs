// ============================================================================
// Nano Route - Candidate Eligibility Evaluator
// File: src-tauri/src/routing/scoring/eligibility.rs
// ============================================================================
// Evaluates strict hard eligibility constraints for provider/model candidates.
// Decoupled from soft scoring: ineligible candidates can NEVER be revived by
// high preference weights or favorable soft scores.
// ============================================================================

use std::sync::Arc;

use crate::analysis::types::{RequirementStrength, TaskAnalysisResult, TaskCapabilityRequirement};
use crate::providers::capabilities::ProviderCapability;
use crate::providers::capability_service::{ProviderCapabilityService, RequestRequirements};
use crate::providers::descriptor::{ProviderDescriptor, ProviderImplementationState};
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ProviderModel};
use crate::providers::preflight::{PreflightBlockReason, PreflightEvaluator};
use crate::routing::scoring::types::{CandidateEligibility, IneligibilityReason};
use crate::services::provider_preferences::ProviderPreferencesService;

pub struct EligibilityEvaluator {
    capability_service: Arc<ProviderCapabilityService>,
    preflight_evaluator: Arc<PreflightEvaluator>,
    provider_preferences: Arc<ProviderPreferencesService>,
}

impl EligibilityEvaluator {
    pub fn new(
        capability_service: Arc<ProviderCapabilityService>,
        preflight_evaluator: Arc<PreflightEvaluator>,
        provider_preferences: Arc<ProviderPreferencesService>,
    ) -> Self {
        Self {
            capability_service,
            preflight_evaluator,
            provider_preferences,
        }
    }

    /// Evaluates all hard eligibility constraints for a candidate model.
    pub fn evaluate(
        &self,
        provider: &ProviderDescriptor,
        model: &ProviderModel,
        analysis: &TaskAnalysisResult,
        estimated_input_tokens: Option<u64>,
        estimated_output_tokens: Option<u64>,
        required_capabilities_override: Option<&[String]>,
    ) -> CandidateEligibility {
        let mut reasons = Vec::new();

        // 1. Adapter Implementation State Check
        if provider.implementation_state != ProviderImplementationState::Implemented {
            reasons.push(IneligibilityReason::AdapterNotImplemented {
                provider_id: provider.id.as_str().to_string(),
            });
        }

        // 2. Model Lifecycle Check
        match model.availability {
            ModelAvailability::Available | ModelAvailability::Preview => {}
            ModelAvailability::Deprecated | ModelAvailability::Unavailable => {
                reasons.push(IneligibilityReason::ModelRetiredOrUnavailable {
                    model_id: model.model_id.clone(),
                });
            }
        }

        // 3. User Activation Status Check
        if let Ok(Some(status)) = self
            .provider_preferences
            .get_provider_configuration(provider.id.as_str())
        {
            if !status.is_active {
                reasons.push(IneligibilityReason::ProviderDisabled {
                    provider_id: provider.id.as_str().to_string(),
                });
            }
        }

        // 4. Context Window vs Estimated Tokens
        let total_tokens_requested =
            estimated_input_tokens.unwrap_or(0) + estimated_output_tokens.unwrap_or(0);
        if total_tokens_requested > 0 && total_tokens_requested > model.context_window as u64 {
            reasons.push(IneligibilityReason::ContextLengthExceeded {
                requested: total_tokens_requested,
                limit: model.context_window as u64,
            });
        }

        // 5. Hard Task Capability Requirements (from Step 28 Task Analysis)
        for req in &analysis.capabilities {
            if req.strength == RequirementStrength::Required {
                if !self.candidate_satisfies_requirement(model, req.capability) {
                    reasons.push(IneligibilityReason::MissingRequiredCapability {
                        capability: req.capability.as_str().to_string(),
                    });
                }
            }
        }

        // 6. Explicit Capability Overrides from Request (if specified)
        if let Some(overrides) = required_capabilities_override {
            for cap_str in overrides {
                if let Some(req_cap) = TaskCapabilityRequirement::from_canonical(cap_str) {
                    if !self.candidate_satisfies_requirement(model, req_cap) {
                        reasons.push(IneligibilityReason::MissingRequiredCapability {
                            capability: cap_str.clone(),
                        });
                    }
                }
            }
        }

        // 7. Full Preflight Check (Credentials, Runtime Health, Rate Limits)
        let req_requirements = RequestRequirements {
            requires_text: true,
            requires_streaming: false,
            requires_system_messages: false,
            requires_tools: analysis.capabilities.iter().any(|c| {
                c.capability == TaskCapabilityRequirement::ToolCalling
                    && c.strength == RequirementStrength::Required
            }),
            requires_vision: analysis.capabilities.iter().any(|c| {
                c.capability == TaskCapabilityRequirement::ImageInput
                    && c.strength == RequirementStrength::Required
            }),
            requires_audio: analysis.capabilities.iter().any(|c| {
                c.capability == TaskCapabilityRequirement::AudioInput
                    && c.strength == RequirementStrength::Required
            }),
            requires_structured_output: analysis.capabilities.iter().any(|c| {
                c.capability == TaskCapabilityRequirement::StructuredOutput
                    && c.strength == RequirementStrength::Required
            }),
            required_context_tokens: if total_tokens_requested > 0 {
                Some(total_tokens_requested)
            } else {
                None
            },
        };

        let preflight = self.preflight_evaluator.evaluate(
            &provider.id,
            &model.model_id,
            &req_requirements,
            None,
        );

        if !preflight.allowed {
            if let Some(block_reason) = preflight.block_reason {
                let mapped = match block_reason {
                    PreflightBlockReason::ProviderNotFound => {
                        IneligibilityReason::ProviderNotFound {
                            provider_id: provider.id.as_str().to_string(),
                        }
                    }
                    PreflightBlockReason::AdapterNotImplemented => {
                        IneligibilityReason::AdapterNotImplemented {
                            provider_id: provider.id.as_str().to_string(),
                        }
                    }
                    PreflightBlockReason::ProviderDisabled => {
                        IneligibilityReason::ProviderDisabled {
                            provider_id: provider.id.as_str().to_string(),
                        }
                    }
                    PreflightBlockReason::CredentialMissing => {
                        IneligibilityReason::CredentialMissing {
                            provider_id: provider.id.as_str().to_string(),
                        }
                    }
                    PreflightBlockReason::EndpointMisconfigured => {
                        IneligibilityReason::EndpointMisconfigured {
                            message: preflight.message,
                        }
                    }
                    PreflightBlockReason::ModelNotFound => IneligibilityReason::ModelNotFound {
                        model_id: model.model_id.clone(),
                    },
                    PreflightBlockReason::ModelRetiredOrUnavailable => {
                        IneligibilityReason::ModelRetiredOrUnavailable {
                            model_id: model.model_id.clone(),
                        }
                    }
                    PreflightBlockReason::CapabilityUnsupported { missing } => {
                        IneligibilityReason::MissingRequiredCapability {
                            capability: missing.join(", "),
                        }
                    }
                    PreflightBlockReason::ContextLengthExceeded { requested, limit } => {
                        IneligibilityReason::ContextLengthExceeded { requested, limit }
                    }
                    PreflightBlockReason::AuthenticationFailed => {
                        IneligibilityReason::AuthenticationFailed {
                            provider_id: provider.id.as_str().to_string(),
                        }
                    }
                    PreflightBlockReason::RateLimited { retry_after_at_ms } => {
                        IneligibilityReason::RateLimited {
                            provider_id: provider.id.as_str().to_string(),
                            retry_after_ms: retry_after_at_ms,
                        }
                    }
                    PreflightBlockReason::ProviderUnavailable => {
                        IneligibilityReason::ProviderUnavailable {
                            provider_id: provider.id.as_str().to_string(),
                        }
                    }
                    PreflightBlockReason::ModelRuntimeUnavailable => {
                        IneligibilityReason::ModelRuntimeUnavailable {
                            model_id: model.model_id.clone(),
                        }
                    }
                };

                // Avoid duplicate reasons
                if !reasons.contains(&mapped) {
                    reasons.push(mapped);
                }
            } else {
                reasons.push(IneligibilityReason::PreflightBlocked {
                    reason: preflight.message,
                });
            }
        }

        if reasons.is_empty() {
            CandidateEligibility::eligible()
        } else {
            CandidateEligibility::ineligible(reasons)
        }
    }

    /// Checks if a model's factual capabilities or attributes satisfy a specific task capability requirement.
    fn candidate_satisfies_requirement(
        &self,
        model: &ProviderModel,
        req: TaskCapabilityRequirement,
    ) -> bool {
        match req {
            TaskCapabilityRequirement::TextGeneration => {
                model.capabilities.supports(ProviderCapability::TextGeneration)
            }
            TaskCapabilityRequirement::LongContext => model.context_window >= 16_000,
            TaskCapabilityRequirement::LargeDocumentIngestion => model.context_window >= 64_000,
            TaskCapabilityRequirement::ImageInput => {
                model.capabilities.supports(ProviderCapability::ImageInput)
                    || model.capabilities.supports(ProviderCapability::Vision)
            }
            TaskCapabilityRequirement::AudioInput => {
                model.capabilities.supports(ProviderCapability::AudioInput)
            }
            TaskCapabilityRequirement::VideoInput => {
                // Video input supported primarily by Gemini models with large context and vision
                model.provider_id.as_str() == ProviderId::GEMINI
                    && model.capabilities.supports(ProviderCapability::Vision)
            }
            TaskCapabilityRequirement::ToolCalling => {
                model.capabilities.supports(ProviderCapability::ToolCalling)
            }
            TaskCapabilityRequirement::StructuredOutput => {
                model.capabilities.supports(ProviderCapability::StructuredOutput)
            }
            TaskCapabilityRequirement::FileHandling => {
                model.capabilities.supports(ProviderCapability::FileInput)
                    || model.context_window >= 32_000
            }
            TaskCapabilityRequirement::CodeGeneration => {
                model.capabilities.supports(ProviderCapability::CodeGeneration)
                    || model.capabilities.supports(ProviderCapability::TextGeneration)
            }
            TaskCapabilityRequirement::CodeUnderstanding => {
                model.capabilities.supports(ProviderCapability::TextGeneration)
            }
            TaskCapabilityRequirement::DeepReasoning => {
                model.capabilities.supports(ProviderCapability::Reasoning)
                    || model.capabilities.supports(ProviderCapability::TextGeneration)
            }
            TaskCapabilityRequirement::MathematicalReasoning
            | TaskCapabilityRequirement::MultiTurnContext
            | TaskCapabilityRequirement::DocumentAnalysis
            | TaskCapabilityRequirement::WebRetrieval
            | TaskCapabilityRequirement::CitationSupport
            | TaskCapabilityRequirement::SearchGrounding
            | TaskCapabilityRequirement::Translation
            | TaskCapabilityRequirement::Summarization => {
                // High-level cognitive capabilities handled via text generation + prompt instruction
                model.capabilities.supports(ProviderCapability::TextGeneration)
            }
        }
    }
}

