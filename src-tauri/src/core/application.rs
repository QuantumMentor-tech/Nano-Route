//! Application Composition Root
//! Responsible for explicitly constructing the native runtime dependency graph.

use std::sync::Arc;
use crate::core::TaskManager;
use crate::errors::AppError;
use crate::services::{
    AppService, ChatService, CredentialVaultService, HealthService, TelemetryService,
};
use crate::state::AppState;
use crate::storage::DatabaseManager;

pub struct Application;

impl Application {
    /// Bootstraps the application services and returns the managed AppState.
    pub fn bootstrap() -> Result<AppState, AppError> {
        let app_service = Arc::new(AppService::new());
        let health_service = Arc::new(HealthService::new());
        let task_manager = Arc::new(TaskManager::new());
        let stream_coordinator = Arc::new(crate::services::StreamCoordinator::new(task_manager.clone()));

        // Initialize persistent SQLite database layer
        let database_manager = Arc::new(
            DatabaseManager::initialize()
                .map_err(|e| AppError::InitializationFailed(format!("Failed to initialize database: {}", e)))?,
        );

        let chat_service = Arc::new(ChatService::new(database_manager.clone()));
        let telemetry_service = Arc::new(TelemetryService::new(database_manager.clone()));
        let credential_vault = Arc::new(CredentialVaultService::new(database_manager.clone()));
        let app_settings = Arc::new(crate::services::AppSettingsService::new(database_manager.clone()));
        let provider_preferences = Arc::new(crate::services::ProviderPreferencesService::new(database_manager.clone()));

        // Initialize authoritative in-memory Provider & Model Registry
        let provider_registry = Arc::new(
            crate::providers::ProviderRegistry::builtin()
                .map_err(|e| AppError::InitializationFailed(format!("Failed to initialize provider registry: {}", e)))?,
        );

        let state = AppState::new(
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
        );
        state.mark_initialized("2026-11-07T00:00:00Z");

        Ok(state)
    }
}

