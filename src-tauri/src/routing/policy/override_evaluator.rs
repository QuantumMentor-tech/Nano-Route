// ============================================================================
// Nano Route - Manual Route Override Evaluator
// File: src-tauri/src/routing/policy/override_evaluator.rs
// ============================================================================
// Authoritative validator for explicit user provider/model route overrides.
// Enforces that manual overrides cannot bypass fundamental execution safety,
// required task modalities, context window limits, or provider health readiness.
// ============================================================================

use std::sync::Arc;

use crate::analysis::types::{RequirementStrength, TaskAnalysisResult, TaskCapabilityRequirement};
use crate::providers::capabilities::ProviderCapability;
use crate::providers::capability_service::{ProviderCapabilityService, RequestRequirements};
use crate::providers::descriptor::ProviderImplementationState;
use crate::providers::identity::ProviderId;
use crate::providers::models::{ModelAvailability, ProviderModel};
use crate::providers::preflight::PreflightEvaluator;
use crate::providers::registry::ProviderRegistry;
use crate::routing::policy::types::{
    ManualRouteOverride, OverrideRejectionReason, OverrideValidationResult,
};
use crate::services::provider_preferences::ProviderPreferencesService;

pub struct ManualOverrideEvaluator {
    registry: Arc<ProviderRegistry>,
    capability_service: Arc<ProviderCapabilityService>,
    preflight_evaluator: Arc<PreflightEvaluator>,
    provider_preferences: Arc<ProviderPreferencesService>,
}

impl ManualOverrideEvaluator {
    pub fn new(
        registry: Arc<ProviderRegistry>,
        capability_service: Arc<ProviderCapabilityService>,
        preflight_evaluator: Arc<PreflightEvaluator>,
        provider_preferences: Arc<ProviderPreferencesService>,
    ) -> Self {
        Self {
            registry,
            capability_service,
            preflight_evaluator,
            provider_preferences,
        }
    }

    /// Evaluates an explicit manual override against authoritative registry, capability, and health state.
    pub fn validate(
        &self,
        manual_override: &ManualRouteOverride,
        task_analysis: Option<&TaskAnalysisResult>,
        estimated_input_tokens: Option<u64>,
        estimated_output_tokens: Option<u64>,
    ) -> OverrideValidationResult {
        // 1. Validate Identifier Strings
        let provider_id_str = manual_override.provider_id.trim();
        let model_id_str = manual_override.model_id.trim();

        if provider_id_str.is_empty() || model_id_str.is_empty() {
            return OverrideValidationResult::invalid(OverrideRejectionReason::MalformedRequest {
                message: "Provider ID and Model ID must not be blank".to_string(),
            });
        }

        let canonical_provider_id = match ProviderId::new(provider_id_str) {
            Ok(id) => id,
            Err(_) => {
                return OverrideValidationResult::invalid(
                    OverrideRejectionReason::ProviderNotFound {
                        provider_id: provider_id_str.to_string(),
                    },
                );
            }
        };

        // 2. Validate Provider in Registry
        let provider = match self.registry.get_provider(&canonical_provider_id) {
            Some(p) => p,
            None => {
                return OverrideValidationResult::invalid(
                    OverrideRejectionReason::ProviderNotFound {
                        provider_id: provider_id_str.to_string(),
                    },
                );
            }
        };

        if provider.implementation_state != ProviderImplementationState::Implemented {
            return OverrideValidationResult::invalid(OverrideRejectionReason::MalformedRequest {
                message: format!(
                    "Native runtime adapter for provider '{}' is not implemented",
                    provider_id_str
                ),
            });
        }

        // 3. Validate Model in Catalog
        let model = match self.registry.get_model(&canonical_provider_id, model_id_str) {
            Some(m) => m,
            None => {
                return OverrideValidationResult::invalid(OverrideRejectionReason::ModelNotFound {
                    model_id: model_id_str.to_string(),
                });
            }
        };

        // 4. Validate Provider/Model Pairing
        if model.provider_id != canonical_provider_id {
            return OverrideValidationResult::invalid(
                OverrideRejectionReason::ModelProviderMismatch {
                    provider_id: provider_id_str.to_string(),
                    model_id: model_id_str.to_string(),
                },
            );
        }

        // 5. Validate Model Lifecycle State
        match model.availability {
            ModelAvailability::Available | ModelAvailability::Preview => {}
            ModelAvailability::Deprecated | ModelAvailability::Unavailable => {
                return OverrideValidationResult::invalid(
                    OverrideRejectionReason::ModelUnavailable {
                        model_id: model_id_str.to_string(),
                    },
                );
            }
        }

        // 6. Validate Provider Activation State
        if let Ok(Some(status)) = self
            .provider_preferences
            .get_provider_configuration(provider.id.as_str())
        {
            if !status.is_active {
                return OverrideValidationResult::invalid(
                    OverrideRejectionReason::ProviderDisabled {
                        provider_id: provider_id_str.to_string(),
                    },
                );
            }
        }

        // 7. Validate Context Window Limits
        let total_requested =
            estimated_input_tokens.unwrap_or(0) + estimated_output_tokens.unwrap_or(0);
        if total_requested > 0 && total_requested > model.context_window as u64 {
            return OverrideValidationResult::invalid(
                OverrideRejectionReason::ContextLengthExceeded {
                    requested: total_requested,
                    limit: model.context_window as u64,
                },
            );
        }

        // 8. Validate Required Task Capabilities (Safety invariant)
        if let Some(analysis) = task_analysis {
            for req in &analysis.capabilities {
                if req.strength == RequirementStrength::Required {
                    if !self.candidate_satisfies_requirement(&model, req.capability) {
                        return OverrideValidationResult::invalid(
                            OverrideRejectionReason::MissingRequiredCapability {
                                capability: req.capability.as_str().to_string(),
                            },
                        );
                    }
                }
            }
        }

        // 9. Full Preflight Check
        let req_requirements = RequestRequirements {
            requires_text: true,
            requires_streaming: false,
            requires_system_messages: false,
            requires_tools: task_analysis
                .map(|a| {
                    a.capabilities.iter().any(|c| {
                        c.capability == TaskCapabilityRequirement::ToolCalling
                            && c.strength == RequirementStrength::Required
                    })
                })
                .unwrap_or(false),
            requires_vision: task_analysis
                .map(|a| {
                    a.capabilities.iter().any(|c| {
                        c.capability == TaskCapabilityRequirement::ImageInput
                            && c.strength == RequirementStrength::Required
                    })
                })
                .unwrap_or(false),
            requires_audio: task_analysis
                .map(|a| {
                    a.capabilities.iter().any(|c| {
                        c.capability == TaskCapabilityRequirement::AudioInput
                            && c.strength == RequirementStrength::Required
                    })
                })
                .unwrap_or(false),
            requires_structured_output: task_analysis
                .map(|a| {
                    a.capabilities.iter().any(|c| {
                        c.capability == TaskCapabilityRequirement::StructuredOutput
                            && c.strength == RequirementStrength::Required
                    })
                })
                .unwrap_or(false),
            required_context_tokens: if total_requested > 0 {
                Some(total_requested)
            } else {
                None
            },
        };

        let preflight = self.preflight_evaluator.evaluate(
            &canonical_provider_id,
            &model.model_id,
            &req_requirements,
            None,
        );

        if !preflight.allowed {
            return OverrideValidationResult::invalid(
                OverrideRejectionReason::HealthCheckBlocked {
                    message: preflight.message,
                },
            );
        }

        OverrideValidationResult::valid(format!(
            "Manual route override for '{}/{}' accepted and validated",
            provider_id_str, model_id_str
        ))
    }

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
                model.capabilities.supports(ProviderCapability::TextGeneration)
            }
        }
    }
}

