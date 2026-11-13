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
        let history_service = Arc::new(crate::services::HistoryService::new(database_manager.clone()));
        let telemetry_service = Arc::new(TelemetryService::new(database_manager.clone()));
        let credential_vault = Arc::new(CredentialVaultService::new(database_manager.clone()));
        let app_settings = Arc::new(crate::services::AppSettingsService::new(database_manager.clone()));
        let provider_preferences = Arc::new(crate::services::ProviderPreferencesService::new(database_manager.clone()));

        // Initialize authoritative in-memory Provider & Model Registry
        let provider_registry = Arc::new(
            crate::providers::ProviderRegistry::builtin()
                .map_err(|e| AppError::InitializationFailed(format!("Failed to initialize provider registry: {}", e)))?,
        );

        // Initialize Step 25 Provider Health Manager & Capability Intelligence
        let provider_health_manager = Arc::new(crate::providers::ProviderHealthManager::new(&provider_registry));
        let provider_capability_service = Arc::new(crate::providers::ProviderCapabilityService::new(provider_registry.clone()));
        let preflight_evaluator = Arc::new(crate::providers::PreflightEvaluator::new(
            provider_registry.clone(),
            provider_capability_service.clone(),
            provider_health_manager.clone(),
        ));
        let provider_health_probe = Arc::new(crate::providers::ProviderHealthProbeService::new(
            provider_registry.clone(),
            provider_health_manager.clone(),
        ));

        // Initialize Step 26 Local SLM Runtime Service (lazy model lifecycle)
        let local_slm_service = Arc::new(crate::inference::LocalSlmService::new());

        // Initialize Step 27 Local Intent Classifier Service
        let intent_classifier = Arc::new(crate::classification::IntentClassifier::new(
            local_slm_service.clone(),
            Some(telemetry_service.clone()),
        ));

        // Initialize Step 28 Task Analyzer Engine
        let task_analyzer = Arc::new(crate::analysis::TaskAnalyzer::new(
            intent_classifier.clone(),
            local_slm_service.clone(),
            Some(telemetry_service.clone()),
        ));

        // Initialize Step 29 Routing Scoring Engine
        let routing_scoring_engine = Arc::new(crate::routing::RoutingScoringEngine::new(
            provider_registry.clone(),
            provider_health_manager.clone(),
            provider_capability_service.clone(),
            preflight_evaluator.clone(),
            provider_preferences.clone(),
        ));

        // Initialize Step 30 Routing Policy Engine
        let routing_policy_engine = Arc::new(crate::routing::RoutingPolicyEngine::new(
            provider_registry.clone(),
            provider_health_manager.clone(),
            provider_capability_service.clone(),
            preflight_evaluator.clone(),
            provider_preferences.clone(),
            routing_scoring_engine.clone(),
            app_settings.clone(),
        ));

        // Initialize Step 34 Routing Explanation Service
        let routing_explanation_service = Arc::new(crate::routing::RoutingExplanationService::new(
            chat_service.clone(),
            telemetry_service.clone(),
            provider_registry.clone(),
        ));

        // Initialize Step 35 Execution Lifecycle Manager
        let execution_manager = Arc::new(crate::services::execution::ExecutionManager::new());

        // Initialize Step 32 Provider Resolver & Chat Orchestrator
        let provider_resolver = Arc::new(crate::providers::resolver::ProviderResolver::new(credential_vault.clone()));
        let chat_orchestrator = Arc::new(crate::services::ChatOrchestrator::new(
            chat_service.clone(),
            task_analyzer.clone(),
            routing_scoring_engine.clone(),
            routing_policy_engine.clone(),
            routing_explanation_service.clone(),
            execution_manager.clone(),
            provider_registry.clone(),
            provider_resolver.clone(),
            telemetry_service.clone(),
        ));

        // Initialize Step 45 Data Lifecycle, Audit, Retention & Privacy Service
        let data_lifecycle_service = Arc::new(crate::services::DataLifecycleService::new(
            database_manager.clone(),
            app_settings.clone(),
            credential_vault.clone(),
            execution_manager.clone(),
            provider_health_manager.clone(),
        ));

        // Initialize Step 53 Disaster Recovery, Backup & Continuity Service
        let recovery_service = Arc::new(crate::services::RecoveryService::new(
            database_manager.clone(),
            execution_manager.clone(),
        ));

        let state = AppState::new(
            app_service,
            health_service,
            task_manager,
            stream_coordinator,
            database_manager,
            chat_service,
            history_service,
            telemetry_service,
            credential_vault,
            app_settings,
            provider_preferences,
            provider_registry,
            provider_health_manager,
            provider_capability_service,
            preflight_evaluator,
            provider_health_probe,
            local_slm_service,
            intent_classifier,
            task_analyzer,
            routing_scoring_engine,
            routing_policy_engine,
            provider_resolver,
            chat_orchestrator,
            routing_explanation_service,
            execution_manager,
            data_lifecycle_service,
            recovery_service,
        );
        state.mark_initialized("2026-11-07T00:00:00Z");

        Ok(state)
    }
}

