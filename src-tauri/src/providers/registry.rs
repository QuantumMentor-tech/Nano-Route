// ============================================================================
// Nano Route - Canonical Provider & Model Registry
// File: src-tauri/src/providers/registry.rs
// ============================================================================
// Authoritative in-memory registry of all AI providers and model descriptors.
// Compile-time verified; thread-safe for concurrent lock-free reads.
// Strictly decoupled from credentials, user preferences, runtime health, and routing.
// ============================================================================

use std::collections::HashMap;
use crate::domain::credentials::ProviderCredentialStatus;
use crate::errors::AppError;
use crate::providers::capabilities::ProviderCapability;
use crate::providers::catalog::builtin_catalog;
use crate::providers::descriptor::{
    EffectiveProviderDescriptor, HistoricalModelReference, ProviderDescriptor,
};
use crate::providers::identity::ProviderId;
use crate::providers::models::ProviderModel;

pub struct ProviderRegistry {
    providers: HashMap<ProviderId, ProviderDescriptor>,
    provider_order: Vec<ProviderId>,
    models: HashMap<(ProviderId, String), ProviderModel>,
    provider_models: HashMap<ProviderId, Vec<String>>,
}

impl ProviderRegistry {
    /// Constructs and validates the built-in catalog registry.
    pub fn builtin() -> Result<Self, AppError> {
        let (providers, models) = builtin_catalog();
        Self::from_descriptors(providers, models)
    }

    /// Constructs the registry from explicit descriptor collections, running full validation.
    pub fn from_descriptors(
        providers: Vec<ProviderDescriptor>,
        models: Vec<ProviderModel>,
    ) -> Result<Self, AppError> {
        let mut provider_map = HashMap::new();
        let mut provider_order = Vec::new();

        for desc in providers {
            if provider_map.contains_key(&desc.provider_id) {
                return Err(AppError::InvalidInput(format!(
                    "Registry validation failure: Duplicate provider ID '{}'",
                    desc.provider_id
                )));
            }
            provider_order.push(desc.provider_id.clone());
            provider_map.insert(desc.provider_id.clone(), desc);
        }

        let mut model_map = HashMap::new();
        let mut provider_models: HashMap<ProviderId, Vec<String>> = HashMap::new();

        for model in models {
            // Validate orphan model
            if !provider_map.contains_key(&model.provider_id) {
                return Err(AppError::InvalidInput(format!(
                    "Registry validation failure: Model '{}' references unregistered provider '{}'",
                    model.model_id, model.provider_id
                )));
            }

            let key = (model.provider_id.clone(), model.model_id.clone());
            if model_map.contains_key(&key) {
                return Err(AppError::InvalidInput(format!(
                    "Registry validation failure: Duplicate model ID '{}' under provider '{}'",
                    model.model_id, model.provider_id
                )));
            }

            provider_models
                .entry(model.provider_id.clone())
                .or_default()
                .push(model.model_id.clone());

            model_map.insert(key, model);
        }

        let registry = Self {
            providers: provider_map,
            provider_order,
            models: model_map,
            provider_models,
        };

        registry.validate()?;
        Ok(registry)
    }

    /// Validates registry invariants (default model references, context sizes, base URLs).
    pub fn validate(&self) -> Result<(), AppError> {
        for (provider_id, desc) in &self.providers {
            // Validate default model reference
            if let Some(ref def_model) = desc.default_model_id {
                let key = (provider_id.clone(), def_model.clone());
                if !self.models.contains_key(&key) {
                    return Err(AppError::InvalidInput(format!(
                        "Registry validation failure: Provider '{}' specifies default model '{}' which does not exist in its catalog",
                        provider_id, def_model
                    )));
                }
            }

            // Validate base URL format
            let url = desc.default_base_url.trim().to_lowercase();
            if !url.starts_with("https://") && !url.starts_with("http://localhost") && !url.starts_with("http://127.0.0.1") {
                return Err(AppError::InvalidInput(format!(
                    "Registry validation failure: Provider '{}' has invalid default base URL '{}'",
                    provider_id, desc.default_base_url
                )));
            }

            if desc.default_base_url.contains('@') {
                return Err(AppError::InvalidInput(format!(
                    "Registry validation failure: Provider '{}' base URL contains embedded credentials",
                    provider_id
                )));
            }
        }

        // Validate model context bounds
        for ((provider_id, model_id), model) in &self.models {
            if model.context_window == 0 {
                return Err(AppError::InvalidInput(format!(
                    "Registry validation failure: Model '{}/{}' declares an invalid context window of 0",
                    provider_id, model_id
                )));
            }
        }

        Ok(())
    }

    /// Retrieves a provider descriptor by strongly-typed ProviderId.
    pub fn get_provider(&self, provider_id: &ProviderId) -> Option<&ProviderDescriptor> {
        self.providers.get(provider_id)
    }

    /// Retrieves a provider descriptor by string ID.
    pub fn get_provider_by_str(&self, id: &str) -> Option<&ProviderDescriptor> {
        let pid = ProviderId::new(id).ok()?;
        self.get_provider(&pid)
    }

    /// Lists all registered providers in deterministic catalog order.
    pub fn list_providers(&self) -> Vec<&ProviderDescriptor> {
        self.provider_order
            .iter()
            .filter_map(|id| self.providers.get(id))
            .collect()
    }

    /// Retrieves a specific model descriptor by provider and model ID.
    pub fn get_model(&self, provider_id: &ProviderId, model_id: &str) -> Option<&ProviderModel> {
        self.models.get(&(provider_id.clone(), model_id.to_string()))
    }

    /// Lists all models registered under a specific provider.
    pub fn list_models_for_provider(&self, provider_id: &ProviderId) -> Vec<&ProviderModel> {
        if let Some(model_ids) = self.provider_models.get(provider_id) {
            let mut models: Vec<&ProviderModel> = model_ids
                .iter()
                .filter_map(|mid| self.models.get(&(provider_id.clone(), mid.clone())))
                .collect();

            // Deterministic sort: default model first, then alphabetically by display name
            models.sort_by(|a, b| {
                b.is_default
                    .cmp(&a.is_default)
                    .then_with(|| a.display_name.cmp(&b.display_name))
            });

            models
        } else {
            Vec::new()
        }
    }

    /// Lists all models across all registered providers.
    pub fn list_all_models(&self) -> Vec<&ProviderModel> {
        let mut all_models = Vec::new();
        for provider_id in &self.provider_order {
            all_models.extend(self.list_models_for_provider(provider_id));
        }
        all_models
    }

    /// Checks if a provider supports a specific capability at the infrastructure level.
    pub fn supports_provider_capability(&self, provider_id: &ProviderId, cap: ProviderCapability) -> bool {
        self.get_provider(provider_id)
            .map(|p| p.supports_capability(cap))
            .unwrap_or(false)
    }

    /// Checks if a specific model supports a capability.
    pub fn supports_model_capability(
        &self,
        provider_id: &ProviderId,
        model_id: &str,
        cap: ProviderCapability,
    ) -> bool {
        self.get_model(provider_id, model_id)
            .map(|m| m.supports_capability(cap))
            .unwrap_or(false)
    }

    /// Resolves an effective provider configuration combining static descriptor with user preferences.
    pub fn resolve_effective_provider(
        &self,
        provider_id: &ProviderId,
        preference: Option<&ProviderCredentialStatus>,
    ) -> Option<EffectiveProviderDescriptor> {
        let descriptor = self.get_provider(provider_id)?;
        let models = self
            .list_models_for_provider(provider_id)
            .into_iter()
            .cloned()
            .collect();

        Some(EffectiveProviderDescriptor::resolve(descriptor, models, preference))
    }

    /// Resolves effective configurations for all registered providers.
    pub fn resolve_all_effective_providers(
        &self,
        preferences: &[ProviderCredentialStatus],
    ) -> Vec<EffectiveProviderDescriptor> {
        let pref_map: HashMap<&str, &ProviderCredentialStatus> = preferences
            .iter()
            .map(|p| (p.provider_id.as_str(), p))
            .collect();

        self.provider_order
            .iter()
            .filter_map(|pid| {
                let pref = pref_map.get(pid.as_str()).copied();
                self.resolve_effective_provider(pid, pref)
            })
            .collect()
    }

    /// Resolves a historical model reference safely.
    /// If the model is absent from the current active catalog, gracefully falls back
    /// to displaying the raw model ID without crashing.
    pub fn resolve_historical_model(&self, provider_id: &str, model_id: &str) -> HistoricalModelReference {
        if let Ok(pid) = ProviderId::new(provider_id) {
            if let Some(model) = self.get_model(&pid, model_id) {
                return HistoricalModelReference {
                    provider_id: provider_id.to_string(),
                    model_id: model_id.to_string(),
                    display_name: model.display_name.clone(),
                    is_known_in_active_registry: true,
                };
            }
        }

        HistoricalModelReference {
            provider_id: provider_id.to_string(),
            model_id: model_id.to_string(),
            display_name: model_id.to_string(),
            is_known_in_active_registry: false,
        }
    }
}

