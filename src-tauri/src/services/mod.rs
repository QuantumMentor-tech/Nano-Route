//! Nano Route — Application Services Layer
//!
//! Responsibility:
//! - Business use-case orchestrators.
//! - Coordinates domain logic and infrastructure without exposing Tauri internals.
//! - Commands delegate to services; services operate on domain entities.

pub mod app;
pub mod app_settings;
pub mod chat;
pub mod credentials;
pub mod health;
pub mod provider_preferences;
pub mod streaming;
pub mod telemetry;

pub use app::AppService;
pub use app_settings::AppSettingsService;
pub use chat::ChatService;
pub use credentials::{CredentialVaultService, SaveCredentialInput};
pub use health::HealthService;
pub use provider_preferences::ProviderPreferencesService;
pub use streaming::StreamCoordinator;
pub use telemetry::{RecordTelemetryInput, TelemetryService};
