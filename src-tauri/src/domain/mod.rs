//! Nano Route — Core Domain Models
//!
//! Responsibility:
//! - Pure domain entities, values, and business contracts.
//! - Pure, portable business logic independent of UI, SQLite, and network clients.
//! - Must NOT depend on Tauri WebView, rusqlite, or reqwest directly.

pub mod app_info;
pub mod chat;
pub mod credentials;
pub mod health;
pub mod history;
pub mod settings;
pub mod telemetry;

pub use app_info::AppInfo;
pub use chat::{ChatConversation, ChatMessage, ChatMessageMetadata, ChatSession, MessageSender};
pub use credentials::{DecryptedProviderCredential, EncryptedCredentialRecord, ProviderCredentialStatus};
pub use health::{CoreStatus, HealthReport, SubsystemHealth};
pub use history::{
    BulkDeleteResult, HistoryFilter, HistoryFilterOptions, HistoryMatchType,
    HistoryMessageMatchPreview, HistoryPage, HistoryPageInfo, HistoryPagination,
    HistorySearchEngine, HistorySearchRequest, HistorySearchResponse, HistorySearchResult,
    HistorySessionDto, HistorySortMode,
};
pub use settings::{
    AppSettingKey, AppSettingsSnapshot, RoutingPreferenceMode, UpdateProviderPreferencesInput,
};
pub use telemetry::{
    TelemetryAggregateReport, TelemetryEventType, TelemetryFilter, TelemetryOutcome, TelemetryRecord,
};
