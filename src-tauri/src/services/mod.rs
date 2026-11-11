//! Nano Route — Application Services Layer
//!
//! Responsibility:
//! - Business use-case orchestrators.
//! - Coordinates domain logic and infrastructure without exposing Tauri internals.
//! - Commands delegate to services; services operate on domain entities.

pub mod app;
pub mod app_settings;
pub mod chat;
pub mod chat_orchestrator;
pub mod context_builder;
pub mod credentials;
pub mod execution;
pub mod health;
pub mod history;
pub mod provider_preferences;
pub mod streaming;
pub mod telemetry;

pub use app::AppService;
pub use app_settings::AppSettingsService;
pub use chat::ChatService;
pub use chat_orchestrator::{
    ChatOrchestrator, ChatStreamEvent, ChatStreamSink, ChatSubmissionRequest, ChatSubmissionResult,
    ManualRouteOverrideDto,
};
pub use context_builder::ConversationContextBuilder;
pub use credentials::{CredentialVaultService, SaveCredentialInput};
pub use execution::{
    CancellationResultDto, ExecutionContext, ExecutionLifecycleState, ExecutionManager,
    ExecutionStateDto, RecoveryContext, TerminationReason,
};
pub use health::HealthService;
pub use history::HistoryService;
pub use provider_preferences::ProviderPreferencesService;
pub use streaming::StreamCoordinator;
pub use telemetry::{RecordTelemetryInput, TelemetryService};
