// ============================================================================
// Nano Route - Telemetry Application Service
// File: src-tauri/src/services/telemetry.rs
// ============================================================================
// Application service for recording and querying operational facts.
// Enforces validation, privacy sanitization, and non-fatal failure isolation.
// ============================================================================

use crate::domain::{
    TelemetryAggregateReport, TelemetryDashboardFilters, TelemetryDashboardSnapshot,
    TelemetryEventType, TelemetryFilter, TelemetryFinancialAnalytics, TelemetryOutcome,
    TelemetryPerformanceAnalytics, TelemetryRecord,
};
use crate::errors::AppError;
use crate::storage::repositories::TelemetryRepository;
use crate::storage::DatabaseManager;
use rusqlite::TransactionBehavior;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

static TELEMETRY_COUNTER: AtomicU64 = AtomicU64::new(1);

fn current_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn generate_telemetry_id() -> String {
    let now = current_epoch_ms();
    let count = TELEMETRY_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("telem_{}_{}", now, count)
}

/// Input parameters for recording an operational telemetry event.
#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordTelemetryInput {
    pub event_type: Option<TelemetryEventType>,
    pub session_id: Option<String>,
    pub message_id: Option<String>,
    pub task_id: Option<String>,
    pub stream_id: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub outcome: Option<TelemetryOutcome>,
    pub error_code: Option<String>,
    pub latency_ms: Option<u64>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cost_usd: Option<f64>,
    #[serde(alias = "confidenceScore", alias = "confidence_score")]
    pub confidence: Option<f64>,
    #[serde(alias = "routing_reason")]
    pub routing_reason: Option<String>,
}

pub struct TelemetryService {
    database_manager: Arc<DatabaseManager>,
}

impl TelemetryService {
    pub fn new(database_manager: Arc<DatabaseManager>) -> Self {
        Self { database_manager }
    }

    /// Validates raw inputs and normalizes constraints.
    fn validate_record(record: &TelemetryRecord) -> Result<(), AppError> {
        // Validate confidence range [0.0, 1.0]
        if let Some(conf) = record.confidence {
            if conf.is_nan() || conf.is_infinite() || conf < 0.0 || conf > 1.0 {
                return Err(AppError::InvalidInput(format!(
                    "Telemetry confidence score must be between 0.0 and 1.0; got {}",
                    conf
                )));
            }
        }

        // Validate cost >= 0.0
        if let Some(cost) = record.cost_usd {
            if cost.is_nan() || cost.is_infinite() || cost < 0.0 {
                return Err(AppError::InvalidInput(format!(
                    "Telemetry cost cannot be negative or invalid float; got {}",
                    cost
                )));
            }
        }

        // Validate reason length <= 255
        if let Some(ref reason) = record.routing_reason {
            if reason.len() > 255 {
                return Err(AppError::InvalidInput(
                    "Telemetry routing reason exceeds maximum permitted length of 255 characters".to_string(),
                ));
            }
        }

        // Validate provider_id length <= 64
        if let Some(ref p) = record.provider_id {
            if p.trim().is_empty() || p.len() > 64 {
                return Err(AppError::InvalidInput(
                    "Telemetry provider_id must be between 1 and 64 characters".to_string(),
                ));
            }
        }

        // Validate model_id length <= 128
        if let Some(ref m) = record.model_id {
            if m.trim().is_empty() || m.len() > 128 {
                return Err(AppError::InvalidInput(
                    "Telemetry model_id must be between 1 and 128 characters".to_string(),
                ));
            }
        }

        Ok(())
    }

    /// Records an operational event to SQLite.
    pub fn record_event(&self, input: RecordTelemetryInput) -> Result<TelemetryRecord, AppError> {
        let event_type = input.event_type.unwrap_or(TelemetryEventType::SystemEvent);
        let outcome = input.outcome.unwrap_or(TelemetryOutcome::Success);
        let occurred_at = current_epoch_ms();

        let record = TelemetryRecord {
            id: generate_telemetry_id(),
            event_type,
            occurred_at,
            session_id: input.session_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            message_id: input.message_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            task_id: input.task_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            stream_id: input.stream_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            provider_id: input.provider_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            model_id: input.model_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            outcome,
            error_code: input.error_code.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            latency_ms: input.latency_ms,
            prompt_tokens: input.prompt_tokens,
            completion_tokens: input.completion_tokens,
            cost_usd: input.cost_usd,
            confidence: input.confidence,
            routing_reason: input.routing_reason.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        };

        Self::validate_record(&record)?;

        self.database_manager.with_connection(|conn| {
            TelemetryRepository::insert(conn, &record)
                .map_err(|e| AppError::Internal(format!("Failed to persist telemetry event: {}", e)))
        })?;

        Ok(record)
    }

    /// Records a batch of operational telemetry events in a single transaction.
    pub fn record_batch(&self, inputs: Vec<RecordTelemetryInput>) -> Result<Vec<TelemetryRecord>, AppError> {
        if inputs.is_empty() {
            return Ok(Vec::new());
        }

        let mut records = Vec::with_capacity(inputs.len());
        for input in inputs {
            let event_type = input.event_type.unwrap_or(TelemetryEventType::SystemEvent);
            let outcome = input.outcome.unwrap_or(TelemetryOutcome::Success);
            let occurred_at = current_epoch_ms();

            let record = TelemetryRecord {
                id: generate_telemetry_id(),
                event_type,
                occurred_at,
                session_id: input.session_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                message_id: input.message_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                task_id: input.task_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                stream_id: input.stream_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                provider_id: input.provider_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                model_id: input.model_id.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                outcome,
                error_code: input.error_code.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
                latency_ms: input.latency_ms,
                prompt_tokens: input.prompt_tokens,
                completion_tokens: input.completion_tokens,
                cost_usd: input.cost_usd,
                confidence: input.confidence,
                routing_reason: input.routing_reason.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
            };

            Self::validate_record(&record)?;
            records.push(record);
        }

        self.database_manager.with_connection(|conn| {
            let tx = conn
                .transaction_with_behavior(TransactionBehavior::Immediate)
                .map_err(|e| AppError::Internal(format!("Failed to begin telemetry transaction: {}", e)))?;

            for record in &records {
                TelemetryRepository::insert(&tx, record)
                    .map_err(|e| AppError::Internal(format!("Failed to insert batch telemetry record: {}", e)))?;
            }

            tx.commit()
                .map_err(|e| AppError::Internal(format!("Failed to commit telemetry batch: {}", e)))?;

            Ok(())
        })?;

        Ok(records)
    }

    /// Queries filtered telemetry records with pagination.
    pub fn list_records(
        &self,
        filter: TelemetryFilter,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<TelemetryRecord>, AppError> {
        let limit_val = limit.unwrap_or(50).min(500);
        let offset_val = offset.unwrap_or(0);

        self.database_manager.with_connection(|conn| {
            TelemetryRepository::list(conn, &filter, limit_val, offset_val)
                .map_err(|e| AppError::Internal(format!("Failed to query telemetry records: {}", e)))
        })
    }

    /// Aggregates metrics over filtered operational observations.
    pub fn aggregate_metrics(&self, filter: TelemetryFilter) -> Result<TelemetryAggregateReport, AppError> {
        self.database_manager.with_connection(|conn| {
            TelemetryRepository::aggregate(conn, &filter)
                .map_err(|e| AppError::Internal(format!("Failed to aggregate telemetry metrics: {}", e)))
        })
    }

    /// Deletes a specific telemetry record by ID.
    pub fn delete_record(&self, id: &str) -> Result<bool, AppError> {
        let trimmed = id.trim();
        if trimmed.is_empty() {
            return Err(AppError::InvalidInput("Telemetry ID cannot be empty".to_string()));
        }

        self.database_manager.with_connection(|conn| {
            TelemetryRepository::delete(conn, trimmed)
                .map_err(|e| AppError::Internal(format!("Failed to delete telemetry record: {}", e)))
        })
    }

    /// Non-panicking fire-and-forget wrapper used by internal classifier/analyzer services.
    pub fn record(&self, input: RecordTelemetryInput) {
        let _ = self.record_event(input);
    }

    fn validate_and_normalize_dashboard_filters(
        mut filters: TelemetryDashboardFilters,
    ) -> Result<TelemetryDashboardFilters, AppError> {
        if let (Some(start), Some(end)) = (filters.start_time, filters.end_time) {
            if start > end {
                return Err(AppError::InvalidInput(
                    "Telemetry date range start cannot be after date range end".to_string(),
                ));
            }
        }

        if let Some(ref p) = filters.provider_id {
            if p.len() > 128 {
                return Err(AppError::InvalidInput(
                    "Telemetry provider filter exceeds maximum length of 128 characters".to_string(),
                ));
            }
        }

        if let Some(ref m) = filters.model_id {
            if m.len() > 128 {
                return Err(AppError::InvalidInput(
                    "Telemetry model filter exceeds maximum length of 128 characters".to_string(),
                ));
            }
        }

        if let Some(ref out_str) = filters.outcome {
            let trimmed = out_str.trim().to_lowercase();
            if !trimmed.is_empty() && trimmed != "unknown" {
                TelemetryOutcome::from_str(&trimmed).map_err(AppError::InvalidInput)?;
            }
        }

        filters.provider_id = filters
            .provider_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        filters.model_id = filters
            .model_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        filters.outcome = filters
            .outcome
            .map(|s| s.trim().to_lowercase())
            .filter(|s| !s.is_empty());
        filters.baseline_provider_id = filters
            .baseline_provider_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        filters.baseline_model_id = filters
            .baseline_model_id
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        Ok(filters)
    }

    /// Validates dashboard filters and returns a read-only Step 42 & Step 43 `TelemetryDashboardSnapshot`.
    pub fn get_dashboard_snapshot(
        &self,
        filters: TelemetryDashboardFilters,
    ) -> Result<TelemetryDashboardSnapshot, AppError> {
        let valid_filters = Self::validate_and_normalize_dashboard_filters(filters)?;
        let generated_at_ms = current_epoch_ms();
        self.database_manager.with_connection(|conn| {
            TelemetryRepository::aggregate_dashboard_snapshot(conn, &valid_filters, generated_at_ms)
                .map_err(|e| {
                    AppError::Internal(format!(
                        "Failed to compute telemetry dashboard snapshot: {}",
                        e
                    ))
                })
        })
    }

    /// Validates dashboard filters and returns a read-only Step 43 `TelemetryFinancialAnalytics` snapshot.
    pub fn get_cost_analytics_snapshot(
        &self,
        filters: TelemetryDashboardFilters,
    ) -> Result<TelemetryFinancialAnalytics, AppError> {
        let valid_filters = Self::validate_and_normalize_dashboard_filters(filters)?;
        let generated_at_ms = current_epoch_ms();
        self.database_manager.with_connection(|conn| {
            TelemetryRepository::aggregate_financial_analytics(
                conn,
                &valid_filters,
                generated_at_ms,
            )
            .map_err(|e| {
                AppError::Internal(format!(
                    "Failed to compute telemetry financial analytics snapshot: {}",
                    e
                ))
            })
        })
    }

    /// Validates dashboard filters and returns a read-only Step 44 `TelemetryPerformanceAnalytics` snapshot.
    pub fn get_performance_analytics_snapshot(
        &self,
        filters: TelemetryDashboardFilters,
    ) -> Result<TelemetryPerformanceAnalytics, AppError> {
        let valid_filters = Self::validate_and_normalize_dashboard_filters(filters)?;
        let generated_at_ms = current_epoch_ms();
        self.database_manager.with_connection(|conn| {
            TelemetryRepository::aggregate_performance_analytics(
                conn,
                &valid_filters,
                generated_at_ms,
            )
            .map_err(|e| {
                AppError::Internal(format!(
                    "Failed to compute telemetry performance analytics snapshot: {}",
                    e
                ))
            })
        })
    }

    /// Clears all telemetry records (supports local data wipe).
    pub fn clear_all(&self) -> Result<usize, AppError> {
        self.database_manager.with_connection(|conn| {
            TelemetryRepository::clear_all(conn)
                .map_err(|e| AppError::Internal(format!("Failed to clear all telemetry records: {}", e)))
        })
    }
}
