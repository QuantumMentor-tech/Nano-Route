// ============================================================================
// Nano Route - Encrypted Credential Repository
// File: src-tauri/src/storage/repositories/credential_repo.rs
// ============================================================================
// Data access layer for DPAPI-protected provider credentials and configuration.
// Strictly parameterized queries; stores ciphertext strictly as SQLite BLOB.
// ============================================================================

use crate::domain::{EncryptedCredentialRecord, ProviderCredentialStatus};
use crate::storage::errors::DatabaseError;
use rusqlite::{params, Connection, Row};

pub struct CredentialRepository;

impl CredentialRepository {
    /// Maps a SQLite row into an EncryptedCredentialRecord.
    fn map_encrypted_row(row: &Row) -> Result<EncryptedCredentialRecord, rusqlite::Error> {
        let is_active_int: i64 = row.get(3)?;
        let priority_int: i64 = row.get(4)?;

        Ok(EncryptedCredentialRecord {
            provider_id: row.get(0)?,
            encrypted_api_key: row.get(1)?,
            base_url: row.get(2)?,
            is_active: is_active_int != 0,
            priority_weight: priority_int.clamp(1, 10) as u8,
            monthly_budget_limit: row.get(5)?,
            current_month_spend: row.get(6)?,
            updated_at: row.get(7)?,
        })
    }

    /// Maps a non-secret SQLite row into a ProviderCredentialStatus.
    fn map_status_row(row: &Row) -> Result<ProviderCredentialStatus, rusqlite::Error> {
        let is_active_int: i64 = row.get(2)?;
        let priority_int: i64 = row.get(3)?;

        Ok(ProviderCredentialStatus {
            provider_id: row.get(0)?,
            is_configured: true,
            base_url: row.get(1)?,
            is_active: is_active_int != 0,
            priority_weight: priority_int.clamp(1, 10) as u8,
            monthly_budget_limit: row.get(4)?,
            current_month_spend: row.get(5)?,
            updated_at: row.get(6)?,
        })
    }

    /// Persists or updates an encrypted credential record in SQLite.
    pub fn insert_or_update(
        conn: &Connection,
        record: &EncryptedCredentialRecord,
    ) -> Result<(), DatabaseError> {
        conn.execute(
            r#"
            INSERT INTO api_credentials (
                provider_id,
                encrypted_api_key,
                base_url,
                is_active,
                priority_weight,
                monthly_budget_limit,
                current_month_spend,
                updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(provider_id) DO UPDATE SET
                encrypted_api_key = excluded.encrypted_api_key,
                base_url = excluded.base_url,
                is_active = excluded.is_active,
                priority_weight = excluded.priority_weight,
                monthly_budget_limit = excluded.monthly_budget_limit,
                current_month_spend = excluded.current_month_spend,
                updated_at = excluded.updated_at;
            "#,
            params![
                record.provider_id,
                record.encrypted_api_key,
                record.base_url,
                if record.is_active { 1 } else { 0 },
                record.priority_weight as i64,
                record.monthly_budget_limit,
                record.current_month_spend,
                record.updated_at,
            ],
        )
        .map_err(|e| DatabaseError::execution_failed(format!("Failed to save encrypted credential: {}", e)))?;

        Ok(())
    }

    /// Retrieves the encrypted credential record for a specific provider.
    pub fn get_by_provider(
        conn: &Connection,
        provider_id: &str,
    ) -> Result<Option<EncryptedCredentialRecord>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT 
                    provider_id,
                    encrypted_api_key,
                    base_url,
                    is_active,
                    priority_weight,
                    monthly_budget_limit,
                    current_month_spend,
                    updated_at
                FROM api_credentials
                WHERE provider_id = ?1;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare get_credential query: {}", e)))?;

        let record = stmt
            .query_row(params![provider_id], Self::map_encrypted_row)
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => None,
                other => Some(DatabaseError::query_failed(format!("Failed to fetch credential: {}", other))),
            })
            .transpose()?;

        Ok(record)
    }

    /// Lists safe non-secret credential statuses for all configured providers.
    /// Never returns encrypted or decrypted API key material.
    pub fn list_statuses(conn: &Connection) -> Result<Vec<ProviderCredentialStatus>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT 
                    provider_id,
                    base_url,
                    is_active,
                    priority_weight,
                    monthly_budget_limit,
                    current_month_spend,
                    updated_at
                FROM api_credentials
                ORDER BY priority_weight DESC, provider_id ASC;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare list_statuses query: {}", e)))?;

        let rows = stmt
            .query_map([], Self::map_status_row)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute list_statuses query: {}", e)))?;

        let mut statuses = Vec::new();
        for row in rows {
            statuses.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map status row: {}", e)))?);
        }

        Ok(statuses)
    }

    /// Updates the active/inactive status of a provider credential.
    pub fn set_active(
        conn: &Connection,
        provider_id: &str,
        is_active: bool,
        updated_at: i64,
    ) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                UPDATE api_credentials
                SET is_active = ?2, updated_at = ?3
                WHERE provider_id = ?1;
                "#,
                params![provider_id, if is_active { 1 } else { 0 }, updated_at],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to update provider active status: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Updates the priority weight of a provider.
    pub fn set_priority(
        conn: &Connection,
        provider_id: &str,
        priority_weight: u8,
        updated_at: i64,
    ) -> Result<bool, DatabaseError> {
        let clamped = priority_weight.clamp(1, 10);
        let rows_affected = conn
            .execute(
                r#"
                UPDATE api_credentials
                SET priority_weight = ?2, updated_at = ?3
                WHERE provider_id = ?1;
                "#,
                params![provider_id, clamped as i64, updated_at],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to update provider priority: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Deletes a provider credential and its associated metadata.
    pub fn delete(conn: &Connection, provider_id: &str) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                "DELETE FROM api_credentials WHERE provider_id = ?1;",
                params![provider_id],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete provider credential: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Atomically updates non-secret provider preferences.
    /// Strictly preserves encrypted_api_key and current_month_spend.
    pub fn update_preferences(
        conn: &Connection,
        provider_id: &str,
        base_url: Option<&str>,
        is_active: bool,
        priority_weight: u8,
        monthly_budget_limit: Option<f64>,
        updated_at: i64,
    ) -> Result<bool, DatabaseError> {
        let clamped_priority = priority_weight.clamp(1, 10);
        let rows_affected = conn
            .execute(
                r#"
                UPDATE api_credentials
                SET base_url = ?2,
                    is_active = ?3,
                    priority_weight = ?4,
                    monthly_budget_limit = ?5,
                    updated_at = ?6
                WHERE provider_id = ?1;
                "#,
                params![
                    provider_id,
                    base_url,
                    if is_active { 1 } else { 0 },
                    clamped_priority as i64,
                    monthly_budget_limit,
                    updated_at,
                ],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to update provider preferences: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Resets provider preferences to documented defaults.
    /// Strictly preserves encrypted_api_key and current_month_spend.
    pub fn reset_preferences(
        conn: &Connection,
        provider_id: &str,
        default_base_url: Option<&str>,
        default_is_active: bool,
        default_priority: u8,
        default_budget: Option<f64>,
        updated_at: i64,
    ) -> Result<bool, DatabaseError> {
        Self::update_preferences(
            conn,
            provider_id,
            default_base_url,
            default_is_active,
            default_priority,
            default_budget,
            updated_at,
        )
    }

    /// Updates current month spend for a provider (accounting / usage recording).
    pub fn update_current_spend(
        conn: &Connection,
        provider_id: &str,
        current_month_spend: f64,
        updated_at: i64,
    ) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                UPDATE api_credentials
                SET current_month_spend = ?2, updated_at = ?3
                WHERE provider_id = ?1;
                "#,
                params![provider_id, current_month_spend, updated_at],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to update provider spend: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Purges all provider credentials (supports complete local data wipe).
    pub fn clear_all(conn: &Connection) -> Result<usize, DatabaseError> {
        let rows_affected = conn
            .execute("DELETE FROM api_credentials;", [])
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to clear all credentials: {}", e)))?;

        Ok(rows_affected)
    }
}

