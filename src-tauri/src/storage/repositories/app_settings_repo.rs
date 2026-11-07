// ============================================================================
// Nano Route - Application Settings Repository
// File: src-tauri/src/storage/repositories/app_settings_repo.rs
// ============================================================================
// Data access layer for application-level user preferences (`app_settings`).
// Generic key-value store using strictly parameterized SQL queries.
// Plaintext secrets or credentials must NEVER enter this store.
// ============================================================================

use crate::storage::errors::DatabaseError;
use rusqlite::{params, Connection};

pub struct AppSettingsRepository;

impl AppSettingsRepository {
    /// Retrieves the raw string value for a given setting key.
    pub fn get(conn: &Connection, key: &str) -> Result<Option<String>, DatabaseError> {
        let mut stmt = conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1;")
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare get_setting query: {}", e)))?;

        let result = stmt
            .query_row(params![key], |row| row.get::<_, String>(0))
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => None,
                other => Some(DatabaseError::query_failed(format!("Failed to query setting: {}", other))),
            })
            .transpose()?;

        Ok(result)
    }

    /// Sets or updates a key-value pair in app_settings.
    pub fn set(conn: &Connection, key: &str, value: &str) -> Result<(), DatabaseError> {
        conn.execute(
            r#"
            INSERT INTO app_settings (key, value)
            VALUES (?1, ?2)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value;
            "#,
            params![key, value],
        )
        .map_err(|e| DatabaseError::execution_failed(format!("Failed to set setting '{}': {}", key, e)))?;

        Ok(())
    }

    /// Deletes a key from app_settings (used during settings reset).
    pub fn delete(conn: &Connection, key: &str) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute("DELETE FROM app_settings WHERE key = ?1;", params![key])
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete setting '{}': {}", key, e)))?;

        Ok(rows_affected > 0)
    }

    /// Lists all persisted key-value pairs from app_settings.
    pub fn list_all(conn: &Connection) -> Result<Vec<(String, String)>, DatabaseError> {
        let mut stmt = conn
            .prepare("SELECT key, value FROM app_settings ORDER BY key ASC;")
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare list_all query: {}", e)))?;

        let rows = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute list_all query: {}", e)))?;

        let mut settings = Vec::new();
        for row in rows {
            settings.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map setting row: {}", e)))?);
        }

        Ok(settings)
    }

    /// Atomically updates multiple settings within a transaction.
    pub fn set_multiple(
        conn: &mut Connection,
        entries: &[(&str, &str)],
    ) -> Result<(), DatabaseError> {
        let tx = conn
            .transaction()
            .map_err(|e| DatabaseError::transaction_failed(format!("Failed to begin transaction: {}", e)))?;

        {
            let mut stmt = tx
                .prepare(
                    r#"
                    INSERT INTO app_settings (key, value)
                    VALUES (?1, ?2)
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value;
                    "#,
                )
                .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare set_multiple query: {}", e)))?;

            for (key, val) in entries {
                stmt.execute(params![key, val]).map_err(|e| {
                    DatabaseError::execution_failed(format!("Failed to execute insert for '{}': {}", key, e))
                })?;
            }
        }

        tx.commit()
            .map_err(|e| DatabaseError::transaction_failed(format!("Failed to commit transaction: {}", e)))?;

        Ok(())
    }

    /// Clears all rows in app_settings (supports complete local data reset).
    pub fn clear_all(conn: &Connection) -> Result<usize, DatabaseError> {
        let rows_affected = conn
            .execute("DELETE FROM app_settings;", [])
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to clear all app_settings: {}", e)))?;

        Ok(rows_affected)
    }
}

