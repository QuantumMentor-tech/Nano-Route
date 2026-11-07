// ============================================================================
// Nano Route - Database Error Subsystem
// File: src-tauri/src/storage/errors.rs
// ============================================================================
// Normalized error taxonomy, retryability classification, and secret sanitization
// for SQLite database operations.
// Maps cleanly into the global application-wide AppError hierarchy.
// ============================================================================

use crate::errors::AppError;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Categorization of database errors encountered by the SQLite layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DatabaseErrorKind {
    /// Failed to open or establish a connection to the SQLite database file.
    ConnectionFailed,
    /// Schema migration failed or could not be applied.
    MigrationFailed,
    /// A previously applied migration's checksum does not match current source.
    TamperedMigration,
    /// Foreign key, unique, check, or not-null constraint was violated.
    ConstraintViolation,
    /// Database file or table corruption was detected by integrity checks.
    CorruptionSuspected,
    /// SQL statement execution failed.
    ExecutionFailed,
    /// Database table or file locked; busy timeout elapsed (SQLITE_BUSY).
    BusyTimeout,
    /// Transaction begin, commit, or rollback failed.
    TransactionFailed,
    /// Database path or directory resolution/creation failed.
    InvalidPath,
}

impl DatabaseErrorKind {
    /// Determines whether the error is transient and safe to retry.
    #[inline]
    pub fn is_retryable(&self) -> bool {
        matches!(self, Self::BusyTimeout | Self::ConnectionFailed)
    }

    /// Returns a static string slice representing the error category.
    #[inline]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ConnectionFailed => "connection_failed",
            Self::MigrationFailed => "migration_failed",
            Self::TamperedMigration => "tampered_migration",
            Self::ConstraintViolation => "constraint_violation",
            Self::CorruptionSuspected => "corruption_suspected",
            Self::ExecutionFailed => "execution_failed",
            Self::BusyTimeout => "busy_timeout",
            Self::TransactionFailed => "transaction_failed",
            Self::InvalidPath => "invalid_path",
        }
    }
}

impl fmt::Display for DatabaseErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Normalized, sanitized error returned by all database operations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DatabaseError {
    pub kind: DatabaseErrorKind,
    pub message: String,
    pub source_code: Option<String>,
    pub is_retryable: bool,
}

impl DatabaseError {
    /// Constructs a new DatabaseError with automatic secret sanitization.
    pub fn new(
        kind: DatabaseErrorKind,
        message: impl Into<String>,
        source_code: Option<String>,
    ) -> Self {
        let is_retryable = kind.is_retryable();
        Self {
            kind,
            message: sanitize_error_text(&message.into()),
            source_code: source_code.map(|s| sanitize_error_text(&s)),
            is_retryable,
        }
    }

    // --- Helper Constructors ---

    pub fn connection_failed(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::ConnectionFailed, msg, None)
    }

    pub fn migration_failed(version: i64, msg: impl Into<String>) -> Self {
        Self::new(
            DatabaseErrorKind::MigrationFailed,
            format!("Migration version {} failed: {}", version, msg.into()),
            Some(format!("MIGRATION_{}", version)),
        )
    }

    pub fn tampered_migration(version: i64, expected: &str, actual: &str) -> Self {
        Self::new(
            DatabaseErrorKind::TamperedMigration,
            format!(
                "Migration {} checksum mismatch (applied: {}, current: {})",
                version, expected, actual
            ),
            Some(format!("CHECKSUM_MISMATCH_{}", version)),
        )
    }

    pub fn constraint_violation(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::ConstraintViolation, msg, None)
    }

    pub fn corruption_suspected(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::CorruptionSuspected, msg, None)
    }

    pub fn execution_failed(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::ExecutionFailed, msg, None)
    }

    pub fn busy_timeout(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::BusyTimeout, msg, None)
    }

    pub fn transaction_failed(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::TransactionFailed, msg, None)
    }

    pub fn invalid_path(msg: impl Into<String>) -> Self {
        Self::new(DatabaseErrorKind::InvalidPath, msg, None)
    }
}

impl fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[sqlite:{}] {}", self.kind, self.message)
    }
}

impl std::error::Error for DatabaseError {}

/// Convert a DatabaseError into the application-wide AppError hierarchy.
impl From<DatabaseError> for AppError {
    fn from(err: DatabaseError) -> Self {
        let formatted = err.to_string();
        match err.kind {
            DatabaseErrorKind::InvalidPath
            | DatabaseErrorKind::ConstraintViolation => AppError::InvalidInput(formatted),

            DatabaseErrorKind::ConnectionFailed
            | DatabaseErrorKind::BusyTimeout => AppError::ServiceUnavailable(formatted),

            DatabaseErrorKind::MigrationFailed
            | DatabaseErrorKind::TamperedMigration => AppError::InitializationFailed(formatted),

            DatabaseErrorKind::CorruptionSuspected
            | DatabaseErrorKind::ExecutionFailed
            | DatabaseErrorKind::TransactionFailed => AppError::Internal(formatted),
        }
    }
}

/// Convert rusqlite::Error into normalized DatabaseError.
impl From<rusqlite::Error> for DatabaseError {
    fn from(err: rusqlite::Error) -> Self {
        match err {
            rusqlite::Error::SqliteFailure(ffi_err, desc) => {
                let code = format!("{:?}", ffi_err.code);
                let desc_str = desc.unwrap_or_else(|| "Unknown SQLite error".to_string());
                match ffi_err.code {
                    rusqlite::ErrorCode::DatabaseBusy | rusqlite::ErrorCode::DatabaseLocked => {
                        Self::new(DatabaseErrorKind::BusyTimeout, desc_str, Some(code))
                    }
                    rusqlite::ErrorCode::ConstraintViolation => {
                        Self::new(DatabaseErrorKind::ConstraintViolation, desc_str, Some(code))
                    }
                    rusqlite::ErrorCode::DatabaseCorrupt | rusqlite::ErrorCode::NotADatabase => {
                        Self::new(DatabaseErrorKind::CorruptionSuspected, desc_str, Some(code))
                    }
                    _ => Self::new(DatabaseErrorKind::ExecutionFailed, desc_str, Some(code)),
                }
            }
            rusqlite::Error::QueryReturnedNoRows => {
                Self::new(DatabaseErrorKind::ExecutionFailed, "Query returned no rows", None)
            }
            _ => Self::new(DatabaseErrorKind::ExecutionFailed, err.to_string(), None),
        }
    }
}

/// Scrub sensitive authentication tokens, API keys, and bearer credentials from error text.
pub fn sanitize_error_text(input: &str) -> String {
    let mut result = input.to_string();
    let prefix_patterns = [
        "sk-", "key-", "Bearer ", "bearer ", "AIzaSy", "ghp_", "api_key=", "apikey=", "key=",
    ];

    for prefix in prefix_patterns {
        let mut start_idx = 0;
        while let Some(found) = result[start_idx..].find(prefix) {
            let actual_start = start_idx + found;
            let token_start = actual_start + prefix.len();

            let token_end = result[token_start..]
                .find(|c: char| c.is_whitespace() || c == ',' || c == '"' || c == '\'' || c == '&' || c == ';')
                .map(|offset| token_start + offset)
                .unwrap_or(result.len());

            if token_end > token_start + 4 {
                let prefix_part = &result[..token_start];
                let suffix_part = &result[token_end..];
                result = format!("{}[REDACTED]{}", prefix_part, suffix_part);
                start_idx = token_start + "[REDACTED]".len();
            } else {
                start_idx = token_start;
            }

            if start_idx >= result.len() {
                break;
            }
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_retryability() {
        assert!(DatabaseErrorKind::BusyTimeout.is_retryable());
        assert!(DatabaseErrorKind::ConnectionFailed.is_retryable());

        assert!(!DatabaseErrorKind::ConstraintViolation.is_retryable());
        assert!(!DatabaseErrorKind::MigrationFailed.is_retryable());
        assert!(!DatabaseErrorKind::CorruptionSuspected.is_retryable());
    }

    #[test]
    fn test_error_sanitization() {
        let raw = "Error writing api_key=sk-proj-supersecretkey123456789 to storage";
        let sanitized = sanitize_error_text(raw);
        assert!(!sanitized.contains("supersecretkey123456789"));
        assert!(sanitized.contains("[REDACTED]"));
    }

    #[test]
    fn test_app_error_conversion() {
        let err = DatabaseError::migration_failed(1, "syntax error near TABLE");
        let app_err: AppError = err.into();
        match app_err {
            AppError::InitializationFailed(msg) => {
                assert!(msg.contains("migration_failed"));
                assert!(msg.contains("Migration version 1 failed"));
            }
            _ => panic!("Expected InitializationFailed variant"),
        }
    }
}

