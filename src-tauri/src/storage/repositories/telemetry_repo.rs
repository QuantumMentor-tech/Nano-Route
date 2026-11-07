// ============================================================================
// Nano Route - Telemetry Repository
// File: src-tauri/src/storage/repositories/telemetry_repo.rs
// ============================================================================
// Data access layer for operational telemetry persistence and aggregation.
// Strictly parameterized queries; zero string interpolations for values.
// ============================================================================

use crate::domain::{
    TelemetryAggregateReport, TelemetryEventType, TelemetryFilter, TelemetryOutcome, TelemetryRecord,
};
use crate::storage::errors::DatabaseError;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, Row};

pub struct TelemetryRepository;

impl TelemetryRepository {
    /// Maps a SQLite row into a TelemetryRecord domain entity.
    fn map_row(row: &Row) -> Result<TelemetryRecord, rusqlite::Error> {
        let event_type_str: String = row.get(1)?;
        let event_type = TelemetryEventType::from_str(&event_type_str).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                1,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            )
        })?;

        let outcome_str: String = row.get(9)?;
        let outcome = TelemetryOutcome::from_str(&outcome_str).map_err(|e| {
            rusqlite::Error::FromSqlConversionFailure(
                9,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e)),
            )
        })?;

        let latency_raw: Option<i64> = row.get(11)?;
        let prompt_tokens_raw: Option<i64> = row.get(12)?;
        let completion_tokens_raw: Option<i64> = row.get(13)?;

        Ok(TelemetryRecord {
            id: row.get(0)?,
            event_type,
            occurred_at: row.get(2)?,
            session_id: row.get(3)?,
            message_id: row.get(4)?,
            task_id: row.get(5)?,
            stream_id: row.get(6)?,
            provider_id: row.get(7)?,
            model_id: row.get(8)?,
            outcome,
            error_code: row.get(10)?,
            latency_ms: latency_raw.map(|l| l.max(0) as u64),
            prompt_tokens: prompt_tokens_raw.map(|t| t.max(0) as u32),
            completion_tokens: completion_tokens_raw.map(|t| t.max(0) as u32),
            cost_usd: row.get(14)?,
            confidence: row.get(15)?,
            routing_reason: row.get(16)?,
        })
    }

    /// Persists a single telemetry record into SQLite.
    pub fn insert(conn: &Connection, record: &TelemetryRecord) -> Result<(), DatabaseError> {
        conn.execute(
            r#"
            INSERT INTO telemetry_records (
                id,
                event_type,
                occurred_at,
                session_id,
                message_id,
                task_id,
                stream_id,
                provider_id,
                model_id,
                outcome,
                error_code,
                latency_ms,
                prompt_tokens,
                completion_tokens,
                cost_usd,
                confidence,
                routing_reason
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17);
            "#,
            params![
                record.id,
                record.event_type.as_str(),
                record.occurred_at,
                record.session_id,
                record.message_id,
                record.task_id,
                record.stream_id,
                record.provider_id,
                record.model_id,
                record.outcome.as_str(),
                record.error_code,
                record.latency_ms.map(|l| l as i64),
                record.prompt_tokens.map(|t| t as i64),
                record.completion_tokens.map(|t| t as i64),
                record.cost_usd,
                record.confidence,
                record.routing_reason,
            ],
        )
        .map_err(|e| DatabaseError::execution_failed(format!("Failed to insert telemetry record: {}", e)))?;

        Ok(())
    }

    /// Fetches a single telemetry record by primary key.
    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<TelemetryRecord>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT 
                    id, event_type, occurred_at, session_id, message_id,
                    task_id, stream_id, provider_id, model_id, outcome,
                    error_code, latency_ms, prompt_tokens, completion_tokens,
                    cost_usd, confidence, routing_reason
                FROM telemetry_records
                WHERE id = ?1;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare get_telemetry query: {}", e)))?;

        let record = stmt
            .query_row(params![id], Self::map_row)
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => None,
                other => Some(DatabaseError::query_failed(format!("Failed to fetch telemetry record: {}", other))),
            })
            .transpose()?;

        Ok(record)
    }

    /// Builds parameterized WHERE clauses from a TelemetryFilter.
    fn build_filter_clauses(
        filter: &TelemetryFilter,
    ) -> (String, Vec<Value>) {
        let mut conditions = Vec::new();
        let mut params = Vec::new();

        if let Some(start) = filter.start_time {
            params.push(Value::Integer(start));
            conditions.push(format!("occurred_at >= ?{}", params.len()));
        }

        if let Some(end) = filter.end_time {
            params.push(Value::Integer(end));
            conditions.push(format!("occurred_at <= ?{}", params.len()));
        }

        if let Some(ref session_id) = filter.session_id {
            params.push(Value::Text(session_id.clone()));
            conditions.push(format!("session_id = ?{}", params.len()));
        }

        if let Some(ref provider_id) = filter.provider_id {
            params.push(Value::Text(provider_id.clone()));
            conditions.push(format!("provider_id = ?{}", params.len()));
        }

        if let Some(ref model_id) = filter.model_id {
            params.push(Value::Text(model_id.clone()));
            conditions.push(format!("model_id = ?{}", params.len()));
        }

        if let Some(event_type) = filter.event_type {
            params.push(Value::Text(event_type.as_str().to_string()));
            conditions.push(format!("event_type = ?{}", params.len()));
        }

        if let Some(outcome) = filter.outcome {
            params.push(Value::Text(outcome.as_str().to_string()));
            conditions.push(format!("outcome = ?{}", params.len()));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        (where_clause, params)
    }

    /// Lists telemetry records matching filter criteria in reverse chronological order.
    pub fn list(
        conn: &Connection,
        filter: &TelemetryFilter,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TelemetryRecord>, DatabaseError> {
        let (where_clause, mut values) = Self::build_filter_clauses(filter);

        let sql = format!(
            r#"
            SELECT 
                id, event_type, occurred_at, session_id, message_id,
                task_id, stream_id, provider_id, model_id, outcome,
                error_code, latency_ms, prompt_tokens, completion_tokens,
                cost_usd, confidence, routing_reason
            FROM telemetry_records
            {}
            ORDER BY occurred_at DESC, id DESC
            LIMIT ?{} OFFSET ?{};
            "#,
            where_clause,
            values.len() + 1,
            values.len() + 2
        );

        values.push(Value::Integer(limit as i64));
        values.push(Value::Integer(offset as i64));

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare list_telemetry query: {}", e)))?;

        let rows = stmt
            .query_map(params_from_iter(values.iter()), Self::map_row)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute list_telemetry query: {}", e)))?;

        let mut records = Vec::new();
        for row in rows {
            records.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map telemetry row: {}", e)))?);
        }

        Ok(records)
    }

    /// Computes aggregated metrics over filtered telemetry facts.
    pub fn aggregate(
        conn: &Connection,
        filter: &TelemetryFilter,
    ) -> Result<TelemetryAggregateReport, DatabaseError> {
        let (where_clause, values) = Self::build_filter_clauses(filter);

        let sql = format!(
            r#"
            SELECT 
                COUNT(*),
                COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome != 'success' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(prompt_tokens), 0),
                COALESCE(SUM(completion_tokens), 0),
                COALESCE(SUM(cost_usd), 0.0),
                AVG(latency_ms),
                MIN(latency_ms),
                MAX(latency_ms)
            FROM telemetry_records
            {};
            "#,
            where_clause
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare aggregate_telemetry query: {}", e)))?;

        let report = stmt
            .query_row(params_from_iter(values.iter()), |row| {
                let total_events: i64 = row.get(0)?;
                let successful_events: i64 = row.get(1)?;
                let failed_events: i64 = row.get(2)?;
                let total_prompt_tokens: i64 = row.get(3)?;
                let total_completion_tokens: i64 = row.get(4)?;
                let total_cost_usd: f64 = row.get(5)?;
                let avg_latency_ms: Option<f64> = row.get(6)?;
                let min_latency_raw: Option<i64> = row.get(7)?;
                let max_latency_raw: Option<i64> = row.get(8)?;

                Ok(TelemetryAggregateReport {
                    total_events: total_events.max(0) as u64,
                    successful_events: successful_events.max(0) as u64,
                    failed_events: failed_events.max(0) as u64,
                    total_prompt_tokens: total_prompt_tokens.max(0) as u64,
                    total_completion_tokens: total_completion_tokens.max(0) as u64,
                    total_cost_usd,
                    avg_latency_ms,
                    min_latency_ms: min_latency_raw.map(|l| l.max(0) as u64),
                    max_latency_ms: max_latency_raw.map(|l| l.max(0) as u64),
                })
            })
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute aggregate_telemetry query: {}", e)))?;

        Ok(report)
    }

    /// Deletes a specific telemetry record by primary key.
    pub fn delete(conn: &Connection, id: &str) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                "DELETE FROM telemetry_records WHERE id = ?1;",
                params![id],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete telemetry record: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Deletes all telemetry records tied to a specific session.
    pub fn delete_by_session(conn: &Connection, session_id: &str) -> Result<usize, DatabaseError> {
        let rows_affected = conn
            .execute(
                "DELETE FROM telemetry_records WHERE session_id = ?1;",
                params![session_id],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete telemetry by session: {}", e)))?;

        Ok(rows_affected)
    }

    /// Deletes all telemetry records older than a specific timestamp (supports retention).
    pub fn delete_before(conn: &Connection, timestamp: i64) -> Result<usize, DatabaseError> {
        let rows_affected = conn
            .execute(
                "DELETE FROM telemetry_records WHERE occurred_at < ?1;",
                params![timestamp],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete telemetry before timestamp: {}", e)))?;

        Ok(rows_affected)
    }

    /// Purges all telemetry records (supports complete local data wipe).
    pub fn clear_all(conn: &Connection) -> Result<usize, DatabaseError> {
        let rows_affected = conn
            .execute("DELETE FROM telemetry_records;", [])
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to clear all telemetry records: {}", e)))?;

        Ok(rows_affected)
    }
}

