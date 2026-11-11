// ============================================================================
// Nano Route - Provider Resolver
// File: src-tauri/src/providers/resolver.rs
// ============================================================================
// Resolves strongly-typed `ProviderId` to an active `ProviderClient` instance.
// Integrates with the DPAPI credential vault to supply authenticated clients.
// Supports registering mock/test providers for deterministic offline testing.
// Strictly decoupled from routing heuristics, scoring, and UI presentation.
// ============================================================================

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::providers::client::ProviderClient;
use crate::providers::errors::ProviderError;
use crate::providers::identity::ProviderId;
use crate::providers::openai::OpenAiClient;
use crate::providers::anthropic::AnthropicClient;
use crate::providers::gemini::GeminiClient;
use crate::providers::deepseek::DeepSeekClient;
use crate::providers::groq::GroqClient;
use crate::providers::mistral::MistralClient;
use crate::services::credentials::CredentialVaultService;

/// Central resolver and cache for concrete `ProviderClient` instances.
pub struct ProviderResolver {
    credential_vault: Arc<CredentialVaultService>,
    clients: RwLock<HashMap<String, Arc<dyn ProviderClient + Send + Sync>>>,
}

impl ProviderResolver {
    /// Creates a new ProviderResolver backed by the native DPAPI credential vault.
    pub fn new(credential_vault: Arc<CredentialVaultService>) -> Self {
        Self {
            credential_vault,
            clients: RwLock::new(HashMap::new()),
        }
    }

    /// Accessor for the underlying credential vault service.
    pub fn credential_vault(&self) -> &Arc<CredentialVaultService> {
        &self.credential_vault
    }

    /// Registers a custom or mock `ProviderClient` (useful for testing and deterministic doubles).
    pub fn register_client(
        &self,
        provider_id: impl Into<String>,
        client: Arc<dyn ProviderClient + Send + Sync>,
    ) {
        if let Ok(mut lock) = self.clients.write() {
            lock.insert(provider_id.into().to_lowercase(), client);
        }
    }

    /// Resolves an instantiated, thread-safe `ProviderClient` for the specified provider ID.
    pub fn resolve(
        &self,
        provider_id_str: &str,
    ) -> Result<Arc<dyn ProviderClient + Send + Sync>, ProviderError> {
        let normalized = provider_id_str.trim().to_lowercase();

        // 1. Check existing registered or cached client
        if let Ok(lock) = self.clients.read() {
            if let Some(client) = lock.get(&normalized) {
                return Ok(client.clone());
            }
        }

        // 2. Instantiate on-demand based on canonical ProviderId
        let client: Arc<dyn ProviderClient + Send + Sync> = match normalized.as_str() {
            ProviderId::OPENAI => {
                Arc::new(OpenAiClient::new(self.credential_vault.clone()))
            }
            ProviderId::ANTHROPIC => {
                Arc::new(AnthropicClient::new(self.credential_vault.clone()))
            }
            ProviderId::GEMINI => {
                Arc::new(GeminiClient::new(self.credential_vault.clone()))
            }
            ProviderId::DEEPSEEK => {
                Arc::new(DeepSeekClient::new(self.credential_vault.clone()))
            }
            ProviderId::GROQ => {
                Arc::new(GroqClient::new(self.credential_vault.clone()))
            }
            ProviderId::MISTRAL => {
                Arc::new(MistralClient::new(self.credential_vault.clone()))
            }
            other => {
                return Err(ProviderError::invalid_request(format!(
                    "Provider '{}' is not supported by the provider execution resolver",
                    other
                )));
            }
        };

        // 3. Cache for subsequent requests
        if let Ok(mut lock) = self.clients.write() {
            lock.insert(normalized, client.clone());
        }

        Ok(client)
    }
}

