// ============================================================================
// Nano Route - History Explorer Application Service
// File: src-tauri/src/services/history.rs
// ============================================================================
// Coordinates read-only historical conversation browsing, deterministic lexical
// search, filtering, sorting, bounded pagination, and transactional bulk deletes.
// Never invokes the SLM, routing scoring/policy, or cloud provider adapters.
// Never logs user queries or conversation content.
// ============================================================================

use crate::domain::{
    BulkDeleteResult, HistoryFilter, HistoryFilterOptions, HistoryPage, HistorySearchRequest,
    HistorySearchResponse, HistorySortMode,
};
use crate::errors::AppError;
use crate::storage::repositories::HistoryRepository;
use crate::storage::DatabaseManager;
use std::sync::Arc;

pub const MAX_SEARCH_QUERY_CHARS: usize = 512;
pub const MAX_FILTER_STRING_CHARS: usize = 128;
pub const MAX_BULK_DELETE_BATCH: usize = 100;

pub struct HistoryService {
    database_manager: Arc<DatabaseManager>,
}

impl HistoryService {
    pub fn new(database_manager: Arc<DatabaseManager>) -> Self {
        Self { database_manager }
    }

    fn validate_filter(raw: Option<HistoryFilter>) -> Result<HistoryFilter, AppError> {
        let mut filter = raw.unwrap_or_default();

        if let Some(ref q) = filter.query {
            if q.chars().count() > MAX_SEARCH_QUERY_CHARS {
                return Err(AppError::InvalidInput(format!(
                    "Search query exceeds maximum permitted length of {} characters",
                    MAX_SEARCH_QUERY_CHARS
                )));
            }
        }

        if let Some(ref prov) = filter.provider_id {
            if prov.chars().count() > MAX_FILTER_STRING_CHARS {
                return Err(AppError::InvalidInput(
                    "Provider filter exceeds maximum length".to_string(),
                ));
            }
            let trimmed = prov.trim().to_string();
            filter.provider_id = if trimmed.is_empty() { None } else { Some(trimmed) };
        }

        if let Some(ref model) = filter.model_id {
            if model.chars().count() > MAX_FILTER_STRING_CHARS {
                return Err(AppError::InvalidInput(
                    "Model filter exceeds maximum length".to_string(),
                ));
            }
            let trimmed = model.trim().to_string();
            filter.model_id = if trimmed.is_empty() { None } else { Some(trimmed) };
        }

        if let (Some(from), Some(to)) = (filter.date_from, filter.date_to) {
            if from > to {
                return Err(AppError::InvalidInput(
                    "Date range start cannot be after date range end".to_string(),
                ));
            }
        }

        Ok(filter)
    }

    /// Lists paginated historical sessions with aggregate message counts and filters.
    pub fn list_history(
        &self,
        filter: Option<HistoryFilter>,
        sort: Option<HistorySortMode>,
        limit: Option<u32>,
        offset: Option<u32>,
        query_id: Option<String>,
    ) -> Result<HistoryPage, AppError> {
        let valid_filter = Self::validate_filter(filter)?;
        let sort_mode = sort.unwrap_or(HistorySortMode::PinnedFirst);

        self.database_manager.with_connection(|conn| {
            HistoryRepository::list_sessions(conn, &valid_filter, sort_mode, limit, offset, query_id)
                .map_err(|e| AppError::Internal(format!("Failed to list conversation history: {}", e)))
        })
    }

    /// Executes deterministic local search across session titles and message contents.
    pub fn search_history(&self, request: HistorySearchRequest) -> Result<HistorySearchResponse, AppError> {
        let mut filter = Self::validate_filter(request.filter)?;
        let query_text = request
            .query
            .or_else(|| filter.query.take())
            .unwrap_or_default();

        if query_text.chars().count() > MAX_SEARCH_QUERY_CHARS {
            return Err(AppError::InvalidInput(format!(
                "Search query exceeds maximum permitted length of {} characters",
                MAX_SEARCH_QUERY_CHARS
            )));
        }

        let sort_mode = request.sort.unwrap_or(HistorySortMode::MostRecent);
        let trimmed_q = query_text.trim().to_string();

        self.database_manager.with_connection(|conn| {
            HistoryRepository::search(
                conn,
                &trimmed_q,
                &filter,
                sort_mode,
                request.limit,
                request.offset,
                request.query_id,
            )
            .map_err(|e| AppError::Internal(format!("Failed to search conversation history: {}", e)))
        })
    }

    /// Retrieves distinct historical provider and model strings recorded in `chat_messages`.
    pub fn get_filter_options(&self) -> Result<HistoryFilterOptions, AppError> {
        self.database_manager.with_connection(|conn| {
            HistoryRepository::list_filter_options(conn)
                .map_err(|e| AppError::Internal(format!("Failed to list history filter options: {}", e)))
        })
    }

    /// Atomically deletes a bounded batch of sessions and cascades to child messages & FTS index.
    pub fn delete_sessions_bulk(
        &self,
        session_ids: Vec<String>,
    ) -> Result<BulkDeleteResult, AppError> {
        if session_ids.is_empty() {
            return Err(AppError::InvalidInput(
                "At least one session ID must be provided for deletion".to_string(),
            ));
        }

        if session_ids.len() > MAX_BULK_DELETE_BATCH {
            return Err(AppError::InvalidInput(format!(
                "Bulk delete batch exceeds maximum permitted size of {} sessions",
                MAX_BULK_DELETE_BATCH
            )));
        }

        for sid in &session_ids {
            if sid.trim().is_empty() {
                return Err(AppError::InvalidInput(
                    "Bulk delete list contains an empty session ID".to_string(),
                ));
            }
        }

        self.database_manager.with_connection(|conn| {
            HistoryRepository::delete_sessions_bulk(conn, &session_ids)
                .map_err(|e| AppError::Internal(format!("Failed to delete selected sessions: {}", e)))
        })
    }

    /// Rebuilds the local FTS5 search index deterministically from authoritative tables.
    pub fn rebuild_search_index(&self) -> Result<u64, AppError> {
        self.database_manager.with_connection(|conn| {
            HistoryRepository::rebuild_search_index(conn)
                .map_err(|e| AppError::Internal(format!("Failed to rebuild search index: {}", e)))
        })
    }
}

