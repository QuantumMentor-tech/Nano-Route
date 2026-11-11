// ============================================================================
// Nano Route - History Explorer Domain Models
// File: src-tauri/src/domain/history.rs
// ============================================================================
// Pure typed DTOs and contracts for historical conversation exploration,
// deterministic lexical search, filtering, sorting, pagination, and safe bulk delete.
// Independent of live routing, SLM execution, or provider network clients.
// ============================================================================

use crate::domain::MessageSender;
use serde::{Deserialize, Serialize};

/// Deterministic sort orders permitted for History Explorer queries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum HistorySortMode {
    #[default]
    MostRecent,
    Oldest,
    RecentlyCreated,
    OldestCreated,
    PinnedFirst,
}

impl HistorySortMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::MostRecent => "most_recent",
            Self::Oldest => "oldest",
            Self::RecentlyCreated => "recently_created",
            Self::OldestCreated => "oldest_created",
            Self::PinnedFirst => "pinned_first",
        }
    }
}

/// Identifies why a session matched a search query.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HistoryMatchType {
    SessionTitle,
    MessageContent,
}

/// Search execution engine used to satisfy a query.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HistorySearchEngine {
    Fts5,
    SqlIndexedFallback,
}

/// Typed filter criteria backed strictly by persisted historical columns.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryFilter {
    pub query: Option<String>,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub pinned_only: Option<bool>,
    pub date_from: Option<i64>,
    pub date_to: Option<i64>,
}

/// Bounded pagination options for History queries.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPagination {
    pub limit: u32,
    pub offset: u32,
}

impl Default for HistoryPagination {
    fn default() -> Self {
        Self {
            limit: 25,
            offset: 0,
        }
    }
}

/// Request contract for listing or searching History Explorer sessions.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistorySearchRequest {
    pub query: Option<String>,
    pub filter: Option<HistoryFilter>,
    pub sort: Option<HistorySortMode>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub query_id: Option<String>,
}

/// Historical session summary DTO exposed to frontend History Explorer.
/// Includes aggregated message counts and historical provider/model provenance.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySessionDto {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub pinned: bool,
    pub message_count: u64,
    pub providers_used: Vec<String>,
    pub models_used: Vec<String>,
}

/// Safe plain-text match preview excerpt for a historical message hit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMessageMatchPreview {
    pub message_id: String,
    pub session_id: String,
    pub sender: MessageSender,
    pub match_type: HistoryMatchType,
    pub preview_text: String,
    pub match_start_offset: Option<usize>,
    pub match_length: Option<usize>,
    pub routed_provider: Option<String>,
    pub routed_model: Option<String>,
    pub created_at: i64,
}

/// Single session hit in a History search result set.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySearchResult {
    pub session: HistorySessionDto,
    pub match_types: Vec<HistoryMatchType>,
    pub title_match: bool,
    pub title_match_start: Option<usize>,
    pub title_match_length: Option<usize>,
    pub matched_message_count: u64,
    pub matched_message_ids: Vec<String>,
    pub previews: Vec<HistoryMessageMatchPreview>,
}

/// Pagination metadata returned alongside bounded history results.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPageInfo {
    pub limit: u32,
    pub offset: u32,
    pub total_count: Option<u64>,
    pub total_count_is_exact: bool,
    pub has_more: bool,
}

/// Paginated list response for History Explorer browsing (non-search or filtered listing).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPage {
    pub items: Vec<HistorySessionDto>,
    pub page_info: HistoryPageInfo,
    pub query_id: Option<String>,
}

/// Paginated search response containing session matches and bounded message previews.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySearchResponse {
    pub query_id: Option<String>,
    pub items: Vec<HistorySearchResult>,
    pub page_info: HistoryPageInfo,
    pub search_engine_used: HistorySearchEngine,
    pub duration_ms: u64,
}

/// Distinct historical provider and model strings recorded in `chat_messages`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HistoryFilterOptions {
    pub providers: Vec<String>,
    pub models: Vec<String>,
}

/// Transactional summary returned after controlled bulk session deletion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteResult {
    pub requested_count: usize,
    pub deleted_count: usize,
    pub deleted_session_ids: Vec<String>,
    pub missing_session_ids: Vec<String>,
}

