// ============================================================================
// Nano Route - Migration Runner Subsystem
// File: src-tauri/src/storage/migrations/runner.rs
// ============================================================================
// Deterministic, transactional, versioned database migration engine.
// Embeds SQL files directly into the compiled native binary via include_str!
// to guarantee packaging safety across development and release builds.
// ============================================================================

use crate::storage::errors::DatabaseError;
use rusqlite::TransactionBehavior;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::Instant;

/// Built-in migration definition.
#[derive(Debug, Clone, Copy)]
pub struct Migration {
    pub version: i64,
    pub name: &'static str,
    pub sql: &'static str,
}

impl Migration {
    /// Computes deterministic SHA-256 checksum of normalized SQL content.
    pub fn checksum(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.sql.trim().as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Catalog of authoritative production migrations compiled into the binary.
pub static BUILTIN_MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "001_database_foundation",
        sql: include_str!("001_database_foundation.sql"),
    },
    Migration {
        version: 2,
        name: "002_chat_persistence",
        sql: include_str!("002_chat_persistence.sql"),
    },
    Migration {
        version: 3,
        name: "003_telemetry_foundation",
        sql: include_str!("003_telemetry_foundation.sql"),
    },
    Migration {
        version: 4,
        name: "004_credential_vault",
        sql: include_str!("004_credential_vault.sql"),
    },
    Migration {
        version: 5,
        name: "005_app_settings",
        sql: include_str!("005_app_settings.sql"),
    },
    Migration {
        version: 6,
        name: "006_history_search_indexes",
        sql: include_str!("006_history_search_indexes.sql"),
    },
];

/// Execution summary returned after running database migrations.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MigrationReport {
    pub initial_version: i64,
    pub final_version: i64,
    pub applied_count: usize,
    pub duration_ms: u64,
}

pub struct MigrationRunner;

impl MigrationRunner {
    /// Runs all pending built-in migrations against the connection.
    pub fn run(conn: &mut rusqlite::Connection) -> Result<MigrationReport, DatabaseError> {
        Self::run_with_catalog(conn, BUILTIN_MIGRATIONS)
    }

    /// Runs migrations using an explicit catalog (enables isolated testing).
    pub fn run_with_catalog(
        conn: &mut rusqlite::Connection,
        migrations: &[Migration],
    ) -> Result<MigrationReport, DatabaseError> {
        let start_time = Instant::now();

        // 1. Validate migration catalog structure (ascending, unique versions)
        Self::validate_catalog(migrations)?;

        // 2. Ensure schema_migrations table exists
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                checksum TEXT NOT NULL,
                applied_at TEXT NOT NULL,
                execution_duration_ms INTEGER NOT NULL
            );
            "#,
        )
        .map_err(|e| DatabaseError::migration_failed(0, format!("Failed to bootstrap schema_migrations: {}", e)))?;

        // 3. Query current user_version and previously applied migrations
        let initial_version: i64 = conn
            .query_row("PRAGMA user_version;", [], |row| row.get(0))
            .unwrap_or(0);

        let mut applied_count = 0;
        let mut current_version = initial_version;

        // 4. Iterate through candidate migrations
        for migration in migrations {
            // Check if already recorded in schema_migrations
            let existing: Option<(String, String)> = conn
                .query_row(
                    "SELECT name, checksum FROM schema_migrations WHERE version = ?1;",
                    [migration.version],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .ok();

            if let Some((_name, recorded_checksum)) = existing {
                // Verify checksum integrity
                let current_checksum = migration.checksum();
                if recorded_checksum != current_checksum {
                    return Err(DatabaseError::tampered_migration(
                        migration.version,
                        &recorded_checksum,
                        &current_checksum,
                    ));
                }
                continue;
            }

            // Apply new migration in an exclusive transaction
            let mig_start = Instant::now();
            let tx = conn
                .transaction_with_behavior(TransactionBehavior::Exclusive)
                .map_err(|e| DatabaseError::transaction_failed(format!("Failed to begin migration transaction: {}", e)))?;

            tx.execute_batch(migration.sql).map_err(|e| {
                DatabaseError::migration_failed(
                    migration.version,
                    format!("Error executing migration SQL ({}): {}", migration.name, e),
                )
            })?;

            let mig_duration_ms = mig_start.elapsed().as_millis() as i64;
            let checksum = migration.checksum();

            tx.execute(
                r#"
                INSERT INTO schema_migrations (version, name, checksum, applied_at, execution_duration_ms)
                VALUES (?1, ?2, ?3, datetime('now'), ?4);
                "#,
                rusqlite::params![migration.version, migration.name, checksum, mig_duration_ms],
            )
            .map_err(|e| {
                DatabaseError::migration_failed(
                    migration.version,
                    format!("Failed to record migration metadata: {}", e),
                )
            })?;

            // Update PRAGMA user_version to reflect latest migration
            tx.execute_batch(&format!("PRAGMA user_version = {};", migration.version))
                .map_err(|e| {
                    DatabaseError::migration_failed(
                        migration.version,
                        format!("Failed to update user_version pragma: {}", e),
                    )
                })?;

            tx.commit().map_err(|e| {
                DatabaseError::transaction_failed(format!("Failed to commit migration transaction: {}", e))
            })?;

            applied_count += 1;
            current_version = migration.version;
        }

        Ok(MigrationReport {
            initial_version,
            final_version: current_version,
            applied_count,
            duration_ms: start_time.elapsed().as_millis() as u64,
        })
    }

    /// Validates that migration versions in the catalog are strictly ascending and contain no duplicates.
    fn validate_catalog(migrations: &[Migration]) -> Result<(), DatabaseError> {
        let mut last_version: Option<i64> = None;

        for m in migrations {
            if m.version <= 0 {
                return Err(DatabaseError::migration_failed(
                    m.version,
                    "Migration version must be a positive integer greater than 0",
                ));
            }

            if let Some(prev) = last_version {
                if m.version == prev {
                    return Err(DatabaseError::migration_failed(
                        m.version,
                        format!("Duplicate migration version {} detected in catalog", m.version),
                    ));
                }
                if m.version < prev {
                    return Err(DatabaseError::migration_failed(
                        m.version,
                        format!(
                            "Out-of-order migration detected: version {} appeared after {}",
                            m.version, prev
                        ),
                    ));
                }
            }

            last_version = Some(m.version);
        }

        Ok(())
    }

    /// Queries the latest applied migration version from the database.
    pub fn get_latest_version(conn: &rusqlite::Connection) -> Result<i64, DatabaseError> {
        let ver: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(ver)
    }

    /// Returns the count of applied migrations.
    pub fn get_applied_count(conn: &rusqlite::Connection) -> Result<usize, DatabaseError> {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM schema_migrations;",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        Ok(count as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builtin_migrations_run() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let report = MigrationRunner::run(&mut conn).unwrap();
        let expected_count = BUILTIN_MIGRATIONS.len();

        assert_eq!(report.initial_version, 0);
        assert_eq!(report.final_version, expected_count as i64);
        assert_eq!(report.applied_count, expected_count);

        // Verify idempotency: second run does nothing
        let second_report = MigrationRunner::run(&mut conn).unwrap();
        assert_eq!(second_report.applied_count, 0);
        assert_eq!(second_report.final_version, expected_count as i64);
    }

    #[test]
    fn test_duplicate_version_fails() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let bad_catalog = [
            Migration { version: 1, name: "m1", sql: "SELECT 1;" },
            Migration { version: 1, name: "m1_dup", sql: "SELECT 2;" },
        ];

        let err = MigrationRunner::run_with_catalog(&mut conn, &bad_catalog).unwrap_err();
        assert_eq!(err.kind, crate::storage::errors::DatabaseErrorKind::MigrationFailed);
    }

    #[test]
    fn test_failed_migration_rollback() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let failing_catalog = [
            Migration { version: 1, name: "m1_good", sql: "CREATE TABLE t1 (id INT);" },
            Migration { version: 2, name: "m2_bad", sql: "INVALID SQL SYNTAX HERE;" },
        ];

        let err = MigrationRunner::run_with_catalog(&mut conn, &failing_catalog).unwrap_err();
        assert_eq!(err.kind, crate::storage::errors::DatabaseErrorKind::MigrationFailed);

        // Version 1 applied, but version 2 not recorded
        assert_eq!(MigrationRunner::get_latest_version(&conn).unwrap(), 1);
    }

    #[test]
    fn test_checksum_tamper_detection() {
        let mut conn = rusqlite::Connection::open_in_memory().unwrap();
        let catalog1 = [
            Migration { version: 1, name: "m1", sql: "CREATE TABLE t1 (val INT);" },
        ];
        MigrationRunner::run_with_catalog(&mut conn, &catalog1).unwrap();

        // Tampered SQL content for version 1
        let catalog2 = [
            Migration { version: 1, name: "m1", sql: "CREATE TABLE t1 (val INT, tampered INT);" },
        ];
        let err = MigrationRunner::run_with_catalog(&mut conn, &catalog2).unwrap_err();
        assert_eq!(err.kind, crate::storage::errors::DatabaseErrorKind::TamperedMigration);
    }
}

