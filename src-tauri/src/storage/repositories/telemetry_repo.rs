// ============================================================================
// Nano Route - Telemetry Repository
// File: src-tauri/src/storage/repositories/telemetry_repo.rs
// ============================================================================
// Data access layer for operational telemetry persistence and aggregation.
// Strictly parameterized queries; zero string interpolations for values.
// ============================================================================

use crate::domain::{
    resolve_provider_display_name, CostAvailabilityState, LatencyProvenanceState,
    LatencySampleSufficiency, SavingsComparisonStatus, TelemetryActualCostSummary,
    TelemetryAggregateReport, TelemetryBaselineSummary, TelemetryCompletenessSummary,
    TelemetryConfidenceBucket, TelemetryConfidenceDistribution, TelemetryCostTrendPoint,
    TelemetryDashboardFilters, TelemetryDashboardSnapshot, TelemetryDashboardSummary,
    TelemetryEventType, TelemetryFilter, TelemetryFilterOptionsDto, TelemetryFinancialAnalytics,
    TelemetryFinancialCoverageSummary, TelemetryFinancialExportRow, TelemetryLatencyDataQualitySummary,
    TelemetryLatencyHistogram, TelemetryLatencyHistogramBucket, TelemetryLatencySummary,
    TelemetryLatencyTrendPoint, TelemetryLogicalLatencySummary, TelemetryModelCostSummary,
    TelemetryModelLatencySummary, TelemetryModelOption, TelemetryModelSummary,
    TelemetryModelTokenSummary, TelemetryOutcome, TelemetryOutcomeLatencySummary,
    TelemetryOutcomeSummary, TelemetryPerformanceAnalytics, TelemetryProviderCostSummary,
    TelemetryProviderLatencySummary, TelemetryProviderOption, TelemetryProviderSummary,
    TelemetryProviderTokenSummary, TelemetryRecord, TelemetryRetryFailoverSummary,
    TelemetryRoutingOverheadSummary, TelemetrySavingsSummary, TelemetryStreamingPerformanceSummary,
    TelemetryTimeBucket, TelemetryTimeSeriesPoint, TelemetryTokenSummary, TelemetryTokenTrendPoint,
    TokenDataSource,
};
use crate::providers::{
    builtin_versioned_pricing_table, nano_usd_to_f64, resolve_versioned_model_pricing,
    usd_to_nano_usd, VersionedModelPricingEntry, DEFAULT_BASELINE_MODEL_ID,
    DEFAULT_BASELINE_PROVIDER_ID,
};
use crate::storage::errors::DatabaseError;
use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection, Row};
use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};

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

    // ========================================================================
    // Step 42: Read-Only Dashboard Snapshot Aggregation Queries
    // ========================================================================

    fn build_dashboard_filter_clauses(
        filters: &TelemetryDashboardFilters,
    ) -> (String, Vec<Value>) {
        let mut conditions = Vec::new();
        let mut params = Vec::new();

        if let Some(start) = filters.start_time {
            params.push(Value::Integer(start));
            conditions.push(format!("occurred_at >= ?{}", params.len()));
        }

        if let Some(end) = filters.end_time {
            params.push(Value::Integer(end));
            conditions.push(format!("occurred_at <= ?{}", params.len()));
        }

        if let Some(ref provider_id) = filters.provider_id {
            let trimmed = provider_id.trim();
            if !trimmed.is_empty() {
                if trimmed.eq_ignore_ascii_case("unrecorded") {
                    conditions.push("(provider_id IS NULL OR TRIM(provider_id) = '')".to_string());
                } else {
                    params.push(Value::Text(trimmed.to_string()));
                    conditions.push(format!("provider_id = ?{}", params.len()));
                }
            }
        }

        if let Some(ref model_id) = filters.model_id {
            let trimmed = model_id.trim();
            if !trimmed.is_empty() {
                if trimmed.eq_ignore_ascii_case("unrecorded") {
                    conditions.push("(model_id IS NULL OR TRIM(model_id) = '')".to_string());
                } else {
                    params.push(Value::Text(trimmed.to_string()));
                    conditions.push(format!("model_id = ?{}", params.len()));
                }
            }
        }

        if let Some(ref outcome) = filters.outcome {
            let trimmed = outcome.trim().to_lowercase();
            if !trimmed.is_empty() {
                params.push(Value::Text(trimmed));
                conditions.push(format!("LOWER(outcome) = ?{}", params.len()));
            }
        }

        if let Some(event_type) = filters.event_type {
            params.push(Value::Text(event_type.as_str().to_string()));
            conditions.push(format!("event_type = ?{}", params.len()));
        }

        let where_clause = if conditions.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", conditions.join(" AND "))
        };

        (where_clause, params)
    }

    fn compute_percentage(part: u64, total: u64) -> Option<f64> {
        if total == 0 {
            None
        } else {
            Some(((part as f64 / total as f64) * 1000.0).round() / 10.0)
        }
    }

    /// Computes a coherent, read-only `TelemetryDashboardSnapshot` in SQLite.
    /// Guarantees every chart/table section honors the exact same filter scope.
    pub fn aggregate_dashboard_snapshot(
        conn: &Connection,
        filters: &TelemetryDashboardFilters,
        generated_at_ms: i64,
    ) -> Result<TelemetryDashboardSnapshot, DatabaseError> {
        let (where_clause, values) = Self::build_dashboard_filter_clauses(filters);

        // 1. Single-pass scalar summary, completeness, confidence, and failover scan
        let summary_sql = format!(
            r#"
            SELECT
                COUNT(*),
                COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome IN ('failure', 'timeout', 'rate_limited', 'unavailable') THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'cancelled' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'fallback' OR event_type = 'fallback_transition' OR routing_reason LIKE 'Failover from %' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN (outcome = 'fallback' OR event_type = 'fallback_transition' OR routing_reason LIKE 'Failover from %') AND outcome IN ('success', 'fallback') THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN (event_type = 'fallback_transition' OR routing_reason LIKE 'Failover from %') AND outcome IN ('failure', 'timeout', 'rate_limited', 'unavailable') THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'timeout' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'rate_limited' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN confidence IS NOT NULL AND confidence >= 0.0 AND confidence <= 1.0 THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN confidence >= 0.0 AND confidence < 0.25 THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN confidence >= 0.25 AND confidence < 0.50 THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN confidence >= 0.50 AND confidence < 0.75 THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN confidence >= 0.75 AND confidence <= 1.00 THEN 1 ELSE 0 END), 0),
                MIN(CASE WHEN confidence >= 0.0 AND confidence <= 1.0 THEN confidence ELSE NULL END),
                MAX(CASE WHEN confidence >= 0.0 AND confidence <= 1.0 THEN confidence ELSE NULL END),
                COALESCE(SUM(CASE WHEN provider_id IS NOT NULL AND TRIM(provider_id) != '' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN model_id IS NOT NULL AND TRIM(model_id) != '' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome IS NOT NULL AND TRIM(outcome) != '' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN routing_reason IS NOT NULL AND TRIM(routing_reason) != '' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN session_id IS NOT NULL AND TRIM(session_id) != '' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN provider_id IS NOT NULL AND TRIM(provider_id) != '' AND model_id IS NOT NULL AND TRIM(model_id) != '' AND outcome IS NOT NULL AND TRIM(outcome) != '' AND routing_reason IS NOT NULL AND TRIM(routing_reason) != '' THEN 1 ELSE 0 END), 0),
                MIN(occurred_at),
                MAX(occurred_at)
            FROM telemetry_records
            {};
            "#,
            where_clause
        );

        let (
            total_records,
            successful_executions,
            failed_executions,
            cancelled_executions,
            fallback_executions,
            fallback_success_count,
            fallback_failure_count,
            timeout_outcome_count,
            rate_limited_outcome_count,
            conf_available,
            conf_b0,
            conf_b1,
            conf_b2,
            conf_b3,
            min_confidence,
            max_confidence,
            provider_recorded_count,
            model_recorded_count,
            outcome_recorded_count,
            routing_reason_recorded_count,
            session_correlation_count,
            complete_metadata_count,
            earliest_record_at_ms,
            latest_record_at_ms,
        ) = conn
            .query_row(&summary_sql, params_from_iter(values.iter()), |row| {
                Ok((
                    row.get::<_, i64>(0)?.max(0) as u64,
                    row.get::<_, i64>(1)?.max(0) as u64,
                    row.get::<_, i64>(2)?.max(0) as u64,
                    row.get::<_, i64>(3)?.max(0) as u64,
                    row.get::<_, i64>(4)?.max(0) as u64,
                    row.get::<_, i64>(5)?.max(0) as u64,
                    row.get::<_, i64>(6)?.max(0) as u64,
                    row.get::<_, i64>(7)?.max(0) as u64,
                    row.get::<_, i64>(8)?.max(0) as u64,
                    row.get::<_, i64>(9)?.max(0) as u64,
                    row.get::<_, i64>(10)?.max(0) as u64,
                    row.get::<_, i64>(11)?.max(0) as u64,
                    row.get::<_, i64>(12)?.max(0) as u64,
                    row.get::<_, i64>(13)?.max(0) as u64,
                    row.get::<_, Option<f64>>(14)?,
                    row.get::<_, Option<f64>>(15)?,
                    row.get::<_, i64>(16)?.max(0) as u64,
                    row.get::<_, i64>(17)?.max(0) as u64,
                    row.get::<_, i64>(18)?.max(0) as u64,
                    row.get::<_, i64>(19)?.max(0) as u64,
                    row.get::<_, i64>(20)?.max(0) as u64,
                    row.get::<_, i64>(21)?.max(0) as u64,
                    row.get::<_, Option<i64>>(22)?,
                    row.get::<_, Option<i64>>(23)?,
                ))
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!(
                    "Failed to execute dashboard summary query: {}",
                    e
                ))
            })?;

        let terminal_executions =
            successful_executions + failed_executions + cancelled_executions;
        let success_rate_percent =
            Self::compute_percentage(successful_executions, terminal_executions);

        let summary = TelemetryDashboardSummary {
            total_routed_requests: total_records,
            successful_executions,
            failed_executions,
            cancelled_executions,
            fallback_executions,
            terminal_executions,
            success_rate_percent,
        };

        // 2. Provider Distribution (deterministic: request_count DESC, provider_id ASC)
        let provider_sql = format!(
            r#"
            SELECT
                COALESCE(NULLIF(TRIM(provider_id), ''), 'unrecorded') AS provider_key,
                COUNT(*) AS req_count,
                COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome IN ('failure', 'timeout', 'rate_limited', 'unavailable') THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'cancelled' THEN 1 ELSE 0 END), 0)
            FROM telemetry_records
            {}
            GROUP BY provider_key
            ORDER BY req_count DESC, provider_key ASC
            LIMIT 100;
            "#,
            where_clause
        );

        let mut provider_stmt = conn.prepare(&provider_sql).map_err(|e| {
            DatabaseError::query_failed(format!("Failed to prepare provider distribution: {}", e))
        })?;
        let provider_rows = provider_stmt
            .query_map(params_from_iter(values.iter()), |row| {
                let raw_prov: String = row.get(0)?;
                let req_count = row.get::<_, i64>(1)?.max(0) as u64;
                let succ_count = row.get::<_, i64>(2)?.max(0) as u64;
                let fail_count = row.get::<_, i64>(3)?.max(0) as u64;
                let canc_count = row.get::<_, i64>(4)?.max(0) as u64;

                let (_, display_name, is_hist) = if raw_prov == "unrecorded" {
                    resolve_provider_display_name(None)
                } else {
                    resolve_provider_display_name(Some(&raw_prov))
                };

                Ok(TelemetryProviderSummary {
                    provider_id: raw_prov,
                    display_name,
                    is_historical_or_unrecorded: is_hist,
                    request_count: req_count,
                    success_count: succ_count,
                    failure_count: fail_count,
                    cancelled_count: canc_count,
                    percentage_of_total: Self::compute_percentage(req_count, total_records),
                })
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!(
                    "Failed to execute provider distribution: {}",
                    e
                ))
            })?;

        let mut provider_distribution = Vec::new();
        for item in provider_rows {
            provider_distribution.push(item.map_err(|e| {
                DatabaseError::query_failed(format!("Failed to map provider summary row: {}", e))
            })?);
        }

        // 3. Model Distribution (deterministic: request_count DESC, provider_id ASC, model_id ASC)
        let model_sql = format!(
            r#"
            SELECT
                COALESCE(NULLIF(TRIM(provider_id), ''), 'unrecorded') AS provider_key,
                COALESCE(NULLIF(TRIM(model_id), ''), 'unrecorded') AS model_key,
                COUNT(*) AS req_count,
                COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome IN ('failure', 'timeout', 'rate_limited', 'unavailable') THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'cancelled' THEN 1 ELSE 0 END), 0)
            FROM telemetry_records
            {}
            GROUP BY provider_key, model_key
            ORDER BY req_count DESC, provider_key ASC, model_key ASC
            LIMIT 100;
            "#,
            where_clause
        );

        let mut model_stmt = conn.prepare(&model_sql).map_err(|e| {
            DatabaseError::query_failed(format!("Failed to prepare model distribution: {}", e))
        })?;
        let model_rows = model_stmt
            .query_map(params_from_iter(values.iter()), |row| {
                let raw_prov: String = row.get(0)?;
                let raw_model: String = row.get(1)?;
                let req_count = row.get::<_, i64>(2)?.max(0) as u64;
                let succ_count = row.get::<_, i64>(3)?.max(0) as u64;
                let fail_count = row.get::<_, i64>(4)?.max(0) as u64;
                let canc_count = row.get::<_, i64>(5)?.max(0) as u64;

                let (_, prov_display, prov_hist) = if raw_prov == "unrecorded" {
                    resolve_provider_display_name(None)
                } else {
                    resolve_provider_display_name(Some(&raw_prov))
                };

                let is_unrec = raw_model == "unrecorded" || prov_hist;

                Ok(TelemetryModelSummary {
                    provider_id: raw_prov,
                    provider_display_name: prov_display,
                    model_id: raw_model,
                    is_historical_or_unrecorded: is_unrec,
                    request_count: req_count,
                    success_count: succ_count,
                    failure_count: fail_count,
                    cancelled_count: canc_count,
                    percentage_of_total: Self::compute_percentage(req_count, total_records),
                })
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!("Failed to execute model distribution: {}", e))
            })?;

        let mut model_distribution = Vec::new();
        for item in model_rows {
            model_distribution.push(item.map_err(|e| {
                DatabaseError::query_failed(format!("Failed to map model summary row: {}", e))
            })?);
        }

        // 4. Outcome Distribution
        let outcome_sql = format!(
            r#"
            SELECT
                COALESCE(NULLIF(LOWER(TRIM(outcome)), ''), 'unknown') AS outcome_key,
                COUNT(*) AS cnt
            FROM telemetry_records
            {}
            GROUP BY outcome_key
            ORDER BY cnt DESC, outcome_key ASC;
            "#,
            where_clause
        );

        let mut outcome_stmt = conn.prepare(&outcome_sql).map_err(|e| {
            DatabaseError::query_failed(format!("Failed to prepare outcome distribution: {}", e))
        })?;
        let outcome_rows = outcome_stmt
            .query_map(params_from_iter(values.iter()), |row| {
                let raw_out: String = row.get(0)?;
                let cnt = row.get::<_, i64>(1)?.max(0) as u64;
                let label = TelemetryOutcome::from_str(&raw_out)
                    .map(|o| o.display_label().to_string())
                    .unwrap_or_else(|_| "Unknown".to_string());
                Ok(TelemetryOutcomeSummary {
                    outcome: raw_out,
                    label,
                    count: cnt,
                    percentage_of_total: Self::compute_percentage(cnt, total_records),
                })
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!(
                    "Failed to execute outcome distribution: {}",
                    e
                ))
            })?;

        let mut outcome_distribution = Vec::new();
        for item in outcome_rows {
            outcome_distribution.push(item.map_err(|e| {
                DatabaseError::query_failed(format!("Failed to map outcome summary row: {}", e))
            })?);
        }

        // 5. Bounded Time-Series Activity
        let bucket_mode = filters.time_bucket.unwrap_or_else(|| {
            if let (Some(s), Some(e)) = (filters.start_time, filters.end_time) {
                if e.saturating_sub(s) <= 48 * 3_600_000 {
                    TelemetryTimeBucket::Hour
                } else {
                    TelemetryTimeBucket::Day
                }
            } else {
                TelemetryTimeBucket::Day
            }
        });

        let bucket_ms: i64 = match bucket_mode {
            TelemetryTimeBucket::Hour => 3_600_000,
            TelemetryTimeBucket::Day => 86_400_000,
        };

        let ts_sql = format!(
            r#"
            SELECT
                (occurred_at / {0}) * {0} AS bucket_start,
                COUNT(*) AS req_count,
                COALESCE(SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome IN ('failure', 'timeout', 'rate_limited', 'unavailable') THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN outcome = 'cancelled' THEN 1 ELSE 0 END), 0)
            FROM telemetry_records
            {1}
            GROUP BY bucket_start
            ORDER BY bucket_start ASC
            LIMIT 366;
            "#,
            bucket_ms, where_clause
        );

        let mut ts_stmt = conn.prepare(&ts_sql).map_err(|e| {
            DatabaseError::query_failed(format!("Failed to prepare time-series query: {}", e))
        })?;
        let ts_rows = ts_stmt
            .query_map(params_from_iter(values.iter()), |row| {
                let bucket_start_ms: i64 = row.get(0)?;
                let req_count = row.get::<_, i64>(1)?.max(0) as u64;
                let succ_count = row.get::<_, i64>(2)?.max(0) as u64;
                let fail_count = row.get::<_, i64>(3)?.max(0) as u64;
                let canc_count = row.get::<_, i64>(4)?.max(0) as u64;

                Ok(TelemetryTimeSeriesPoint {
                    bucket_start_ms,
                    bucket_label: format!("{}", bucket_start_ms),
                    request_count: req_count,
                    success_count: succ_count,
                    failure_count: fail_count,
                    cancelled_count: canc_count,
                })
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!("Failed to execute time-series query: {}", e))
            })?;

        let mut time_series = Vec::new();
        for item in ts_rows {
            time_series.push(item.map_err(|e| {
                DatabaseError::query_failed(format!("Failed to map time-series row: {}", e))
            })?);
        }

        // 6. Confidence Distribution
        let missing_confidence = total_records.saturating_sub(conf_available);
        let confidence_buckets = vec![
            TelemetryConfidenceBucket {
                bucket_key: "0.00_0.25".to_string(),
                label: "0.00 – 0.24".to_string(),
                min_inclusive: 0.0,
                max_inclusive: 0.2499,
                count: conf_b0,
                percentage_of_available: Self::compute_percentage(conf_b0, conf_available),
            },
            TelemetryConfidenceBucket {
                bucket_key: "0.25_0.50".to_string(),
                label: "0.25 – 0.49".to_string(),
                min_inclusive: 0.25,
                max_inclusive: 0.4999,
                count: conf_b1,
                percentage_of_available: Self::compute_percentage(conf_b1, conf_available),
            },
            TelemetryConfidenceBucket {
                bucket_key: "0.50_0.75".to_string(),
                label: "0.50 – 0.74".to_string(),
                min_inclusive: 0.50,
                max_inclusive: 0.7499,
                count: conf_b2,
                percentage_of_available: Self::compute_percentage(conf_b2, conf_available),
            },
            TelemetryConfidenceBucket {
                bucket_key: "0.75_1.00".to_string(),
                label: "0.75 – 1.00".to_string(),
                min_inclusive: 0.75,
                max_inclusive: 1.0,
                count: conf_b3,
                percentage_of_available: Self::compute_percentage(conf_b3, conf_available),
            },
        ];

        let confidence_distribution = TelemetryConfidenceDistribution {
            available_count: conf_available,
            missing_count: missing_confidence,
            min_confidence,
            max_confidence,
            buckets: confidence_buckets,
        };

        // 7. Retry & Failover Operational Summary
        let retry_failover = TelemetryRetryFailoverSummary {
            failover_data_available: total_records > 0,
            failover_involved_count: fallback_executions,
            fallback_success_count,
            fallback_failure_count,
            timeout_outcome_count,
            rate_limited_outcome_count,
            // Explicitly false: `telemetry_records` does not store a retry counter column
            retry_data_available: false,
            retry_execution_count: None,
        };

        // 8. Completeness Summary
        let completeness = TelemetryCompletenessSummary {
            total_records,
            provider_recorded_count,
            provider_recorded_percent: Self::compute_percentage(
                provider_recorded_count,
                total_records,
            ),
            model_recorded_count,
            model_recorded_percent: Self::compute_percentage(model_recorded_count, total_records),
            outcome_recorded_count,
            outcome_recorded_percent: Self::compute_percentage(
                outcome_recorded_count,
                total_records,
            ),
            routing_reason_recorded_count,
            routing_reason_recorded_percent: Self::compute_percentage(
                routing_reason_recorded_count,
                total_records,
            ),
            confidence_recorded_count: conf_available,
            confidence_recorded_percent: Self::compute_percentage(conf_available, total_records),
            session_correlation_count,
            session_correlation_percent: Self::compute_percentage(
                session_correlation_count,
                total_records,
            ),
            complete_metadata_count,
            complete_metadata_percent: Self::compute_percentage(
                complete_metadata_count,
                total_records,
            ),
            incomplete_records_count: total_records.saturating_sub(complete_metadata_count),
            earliest_record_at_ms,
            latest_record_at_ms,
        };

        // 9. Global Filter Options Discovery across all stored telemetry records
        let filter_options = Self::discover_filter_options(conn)?;

        // 10. Step 43 Token Usage, Cost Analytics & Routing Savings Snapshot
        let financial_analytics =
            Self::aggregate_financial_analytics(conn, filters, generated_at_ms)?;

        // 11. Step 44 Latency, Execution Performance & Benchmark Analytics Snapshot
        let performance_analytics =
            Self::aggregate_performance_analytics(conn, filters, generated_at_ms)?;

        Ok(TelemetryDashboardSnapshot {
            query_id: filters.query_id.clone(),
            generated_at_ms,
            applied_filters: filters.clone(),
            filter_options,
            summary,
            time_series,
            provider_distribution,
            model_distribution,
            outcome_distribution,
            retry_failover,
            confidence_distribution,
            completeness,
            financial_analytics,
            performance_analytics,
        })
    }

    // ========================================================================
    // Step 43: Read-Only Token Usage, Cost Analytics & Routing Savings Engine
    // ========================================================================

    /// Computes the authoritative Step 43 `TelemetryFinancialAnalytics` snapshot for `filters`.
    pub fn aggregate_financial_analytics(
        conn: &Connection,
        filters: &TelemetryDashboardFilters,
        generated_at_ms: i64,
    ) -> Result<TelemetryFinancialAnalytics, DatabaseError> {
        let pricing_table = builtin_versioned_pricing_table();
        Self::aggregate_financial_analytics_with_pricing(
            conn,
            filters,
            generated_at_ms,
            &pricing_table,
        )
    }

    pub fn aggregate_financial_analytics_with_pricing(
        conn: &Connection,
        filters: &TelemetryDashboardFilters,
        generated_at_ms: i64,
        pricing_table: &[VersionedModelPricingEntry],
    ) -> Result<TelemetryFinancialAnalytics, DatabaseError> {
        let (where_clause, values) = Self::build_dashboard_filter_clauses(filters);

        let bucket_mode = filters.time_bucket.unwrap_or_else(|| {
            if let (Some(s), Some(e)) = (filters.start_time, filters.end_time) {
                if e.saturating_sub(s) <= 48 * 3_600_000 {
                    TelemetryTimeBucket::Hour
                } else {
                    TelemetryTimeBucket::Day
                }
            } else {
                TelemetryTimeBucket::Day
            }
        });
        let bucket_ms: i64 = match bucket_mode {
            TelemetryTimeBucket::Hour => 3_600_000,
            TelemetryTimeBucket::Day => 86_400_000,
        };

        let baseline_prov = filters
            .baseline_provider_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_BASELINE_PROVIDER_ID)
            .to_lowercase();
        let baseline_mod = filters
            .baseline_model_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_BASELINE_MODEL_ID)
            .to_string();

        let (_, baseline_prov_display, _) = resolve_provider_display_name(Some(&baseline_prov));
        let baseline_mod_display = pricing_table
            .iter()
            .find(|p| {
                p.provider_id.eq_ignore_ascii_case(&baseline_prov)
                    && p.model_id.eq_ignore_ascii_case(&baseline_mod)
            })
            .map(|p| p.display_name.clone())
            .unwrap_or_else(|| baseline_mod.clone());

        #[derive(Clone)]
        struct RawFinRow {
            id: String,
            event_type: String,
            occurred_at: i64,
            message_id: Option<String>,
            task_id: Option<String>,
            stream_id: Option<String>,
            provider_id: Option<String>,
            model_id: Option<String>,
            prompt_tokens: Option<i64>,
            completion_tokens: Option<i64>,
            cost_usd: Option<f64>,
        }

        let sql = format!(
            r#"
            SELECT
                id,
                event_type,
                occurred_at,
                NULLIF(TRIM(message_id), ''),
                NULLIF(TRIM(task_id), ''),
                NULLIF(TRIM(stream_id), ''),
                NULLIF(TRIM(provider_id), ''),
                NULLIF(TRIM(model_id), ''),
                prompt_tokens,
                completion_tokens,
                cost_usd
            FROM telemetry_records
            {}
            ORDER BY occurred_at ASC, id ASC;
            "#,
            where_clause
        );

        let mut stmt = conn.prepare(&sql).map_err(|e| {
            DatabaseError::query_failed(format!(
                "Failed to prepare financial analytics query: {}",
                e
            ))
        })?;

        let mapped = stmt
            .query_map(params_from_iter(values.iter()), |row| {
                Ok(RawFinRow {
                    id: row.get(0)?,
                    event_type: row.get(1)?,
                    occurred_at: row.get(2)?,
                    message_id: row.get(3)?,
                    task_id: row.get(4)?,
                    stream_id: row.get(5)?,
                    provider_id: row.get(6)?,
                    model_id: row.get(7)?,
                    prompt_tokens: row.get(8)?,
                    completion_tokens: row.get(9)?,
                    cost_usd: row.get(10)?,
                })
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!(
                    "Failed to execute financial analytics query: {}",
                    e
                ))
            })?;

        let mut rows = Vec::new();
        for r in mapped {
            rows.push(r.map_err(|e| {
                DatabaseError::query_failed(format!("Failed to map financial row: {}", e))
            })?);
        }

        // First pass: identify execution-correlated IDs and terminal stream_lifecycle IDs
        let mut exec_task_ids = HashSet::new();
        let mut exec_msg_ids = HashSet::new();
        let mut exec_stream_ids = HashSet::new();
        let mut last_stream_lifecycle_id_by_stream: HashMap<String, String> = HashMap::new();

        for r in &rows {
            let et = r.event_type.as_str();
            if et == "provider_execution" || et == "fallback_transition" {
                if let Some(ref tid) = r.task_id {
                    exec_task_ids.insert(tid.clone());
                }
                if let Some(ref mid) = r.message_id {
                    exec_msg_ids.insert(mid.clone());
                }
                if let Some(ref sid) = r.stream_id {
                    exec_stream_ids.insert(sid.clone());
                }
            } else if et == "stream_lifecycle" {
                if let Some(ref sid) = r.stream_id {
                    last_stream_lifecycle_id_by_stream.insert(sid.clone(), r.id.clone());
                }
            }
        }

        let mut duplicate_or_intermediate_events_excluded: u64 = 0;
        let mut physical_attempts: Vec<RawFinRow> = Vec::with_capacity(rows.len());

        for r in rows {
            let et = r.event_type.as_str();
            let mut exclude = false;

            if et == "stream_lifecycle" {
                if r.stream_id.as_ref().is_some_and(|s| exec_stream_ids.contains(s))
                    || r.task_id.as_ref().is_some_and(|t| exec_task_ids.contains(t))
                    || r.message_id.as_ref().is_some_and(|m| exec_msg_ids.contains(m))
                {
                    exclude = true;
                } else if let Some(ref sid) = r.stream_id {
                    if last_stream_lifecycle_id_by_stream
                        .get(sid)
                        .is_some_and(|last_id| last_id != &r.id)
                    {
                        exclude = true;
                    }
                }
            } else if et == "routing_decision" || et == "system_event" {
                if r.task_id.as_ref().is_some_and(|t| exec_task_ids.contains(t))
                    || r.message_id.as_ref().is_some_and(|m| exec_msg_ids.contains(m))
                {
                    exclude = true;
                }
            }

            if exclude {
                duplicate_or_intermediate_events_excluded += 1;
            } else {
                physical_attempts.push(r);
            }
        }

        let physical_attempt_count = physical_attempts.len() as u64;
        let mut logical_requests_set: HashSet<String> = HashSet::new();
        let mut cost_eligible_logical_requests: HashSet<String> = HashSet::new();

        let mut input_tokens_available_count: u64 = 0;
        let mut output_tokens_available_count: u64 = 0;
        let mut both_tokens_available_count: u64 = 0;
        let mut sum_input_tokens: u64 = 0;
        let mut sum_output_tokens: u64 = 0;
        let mut sum_both_total_tokens: u64 = 0;

        let mut cost_eligible_attempt_count: u64 = 0;
        let mut zero_cost_attempt_count: u64 = 0;
        let mut total_actual_cost_nano: i128 = 0;

        let mut compat_cost_token_count: u64 = 0;
        let mut compat_total_tokens: u64 = 0;
        let mut compat_cost_nano: i128 = 0;

        let mut savings_eligible_count: u64 = 0;
        let mut missing_token_data_count: u64 = 0;
        let mut missing_actual_cost_count: u64 = 0;
        let mut missing_baseline_pricing_count: u64 = 0;
        let mut baseline_pricing_coverage_count: u64 = 0;
        let mut eligible_actual_cost_nano: i128 = 0;
        let mut baseline_cost_nano: i128 = 0;
        let mut pricing_versions_set: BTreeSet<String> = BTreeSet::new();

        #[derive(Default)]
        struct GroupFinAcc {
            attempt_count: u64,
            logical_requests: HashSet<String>,
            token_eligible_count: u64,
            input_available_count: u64,
            output_available_count: u64,
            input_tokens: u64,
            output_tokens: u64,
            total_tokens: u64,
            cost_eligible_count: u64,
            actual_cost_nano: i128,
            savings_eligible_count: u64,
            eligible_actual_cost_nano: i128,
            baseline_cost_nano: i128,
        }

        let mut provider_acc: BTreeMap<String, GroupFinAcc> = BTreeMap::new();
        let mut model_acc: BTreeMap<(String, String), GroupFinAcc> = BTreeMap::new();
        let mut bucket_acc: BTreeMap<i64, GroupFinAcc> = BTreeMap::new();
        let mut export_acc: BTreeMap<(i64, String, String), GroupFinAcc> = BTreeMap::new();

        for r in &physical_attempts {
            let logical_key = if let Some(ref tid) = r.task_id {
                format!("task:{}", tid)
            } else if let Some(ref mid) = r.message_id {
                format!("msg:{}", mid)
            } else if let Some(ref sid) = r.stream_id {
                format!("stream:{}", sid)
            } else {
                format!("rec:{}", r.id)
            };
            logical_requests_set.insert(logical_key.clone());

            let prov_key = r
                .provider_id
                .clone()
                .unwrap_or_else(|| "unrecorded".to_string());
            let mod_key = r
                .model_id
                .clone()
                .unwrap_or_else(|| "unrecorded".to_string());
            let bucket_start = (r.occurred_at.max(0) / bucket_ms) * bucket_ms;

            let valid_in = r.prompt_tokens.filter(|&v| v >= 0).map(|v| v as u64);
            let valid_out = r.completion_tokens.filter(|&v| v >= 0).map(|v| v as u64);
            let valid_both = match (valid_in, valid_out) {
                (Some(i), Some(o)) => Some((i, o, i.saturating_add(o))),
                _ => None,
            };

            if let Some(i) = valid_in {
                input_tokens_available_count += 1;
                sum_input_tokens = sum_input_tokens.saturating_add(i);
            }
            if let Some(o) = valid_out {
                output_tokens_available_count += 1;
                sum_output_tokens = sum_output_tokens.saturating_add(o);
            }
            if let Some((_, _, tot)) = valid_both {
                both_tokens_available_count += 1;
                sum_both_total_tokens = sum_both_total_tokens.saturating_add(tot);
            } else {
                missing_token_data_count += 1;
            }

            let valid_cost_nano = r.cost_usd.and_then(usd_to_nano_usd);
            if let Some(c_nano) = valid_cost_nano {
                cost_eligible_attempt_count += 1;
                cost_eligible_logical_requests.insert(logical_key.clone());
                if c_nano == 0 {
                    zero_cost_attempt_count += 1;
                }
                total_actual_cost_nano = total_actual_cost_nano.saturating_add(c_nano);
            } else {
                missing_actual_cost_count += 1;
            }

            if let (Some(c_nano), Some((_, _, tot))) = (valid_cost_nano, valid_both) {
                compat_cost_token_count += 1;
                compat_total_tokens = compat_total_tokens.saturating_add(tot);
                compat_cost_nano = compat_cost_nano.saturating_add(c_nano);
            }

            let base_pricing_opt = resolve_versioned_model_pricing(
                pricing_table,
                &baseline_prov,
                &baseline_mod,
                r.occurred_at,
            );
            if base_pricing_opt.is_some() {
                baseline_pricing_coverage_count += 1;
            } else {
                missing_baseline_pricing_count += 1;
            }

            let savings_tuple = match (valid_both, valid_cost_nano, base_pricing_opt) {
                (Some((in_t, out_t, _)), Some(act_nano), Some(bp)) => {
                    let b_nano = bp.compute_cost_nano_usd(in_t, out_t);
                    pricing_versions_set.insert(bp.pricing_version.clone());
                    savings_eligible_count += 1;
                    eligible_actual_cost_nano = eligible_actual_cost_nano.saturating_add(act_nano);
                    baseline_cost_nano = baseline_cost_nano.saturating_add(b_nano);
                    Some((act_nano, b_nano))
                }
                _ => None,
            };

            let mut apply_to_acc = |acc: &mut GroupFinAcc| {
                acc.attempt_count += 1;
                acc.logical_requests.insert(logical_key.clone());
                if let Some(i) = valid_in {
                    acc.input_available_count += 1;
                    acc.input_tokens = acc.input_tokens.saturating_add(i);
                }
                if let Some(o) = valid_out {
                    acc.output_available_count += 1;
                    acc.output_tokens = acc.output_tokens.saturating_add(o);
                }
                if let Some((_, _, tot)) = valid_both {
                    acc.token_eligible_count += 1;
                    acc.total_tokens = acc.total_tokens.saturating_add(tot);
                }
                if let Some(c_nano) = valid_cost_nano {
                    acc.cost_eligible_count += 1;
                    acc.actual_cost_nano = acc.actual_cost_nano.saturating_add(c_nano);
                }
                if let Some((act_nano, b_nano)) = savings_tuple {
                    acc.savings_eligible_count += 1;
                    acc.eligible_actual_cost_nano =
                        acc.eligible_actual_cost_nano.saturating_add(act_nano);
                    acc.baseline_cost_nano = acc.baseline_cost_nano.saturating_add(b_nano);
                }
            };

            apply_to_acc(provider_acc.entry(prov_key.clone()).or_default());
            apply_to_acc(
                model_acc
                    .entry((prov_key.clone(), mod_key.clone()))
                    .or_default(),
            );
            apply_to_acc(bucket_acc.entry(bucket_start).or_default());
            apply_to_acc(
                export_acc
                    .entry((bucket_start, prov_key, mod_key))
                    .or_default(),
            );
        }

        let logical_request_count = logical_requests_set.len() as u64;
        let missing_cost_attempt_count =
            physical_attempt_count.saturating_sub(cost_eligible_attempt_count);

        let token_summary = TelemetryTokenSummary {
            logical_request_count,
            physical_attempt_count,
            duplicate_or_intermediate_events_excluded,
            input_tokens_available_count,
            output_tokens_available_count,
            both_tokens_available_count,
            missing_token_records_count: missing_token_data_count,
            total_input_tokens: if input_tokens_available_count > 0 {
                Some(sum_input_tokens)
            } else {
                None
            },
            total_output_tokens: if output_tokens_available_count > 0 {
                Some(sum_output_tokens)
            } else {
                None
            },
            total_tokens: if both_tokens_available_count > 0 {
                Some(sum_both_total_tokens)
            } else {
                None
            },
            token_data_source: if both_tokens_available_count > 0
                || input_tokens_available_count > 0
                || output_tokens_available_count > 0
            {
                TokenDataSource::Recorded
            } else {
                TokenDataSource::Unavailable
            },
        };

        let eligible_logical_request_count = cost_eligible_logical_requests.len() as u64;
        let total_actual_cost_usd = if cost_eligible_attempt_count > 0 {
            Some(nano_usd_to_f64(total_actual_cost_nano))
        } else {
            None
        };
        let average_cost_per_attempt_usd = if cost_eligible_attempt_count > 0 {
            Some(nano_usd_to_f64(total_actual_cost_nano) / (cost_eligible_attempt_count as f64))
        } else {
            None
        };
        let average_cost_per_logical_request_usd = if eligible_logical_request_count > 0 {
            Some(nano_usd_to_f64(total_actual_cost_nano) / (eligible_logical_request_count as f64))
        } else {
            None
        };
        let (cost_per_thousand_tokens_usd, cost_per_million_tokens_usd) =
            if compat_cost_token_count > 0 && compat_total_tokens > 0 {
                let per_token = nano_usd_to_f64(compat_cost_nano) / (compat_total_tokens as f64);
                (Some(per_token * 1_000.0), Some(per_token * 1_000_000.0))
            } else {
                (None, None)
            };

        let actual_cost_summary = TelemetryActualCostSummary {
            currency: "USD".to_string(),
            cost_availability_state: if cost_eligible_attempt_count > 0 {
                CostAvailabilityState::Exact
            } else {
                CostAvailabilityState::Unavailable
            },
            eligible_attempt_count: cost_eligible_attempt_count,
            eligible_logical_request_count,
            missing_cost_attempt_count,
            zero_cost_attempt_count,
            total_actual_cost_usd,
            average_cost_per_logical_request_usd,
            average_cost_per_attempt_usd,
            cost_per_thousand_tokens_usd,
            cost_per_million_tokens_usd,
            cost_per_token_compatible_record_count: compat_cost_token_count,
            cost_per_token_compatible_total_tokens: compat_total_tokens,
        };

        let pricing_versions_used: Vec<String> = pricing_versions_set.into_iter().collect();
        let pricing_version_used = match pricing_versions_used.len() {
            0 => resolve_versioned_model_pricing(
                pricing_table,
                &baseline_prov,
                &baseline_mod,
                generated_at_ms,
            )
            .map(|p| p.pricing_version),
            1 => Some(pricing_versions_used[0].clone()),
            _ => Some("multiple".to_string()),
        };

        let baseline_has_any_pricing = pricing_table.iter().any(|p| {
            p.provider_id.eq_ignore_ascii_case(&baseline_prov)
                && p.model_id.eq_ignore_ascii_case(&baseline_mod)
        });

        let eligible_actual_cost_usd = if savings_eligible_count > 0 {
            Some(nano_usd_to_f64(eligible_actual_cost_nano))
        } else {
            None
        };
        let baseline_cost_usd = if savings_eligible_count > 0 {
            Some(nano_usd_to_f64(baseline_cost_nano))
        } else {
            None
        };
        let savings_nano = baseline_cost_nano - eligible_actual_cost_nano;
        let estimated_savings_usd = if savings_eligible_count > 0 {
            Some(nano_usd_to_f64(savings_nano))
        } else {
            None
        };
        let savings_percent = if savings_eligible_count > 0 && baseline_cost_nano > 0 {
            Some(((savings_nano as f64 / baseline_cost_nano as f64) * 1000.0).round() / 10.0)
        } else {
            None
        };

        let comparison_status = if savings_eligible_count == 0 {
            SavingsComparisonStatus::Unavailable
        } else if savings_nano > 0 {
            SavingsComparisonStatus::BelowBaseline
        } else if savings_nano < 0 {
            SavingsComparisonStatus::AboveBaseline
        } else {
            SavingsComparisonStatus::AtBaseline
        };

        let baseline_summary = TelemetryBaselineSummary {
            baseline_provider_id: baseline_prov.clone(),
            baseline_provider_display_name: baseline_prov_display,
            baseline_model_id: baseline_mod.clone(),
            baseline_model_display_name: baseline_mod_display,
            methodology: "token_equivalent_baseline_estimate".to_string(),
            methodology_label:
                "Token-equivalent baseline estimate (Method B: actual token workload × versioned baseline pricing)"
                    .to_string(),
            pricing_version_used,
            pricing_versions_used,
            baseline_available: baseline_has_any_pricing,
            baseline_cost_usd,
        };

        // Compute all-time cumulative savings when date range filters are active
        let (
            all_time_eligible_record_count,
            all_time_actual_cost_usd,
            all_time_baseline_cost_usd,
            all_time_estimated_savings_usd,
            all_time_savings_percent,
        ) = if filters.start_time.is_some() || filters.end_time.is_some() {
            let mut all_time_filters = filters.clone();
            all_time_filters.start_time = None;
            all_time_filters.end_time = None;
            let all_time_snap = Self::aggregate_financial_analytics_with_pricing(
                conn,
                &all_time_filters,
                generated_at_ms,
                pricing_table,
            )?;
            (
                all_time_snap.savings_summary.eligible_record_count,
                all_time_snap.savings_summary.eligible_actual_cost_usd,
                all_time_snap.savings_summary.baseline_cost_usd,
                all_time_snap.savings_summary.estimated_savings_usd,
                all_time_snap.savings_summary.savings_percent,
            )
        } else {
            (
                savings_eligible_count,
                eligible_actual_cost_usd,
                baseline_cost_usd,
                estimated_savings_usd,
                savings_percent,
            )
        };

        let savings_summary = TelemetrySavingsSummary {
            savings_state: if savings_eligible_count > 0 {
                CostAvailabilityState::Estimated
            } else {
                CostAvailabilityState::Unavailable
            },
            comparison_status,
            eligible_record_count: savings_eligible_count,
            ineligible_record_count: physical_attempt_count.saturating_sub(savings_eligible_count),
            missing_token_data_count,
            missing_actual_cost_count,
            missing_baseline_pricing_count,
            eligible_actual_cost_usd,
            baseline_cost_usd,
            estimated_savings_usd,
            savings_percent,
            all_time_eligible_record_count,
            all_time_actual_cost_usd,
            all_time_baseline_cost_usd,
            all_time_estimated_savings_usd,
            all_time_savings_percent,
        };

        let mut token_trend = Vec::with_capacity(bucket_acc.len());
        let mut cost_trend = Vec::with_capacity(bucket_acc.len());
        for (bucket_start_ms, acc) in bucket_acc {
            token_trend.push(TelemetryTokenTrendPoint {
                bucket_start_ms,
                bucket_label: format!("{}", bucket_start_ms),
                attempt_count: acc.attempt_count,
                token_eligible_count: acc.token_eligible_count,
                input_tokens: if acc.input_available_count > 0 {
                    Some(acc.input_tokens)
                } else {
                    None
                },
                output_tokens: if acc.output_available_count > 0 {
                    Some(acc.output_tokens)
                } else {
                    None
                },
                total_tokens: if acc.token_eligible_count > 0 {
                    Some(acc.total_tokens)
                } else {
                    None
                },
            });

            cost_trend.push(TelemetryCostTrendPoint {
                bucket_start_ms,
                bucket_label: format!("{}", bucket_start_ms),
                attempt_count: acc.attempt_count,
                cost_eligible_count: acc.cost_eligible_count,
                actual_cost_usd: if acc.cost_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.actual_cost_nano))
                } else {
                    None
                },
                savings_eligible_count: acc.savings_eligible_count,
                baseline_cost_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.baseline_cost_nano))
                } else {
                    None
                },
                estimated_savings_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(
                        acc.baseline_cost_nano - acc.eligible_actual_cost_nano,
                    ))
                } else {
                    None
                },
            });
        }

        let compute_nano_share = |part_nano: i128, total_nano: i128| -> Option<f64> {
            if total_nano <= 0 {
                None
            } else {
                Some(((part_nano as f64 / total_nano as f64) * 1000.0).round() / 10.0)
            }
        };

        let mut provider_token_breakdown: Vec<TelemetryProviderTokenSummary> = Vec::new();
        let mut provider_cost_breakdown: Vec<TelemetryProviderCostSummary> = Vec::new();
        for (prov_id, acc) in provider_acc {
            let (_, display_name, is_hist) = if prov_id == "unrecorded" {
                resolve_provider_display_name(None)
            } else {
                resolve_provider_display_name(Some(&prov_id))
            };

            provider_token_breakdown.push(TelemetryProviderTokenSummary {
                provider_id: prov_id.clone(),
                display_name: display_name.clone(),
                is_historical_or_unrecorded: is_hist,
                attempt_count: acc.attempt_count,
                logical_request_count: acc.logical_requests.len() as u64,
                token_eligible_count: acc.token_eligible_count,
                input_tokens: if acc.input_available_count > 0 {
                    Some(acc.input_tokens)
                } else {
                    None
                },
                output_tokens: if acc.output_available_count > 0 {
                    Some(acc.output_tokens)
                } else {
                    None
                },
                total_tokens: if acc.token_eligible_count > 0 {
                    Some(acc.total_tokens)
                } else {
                    None
                },
                share_of_total_tokens_percent: if acc.token_eligible_count > 0 {
                    Self::compute_percentage(acc.total_tokens, sum_both_total_tokens)
                } else {
                    None
                },
            });

            let p_sav_nano = acc.baseline_cost_nano - acc.eligible_actual_cost_nano;
            provider_cost_breakdown.push(TelemetryProviderCostSummary {
                provider_id: prov_id,
                display_name,
                is_historical_or_unrecorded: is_hist,
                attempt_count: acc.attempt_count,
                cost_eligible_count: acc.cost_eligible_count,
                actual_cost_usd: if acc.cost_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.actual_cost_nano))
                } else {
                    None
                },
                average_cost_per_eligible_attempt_usd: if acc.cost_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.actual_cost_nano) / (acc.cost_eligible_count as f64))
                } else {
                    None
                },
                total_tokens: if acc.token_eligible_count > 0 {
                    Some(acc.total_tokens)
                } else {
                    None
                },
                share_of_total_cost_percent: if acc.cost_eligible_count > 0 {
                    compute_nano_share(acc.actual_cost_nano, total_actual_cost_nano)
                } else {
                    None
                },
                savings_eligible_count: acc.savings_eligible_count,
                eligible_actual_cost_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.eligible_actual_cost_nano))
                } else {
                    None
                },
                baseline_cost_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.baseline_cost_nano))
                } else {
                    None
                },
                estimated_savings_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(p_sav_nano))
                } else {
                    None
                },
                savings_percent: if acc.savings_eligible_count > 0 && acc.baseline_cost_nano > 0 {
                    Some(
                        ((p_sav_nano as f64 / acc.baseline_cost_nano as f64) * 1000.0).round()
                            / 10.0,
                    )
                } else {
                    None
                },
            });
        }

        // Deterministic sorting: total_tokens DESC (None last), attempt_count DESC, provider_id ASC
        provider_token_breakdown.sort_by(|a, b| {
            b.total_tokens
                .unwrap_or(0)
                .cmp(&a.total_tokens.unwrap_or(0))
                .then_with(|| b.attempt_count.cmp(&a.attempt_count))
                .then_with(|| a.provider_id.cmp(&b.provider_id))
        });

        provider_cost_breakdown.sort_by(|a, b| {
            let ca = a.actual_cost_usd.and_then(usd_to_nano_usd).unwrap_or(-1);
            let cb = b.actual_cost_usd.and_then(usd_to_nano_usd).unwrap_or(-1);
            cb.cmp(&ca)
                .then_with(|| b.attempt_count.cmp(&a.attempt_count))
                .then_with(|| a.provider_id.cmp(&b.provider_id))
        });

        let mut model_token_breakdown: Vec<TelemetryModelTokenSummary> = Vec::new();
        let mut model_cost_breakdown: Vec<TelemetryModelCostSummary> = Vec::new();
        for ((prov_id, mod_id), acc) in model_acc {
            let (_, prov_display, prov_hist) = if prov_id == "unrecorded" {
                resolve_provider_display_name(None)
            } else {
                resolve_provider_display_name(Some(&prov_id))
            };
            let is_unrec = mod_id == "unrecorded" || prov_hist;

            model_token_breakdown.push(TelemetryModelTokenSummary {
                provider_id: prov_id.clone(),
                provider_display_name: prov_display.clone(),
                model_id: mod_id.clone(),
                is_historical_or_unrecorded: is_unrec,
                attempt_count: acc.attempt_count,
                logical_request_count: acc.logical_requests.len() as u64,
                token_eligible_count: acc.token_eligible_count,
                input_tokens: if acc.input_available_count > 0 {
                    Some(acc.input_tokens)
                } else {
                    None
                },
                output_tokens: if acc.output_available_count > 0 {
                    Some(acc.output_tokens)
                } else {
                    None
                },
                total_tokens: if acc.token_eligible_count > 0 {
                    Some(acc.total_tokens)
                } else {
                    None
                },
                share_of_total_tokens_percent: if acc.token_eligible_count > 0 {
                    Self::compute_percentage(acc.total_tokens, sum_both_total_tokens)
                } else {
                    None
                },
            });

            let m_sav_nano = acc.baseline_cost_nano - acc.eligible_actual_cost_nano;
            model_cost_breakdown.push(TelemetryModelCostSummary {
                provider_id: prov_id,
                provider_display_name: prov_display,
                model_id: mod_id,
                is_historical_or_unrecorded: is_unrec,
                attempt_count: acc.attempt_count,
                cost_eligible_count: acc.cost_eligible_count,
                actual_cost_usd: if acc.cost_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.actual_cost_nano))
                } else {
                    None
                },
                average_cost_per_eligible_attempt_usd: if acc.cost_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.actual_cost_nano) / (acc.cost_eligible_count as f64))
                } else {
                    None
                },
                total_tokens: if acc.token_eligible_count > 0 {
                    Some(acc.total_tokens)
                } else {
                    None
                },
                share_of_total_cost_percent: if acc.cost_eligible_count > 0 {
                    compute_nano_share(acc.actual_cost_nano, total_actual_cost_nano)
                } else {
                    None
                },
                savings_eligible_count: acc.savings_eligible_count,
                eligible_actual_cost_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.eligible_actual_cost_nano))
                } else {
                    None
                },
                baseline_cost_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.baseline_cost_nano))
                } else {
                    None
                },
                estimated_savings_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(m_sav_nano))
                } else {
                    None
                },
                savings_percent: if acc.savings_eligible_count > 0 && acc.baseline_cost_nano > 0 {
                    Some(
                        ((m_sav_nano as f64 / acc.baseline_cost_nano as f64) * 1000.0).round()
                            / 10.0,
                    )
                } else {
                    None
                },
            });
        }

        model_token_breakdown.sort_by(|a, b| {
            b.total_tokens
                .unwrap_or(0)
                .cmp(&a.total_tokens.unwrap_or(0))
                .then_with(|| b.attempt_count.cmp(&a.attempt_count))
                .then_with(|| a.provider_id.cmp(&b.provider_id))
                .then_with(|| a.model_id.cmp(&b.model_id))
        });

        model_cost_breakdown.sort_by(|a, b| {
            let ca = a.actual_cost_usd.and_then(usd_to_nano_usd).unwrap_or(-1);
            let cb = b.actual_cost_usd.and_then(usd_to_nano_usd).unwrap_or(-1);
            cb.cmp(&ca)
                .then_with(|| b.attempt_count.cmp(&a.attempt_count))
                .then_with(|| a.provider_id.cmp(&b.provider_id))
                .then_with(|| a.model_id.cmp(&b.model_id))
        });

        let mut export_rows = Vec::with_capacity(export_acc.len());
        for ((bucket_start_ms, provider_id, model_id), acc) in export_acc {
            export_rows.push(TelemetryFinancialExportRow {
                bucket_start_ms,
                provider_id,
                model_id,
                attempt_count: acc.attempt_count,
                input_tokens: if acc.input_available_count > 0 {
                    Some(acc.input_tokens)
                } else {
                    None
                },
                output_tokens: if acc.output_available_count > 0 {
                    Some(acc.output_tokens)
                } else {
                    None
                },
                total_tokens: if acc.token_eligible_count > 0 {
                    Some(acc.total_tokens)
                } else {
                    None
                },
                actual_cost_usd: if acc.cost_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.actual_cost_nano))
                } else {
                    None
                },
                baseline_cost_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(acc.baseline_cost_nano))
                } else {
                    None
                },
                estimated_savings_usd: if acc.savings_eligible_count > 0 {
                    Some(nano_usd_to_f64(
                        acc.baseline_cost_nano - acc.eligible_actual_cost_nano,
                    ))
                } else {
                    None
                },
            });
        }

        let coverage = TelemetryFinancialCoverageSummary {
            total_physical_attempts: physical_attempt_count,
            total_logical_requests: logical_request_count,
            token_coverage_count: both_tokens_available_count,
            token_coverage_percent: Self::compute_percentage(
                both_tokens_available_count,
                physical_attempt_count,
            ),
            cost_coverage_count: cost_eligible_attempt_count,
            cost_coverage_percent: Self::compute_percentage(
                cost_eligible_attempt_count,
                physical_attempt_count,
            ),
            baseline_pricing_coverage_count,
            baseline_pricing_coverage_percent: Self::compute_percentage(
                baseline_pricing_coverage_count,
                physical_attempt_count,
            ),
            savings_coverage_count: savings_eligible_count,
            savings_coverage_percent: Self::compute_percentage(
                savings_eligible_count,
                physical_attempt_count,
            ),
            complete_financial_analytics_count: savings_eligible_count,
            complete_financial_analytics_percent: Self::compute_percentage(
                savings_eligible_count,
                physical_attempt_count,
            ),
        };

        Ok(TelemetryFinancialAnalytics {
            query_id: filters.query_id.clone(),
            generated_at_ms,
            currency: "USD".to_string(),
            token_summary,
            actual_cost_summary,
            baseline_summary,
            savings_summary,
            token_trend,
            cost_trend,
            provider_token_breakdown,
            model_token_breakdown,
            provider_cost_breakdown,
            model_cost_breakdown,
            coverage,
            export_rows,
        })
    }

    // ========================================================================
    // Step 44: Read-Only Latency, Execution Performance & Benchmark Analytics
    // ========================================================================

    /// Deterministic percentile & summary calculator using inclusive linear interpolation (R-7).
    /// Enforces sample-size thresholds:
    /// - n >= 1: min, max, average, median (P50)
    /// - n >= 3: P25, P75
    /// - n >= 5: P90, P95
    /// - n >= 10: P99
    fn compute_latency_distribution_stats(
        samples: &[u64],
    ) -> (
        LatencySampleSufficiency,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<f64>,
        Option<u64>,
        Option<u64>,
    ) {
        let n = samples.len();
        if n == 0 {
            return (
                LatencySampleSufficiency::Empty,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            );
        }

        let mut sorted = samples.to_vec();
        sorted.sort_unstable();

        let sum: u128 = sorted.iter().map(|&v| v as u128).sum();
        let avg = (sum as f64) / (n as f64);
        let min_v = sorted[0];
        let max_v = sorted[n - 1];

        let interp = |q: f64| -> f64 {
            if n == 1 {
                return sorted[0] as f64;
            }
            let pos = q * ((n - 1) as f64);
            let lo = pos.floor() as usize;
            let hi = pos.ceil() as usize;
            let frac = pos - (lo as f64);
            let lo_val = sorted[lo] as f64;
            let hi_val = sorted[hi.min(n - 1)] as f64;
            lo_val + frac * (hi_val - lo_val)
        };

        let median = interp(0.50);
        let p25 = if n >= 3 { Some(interp(0.25)) } else { None };
        let p75 = if n >= 3 { Some(interp(0.75)) } else { None };
        let p90 = if n >= 5 { Some(interp(0.90)) } else { None };
        let p95 = if n >= 5 { Some(interp(0.95)) } else { None };
        let p99 = if n >= 10 { Some(interp(0.99)) } else { None };

        let sufficiency = if n < 5 {
            LatencySampleSufficiency::Limited
        } else {
            LatencySampleSufficiency::Sufficient
        };

        (
            sufficiency,
            Some(avg),
            Some(median),
            p25,
            p75,
            p90,
            p95,
            p99,
            Some(min_v),
            Some(max_v),
        )
    }

    /// Computes the authoritative Step 44 `TelemetryPerformanceAnalytics` snapshot for `filters`.
    pub fn aggregate_performance_analytics(
        conn: &Connection,
        filters: &TelemetryDashboardFilters,
        generated_at_ms: i64,
    ) -> Result<TelemetryPerformanceAnalytics, DatabaseError> {
        let (where_clause, values) = Self::build_dashboard_filter_clauses(filters);

        let bucket_mode = filters.time_bucket.unwrap_or_else(|| {
            if let (Some(s), Some(e)) = (filters.start_time, filters.end_time) {
                if e.saturating_sub(s) <= 48 * 3_600_000 {
                    TelemetryTimeBucket::Hour
                } else {
                    TelemetryTimeBucket::Day
                }
            } else {
                TelemetryTimeBucket::Day
            }
        });
        let bucket_ms: i64 = match bucket_mode {
            TelemetryTimeBucket::Hour => 3_600_000,
            TelemetryTimeBucket::Day => 86_400_000,
        };

        #[derive(Clone)]
        struct RawPerfRow {
            id: String,
            event_type: String,
            occurred_at: i64,
            message_id: Option<String>,
            task_id: Option<String>,
            stream_id: Option<String>,
            provider_id: Option<String>,
            model_id: Option<String>,
            outcome: String,
            latency_ms: Option<i64>,
        }

        let sql = format!(
            r#"
            SELECT
                id,
                event_type,
                occurred_at,
                NULLIF(TRIM(message_id), ''),
                NULLIF(TRIM(task_id), ''),
                NULLIF(TRIM(stream_id), ''),
                NULLIF(TRIM(provider_id), ''),
                NULLIF(TRIM(model_id), ''),
                COALESCE(NULLIF(LOWER(TRIM(outcome)), ''), 'unknown'),
                latency_ms
            FROM telemetry_records
            {}
            ORDER BY occurred_at ASC, id ASC;
            "#,
            where_clause
        );

        let mut stmt = conn.prepare(&sql).map_err(|e| {
            DatabaseError::query_failed(format!(
                "Failed to prepare performance analytics query: {}",
                e
            ))
        })?;

        let mapped = stmt
            .query_map(params_from_iter(values.iter()), |row| {
                Ok(RawPerfRow {
                    id: row.get(0)?,
                    event_type: row.get(1)?,
                    occurred_at: row.get(2)?,
                    message_id: row.get(3)?,
                    task_id: row.get(4)?,
                    stream_id: row.get(5)?,
                    provider_id: row.get(6)?,
                    model_id: row.get(7)?,
                    outcome: row.get(8)?,
                    latency_ms: row.get(9)?,
                })
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!(
                    "Failed to execute performance analytics query: {}",
                    e
                ))
            })?;

        let mut raw_rows = Vec::new();
        for item in mapped {
            raw_rows.push(item.map_err(|e| {
                DatabaseError::query_failed(format!(
                    "Failed to read performance analytics row: {}",
                    e
                ))
            })?);
        }

        // First pass: identify execution-correlated IDs, terminal stream_lifecycle IDs, and routing events
        let mut exec_task_ids = HashSet::new();
        let mut exec_msg_ids = HashSet::new();
        let mut exec_stream_ids = HashSet::new();
        let mut last_stream_lifecycle_id_by_stream: HashMap<String, String> = HashMap::new();

        let mut total_routing_events: u64 = 0;
        let mut routing_latency_samples: Vec<u64> = Vec::new();

        const MAX_VALID_LATENCY_MS: i64 = 86_400_000;

        for r in &raw_rows {
            if r.event_type == "routing_decision" {
                total_routing_events += 1;
                if let Some(lat) = r.latency_ms {
                    if (0..=MAX_VALID_LATENCY_MS).contains(&lat) {
                        routing_latency_samples.push(lat as u64);
                    }
                }
            }

            if r.event_type == "provider_execution" || r.event_type == "fallback_transition" {
                if let Some(ref tid) = r.task_id {
                    exec_task_ids.insert(tid.clone());
                }
                if let Some(ref mid) = r.message_id {
                    exec_msg_ids.insert(mid.clone());
                }
                if let Some(ref sid) = r.stream_id {
                    exec_stream_ids.insert(sid.clone());
                }
            } else if r.event_type == "stream_lifecycle" {
                if let Some(ref sid) = r.stream_id {
                    last_stream_lifecycle_id_by_stream.insert(sid.clone(), r.id.clone());
                }
            }
        }

        let mut duplicate_or_intermediate_events_excluded: u64 = 0;
        let mut eligible_attempts: Vec<RawPerfRow> = Vec::with_capacity(raw_rows.len());

        for r in raw_rows {
            let mut exclude = false;
            if r.event_type == "stream_lifecycle" {
                if r.stream_id
                    .as_ref()
                    .is_some_and(|sid| exec_stream_ids.contains(sid))
                    || r.task_id
                        .as_ref()
                        .is_some_and(|tid| exec_task_ids.contains(tid))
                    || r.message_id
                        .as_ref()
                        .is_some_and(|mid| exec_msg_ids.contains(mid))
                {
                    exclude = true;
                } else if let Some(ref sid) = r.stream_id {
                    if last_stream_lifecycle_id_by_stream
                        .get(sid)
                        .is_some_and(|last_id| last_id != &r.id)
                    {
                        exclude = true;
                    }
                }
            } else if r.event_type == "routing_decision" || r.event_type == "system_event" {
                if r.task_id
                    .as_ref()
                    .is_some_and(|tid| exec_task_ids.contains(tid))
                    || r.message_id
                        .as_ref()
                        .is_some_and(|mid| exec_msg_ids.contains(mid))
                    || r.event_type == "system_event"
                {
                    exclude = true;
                }
            }

            if exclude {
                duplicate_or_intermediate_events_excluded += 1;
            } else {
                eligible_attempts.push(r);
            }
        }

        let total_eligible_executions = eligible_attempts.len() as u64;
        let mut all_valid_samples: Vec<u64> = Vec::with_capacity(eligible_attempts.len());
        let mut missing_latency_count: u64 = 0;
        let mut invalid_latency_count: u64 = 0;
        let mut earliest_measured_at_ms: Option<i64> = None;
        let mut latest_measured_at_ms: Option<i64> = None;

        #[derive(Default)]
        struct PerfGroupAcc {
            eligible_count: u64,
            samples: Vec<u64>,
        }

        let mut provider_acc: BTreeMap<String, PerfGroupAcc> = BTreeMap::new();
        let mut model_acc: BTreeMap<(String, String), PerfGroupAcc> = BTreeMap::new();
        let mut outcome_acc: BTreeMap<String, PerfGroupAcc> = BTreeMap::new();
        let mut bucket_acc: BTreeMap<i64, PerfGroupAcc> = BTreeMap::new();
        let mut logical_attempts_map: BTreeMap<String, Vec<Option<u64>>> = BTreeMap::new();

        let mut total_streaming_executions: u64 = 0;
        let mut streaming_completion_samples: Vec<u64> = Vec::new();
        let mut distinct_providers: BTreeSet<String> = BTreeSet::new();
        let mut distinct_models: BTreeSet<(String, String)> = BTreeSet::new();

        // 8-bin latency distribution histogram counters
        let mut hist_counts = [0u64; 8];

        for r in &eligible_attempts {
            let logical_key = if let Some(ref tid) = r.task_id {
                format!("task:{}", tid)
            } else if let Some(ref mid) = r.message_id {
                format!("msg:{}", mid)
            } else if let Some(ref sid) = r.stream_id {
                format!("stream:{}", sid)
            } else {
                format!("rec:{}", r.id)
            };

            let prov_key = r
                .provider_id
                .clone()
                .unwrap_or_else(|| "unrecorded".to_string());
            let mod_key = r
                .model_id
                .clone()
                .unwrap_or_else(|| "unrecorded".to_string());
            distinct_providers.insert(prov_key.clone());
            distinct_models.insert((prov_key.clone(), mod_key.clone()));

            let safe_epoch = r.occurred_at.max(0);
            let bucket_start = (safe_epoch / bucket_ms) * bucket_ms;

            let is_streaming = r.stream_id.is_some() || r.event_type == "stream_lifecycle";
            if is_streaming {
                total_streaming_executions += 1;
            }

            let valid_lat: Option<u64> = match r.latency_ms {
                None => {
                    missing_latency_count += 1;
                    None
                }
                Some(v) if (0..=MAX_VALID_LATENCY_MS).contains(&v) => Some(v as u64),
                Some(_) => {
                    invalid_latency_count += 1;
                    None
                }
            };

            logical_attempts_map
                .entry(logical_key)
                .or_default()
                .push(valid_lat);

            let p_entry = provider_acc.entry(prov_key.clone()).or_default();
            p_entry.eligible_count += 1;

            let m_entry = model_acc.entry((prov_key, mod_key)).or_default();
            m_entry.eligible_count += 1;

            let o_entry = outcome_acc.entry(r.outcome.clone()).or_default();
            o_entry.eligible_count += 1;

            let b_entry = bucket_acc.entry(bucket_start).or_default();
            b_entry.eligible_count += 1;

            if let Some(lat) = valid_lat {
                all_valid_samples.push(lat);
                p_entry.samples.push(lat);
                m_entry.samples.push(lat);
                o_entry.samples.push(lat);
                b_entry.samples.push(lat);

                if is_streaming {
                    streaming_completion_samples.push(lat);
                }

                earliest_measured_at_ms = Some(
                    earliest_measured_at_ms
                        .map_or(r.occurred_at, |prev| prev.min(r.occurred_at)),
                );
                latest_measured_at_ms = Some(
                    latest_measured_at_ms
                        .map_or(r.occurred_at, |prev| prev.max(r.occurred_at)),
                );

                let bin_idx = if lat < 100 {
                    0
                } else if lat < 250 {
                    1
                } else if lat < 500 {
                    2
                } else if lat < 1_000 {
                    3
                } else if lat < 2_000 {
                    4
                } else if lat < 5_000 {
                    5
                } else if lat < 10_000 {
                    6
                } else {
                    7
                };
                hist_counts[bin_idx] += 1;
            }
        }

        let measured_executions = all_valid_samples.len() as u64;
        let (
            sufficiency,
            avg_lat,
            med_lat,
            p25_lat,
            p75_lat,
            p90_lat,
            p95_lat,
            p99_lat,
            min_lat,
            max_lat,
        ) = Self::compute_latency_distribution_stats(&all_valid_samples);

        let population_label = match filters.outcome.as_deref() {
            Some(o) if !o.trim().is_empty() => {
                format!("Filtered execution attempts (Outcome: {})", o.trim())
            }
            _ => "All valid provider execution attempts".to_string(),
        };

        let summary = TelemetryLatencySummary {
            population_label,
            metric_semantics_label:
                "Observed Provider Attempt Latency (monotonic Instant duration in ms)".to_string(),
            percentile_methodology:
                "Linear interpolation (inclusive R-7), exact midpoint median".to_string(),
            total_eligible_executions,
            measured_executions,
            missing_latency_count,
            invalid_latency_count,
            latency_coverage_percent: Self::compute_percentage(
                measured_executions,
                total_eligible_executions,
            ),
            sample_sufficiency: sufficiency,
            provenance: if measured_executions > 0 {
                LatencyProvenanceState::Recorded
            } else {
                LatencyProvenanceState::Unavailable
            },
            average_latency_ms: avg_lat,
            median_latency_ms: med_lat,
            p25_latency_ms: p25_lat,
            p50_latency_ms: med_lat,
            p75_latency_ms: p75_lat,
            p90_latency_ms: p90_lat,
            p95_latency_ms: p95_lat,
            p99_latency_ms: p99_lat,
            min_latency_ms: min_lat,
            max_latency_ms: max_lat,
        };

        let bin_defs: [(&str, &str, u64, Option<u64>); 8] = [
            ("lt_100ms", "< 100 ms", 0, Some(100)),
            ("100_250ms", "100–250 ms", 100, Some(250)),
            ("250_500ms", "250–500 ms", 250, Some(500)),
            ("500_1000ms", "500 ms–1 s", 500, Some(1_000)),
            ("1000_2000ms", "1–2 s", 1_000, Some(2_000)),
            ("2000_5000ms", "2–5 s", 2_000, Some(5_000)),
            ("5000_10000ms", "5–10 s", 5_000, Some(10_000)),
            ("gte_10000ms", "10 s+", 10_000, None),
        ];

        let mut hist_buckets = Vec::with_capacity(8);
        for (idx, (key, label, min_b, max_b)) in bin_defs.iter().enumerate() {
            let c = hist_counts[idx];
            hist_buckets.push(TelemetryLatencyHistogramBucket {
                bucket_key: (*key).to_string(),
                label: (*label).to_string(),
                min_bound_ms: *min_b,
                max_bound_ms: *max_b,
                count: c,
                percentage: Self::compute_percentage(c, measured_executions),
            });
        }

        let distribution = TelemetryLatencyHistogram {
            measured_sample_count: measured_executions,
            buckets: hist_buckets,
        };

        let mut time_series = Vec::with_capacity(bucket_acc.len());
        for (bucket_start_ms, acc) in bucket_acc {
            let (_, b_avg, b_med, _, _, _, b_p95, _, b_min, b_max) =
                Self::compute_latency_distribution_stats(&acc.samples);
            time_series.push(TelemetryLatencyTrendPoint {
                bucket_start_ms,
                bucket_label: format!("{}", bucket_start_ms),
                eligible_count: acc.eligible_count,
                measured_count: acc.samples.len() as u64,
                average_latency_ms: b_avg,
                median_latency_ms: b_med,
                p95_latency_ms: b_p95,
                min_latency_ms: b_min,
                max_latency_ms: b_max,
            });
        }

        let mut provider_breakdown = Vec::with_capacity(provider_acc.len());
        for (raw_prov, acc) in provider_acc {
            let (norm_id, display_name, is_unrec) = if raw_prov == "unrecorded" {
                ("unrecorded".to_string(), "Not recorded".to_string(), true)
            } else {
                resolve_provider_display_name(Some(&raw_prov))
            };
            let m_cnt = acc.samples.len() as u64;
            let (p_suff, p_avg, p_med, p_p25, p_p75, p_p90, p_p95, p_p99, p_min, p_max) =
                Self::compute_latency_distribution_stats(&acc.samples);
            provider_breakdown.push(TelemetryProviderLatencySummary {
                provider_id: norm_id,
                display_name,
                is_historical_or_unrecorded: is_unrec,
                total_eligible_count: acc.eligible_count,
                measured_count: m_cnt,
                coverage_percent: Self::compute_percentage(m_cnt, acc.eligible_count),
                sample_sufficiency: p_suff,
                average_latency_ms: p_avg,
                median_latency_ms: p_med,
                p25_latency_ms: p_p25,
                p75_latency_ms: p_p75,
                p90_latency_ms: p_p90,
                p95_latency_ms: p_p95,
                p99_latency_ms: p_p99,
                min_latency_ms: p_min,
                max_latency_ms: p_max,
            });
        }
        provider_breakdown.sort_by(|a, b| {
            b.measured_count
                .cmp(&a.measured_count)
                .then_with(|| b.total_eligible_count.cmp(&a.total_eligible_count))
                .then_with(|| a.provider_id.cmp(&b.provider_id))
        });

        let mut model_breakdown = Vec::with_capacity(model_acc.len());
        for ((raw_prov, raw_mod), acc) in model_acc {
            let (prov_id, prov_display, is_prov_unrec) = if raw_prov == "unrecorded" {
                ("unrecorded".to_string(), "Not recorded".to_string(), true)
            } else {
                resolve_provider_display_name(Some(&raw_prov))
            };
            let is_mod_unrec = raw_mod == "unrecorded";
            let mod_id = if is_mod_unrec {
                "Not recorded".to_string()
            } else {
                raw_mod
            };
            let m_cnt = acc.samples.len() as u64;
            let (m_suff, m_avg, m_med, m_p25, m_p75, m_p90, m_p95, m_p99, m_min, m_max) =
                Self::compute_latency_distribution_stats(&acc.samples);
            model_breakdown.push(TelemetryModelLatencySummary {
                provider_id: prov_id,
                provider_display_name: prov_display,
                model_id: mod_id,
                is_historical_or_unrecorded: is_prov_unrec || is_mod_unrec,
                total_eligible_count: acc.eligible_count,
                measured_count: m_cnt,
                coverage_percent: Self::compute_percentage(m_cnt, acc.eligible_count),
                sample_sufficiency: m_suff,
                average_latency_ms: m_avg,
                median_latency_ms: m_med,
                p25_latency_ms: m_p25,
                p75_latency_ms: m_p75,
                p90_latency_ms: m_p90,
                p95_latency_ms: m_p95,
                p99_latency_ms: m_p99,
                min_latency_ms: m_min,
                max_latency_ms: m_max,
            });
        }
        model_breakdown.sort_by(|a, b| {
            b.measured_count
                .cmp(&a.measured_count)
                .then_with(|| b.total_eligible_count.cmp(&a.total_eligible_count))
                .then_with(|| a.provider_id.cmp(&b.provider_id))
                .then_with(|| a.model_id.cmp(&b.model_id))
        });

        let mut outcome_breakdown = Vec::with_capacity(outcome_acc.len());
        for (raw_out, acc) in outcome_acc {
            let label = TelemetryOutcome::from_str(&raw_out)
                .map(|o| o.display_label().to_string())
                .unwrap_or_else(|_| "Unknown".to_string());
            let m_cnt = acc.samples.len() as u64;
            let (_, o_avg, o_med, _, _, _, o_p95, _, o_min, o_max) =
                Self::compute_latency_distribution_stats(&acc.samples);
            outcome_breakdown.push(TelemetryOutcomeLatencySummary {
                outcome: raw_out,
                display_label: label,
                total_count: acc.eligible_count,
                measured_count: m_cnt,
                average_latency_ms: o_avg,
                median_latency_ms: o_med,
                p95_latency_ms: o_p95,
                min_latency_ms: o_min,
                max_latency_ms: o_max,
            });
        }
        outcome_breakdown.sort_by(|a, b| {
            b.measured_count
                .cmp(&a.measured_count)
                .then_with(|| b.total_count.cmp(&a.total_count))
                .then_with(|| a.outcome.cmp(&b.outcome))
        });

        let measured_routing_events = routing_latency_samples.len() as u64;
        let (_, r_avg, r_med, _, _, _, r_p95, _, r_min, r_max) =
            Self::compute_latency_distribution_stats(&routing_latency_samples);
        let routing_overhead = TelemetryRoutingOverheadSummary {
            total_routing_events,
            measured_routing_events,
            provenance: if measured_routing_events > 0 {
                LatencyProvenanceState::Recorded
            } else {
                LatencyProvenanceState::Unavailable
            },
            average_routing_latency_ms: r_avg,
            median_routing_latency_ms: r_med,
            p95_routing_latency_ms: r_p95,
            min_routing_latency_ms: r_min,
            max_routing_latency_ms: r_max,
            slm_classification_provenance: LatencyProvenanceState::Unavailable,
            slm_classification_note:
                "Isolated local SLM classification sub-stage duration is not separately persisted in historical telemetry_records.".to_string(),
        };

        let measured_stream_cnt = streaming_completion_samples.len() as u64;
        let (_, s_avg, s_med, _, _, _, s_p95, _, s_min, s_max) =
            Self::compute_latency_distribution_stats(&streaming_completion_samples);
        let streaming_performance = TelemetryStreamingPerformanceSummary {
            total_streaming_executions,
            measured_streaming_completion_count: measured_stream_cnt,
            completion_provenance: if measured_stream_cnt > 0 {
                LatencyProvenanceState::Recorded
            } else {
                LatencyProvenanceState::Unavailable
            },
            average_stream_completion_latency_ms: s_avg,
            median_stream_completion_latency_ms: s_med,
            p95_stream_completion_latency_ms: s_p95,
            min_stream_completion_latency_ms: s_min,
            max_stream_completion_latency_ms: s_max,
            ttft_measured_count: 0,
            average_ttft_ms: None,
            median_ttft_ms: None,
            ttft_provenance: LatencyProvenanceState::Unavailable,
            ttft_methodology_note:
                "Time-to-First-Token (TTFT) is not separately persisted in historical telemetry_records; only terminal stream completion latency is reported.".to_string(),
        };

        let total_logical_requests = logical_attempts_map.len() as u64;
        let mut single_attempt_logical_requests: u64 = 0;
        let mut multi_attempt_logical_requests: u64 = 0;
        let mut single_attempt_samples: Vec<u64> = Vec::new();
        let mut multi_attempt_samples: Vec<u64> = Vec::new();
        let mut logical_cumulative_samples: Vec<u64> = Vec::new();
        let mut initial_attempt_samples: Vec<u64> = Vec::new();
        let mut retry_failover_attempt_samples: Vec<u64> = Vec::new();

        for attempts in logical_attempts_map.values() {
            if attempts.len() <= 1 {
                single_attempt_logical_requests += 1;
            } else {
                multi_attempt_logical_requests += 1;
            }

            for (idx, lat_opt) in attempts.iter().enumerate() {
                if let Some(lat) = lat_opt {
                    if idx == 0 {
                        initial_attempt_samples.push(*lat);
                    } else {
                        retry_failover_attempt_samples.push(*lat);
                    }
                }
            }

            if !attempts.is_empty() && attempts.iter().all(|x| x.is_some()) {
                let sum_lat: u64 = attempts.iter().filter_map(|&x| x).sum();
                logical_cumulative_samples.push(sum_lat);
                if attempts.len() <= 1 {
                    single_attempt_samples.push(sum_lat);
                } else {
                    multi_attempt_samples.push(sum_lat);
                }
            }
        }

        let (_, sa_avg, sa_med, _, _, _, sa_p95, _, _, _) =
            Self::compute_latency_distribution_stats(&single_attempt_samples);
        let (_, ma_avg, ma_med, _, _, _, ma_p95, _, _, _) =
            Self::compute_latency_distribution_stats(&multi_attempt_samples);
        let (_, lc_avg, lc_med, _, _, _, lc_p95, _, lc_min, lc_max) =
            Self::compute_latency_distribution_stats(&logical_cumulative_samples);
        let (_, ia_avg, ia_med, _, _, _, _, _, _, _) =
            Self::compute_latency_distribution_stats(&initial_attempt_samples);
        let (_, rf_avg, rf_med, _, _, _, _, _, _, _) =
            Self::compute_latency_distribution_stats(&retry_failover_attempt_samples);

        let logical_vs_physical = TelemetryLogicalLatencySummary {
            total_logical_requests,
            measured_logical_requests: logical_cumulative_samples.len() as u64,
            single_attempt_logical_requests,
            multi_attempt_logical_requests,
            single_attempt_median_latency_ms: sa_med,
            single_attempt_average_latency_ms: sa_avg,
            single_attempt_p95_latency_ms: sa_p95,
            multi_attempt_median_latency_ms: ma_med,
            multi_attempt_average_latency_ms: ma_avg,
            multi_attempt_p95_latency_ms: ma_p95,
            logical_cumulative_median_latency_ms: lc_med,
            logical_cumulative_average_latency_ms: lc_avg,
            logical_cumulative_p95_latency_ms: lc_p95,
            logical_cumulative_min_latency_ms: lc_min,
            logical_cumulative_max_latency_ms: lc_max,
            initial_attempt_measured_count: initial_attempt_samples.len() as u64,
            initial_attempt_median_latency_ms: ia_med,
            initial_attempt_average_latency_ms: ia_avg,
            retry_or_failover_attempt_measured_count: retry_failover_attempt_samples.len() as u64,
            retry_or_failover_attempt_median_latency_ms: rf_med,
            retry_or_failover_attempt_average_latency_ms: rf_avg,
        };

        let data_quality = TelemetryLatencyDataQualitySummary {
            total_eligible_records: total_eligible_executions,
            valid_latency_records: measured_executions,
            missing_latency_records: missing_latency_count,
            invalid_latency_records: invalid_latency_count,
            duplicate_or_intermediate_events_excluded,
            coverage_percent: Self::compute_percentage(
                measured_executions,
                total_eligible_executions,
            ),
            distinct_providers_count: distinct_providers.len() as u64,
            distinct_models_count: distinct_models.len() as u64,
            earliest_measured_at_ms,
            latest_measured_at_ms,
        };

        Ok(TelemetryPerformanceAnalytics {
            query_id: filters.query_id.clone(),
            generated_at_ms,
            summary,
            distribution,
            time_series,
            provider_breakdown,
            model_breakdown,
            outcome_breakdown,
            routing_overhead,
            streaming_performance,
            logical_vs_physical,
            data_quality,
        })
    }

    /// Discovers distinct providers, models, and outcomes stored in `telemetry_records`.
    pub fn discover_filter_options(
        conn: &Connection,
    ) -> Result<TelemetryFilterOptionsDto, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT DISTINCT
                    NULLIF(TRIM(provider_id), ''),
                    NULLIF(TRIM(model_id), ''),
                    NULLIF(LOWER(TRIM(outcome)), '')
                FROM telemetry_records
                LIMIT 500;
                "#,
            )
            .map_err(|e| {
                DatabaseError::query_failed(format!("Failed to prepare filter discovery: {}", e))
            })?;

        let mut provider_map: BTreeMap<String, TelemetryProviderOption> = BTreeMap::new();
        let mut model_set: BTreeSet<(Option<String>, String)> = BTreeSet::new();
        let mut outcome_set: BTreeSet<String> = BTreeSet::new();

        let rows = stmt
            .query_map([], |row| {
                let prov: Option<String> = row.get(0)?;
                let model: Option<String> = row.get(1)?;
                let out: Option<String> = row.get(2)?;
                Ok((prov, model, out))
            })
            .map_err(|e| {
                DatabaseError::query_failed(format!("Failed to execute filter discovery: {}", e))
            })?;

        for r in rows {
            let (prov, model, out) = r.map_err(|e| {
                DatabaseError::query_failed(format!("Failed to map filter discovery row: {}", e))
            })?;

            if let Some(ref p) = prov {
                let (_, display, is_hist) = resolve_provider_display_name(Some(p));
                provider_map
                    .entry(p.clone())
                    .or_insert(TelemetryProviderOption {
                        provider_id: p.clone(),
                        display_name: display,
                        is_historical: is_hist,
                    });
            }

            if let Some(m) = model {
                model_set.insert((prov.clone(), m));
            }

            if let Some(o) = out {
                outcome_set.insert(o);
            }
        }

        let providers = provider_map.into_values().collect();
        let models = model_set
            .into_iter()
            .map(|(provider_id, model_id)| TelemetryModelOption {
                provider_id,
                model_id,
            })
            .collect();
        let outcomes = outcome_set.into_iter().collect();

        Ok(TelemetryFilterOptionsDto {
            providers,
            models,
            outcomes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::migrations::MigrationRunner;

    fn setup_in_memory_db() -> Connection {
        let mut conn = Connection::open_in_memory().expect("open in-memory sqlite");
        MigrationRunner::run(&mut conn).expect("run migrations");
        conn
    }

    #[test]
    fn empty_dashboard_snapshot_preserves_unknown_denominators() {
        let conn = setup_in_memory_db();
        let filters = TelemetryDashboardFilters::default();
        let snap = TelemetryRepository::aggregate_dashboard_snapshot(&conn, &filters, 1_700_000_000_000)
            .expect("empty snapshot");

        assert_eq!(snap.summary.total_routed_requests, 0);
        assert_eq!(snap.summary.terminal_executions, 0);
        assert_eq!(snap.summary.success_rate_percent, None);
        assert_eq!(snap.confidence_distribution.available_count, 0);
        assert_eq!(snap.completeness.complete_metadata_percent, None);
        assert!(!snap.retry_failover.retry_data_available);
        assert_eq!(snap.retry_failover.retry_execution_count, None);
    }

    #[test]
    fn dashboard_snapshot_maintains_sum_invariants_across_distributions() {
        let conn = setup_in_memory_db();
        let records = vec![
            TelemetryRecord {
                id: "t1".to_string(),
                event_type: TelemetryEventType::ProviderExecution,
                occurred_at: 1_700_000_010_000,
                session_id: None,
                message_id: None,
                task_id: None,
                stream_id: None,
                provider_id: Some("openai".to_string()),
                model_id: Some("gpt-4o".to_string()),
                outcome: TelemetryOutcome::Success,
                error_code: None,
                latency_ms: Some(120),
                prompt_tokens: Some(50),
                completion_tokens: Some(100),
                cost_usd: Some(0.001),
                confidence: Some(0.92),
                routing_reason: Some("Primary route".to_string()),
            },
            TelemetryRecord {
                id: "t2".to_string(),
                event_type: TelemetryEventType::ProviderExecution,
                occurred_at: 1_700_000_020_000,
                session_id: None,
                message_id: None,
                task_id: None,
                stream_id: None,
                provider_id: Some("anthropic".to_string()),
                model_id: Some("claude-3-5-sonnet".to_string()),
                outcome: TelemetryOutcome::Cancelled,
                error_code: Some("USER_CANCELLED".to_string()),
                latency_ms: Some(45),
                prompt_tokens: None,
                completion_tokens: None,
                cost_usd: None,
                confidence: None,
                routing_reason: None,
            },
            TelemetryRecord {
                id: "t3".to_string(),
                event_type: TelemetryEventType::SystemEvent,
                occurred_at: 1_700_000_030_000,
                session_id: None,
                message_id: None,
                task_id: None,
                stream_id: None,
                provider_id: None,
                model_id: None,
                outcome: TelemetryOutcome::Failure,
                error_code: Some("INIT_ERR".to_string()),
                latency_ms: None,
                prompt_tokens: None,
                completion_tokens: None,
                cost_usd: None,
                confidence: Some(0.20),
                routing_reason: None,
            },
        ];

        for r in &records {
            TelemetryRepository::insert(&conn, r).expect("insert record");
        }

        let snap = TelemetryRepository::aggregate_dashboard_snapshot(
            &conn,
            &TelemetryDashboardFilters::default(),
            1_700_000_050_000,
        )
        .expect("snapshot");

        assert_eq!(snap.summary.total_routed_requests, 3);
        let prov_sum: u64 = snap.provider_distribution.iter().map(|p| p.request_count).sum();
        let mod_sum: u64 = snap.model_distribution.iter().map(|m| m.request_count).sum();
        let out_sum: u64 = snap.outcome_distribution.iter().map(|o| o.count).sum();
        let ts_sum: u64 = snap.time_series.iter().map(|t| t.request_count).sum();

        assert_eq!(prov_sum, snap.summary.total_routed_requests);
        assert_eq!(mod_sum, snap.summary.total_routed_requests);
        assert_eq!(out_sum, snap.summary.total_routed_requests);
        assert_eq!(ts_sum, snap.summary.total_routed_requests);
        assert_eq!(
            snap.confidence_distribution.available_count + snap.confidence_distribution.missing_count,
            snap.summary.total_routed_requests
        );
    }

    #[test]
    fn financial_analytics_handles_retries_failovers_and_savings_without_double_counting() {
        let conn = setup_in_memory_db();

        // Logical request 1 (task_id = "req-1"):
        // - routing_decision event (excluded from physical attempts when execution exists)
        // - primary provider_execution failure with 0 cost
        // - fallback provider_execution success on openai/gpt-4o-mini
        let records = vec![
            TelemetryRecord {
                id: "f1-route".to_string(),
                event_type: TelemetryEventType::RoutingDecision,
                occurred_at: 1_730_000_000_000,
                session_id: None,
                message_id: None,
                task_id: Some("req-1".to_string()),
                stream_id: None,
                provider_id: Some("openai".to_string()),
                model_id: Some("gpt-4o".to_string()),
                outcome: TelemetryOutcome::Success,
                error_code: None,
                latency_ms: Some(12),
                prompt_tokens: None,
                completion_tokens: None,
                cost_usd: None,
                confidence: Some(0.9),
                routing_reason: Some("Primary route".to_string()),
            },
            TelemetryRecord {
                id: "f1-primary".to_string(),
                event_type: TelemetryEventType::ProviderExecution,
                occurred_at: 1_730_000_001_000,
                session_id: None,
                message_id: None,
                task_id: Some("req-1".to_string()),
                stream_id: None,
                provider_id: Some("openai".to_string()),
                model_id: Some("gpt-4o".to_string()),
                outcome: TelemetryOutcome::RateLimited,
                error_code: Some("RATE_LIMITED".to_string()),
                latency_ms: Some(80),
                prompt_tokens: Some(1_000),
                completion_tokens: Some(0),
                cost_usd: Some(0.0),
                confidence: Some(0.9),
                routing_reason: Some("Primary attempt".to_string()),
            },
            TelemetryRecord {
                id: "f1-fallback".to_string(),
                event_type: TelemetryEventType::ProviderExecution,
                occurred_at: 1_730_000_002_000,
                session_id: None,
                message_id: None,
                task_id: Some("req-1".to_string()),
                stream_id: None,
                provider_id: Some("openai".to_string()),
                model_id: Some("gpt-4o-mini".to_string()),
                outcome: TelemetryOutcome::Fallback,
                error_code: None,
                latency_ms: Some(210),
                prompt_tokens: Some(1_000),
                completion_tokens: Some(1_000),
                cost_usd: Some(0.00075), // $0.15/1M in + $0.60/1M out
                confidence: Some(0.9),
                routing_reason: Some("Failover from openai/gpt-4o".to_string()),
            },
        ];

        for r in &records {
            TelemetryRepository::insert(&conn, r).expect("insert record");
        }

        let fin = TelemetryRepository::aggregate_financial_analytics(
            &conn,
            &TelemetryDashboardFilters::default(),
            1_730_000_010_000,
        )
        .expect("financial analytics");

        // 1 logical request, 2 physical attempts, 1 intermediate routing_decision excluded
        assert_eq!(fin.token_summary.logical_request_count, 1);
        assert_eq!(fin.token_summary.physical_attempt_count, 2);
        assert_eq!(fin.token_summary.duplicate_or_intermediate_events_excluded, 1);
        assert_eq!(fin.token_summary.total_input_tokens, Some(2_000));
        assert_eq!(fin.token_summary.total_output_tokens, Some(1_000));
        assert_eq!(fin.token_summary.total_tokens, Some(3_000));
        assert_eq!(fin.actual_cost_summary.eligible_attempt_count, 2);
        assert_eq!(fin.actual_cost_summary.eligible_logical_request_count, 1);
        assert!(fin.savings_summary.estimated_savings_usd.unwrap() > 0.0);
    }

    #[test]
    fn performance_analytics_computes_exact_percentiles_outliers_and_logical_latency() {
        let conn = setup_test_db();
        let latencies = [100u64, 200, 300, 400, 500];
        for (i, lat) in latencies.iter().enumerate() {
            let rec = TelemetryRecord {
                id: format!("perf-{}", i),
                event_type: TelemetryEventType::ProviderExecution,
                occurred_at: 1_730_000_000_000 + (i as i64) * 1_000,
                session_id: None,
                message_id: None,
                task_id: Some(format!("task-{}", i)),
                stream_id: None,
                provider_id: Some("openai".to_string()),
                model_id: Some("gpt-4o-mini".to_string()),
                outcome: TelemetryOutcome::Success,
                error_code: None,
                latency_ms: Some(*lat),
                prompt_tokens: Some(100),
                completion_tokens: Some(50),
                cost_usd: Some(0.0001),
                confidence: Some(0.95),
                routing_reason: Some("Primary".to_string()),
            };
            TelemetryRepository::insert(&conn, &rec).expect("insert perf record");
        }

        let perf = TelemetryRepository::aggregate_performance_analytics(
            &conn,
            &TelemetryDashboardFilters::default(),
            1_730_000_010_000,
        )
        .expect("performance analytics");

        assert_eq!(perf.summary.measured_executions, 5);
        assert_eq!(perf.summary.median_latency_ms, Some(300.0));
        assert_eq!(perf.summary.average_latency_ms, Some(300.0));
        assert_eq!(perf.summary.min_latency_ms, Some(100));
        assert_eq!(perf.summary.max_latency_ms, Some(500));
        assert_eq!(perf.summary.p90_latency_ms, Some(460.0));
        assert_eq!(perf.summary.p95_latency_ms, Some(480.0));
        // n=5 < 10 -> p99 must be None (small-sample rule)
        assert_eq!(perf.summary.p99_latency_ms, None);
    }
}


