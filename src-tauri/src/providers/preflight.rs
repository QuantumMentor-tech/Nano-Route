// ============================================================================
// Nano Route - Provider & Model Request Preflight Evaluator
// File: src-tauri/src/providers/preflight.rs
// ============================================================================
// Evaluates configuration, credentials, model lifecycle, capabilities, and runtime
// state before a request is dispatched over the network.
// Strictly returns Allowed or Blocked(reason); NEVER chooses another provider.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::providers::capability_service::{ProviderCapabilityService, RequestRequirements};
use crate::providers::health_manager::{current_time_ms, ProviderHealthManager};
use crate::providers::health_types::RuntimeHealthState;
use crate::providers::identity::ProviderId;
use crate::providers::models::ModelAvailability;
use crate::providers::registry::ProviderRegistry;

/// Reason why a request was blocked during local preflight check.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PreflightBlockReason {
    ProviderNotFound,
    AdapterNotImplemented,
    ProviderDisabled,
    CredentialMissing,
    EndpointMisconfigured,
    ModelNotFound,
    ModelRetiredOrUnavailable,
    CapabilityUnsupported { missing: Vec<String> },
    ContextLengthExceeded { requested: u64, limit: u64 },
    AuthenticationFailed,
    RateLimited { retry_after_at_ms: Option<u64> },
    ProviderUnavailable,
    ModelRuntimeUnavailable,
}

/// Typed result of a preflight evaluation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreflightEvaluation {
    pub allowed: bool,
    pub block_reason: Option<PreflightBlockReason>,
    pub message: String,
    pub evaluated_at_ms: u64,
}

impl PreflightEvaluation {
    /// Creates an Allowed preflight decision.
    pub fn allowed(now_ms: u64) -> Self {
        Self {
            allowed: true,
            block_reason: None,
            message: "Request permitted by preflight validation".to_string(),
            evaluated_at_ms: now_ms,
        }
    }

    /// Creates a Blocked preflight decision with a typed reason.
    pub fn blocked(reason: PreflightBlockReason, message: impl Into<String>, now_ms: u64) -> Self {
        Self {
            allowed: false,
            block_reason: Some(reason),
            message: message.into(),
            evaluated_at_ms: now_ms,
        }
    }
}

/// Preflight validation engine.
pub struct PreflightEvaluator {
    registry: Arc<ProviderRegistry>,
    capability_service: Arc<ProviderCapabilityService>,
    health_manager: Arc<ProviderHealthManager>,
}

impl PreflightEvaluator {
    pub fn new(
        registry: Arc<ProviderRegistry>,
        capability_service: Arc<ProviderCapabilityService>,
        health_manager: Arc<ProviderHealthManager>,
    ) -> Self {
        Self {
            registry,
            capability_service,
            health_manager,
        }
    }

    /// Performs preflight evaluation on a proposed request.
    /// Strictly adheres to the 9-stage evaluation order.
    pub fn evaluate(
        &self,
        provider_id: &ProviderId,
        model_id: &str,
        requirements: &RequestRequirements,
        now_ms: Option<u64>,
    ) -> PreflightEvaluation {
        let now = now_ms.unwrap_or_else(current_time_ms);

        // Stage 1: Provider Exists
        let provider_desc = match self.registry.get_provider(provider_id) {
            Some(d) => d,
            None => {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::ProviderNotFound,
                    format!("Provider '{}' does not exist in registry", provider_id),
                    now,
                );
            }
        };

        // Stage 2: Adapter Available
        if provider_desc.implementation_state != crate::providers::descriptor::ProviderImplementationState::Implemented {
            return PreflightEvaluation::blocked(
                PreflightBlockReason::AdapterNotImplemented,
                format!(
                    "Provider '{}' adapter is currently {:?}",
                    provider_id, provider_desc.implementation_state
                ),
                now,
            );
        }

        // Stage 3-5: Inspect Health Manager Snapshot for Configuration & Credentials
        let health_snapshot = match self.health_manager.get_provider_health(provider_id, now) {
            Some(h) => h,
            None => {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::ProviderNotFound,
                    format!("Provider '{}' health state not initialized", provider_id),
                    now,
                );
            }
        };

        // Stage 3: Provider Enabled
        if !health_snapshot.is_enabled {
            return PreflightEvaluation::blocked(
                PreflightBlockReason::ProviderDisabled,
                format!("Provider '{}' is disabled in user preferences", provider_id),
                now,
            );
        }

        // Stage 4: Credential Available
        if provider_desc.credential_required && !health_snapshot.is_credential_configured {
            return PreflightEvaluation::blocked(
                PreflightBlockReason::CredentialMissing,
                format!("API key for provider '{}' is not configured", provider_id),
                now,
            );
        }

        // Stage 5: Endpoint Valid
        if health_snapshot.state == RuntimeHealthState::EndpointMisconfigured {
            return PreflightEvaluation::blocked(
                PreflightBlockReason::EndpointMisconfigured,
                format!("Endpoint configuration for provider '{}' is invalid", provider_id),
                now,
            );
        }

        // Stage 6: Model Exists in Registry
        let model = match self.registry.get_model(provider_id, model_id) {
            Some(m) => m,
            None => {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::ModelNotFound,
                    format!(
                        "Model '{}' does not exist under provider '{}'",
                        model_id, provider_id
                    ),
                    now,
                );
            }
        };

        // Stage 7: Model Active / Available
        if model.availability == ModelAvailability::Deprecated {
            return PreflightEvaluation::blocked(
                PreflightBlockReason::ModelRetiredOrUnavailable,
                format!("Model '{}' is marked as deprecated", model_id),
                now,
            );
        }

        // Stage 8: Effective Capability Valid
        match self
            .capability_service
            .evaluate_request_capabilities(provider_id, model_id, requirements)
        {
            Ok(cap_result) => {
                if !cap_result.is_supported {
                    if cap_result.context_limit_exceeded {
                        return PreflightEvaluation::blocked(
                            PreflightBlockReason::ContextLengthExceeded {
                                requested: requirements.required_context_tokens.unwrap_or(0),
                                limit: model.context_window,
                            },
                            cap_result.explanation.unwrap_or_default(),
                            now,
                        );
                    } else {
                        return PreflightEvaluation::blocked(
                            PreflightBlockReason::CapabilityUnsupported {
                                missing: cap_result
                                    .missing_capabilities
                                    .iter()
                                    .map(|c| format!("{:?}", c))
                                    .collect(),
                            },
                            cap_result.explanation.unwrap_or_default(),
                            now,
                        );
                    }
                }
            }
            Err(e) => {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::CapabilityUnsupported { missing: vec![] },
                    format!("Failed to evaluate capabilities: {}", e),
                    now,
                );
            }
        }

        // Stage 9: Definite Runtime Blocker Check
        // Check Model Runtime State first
        if let Some(model_health) = self.health_manager.get_model_health(provider_id, model_id, now) {
            if model_health.state == RuntimeHealthState::ModelUnavailable {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::ModelRuntimeUnavailable,
                    format!(
                        "Model '{}' under provider '{}' is observed as unavailable ({:?})",
                        model_id, provider_id, model_health.last_error_category
                    ),
                    now,
                );
            }
        }

        // Check Provider Runtime State
        match health_snapshot.state {
            RuntimeHealthState::AuthenticationFailed => {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::AuthenticationFailed,
                    format!("Provider '{}' authentication failed on recent request", provider_id),
                    now,
                );
            }
            RuntimeHealthState::RateLimited => {
                if !health_snapshot.rate_limit_info.is_cooldown_expired(now) {
                    return PreflightEvaluation::blocked(
                        PreflightBlockReason::RateLimited {
                            retry_after_at_ms: health_snapshot.rate_limit_info.retry_after_at_ms,
                        },
                        format!(
                            "Provider '{}' is rate-limited until {:?}",
                            provider_id, health_snapshot.rate_limit_info.retry_after_at_ms
                        ),
                        now,
                    );
                }
            }
            RuntimeHealthState::ProviderUnavailable => {
                return PreflightEvaluation::blocked(
                    PreflightBlockReason::ProviderUnavailable,
                    format!("Provider '{}' is currently unavailable (5xx/outage)", provider_id),
                    now,
                );
            }
            // Unknown, Degraded, Ready, ReadyPendingVerification, Stale are ALL allowed!
            _ => {}
        }

        PreflightEvaluation::allowed(now)
    }
}

