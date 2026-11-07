//! Provider Capability System
//!
//! Responsibility:
//! - Explicit enumeration and querying of provider and model capabilities.
//! - Strongly-typed query API answering YES, NO, or UNKNOWN.
//! - Strictly provider-agnostic without embedding routing or scoring rules.

use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

/// Discrete capability supported by an AI model or external provider.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderCapability {
    /// Standard chat and prompt text generation.
    TextGeneration,
    /// Low-latency token-by-token streaming.
    Streaming,
    /// Image and visual understanding.
    Vision,
    /// Function calling and external tool definitions.
    ToolCalling,
    /// JSON schema or typed structured outputs.
    StructuredOutput,
    /// Vector and semantic text embeddings.
    Embeddings,
    /// Context windows exceeding 100k tokens.
    LargeContext,
    /// Extended chain-of-thought or reasoning capabilities.
    Reasoning,
    /// Specialized programming and code synthesis.
    CodeGeneration,
    /// Dedicated system-instruction developer role.
    SystemMessages,
    /// Document or file uploads (PDF, text files).
    FileInput,
    /// Image upload and multimodal processing.
    ImageInput,
    /// Audio speech recognition and synthesis.
    AudioInput,
}

/// Set of capabilities supported by a provider or model.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    capabilities: BTreeSet<ProviderCapability>,
}

impl ProviderCapabilities {
    /// Creates an empty capability set.
    pub fn new() -> Self {
        Self {
            capabilities: BTreeSet::new(),
        }
    }

    /// Creates a capability set containing the specified items.
    pub fn from_slice(caps: &[ProviderCapability]) -> Self {
        Self {
            capabilities: caps.iter().copied().collect(),
        }
    }

    /// Adds a capability to the set.
    pub fn with_capability(mut self, cap: ProviderCapability) -> Self {
        self.capabilities.insert(cap);
        self
    }

    /// Checks if a specific capability is supported.
    pub fn supports(&self, cap: ProviderCapability) -> bool {
        self.capabilities.contains(&cap)
    }

    /// Checks if all listed capabilities are supported.
    pub fn supports_all(&self, caps: &[ProviderCapability]) -> bool {
        caps.iter().all(|c| self.supports(*c))
    }

    /// Checks if at least one of the listed capabilities is supported.
    pub fn supports_any(&self, caps: &[ProviderCapability]) -> bool {
        caps.iter().any(|c| self.supports(*c))
    }

    /// Returns the number of enabled capabilities.
    pub fn len(&self) -> usize {
        self.capabilities.len()
    }

    /// Returns true if no capabilities are defined.
    pub fn is_empty(&self) -> bool {
        self.capabilities.is_empty()
    }

    /// Standard preset for modern text-based conversational models.
    pub fn standard_chat() -> Self {
        Self::from_slice(&[
            ProviderCapability::TextGeneration,
            ProviderCapability::Streaming,
            ProviderCapability::SystemMessages,
            ProviderCapability::ToolCalling,
            ProviderCapability::StructuredOutput,
        ])
    }

    /// Preset for multimodal vision models.
    pub fn multimodal_vision() -> Self {
        Self::standard_chat()
            .with_capability(ProviderCapability::Vision)
            .with_capability(ProviderCapability::ImageInput)
    }

    /// Preset for reasoning models (e.g., o1, o3, DeepSeek-R1).
    pub fn reasoning_model() -> Self {
        Self::from_slice(&[
            ProviderCapability::TextGeneration,
            ProviderCapability::Reasoning,
            ProviderCapability::StructuredOutput,
        ])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capability_queries() {
        let caps = ProviderCapabilities::standard_chat();
        assert!(caps.supports(ProviderCapability::TextGeneration));
        assert!(caps.supports(ProviderCapability::Streaming));
        assert!(!caps.supports(ProviderCapability::Vision));

        assert!(caps.supports_all(&[
            ProviderCapability::TextGeneration,
            ProviderCapability::Streaming
        ]));
        assert!(!caps.supports_all(&[
            ProviderCapability::TextGeneration,
            ProviderCapability::Vision
        ]));
    }

    #[test]
    fn test_multimodal_preset() {
        let caps = ProviderCapabilities::multimodal_vision();
        assert!(caps.supports(ProviderCapability::Vision));
        assert!(caps.supports(ProviderCapability::ImageInput));
        assert!(caps.supports(ProviderCapability::Streaming));
    }
}

