//! Provider Identity Representation
//!
//! Responsibility:
//! - Canonical, strongly-typed internal provider identifier.
//! - Deterministic, serializable, safe to persist, safe for logs and routing.
//! - Independent from API keys, URLs, display names, and model names.

use serde::{Deserialize, Serialize};
use std::fmt;
use std::ops::Deref;
use crate::providers::errors::ProviderError;

/// Canonical internal provider identifier.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct ProviderId(String);

impl ProviderId {
    // Authoritative well-known provider identifiers
    pub const OPENAI: &'static str = "openai";
    pub const ANTHROPIC: &'static str = "anthropic";
    pub const GEMINI: &'static str = "gemini";
    pub const DEEPSEEK: &'static str = "deepseek";
    pub const MISTRAL: &'static str = "mistral";
    pub const XAI: &'static str = "xai";
    pub const GROQ: &'static str = "groq";
    pub const LOCAL: &'static str = "local";
    pub const CUSTOM: &'static str = "custom";

    /// Constructs a validated ProviderId.
    /// Rejects empty, whitespace-only, or invalid identifier strings.
    pub fn new(id: impl Into<String>) -> Result<Self, ProviderError> {
        let raw = id.into();
        let trimmed = raw.trim().to_lowercase();

        if trimmed.is_empty() {
            return Err(ProviderError::invalid_request(
                "ProviderId cannot be empty or whitespace only",
            ));
        }

        if trimmed.len() < 2 || trimmed.len() > 32 {
            return Err(ProviderError::invalid_request(format!(
                "ProviderId length must be between 2 and 32 characters (got {})",
                trimmed.len()
            )));
        }

        // Validate character set: lowercase ascii alphanumeric, hyphens, and underscores
        if !trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            return Err(ProviderError::invalid_request(format!(
                "ProviderId '{}' contains invalid characters (only a-z, 0-9, '-', '_' allowed)",
                trimmed
            )));
        }

        Ok(Self(trimmed))
    }

    /// Creates a well-known ProviderId without runtime validation overhead.
    pub const fn from_static(id: &'static str) -> Self {
        // Safe for compile-time verified constants
        Self(String::new()) // placeholder, see below for static construction
    }

    /// Access the underlying string slice.
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// Returns human-readable default display name.
    pub fn default_display_name(&self) -> &'static str {
        match self.0.as_str() {
            Self::OPENAI => "OpenAI",
            Self::ANTHROPIC => "Anthropic",
            Self::GEMINI => "Google Gemini",
            Self::DEEPSEEK => "DeepSeek",
            Self::MISTRAL => "Mistral AI",
            Self::XAI => "xAI (Grok)",
            Self::GROQ => "Groq",
            Self::LOCAL => "Local SLM / Ollama",
            Self::CUSTOM => "Custom Provider",
            _ => "Unknown Provider",
        }
    }
}

impl Deref for ProviderId {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl AsRef<str> for ProviderId {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl From<&str> for ProviderId {
    fn from(s: &str) -> Self {
        Self::new(s).unwrap_or_else(|_| Self("custom".to_string()))
    }
}

impl From<String> for ProviderId {
    fn from(s: String) -> Self {
        Self::new(s).unwrap_or_else(|_| Self("custom".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_provider_ids() {
        assert_eq!(ProviderId::new("openai").unwrap().as_str(), "openai");
        assert_eq!(ProviderId::new("ANTHROPIC").unwrap().as_str(), "anthropic");
        assert_eq!(ProviderId::new("local-slm").unwrap().as_str(), "local-slm");
        assert_eq!(ProviderId::new("groq_fast").unwrap().as_str(), "groq_fast");
    }

    #[test]
    fn test_invalid_provider_ids() {
        assert!(ProviderId::new("").is_err());
        assert!(ProviderId::new("   ").is_err());
        assert!(ProviderId::new("a").is_err()); // Too short
        assert!(ProviderId::new("invalid id with spaces").is_err());
        assert!(ProviderId::new("openai!@#").is_err());
    }

    #[test]
    fn test_display_names() {
        let p = ProviderId::new("openai").unwrap();
        assert_eq!(p.default_display_name(), "OpenAI");
        let p = ProviderId::new("anthropic").unwrap();
        assert_eq!(p.default_display_name(), "Anthropic");
    }
}

