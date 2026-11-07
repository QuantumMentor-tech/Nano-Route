// ============================================================================
// Nano Route - SQLite Pragmas & Operational Configuration
// File: src-tauri/src/storage/pragmas.rs
// ============================================================================
// Authoritative connection settings enforcing WAL mode, foreign key constraints,
// busy timeouts, and memory-safe caching.
// ============================================================================

use crate::storage::errors::DatabaseError;
use serde::{Deserialize, Serialize};

/// Diagnostic report verifying that active SQLite connection pragmas match policy.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PragmaReport {
    pub foreign_keys_enabled: bool,
    pub journal_mode: String,
    pub synchronous_mode: i64,
    pub busy_timeout_ms: i64,
}

pub struct SqlitePragmas;

impl SqlitePragmas {
    /// Applies the authoritative Nano Route SQLite pragmas to a connection.
    ///
    /// Pragmas:
    /// - `PRAGMA foreign_keys = ON`: Enforces relational integrity across parent-child keys.
    /// - `PRAGMA journal_mode = WAL`: Concurrent readers with single writer; high throughput.
    /// - `PRAGMA synchronous = NORMAL`: Standard durability in WAL mode with minimal disk stalls.
    /// - `PRAGMA busy_timeout = 5000`: 5,000ms retry window before returning SQLITE_BUSY.
    /// - `PRAGMA temp_store = MEMORY`: Keeps temporary tables and index sorting in memory.
    /// - `PRAGMA cache_size = -2000`: ~2,048 KB memory cache per open connection.
    pub fn apply(conn: &rusqlite::Connection) -> Result<(), DatabaseError> {
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = ON;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA busy_timeout = 5000;
            PRAGMA temp_store = MEMORY;
            PRAGMA cache_size = -2000;
            "#,
        )
        .map_err(|e| DatabaseError::connection_failed(format!("Failed to apply SQLite pragmas: {}", e)))?;

        Ok(())
    }

    /// Inspects and reads back active pragma values to verify runtime enforcement.
    pub fn verify(conn: &rusqlite::Connection) -> Result<PragmaReport, DatabaseError> {
        let fk: i64 = conn
            .query_row("PRAGMA foreign_keys;", [], |row| row.get(0))
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to query foreign_keys: {}", e)))?;

        let jm: String = conn
            .query_row("PRAGMA journal_mode;", [], |row| row.get(0))
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to query journal_mode: {}", e)))?;

        let sync: i64 = conn
            .query_row("PRAGMA synchronous;", [], |row| row.get(0))
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to query synchronous: {}", e)))?;

        let busy: i64 = conn
            .query_row("PRAGMA busy_timeout;", [], |row| row.get(0))
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to query busy_timeout: {}", e)))?;

        Ok(PragmaReport {
            foreign_keys_enabled: fk == 1,
            journal_mode: jm.to_lowercase(),
            synchronous_mode: sync,
            busy_timeout_ms: busy,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_pragmas_application() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        SqlitePragmas::apply(&conn).unwrap();

        let report = SqlitePragmas::verify(&conn).unwrap();
        assert!(report.foreign_keys_enabled);
        assert_eq!(report.synchronous_mode, 1); // 1 = NORMAL
        assert_eq!(report.busy_timeout_ms, 5000);
        // Note: in-memory databases may report "memory" for journal_mode, but on disk they report "wal".
    }
}

