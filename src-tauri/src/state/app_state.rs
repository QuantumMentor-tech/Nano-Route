//! Native Application State
//! Thread-safe container for shared services and runtime metadata managed by Tauri.

use std::sync::{Arc, RwLock};
use crate::core::TaskManager;
use crate::providers::ProviderRegistry;
use crate::services::{
    AppService, AppSettingsService, ChatService, CredentialVaultService, HealthService,
    ProviderPreferencesService, StreamCoordinator, TelemetryService,
};
use crate::storage::DatabaseManager;

pub struct AppState {
    pub app_service: Arc<AppService>,
    pub health_service: Arc<HealthService>,
    pub task_manager: Arc<TaskManager>,
    pub stream_coordinator: Arc<StreamCoordinator>,
    pub database_manager: Arc<DatabaseManager>,
    pub chat_service: Arc<ChatService>,
    pub telemetry_service: Arc<TelemetryService>,
    pub credential_vault: Arc<CredentialVaultService>,
    pub app_settings: Arc<AppSettingsService>,
    pub provider_preferences: Arc<ProviderPreferencesService>,
    pub provider_registry: Arc<ProviderRegistry>,
    pub initialized_at: RwLock<Option<String>>,
}

impl AppState {
    pub fn new(
        app_service: Arc<AppService>,
        health_service: Arc<HealthService>,
        task_manager: Arc<TaskManager>,
        stream_coordinator: Arc<StreamCoordinator>,
        database_manager: Arc<DatabaseManager>,
        chat_service: Arc<ChatService>,
        telemetry_service: Arc<TelemetryService>,
        credential_vault: Arc<CredentialVaultService>,
        app_settings: Arc<AppSettingsService>,
        provider_preferences: Arc<ProviderPreferencesService>,
        provider_registry: Arc<ProviderRegistry>,
    ) -> Self {
        Self {
            app_service,
            health_service,
            task_manager,
            stream_coordinator,
            database_manager,
            chat_service,
            telemetry_service,
            credential_vault,
            app_settings,
            provider_preferences,
            provider_registry,
            initialized_at: RwLock::new(None),
        }
    }

    /// Marks the native core as initialized with an ISO 8601 timestamp.
    pub fn mark_initialized(&self, timestamp: impl Into<String>) {
        if let Ok(mut lock) = self.initialized_at.write() {
            *lock = Some(timestamp.into());
        }
    }

    /// Checks if the native core has completed initialization.
    pub fn is_initialized(&self) -> bool {
        self.initialized_at
            .read()
            .map(|opt| opt.is_some())
            .unwrap_or(false)
    }
}

