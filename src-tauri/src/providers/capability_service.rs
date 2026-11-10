// ============================================================================
// Nano Route - Provider & Model Capability Service
// File: src-tauri/src/providers/capability_service.rs
// ============================================================================
// Centralized capability intelligence evaluating static registry capabilities,
// native adapter implementation constraints, model features, and request requirements.
// Strictly decoupled from runtime health, quality ranking, and routing decisions.
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::sync::Arc;

use crate::errors::AppError;
use crate::providers::capabilities::{ProviderCapabilities, ProviderCapability};
use crate::providers::identity::ProviderId;
use crate::providers::registry::ProviderRegistry;

/// Native adapter implementation capability baseline.
/// Reflects what Nano Route's Rust adapters can actually execute today,
/// independent of what remote providers publicly advertise in API docs.
#[derive(Debug, Clone)]
pub struct AdapterCapabilities {
    pub supported_capabilities: ProviderCapabilities,
}

impl AdapterCapabilities {
    /// Baseline capabilities implemented by Nano Route's cloud provider adapters (Steps 22-24).
    pub fn standard_cloud_adapter() -> Self {
        Self {
            supported_capabilities: ProviderCapabilities::from_slice(&[
                ProviderCapability::TextGeneration,
                ProviderCapability::Streaming,
                ProviderCapability::SystemMessages,
            ]),
        }
    }
}

/// Typed requirements demanded by an execution request.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct RequestRequirements {
    pub requires_text: bool,
    pub requires_streaming: bool,
    pub requires_system_messages: bool,
    pub requires_tools: bool,
    pub requires_vision: bool,
    pub requires_audio: bool,
    pub requires_structured_output: bool,
    pub required_context_tokens: Option<u64>,
}

impl RequestRequirements {
    /// Simple text completion requirements.
    pub fn text() -> Self {
        Self {
            requires_text: true,
            requires_streaming: false,
            requires_system_messages: false,
            requires_tools: false,
            requires_vision: false,
            requires_audio: false,
            requires_structured_output: false,
            required_context_tokens: None,
        }
    }

    /// Streaming text chat requirements.
    pub fn streaming_chat() -> Self {
        Self {
            requires_text: true,
            requires_streaming: true,
            requires_system_messages: true,
            requires_tools: false,
            requires_vision: false,
            requires_audio: false,
            requires_structured_output: false,
            required_context_tokens: None,
        }
    }

    /// Converts requirements into a set of discrete capability flags.
    pub fn to_required_capabilities(&self) -> BTreeSet<ProviderCapability> {
        let mut set = BTreeSet::new();
        if self.requires_text {
            set.insert(ProviderCapability::TextGeneration);
        }
        if self.requires_streaming {
            set.insert(ProviderCapability::Streaming);
        }
        if self.requires_system_messages {
            set.insert(ProviderCapability::SystemMessages);
        }
        if self.requires_tools {
            set.insert(ProviderCapability::ToolCalling);
        }
        if self.requires_vision {
            set.insert(ProviderCapability::Vision);
            set.insert(ProviderCapability::ImageInput);
        }
        if self.requires_audio {
            set.insert(ProviderCapability::AudioInput);
        }
        if self.requires_structured_output {
            set.insert(ProviderCapability::StructuredOutput);
        }
        set
    }
}

/// Result of evaluating capabilities for a given request.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CapabilityEvaluationResult {
    pub is_supported: bool,
    pub missing_capabilities: Vec<ProviderCapability>,
    pub context_limit_exceeded: bool,
    pub model_context_window: Option<u64>,
    pub explanation: Option<String>,
}

/// Authoritative Provider & Model Capability Service.
pub struct ProviderCapabilityService {
    registry: Arc<ProviderRegistry>,
}

impl ProviderCapabilityService {
    pub fn new(registry: Arc<ProviderRegistry>) -> Self {
        Self { registry }
    }

    /// Returns static capabilities advertised by the provider descriptor in the registry.
    pub fn get_registry_provider_capabilities(
        &self,
        provider_id: &ProviderId,
    ) -> Result<ProviderCapabilities, AppError> {
        let desc = self
            .registry
            .get_provider(provider_id)
            .ok_or_else(|| AppError::NotFound(format!("Provider '{}' not found", provider_id)))?;
        Ok(desc.capabilities.clone())
    }

    /// Returns static capabilities advertised by a specific model descriptor in the registry.
    pub fn get_registry_model_capabilities(
        &self,
        provider_id: &ProviderId,
        model_id: &str,
    ) -> Result<ProviderCapabilities, AppError> {
        let model = self
            .registry
            .get_model(provider_id, model_id)
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Model '{}' under provider '{}' not found",
                    model_id, provider_id
                ))
            })?;
        Ok(model.capabilities.clone())
    }

    /// Computes the effective capability set:
    /// Effective = RegistryCap ∩ AdapterCap ∩ ModelCap
    pub fn compute_effective_capabilities(
        &self,
        provider_id: &ProviderId,
        model_id: &str,
    ) -> Result<ProviderCapabilities, AppError> {
        let provider_caps = self.get_registry_provider_capabilities(provider_id)?;
        let model_caps = self.get_registry_model_capabilities(provider_id, model_id)?;
        let adapter_caps = AdapterCapabilities::standard_cloud_adapter().supported_capabilities;

        let mut effective = Vec::new();
        for cap in &[
            ProviderCapability::TextGeneration,
            ProviderCapability::Streaming,
            ProviderCapability::Vision,
            ProviderCapability::ToolCalling,
            ProviderCapability::StructuredOutput,
            ProviderCapability::Embeddings,
            ProviderCapability::LargeContext,
            ProviderCapability::Reasoning,
            ProviderCapability::CodeGeneration,
            ProviderCapability::SystemMessages,
            ProviderCapability::FileInput,
            ProviderCapability::ImageInput,
            ProviderCapability::AudioInput,
        ] {
            if provider_caps.supports(*cap)
                && model_caps.supports(*cap)
                && adapter_caps.supports(*cap)
            {
                effective.push(*cap);
            }
        }

        Ok(ProviderCapabilities::from_slice(&effective))
    }

    /// Evaluates whether a proposed provider/model pair can execute the given requirements.
    pub fn evaluate_request_capabilities(
        &self,
        provider_id: &ProviderId,
        model_id: &str,
        requirements: &RequestRequirements,
    ) -> Result<CapabilityEvaluationResult, AppError> {
        let model = self
            .registry
            .get_model(provider_id, model_id)
            .ok_or_else(|| {
                AppError::NotFound(format!(
                    "Model '{}' not found under provider '{}'",
                    model_id, provider_id
                ))
            })?;

        let effective_caps = self.compute_effective_capabilities(provider_id, model_id)?;
        let required_caps = requirements.to_required_capabilities();

        let mut missing = Vec::new();
        for req_cap in required_caps {
            if !effective_caps.supports(req_cap) {
                missing.push(req_cap);
            }
        }

        // Context window validation
        let mut context_exceeded = false;
        if let Some(req_tokens) = requirements.required_context_tokens {
            if req_tokens > model.context_window {
                context_exceeded = true;
            }
        }

        if missing.is_empty() && !context_exceeded {
            Ok(CapabilityEvaluationResult {
                is_supported: true,
                missing_capabilities: Vec::new(),
                context_limit_exceeded: false,
                model_context_window: Some(model.context_window),
                explanation: None,
            })
        } else {
            let mut reasons = Vec::new();
            if !missing.is_empty() {
                reasons.push(format!(
                    "Missing capabilities: {:?}",
                    missing.iter().map(|c| format!("{:?}", c)).collect::<Vec<_>>()
                ));
            }
            if context_exceeded {
                reasons.push(format!(
                    "Context length exceeded (requested: {:?}, model limit: {})",
                    requirements.required_context_tokens, model.context_window
                ));
            }

            Ok(CapabilityEvaluationResult {
                is_supported: false,
                missing_capabilities: missing,
                context_limit_exceeded: context_exceeded,
                model_context_window: Some(model.context_window),
                explanation: Some(reasons.join("; ")),
            })
        }
    }
}

