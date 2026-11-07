// ============================================================================
// Nano Route - SQLite Connection Factory
// File: src-tauri/src/storage/connection.rs
// ============================================================================
// Factory managing low-level rusqlite connection initialization.
// Automatically applies authoritative pragmas upon opening.
// ============================================================================

use crate::storage::errors::DatabaseError;
use crate::storage::pragmas::SqlitePragmas;
use rusqlite::{Connection, OpenFlags};
use std::path::Path;

/// Configuration parameters for establishing a SQLite connection.
#[derive(Debug, Clone)]
pub struct ConnectionConfig {
    pub apply_pragmas: bool,
    pub open_flags: OpenFlags,
}

impl Default for ConnectionConfig {
    fn default() -> Self {
        Self {
            apply_pragmas: true,
            open_flags: OpenFlags::SQLITE_OPEN_READ_WRITE
                | OpenFlags::SQLITE_OPEN_CREATE
                | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        }
    }
}

pub struct ConnectionFactory;

impl ConnectionFactory {
    /// Opens a persistent SQLite connection at the specified path and applies pragmas.
    pub fn open(path: &Path) -> Result<Connection, DatabaseError> {
        Self::open_with_config(path, ConnectionConfig::default())
    }

    /// Opens a connection with custom configuration flags.
    pub fn open_with_config(path: &Path, config: ConnectionConfig) -> Result<Connection, DatabaseError> {
        let conn = Connection::open_with_flags(path, config.open_flags)
            .map_err(|e| DatabaseError::connection_failed(format!("Failed to open SQLite database at '{}': {}", path.display(), e)))?;

        if config.apply_pragmas {
            SqlitePragmas::apply(&conn)?;
        }

        Ok(conn)
    }

    /// Opens an isolated in-memory SQLite database connection with pragmas applied.
    pub fn open_in_memory() -> Result<Connection, DatabaseError> {
        let conn = Connection::open_in_memory()
            .map_err(|e| DatabaseError::connection_failed(format!("Failed to open in-memory SQLite: {}", e)))?;

        SqlitePragmas::apply(&conn)?;
        Ok(conn)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_open_in_memory_connection() {
        let conn = ConnectionFactory::open_in_memory().unwrap();
        let val: i64 = conn.query_row("SELECT 42;", [], |r| r.get(0)).unwrap();
        assert_eq!(val, 42);
    }
}

