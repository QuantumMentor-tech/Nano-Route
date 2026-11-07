// ============================================================================
// Nano Route — Persistence & Local Database Subsystem
// File: src-tauri/src/storage/mod.rs
// ============================================================================
// Responsibility:
// - Embedded SQLite connection management, WAL mode, pragmas, and migrations.
// - Repositories for sessions, messages, telemetry, and encrypted settings.
// - Isolates blocking database access from Tokio workers.
// - Strictly prevents raw SQL execution from frontend commands.
// ============================================================================

pub mod connection;
pub mod errors;
pub mod manager;
pub mod migrations;
pub mod path;
pub mod pragmas;
pub mod repositories;

pub use connection::{ConnectionConfig, ConnectionFactory};
pub use errors::{DatabaseError, DatabaseErrorKind};
pub use manager::{DatabaseHealthReport, DatabaseManager, DatabaseStatus};
pub use migrations::{Migration, MigrationReport, MigrationRunner, BUILTIN_MIGRATIONS};
pub use path::{DatabasePathResolver, DEFAULT_DB_FILENAME, ENV_DB_PATH_OVERRIDE};
pub use pragmas::{PragmaReport, SqlitePragmas};
pub use repositories::{
    AppSettingsRepository, ChatMessageRepository, ChatSessionRepository, CredentialRepository,
    TelemetryRepository,
};
