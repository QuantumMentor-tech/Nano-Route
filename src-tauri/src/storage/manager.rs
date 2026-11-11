// ============================================================================
// Nano Route - Database Manager & Execution Boundary
// File: src-tauri/src/storage/manager.rs
// ============================================================================
// Composition root and authoritative service interface for SQLite persistence.
// Encapsulates rusqlite::Connection behind a thread-safe mutex and isolates
// blocking database operations from Tokio asynchronous worker threads.
// ============================================================================

use crate::storage::connection::ConnectionFactory;
use crate::storage::errors::DatabaseError;
use crate::storage::migrations::{MigrationReport, MigrationRunner};
use crate::storage::path::DatabasePathResolver;
use crate::storage::pragmas::SqlitePragmas;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// Runtime operational status of the database subsystem.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DatabaseStatus {
    Initializing,
    Ready,
    Degraded,
    Failed,
}

/// Comprehensive health and diagnostic report for the SQLite database.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseHealthReport {
    pub status: DatabaseStatus,
    pub schema_version: i64,
    pub migrations_applied: usize,
    pub integrity_ok: bool,
    pub wal_enabled: bool,
    pub database_path: String,
    pub latency_ms: u64,
}

/// Authoritative manager and execution boundary for all Nano Route persistence.
pub struct DatabaseManager {
    connection: Arc<Mutex<Connection>>,
    database_path: Option<PathBuf>,
    is_in_memory: bool,
    initialization_report: MigrationReport,
}

impl DatabaseManager {
    /// Bootstraps the production database at the canonical OS application-data path.
    /// Opens the connection, applies pragmas, executes pending migrations, and verifies integrity.
    pub fn initialize() -> Result<Self, DatabaseError> {
        let path = DatabasePathResolver::resolve_path()?;
        Self::open(&path)
    }

    /// Opens or creates a database at an explicit file path.
    pub fn open(path: &Path) -> Result<Self, DatabaseError> {
        DatabasePathResolver::ensure_parent_directory(path)?;

        let mut conn = ConnectionFactory::open(path)?;

        // Execute authoritative migrations
        let report = MigrationRunner::run(&mut conn)?;

        // Verify initial integrity
        let integrity_ok: String = conn
            .query_row("PRAGMA integrity_check;", [], |r| r.get(0))
            .map_err(|e| DatabaseError::corruption_suspected(format!("Initial integrity check failed: {}", e)))?;

        if integrity_ok != "ok" {
            return Err(DatabaseError::corruption_suspected(format!(
                "Integrity check returned non-ok status: {}",
                integrity_ok
            )));
        }

        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
            database_path: Some(path.to_path_buf()),
            is_in_memory: false,
            initialization_report: report,
        })
    }

    /// Creates an isolated in-memory database instance with migrations applied (ideal for tests).
    pub fn in_memory() -> Result<Self, DatabaseError> {
        let mut conn = ConnectionFactory::open_in_memory()?;
        let report = MigrationRunner::run(&mut conn)?;

        Ok(Self {
            connection: Arc::new(Mutex::new(conn)),
            database_path: None,
            is_in_memory: true,
            initialization_report: report,
        })
    }

    /// Synchronous execution boundary: acquires lock and runs a closure against the connection.
    pub fn with_connection<F, R>(&self, f: F) -> Result<R, DatabaseError>
    where
        F: FnOnce(&mut Connection) -> Result<R, DatabaseError>,
    {
        let mut conn = self.connection.lock().map_err(|_| {
            DatabaseError::execution_failed("Database connection lock poisoned")
        })?;

        f(&mut conn)
    }

    /// Asynchronous execution boundary: runs blocking SQLite closure on Tokio's blocking threadpool.
    /// Prevents blocking Tokio worker threads.
    pub async fn execute_async<F, R>(&self, f: F) -> Result<R, DatabaseError>
    where
        F: FnOnce(&mut Connection) -> Result<R, DatabaseError> + Send + 'static,
        R: Send + 'static,
    {
        let conn_arc = self.connection.clone();
        tokio::task::spawn_blocking(move || {
            let mut conn = conn_arc.lock().map_err(|_| {
                DatabaseError::execution_failed("Database connection lock poisoned in spawn_blocking")
            })?;
            f(&mut conn)
        })
        .await
        .map_err(|join_err| {
            DatabaseError::execution_failed(format!("Database task panicked or was aborted: {}", join_err))
        })?
    }

    /// Verifies the structural health of the SQLite database.
    pub fn health_check(&self) -> Result<DatabaseHealthReport, DatabaseError> {
        let start = Instant::now();

        self.with_connection(|conn| {
            // Smoke query
            let smoke: i64 = conn
                .query_row("SELECT 1;", [], |r| r.get(0))
                .map_err(|e| DatabaseError::connection_failed(format!("Health check smoke query failed: {}", e)))?;

            if smoke != 1 {
                return Err(DatabaseError::connection_failed("Smoke query returned unexpected value"));
            }

            let schema_version = MigrationRunner::get_latest_version(conn)?;
            let migrations_applied = MigrationRunner::get_applied_count(conn)?;
            let pragma_report = SqlitePragmas::verify(conn)?;

            let integrity_ok: String = conn
                .query_row("PRAGMA integrity_check(1);", [], |r| r.get(0))
                .unwrap_or_else(|_| "failed".to_string());

            let is_ok = integrity_ok == "ok";

            let path_display = match &self.database_path {
                Some(p) => p.display().to_string(),
                None => ":memory:".to_string(),
            };

            let status = if is_ok && schema_version >= 1 {
                DatabaseStatus::Ready
            } else {
                DatabaseStatus::Degraded
            };

            Ok(DatabaseHealthReport {
                status,
                schema_version,
                migrations_applied,
                integrity_ok: is_ok,
                wal_enabled: pragma_report.journal_mode == "wal",
                database_path: path_display,
                latency_ms: start.elapsed().as_millis() as u64,
            })
        })
    }

    /// Runs a full SQLite `PRAGMA integrity_check` returning true if healthy.
    pub fn integrity_check(&self) -> Result<bool, DatabaseError> {
        self.with_connection(|conn| {
            let result: String = conn
                .query_row("PRAGMA integrity_check;", [], |r| r.get(0))
                .map_err(|e| DatabaseError::corruption_suspected(format!("Integrity check query failed: {}", e)))?;

            Ok(result == "ok")
        })
    }

    /// Returns the active schema version.
    pub fn schema_version(&self) -> Result<i64, DatabaseError> {
        self.with_connection(|conn| MigrationRunner::get_latest_version(conn))
    }

    /// Returns the migration report generated during startup initialization.
    pub fn initialization_report(&self) -> &MigrationReport {
        &self.initialization_report
    }

    /// Performs safe database shutdown by committing any pending work and checkpointing WAL.
    pub fn shutdown(&self) -> Result<(), DatabaseError> {
        self.with_connection(|conn| {
            if !self.is_in_memory {
                // Checkpoint WAL to flush all transactions into the primary db file
                let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");
            }
            Ok(())
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_in_memory_database_manager() {
        let manager = DatabaseManager::in_memory().unwrap();
        let expected_count = crate::storage::migrations::BUILTIN_MIGRATIONS.len();
        assert_eq!(manager.schema_version().unwrap(), expected_count as i64);

        let health = manager.health_check().unwrap();
        assert_eq!(health.status, DatabaseStatus::Ready);
        assert!(health.integrity_ok);
        assert_eq!(health.migrations_applied, expected_count);
        assert_eq!(health.database_path, ":memory:");
    }

    #[test]
    fn test_transaction_rollback_boundary() {
        let manager = DatabaseManager::in_memory().unwrap();

        // Transaction with intentional rollback
        let result = manager.with_connection(|conn| {
            let tx = conn.transaction().unwrap();
            tx.execute("INSERT INTO database_metadata (key, value, updated_at) VALUES ('k1', 'v1', 'now');", []).unwrap();
            
            // Deliberate error causing rollback
            let err_res: Result<(), DatabaseError> = Err(DatabaseError::execution_failed("Intentional failure"));
            err_res?;
            tx.commit().unwrap();
            Ok(())
        });

        assert!(result.is_err());

        // Verify k1 was NOT persisted
        let exists: bool = manager.with_connection(|conn| {
            let count: i64 = conn.query_row("SELECT COUNT(*) FROM database_metadata WHERE key = 'k1';", [], |r| r.get(0)).unwrap();
            Ok(count > 0)
        }).unwrap();

        assert!(!exists, "Expected k1 to be rolled back");
    }

    #[tokio::test]
    async fn test_async_execution_boundary() {
        let manager = DatabaseManager::in_memory().unwrap();

        let val = manager
            .execute_async(|conn| {
                let v: i64 = conn.query_row("SELECT 100 + 200;", [], |r| r.get(0)).unwrap();
                Ok(v)
            })
            .await
            .unwrap();

        assert_eq!(val, 300);
    }

    #[test]
    fn test_file_backed_database_reopen() {
        let temp_dir = std::env::temp_dir().join("nano_route_test_reopen");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let db_path = temp_dir.join("test_reopen.db");

        // 1. First initialization
        {
            let manager = DatabaseManager::open(&db_path).unwrap();
            assert_eq!(manager.schema_version().unwrap(), 1);
            manager.with_connection(|conn| {
                conn.execute("INSERT INTO database_metadata (key, value, updated_at) VALUES ('persistent_key', 'persisted_val', 'now');", []).unwrap();
                Ok(())
            }).unwrap();
            manager.shutdown().unwrap();
        }

        // 2. Second initialization (reopen)
        {
            let manager = DatabaseManager::open(&db_path).unwrap();
            assert_eq!(manager.schema_version().unwrap(), 1);
            let val: String = manager.with_connection(|conn| {
                conn.query_row("SELECT value FROM database_metadata WHERE key = 'persistent_key';", [], |r| r.get(0)).unwrap()
            }).unwrap();
            assert_eq!(val, "persisted_val");
            manager.shutdown().unwrap();
        }

        let _ = std::fs::remove_dir_all(&temp_dir);
    }
}

