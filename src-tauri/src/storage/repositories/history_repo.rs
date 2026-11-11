// ============================================================================
// Nano Route - History Explorer Repository
// File: src-tauri/src/storage/repositories/history_repo.rs
// ============================================================================
// High-performance, privacy-preserving local SQLite query and search repository.
// Strictly parameterized SQL; zero string interpolation of user input;
// bounded pagination; FTS5 search with indexed SQL LIKE fallback and recovery.
// ============================================================================

use crate::domain::{
    BulkDeleteResult, HistoryFilter, HistoryFilterOptions, HistoryMatchType,
    HistoryMessageMatchPreview, HistoryPage, HistoryPageInfo, HistorySearchEngine,
    HistorySearchResponse, HistorySearchResult, HistorySessionDto, HistorySortMode,
    MessageSender,
};
use crate::storage::errors::DatabaseError;
use rusqlite::{params_from_iter, types::Value, Connection, Row, TransactionBehavior};
use std::collections::{HashMap, HashSet};
use std::time::Instant;

pub const DEFAULT_HISTORY_PAGE_SIZE: u32 = 25;
pub const MAX_HISTORY_PAGE_SIZE: u32 = 100;
pub const MAX_SEARCH_PREVIEWS_PER_SESSION: usize = 3;
pub const MAX_MATCHED_IDS_PER_SESSION: usize = 20;
pub const MAX_PREVIEW_CHARS: usize = 160;

pub struct HistoryRepository;

impl HistoryRepository {
    /// Clamps requested pagination limit to safe operational bounds [1, 100].
    pub fn normalize_limit(limit: Option<u32>) -> u32 {
        limit.unwrap_or(DEFAULT_HISTORY_PAGE_SIZE).clamp(1, MAX_HISTORY_PAGE_SIZE)
    }

    /// Escapes SQL LIKE wildcards using `\` escape character.
    pub fn escape_like_pattern(input: &str) -> String {
        let mut out = String::with_capacity(input.len() + 8);
        for ch in input.chars() {
            match ch {
                '\\' => out.push_str("\\\\"),
                '%' => out.push_str("\\%"),
                '_' => out.push_str("\\_"),
                other => out.push(other),
            }
        }
        out
    }

    /// Safely constructs a quoted FTS5 MATCH expression from natural search text.
    /// Returns `None` if input contains no FTS5-indexable alphanumeric tokens
    /// (e.g. pure punctuation or emoji), triggering safe SQL LIKE fallback.
    pub fn build_fts5_match_expression(raw_query: &str) -> Option<String> {
        let mut tokens: Vec<String> = Vec::new();
        let mut current = String::new();

        for ch in raw_query.chars() {
            if ch.is_alphanumeric() || ch == '_' {
                for lc in ch.to_lowercase() {
                    current.push(lc);
                }
            } else if !current.is_empty() {
                tokens.push(std::mem::take(&mut current));
                if tokens.len() >= 16 {
                    break;
                }
            }
        }
        if !current.is_empty() && tokens.len() < 16 {
            tokens.push(current);
        }

        if tokens.is_empty() {
            return None;
        }

        let expr = tokens
            .into_iter()
            .map(|tok| format!("\"{}\"*", tok.replace('"', "")))
            .collect::<Vec<_>>()
            .join(" ");

        Some(expr)
    }

    /// Extracts a bounded plain-text snippet around the first case-insensitive match
    /// using Unicode scalar boundaries (`chars()`), never splitting multi-byte codepoints.
    pub fn extract_safe_preview(
        content: &str,
        query: &str,
    ) -> (String, Option<usize>, Option<usize>) {
        let chars: Vec<char> = content.chars().collect();
        if chars.is_empty() {
            return (String::new(), None, None);
        }

        let trimmed_query = query.trim();
        let lower_chars: Vec<char> = chars.iter().flat_map(|c| c.to_lowercase()).collect();
        let query_lower_chars: Vec<char> = trimmed_query
            .chars()
            .flat_map(|c| c.to_lowercase())
            .collect();

        let match_char_idx = if !query_lower_chars.is_empty() && lower_chars.len() >= query_lower_chars.len() {
            // Find exact contiguous case-insensitive char match first
            let exact_pos = find_subslice_char_pos(&chars, trimmed_query);
            if exact_pos.is_some() {
                exact_pos
            } else {
                // Fall back to matching the first word token in multi-word searches
                trimmed_query
                    .split_whitespace()
                    .find_map(|tok| find_subslice_char_pos(&chars, tok))
            }
        } else {
            None
        };

        let matched_len = if let Some(start) = match_char_idx {
            let exact_matched = find_subslice_char_pos(&chars, trimmed_query) == Some(start);
            if exact_matched {
                trimmed_query.chars().count()
            } else {
                trimmed_query
                    .split_whitespace()
                    .find(|tok| find_subslice_char_pos(&chars, tok) == Some(start))
                    .map(|tok| tok.chars().count())
                    .unwrap_or(0)
            }
        } else {
            0
        };

        if chars.len() <= MAX_PREVIEW_CHARS {
            let preview: String = chars.into_iter().collect();
            return match match_char_idx {
                Some(idx) if matched_len > 0 => (preview, Some(idx), Some(matched_len)),
                _ => (preview, None, None),
            };
        }

        let window_start = match match_char_idx {
            Some(pos) => pos.saturating_sub(48),
            None => 0,
        };
        let window_end = (window_start + MAX_PREVIEW_CHARS).min(chars.len());
        let has_prefix = window_start > 0;
        let has_suffix = window_end < chars.len();

        let mut snippet = String::with_capacity(MAX_PREVIEW_CHARS + 8);
        if has_prefix {
            snippet.push_str("...");
        }
        let body: String = chars[window_start..window_end].iter().collect();
        snippet.push_str(&body);
        if has_suffix {
            snippet.push_str("...");
        }

        let adjusted_offset = match match_char_idx {
            Some(pos) if pos >= window_start && pos < window_end && matched_len > 0 => {
                let prefix_len = if has_prefix { 3 } else { 0 };
                let rel_start = prefix_len + (pos - window_start);
                let visible_match_len = matched_len.min(window_end - pos);
                Some((rel_start, visible_match_len))
            }
            _ => None,
        };

        match adjusted_offset {
            Some((off, len)) => (snippet, Some(off), Some(len)),
            None => (snippet, None, None),
        }
    }

    fn sort_order_clause(sort: HistorySortMode) -> &'static str {
        match sort {
            HistorySortMode::MostRecent => "s.updated_at DESC, s.id DESC",
            HistorySortMode::Oldest => "s.updated_at ASC, s.id ASC",
            HistorySortMode::RecentlyCreated => "s.created_at DESC, s.id DESC",
            HistorySortMode::OldestCreated => "s.created_at ASC, s.id ASC",
            HistorySortMode::PinnedFirst => "s.pinned DESC, s.updated_at DESC, s.id DESC",
        }
    }

    fn build_session_filter_clauses(
        filter: &HistoryFilter,
        params: &mut Vec<Value>,
        clauses: &mut Vec<String>,
    ) {
        if let Some(ref prov) = filter.provider_id {
            let trimmed = prov.trim();
            if !trimmed.is_empty() {
                let idx = params.len() + 1;
                params.push(Value::Text(trimmed.to_string()));
                clauses.push(format!(
                    "EXISTS (SELECT 1 FROM chat_messages pm WHERE pm.session_id = s.id AND LOWER(pm.routed_provider) = LOWER(?{}))",
                    idx
                ));
            }
        }

        if let Some(ref model) = filter.model_id {
            let trimmed = model.trim();
            if !trimmed.is_empty() {
                let idx = params.len() + 1;
                params.push(Value::Text(trimmed.to_string()));
                clauses.push(format!(
                    "EXISTS (SELECT 1 FROM chat_messages mm WHERE mm.session_id = s.id AND LOWER(mm.routed_model) = LOWER(?{}))",
                    idx
                ));
            }
        }

        if filter.pinned_only == Some(true) {
            clauses.push("s.pinned = 1".to_string());
        }

        if let Some(date_from) = filter.date_from {
            let idx = params.len() + 1;
            params.push(Value::Integer(date_from));
            clauses.push(format!("s.updated_at >= ?{}", idx));
        }

        if let Some(date_to) = filter.date_to {
            let idx = params.len() + 1;
            params.push(Value::Integer(date_to));
            clauses.push(format!("s.updated_at <= ?{}", idx));
        }
    }

    fn map_session_row(row: &Row) -> Result<HistorySessionDto, rusqlite::Error> {
        let pinned_int: i64 = row.get(4)?;
        let message_count_raw: i64 = row.get(5)?;
        let providers_csv: String = row.get(6)?;
        let models_csv: String = row.get(7)?;

        let providers_used = split_csv_distinct(&providers_csv);
        let models_used = split_csv_distinct(&models_csv);

        Ok(HistorySessionDto {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            pinned: pinned_int != 0,
            message_count: message_count_raw.max(0) as u64,
            providers_used,
            models_used,
        })
    }

    /// Lists paginated history sessions using a single aggregate query (no N+1 queries).
    pub fn list_sessions(
        conn: &Connection,
        filter: &HistoryFilter,
        sort: HistorySortMode,
        limit: Option<u32>,
        offset: Option<u32>,
        query_id: Option<String>,
    ) -> Result<HistoryPage, DatabaseError> {
        let limit_val = Self::normalize_limit(limit);
        let offset_val = offset.unwrap_or(0);

        let mut params: Vec<Value> = Vec::new();
        let mut clauses: Vec<String> = Vec::new();
        Self::build_session_filter_clauses(filter, &mut params, &mut clauses);

        let where_sql = if clauses.is_empty() {
            String::new()
        } else {
            format!("WHERE {}", clauses.join(" AND "))
        };

        // 1. Exact total count matching filter
        let count_sql = format!("SELECT COUNT(*) FROM chat_sessions s {};", where_sql);
        let total_count_raw: i64 = conn
            .query_row(&count_sql, params_from_iter(params.iter()), |r| r.get(0))
            .map_err(|e| DatabaseError::query_failed(format!("Failed to count history sessions: {}", e)))?;

        // 2. Single-query paginated fetch with aggregate message_count & distinct providers/models
        let limit_idx = params.len() + 1;
        let offset_idx = params.len() + 2;
        let mut page_params = params;
        page_params.push(Value::Integer((limit_val + 1) as i64));
        page_params.push(Value::Integer(offset_val as i64));

        let order_clause = Self::sort_order_clause(sort);
        let sql = format!(
            r#"
            SELECT
                s.id,
                s.title,
                s.created_at,
                s.updated_at,
                s.pinned,
                COUNT(m.id) AS message_count,
                COALESCE(GROUP_CONCAT(DISTINCT m.routed_provider), '') AS providers_csv,
                COALESCE(GROUP_CONCAT(DISTINCT m.routed_model), '') AS models_csv
            FROM chat_sessions s
            LEFT JOIN chat_messages m ON m.session_id = s.id
            {}
            GROUP BY s.id
            ORDER BY {}
            LIMIT ?{} OFFSET ?{};
            "#,
            where_sql, order_clause, limit_idx, offset_idx
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare history list query: {}", e)))?;

        let rows = stmt
            .query_map(params_from_iter(page_params.iter()), Self::map_session_row)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute history list query: {}", e)))?;

        let mut items = Vec::new();
        for row in rows {
            items.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map history session row: {}", e)))?);
        }

        let has_more = items.len() > limit_val as usize;
        if has_more {
            items.truncate(limit_val as usize);
        }

        Ok(HistoryPage {
            items,
            page_info: HistoryPageInfo {
                limit: limit_val,
                offset: offset_val,
                total_count: Some(total_count_raw.max(0) as u64),
                total_count_is_exact: true,
                has_more,
            },
            query_id,
        })
    }

    /// Searches session titles and message contents locally via FTS5 with safe fallback.
    pub fn search(
        conn: &Connection,
        raw_query: &str,
        filter: &HistoryFilter,
        sort: HistorySortMode,
        limit: Option<u32>,
        offset: Option<u32>,
        query_id: Option<String>,
    ) -> Result<HistorySearchResponse, DatabaseError> {
        let start = Instant::now();
        let trimmed_query = raw_query.trim();
        let limit_val = Self::normalize_limit(limit);
        let offset_val = offset.unwrap_or(0);

        if trimmed_query.is_empty() {
            let page = Self::list_sessions(
                conn,
                filter,
                sort,
                Some(limit_val),
                Some(offset_val),
                query_id.clone(),
            )?;
            let items = page
                .items
                .into_iter()
                .map(|s| HistorySearchResult {
                    session: s,
                    match_types: Vec::new(),
                    title_match: false,
                    title_match_start: None,
                    title_match_length: None,
                    matched_message_count: 0,
                    matched_message_ids: Vec::new(),
                    previews: Vec::new(),
                })
                .collect();

            return Ok(HistorySearchResponse {
                query_id,
                items,
                page_info: page.page_info,
                search_engine_used: HistorySearchEngine::Fts5,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        // Determine matching candidates via FTS5 if available and query tokenizes cleanly,
        // otherwise use parameterized indexed SQL LIKE fallback.
        let mut engine_used = HistorySearchEngine::SqlIndexedFallback;
        let candidate_hits = match Self::build_fts5_match_expression(trimmed_query) {
            Some(fts_expr) => match Self::collect_fts_hits(conn, &fts_expr) {
                Ok(hits) => {
                    engine_used = HistorySearchEngine::Fts5;
                    hits
                }
                Err(_) => Self::collect_sql_like_hits(conn, trimmed_query)?,
            },
            None => Self::collect_sql_like_hits(conn, trimmed_query)?,
        };

        if candidate_hits.is_empty() {
            return Ok(HistorySearchResponse {
                query_id,
                items: Vec::new(),
                page_info: HistoryPageInfo {
                    limit: limit_val,
                    offset: offset_val,
                    total_count: Some(0),
                    total_count_is_exact: true,
                    has_more: false,
                },
                search_engine_used: engine_used,
                duration_ms: start.elapsed().as_millis() as u64,
            });
        }

        // Filter candidates deterministically in SQL according to active filters & sort order
        let mut matched_ids: Vec<String> = candidate_hits.keys().cloned().collect();
        matched_ids.sort();

        let mut params: Vec<Value> = Vec::new();
        let mut clauses: Vec<String> = Vec::new();
        Self::build_session_filter_clauses(filter, &mut params, &mut clauses);

        // Restrict to candidate session IDs
        let mut in_placeholders = Vec::with_capacity(matched_ids.len());
        for sid in &matched_ids {
            params.push(Value::Text(sid.clone()));
            in_placeholders.push(format!("?{}", params.len()));
        }
        clauses.push(format!("s.id IN ({})", in_placeholders.join(", ")));

        let where_sql = format!("WHERE {}", clauses.join(" AND "));

        // Exact title match boost -> partial title match -> message match -> user sort tie-breaker
        let exact_title_idx = params.len() + 1;
        params.push(Value::Text(trimmed_query.to_string()));

        let like_title_idx = params.len() + 1;
        let like_pattern = format!("%{}%", Self::escape_like_pattern(trimmed_query));
        params.push(Value::Text(like_pattern));

        let count_sql = format!("SELECT COUNT(*) FROM chat_sessions s {};", where_sql);
        // Count only uses filter + IN params (slice before exact_title_idx - 1)
        let count_param_len = exact_title_idx - 1;
        let total_count_raw: i64 = conn
            .query_row(&count_sql, params_from_iter(params[..count_param_len].iter()), |r| r.get(0))
            .map_err(|e| DatabaseError::query_failed(format!("Failed to count search results: {}", e)))?;

        let limit_idx = params.len() + 1;
        let offset_idx = params.len() + 2;
        params.push(Value::Integer((limit_val + 1) as i64));
        params.push(Value::Integer(offset_val as i64));

        let sort_clause = Self::sort_order_clause(sort);
        let session_sql = format!(
            r#"
            SELECT
                s.id,
                s.title,
                s.created_at,
                s.updated_at,
                s.pinned,
                COUNT(m.id) AS message_count,
                COALESCE(GROUP_CONCAT(DISTINCT m.routed_provider), '') AS providers_csv,
                COALESCE(GROUP_CONCAT(DISTINCT m.routed_model), '') AS models_csv
            FROM chat_sessions s
            LEFT JOIN chat_messages m ON m.session_id = s.id
            {}
            GROUP BY s.id
            ORDER BY
                CASE
                    WHEN LOWER(s.title) = LOWER(?{}) THEN 0
                    WHEN LOWER(s.title) LIKE LOWER(?{}) ESCAPE '\' THEN 1
                    ELSE 2
                END ASC,
                {}
            LIMIT ?{} OFFSET ?{};
            "#,
            where_sql, exact_title_idx, like_title_idx, sort_clause, limit_idx, offset_idx
        );

        let mut stmt = conn
            .prepare(&session_sql)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare search session query: {}", e)))?;

        let rows = stmt
            .query_map(params_from_iter(params.iter()), Self::map_session_row)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute search session query: {}", e)))?;

        let mut paged_sessions = Vec::new();
        for row in rows {
            paged_sessions.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map search session row: {}", e)))?);
        }

        let has_more = paged_sessions.len() > limit_val as usize;
        if has_more {
            paged_sessions.truncate(limit_val as usize);
        }

        // Batch-fetch matching message previews ONLY for the sessions on this page (O(1) queries, zero N+1)
        let page_message_ids: Vec<String> = paged_sessions
            .iter()
            .flat_map(|s| {
                candidate_hits
                    .get(&s.id)
                    .map(|h| {
                        h.message_ids
                            .iter()
                            .take(MAX_SEARCH_PREVIEWS_PER_SESSION)
                            .cloned()
                            .collect::<Vec<_>>()
                    })
                    .unwrap_or_default()
            })
            .collect();

        let previews_by_message_id =
            Self::fetch_message_previews_batch(conn, &page_message_ids, trimmed_query)?;

        let mut results = Vec::with_capacity(paged_sessions.len());
        for session in paged_sessions {
            let hit = candidate_hits.get(&session.id);
            let title_match_pos = find_subslice_char_pos(
                &session.title.chars().collect::<Vec<_>>(),
                trimmed_query,
            );
            let title_matched =
                title_match_pos.is_some() || hit.map(|h| h.title_matched).unwrap_or(false);

            let (title_match_start, title_match_length) = match title_match_pos {
                Some(pos) => (Some(pos), Some(trimmed_query.chars().count())),
                None => (None, None),
            };

            let all_msg_ids: Vec<String> = hit
                .map(|h| h.message_ids.clone())
                .unwrap_or_default();
            let matched_msg_count = all_msg_ids.len() as u64;
            let bounded_msg_ids: Vec<String> = all_msg_ids
                .into_iter()
                .take(MAX_MATCHED_IDS_PER_SESSION)
                .collect();

            let mut match_types = Vec::new();
            if title_matched {
                match_types.push(HistoryMatchType::SessionTitle);
            }
            if matched_msg_count > 0 {
                match_types.push(HistoryMatchType::MessageContent);
            }

            let mut previews = Vec::new();
            for mid in bounded_msg_ids.iter().take(MAX_SEARCH_PREVIEWS_PER_SESSION) {
                if let Some(prev) = previews_by_message_id.get(mid) {
                    previews.push(prev.clone());
                }
            }

            results.push(HistorySearchResult {
                session,
                match_types,
                title_match: title_matched,
                title_match_start,
                title_match_length,
                matched_message_count: matched_msg_count,
                matched_message_ids: bounded_msg_ids,
                previews,
            });
        }

        Ok(HistorySearchResponse {
            query_id,
            items: results,
            page_info: HistoryPageInfo {
                limit: limit_val,
                offset: offset_val,
                total_count: Some(total_count_raw.max(0) as u64),
                total_count_is_exact: true,
                has_more,
            },
            search_engine_used: engine_used,
            duration_ms: start.elapsed().as_millis() as u64,
        })
    }

    fn collect_fts_hits(
        conn: &Connection,
        fts_expr: &str,
    ) -> Result<HashMap<String, CandidateHit>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT entry_type, session_id, message_id
                FROM history_search_fts
                WHERE history_search_fts MATCH ?1
                LIMIT 2000;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("FTS5 query prepare failed: {}", e)))?;

        let rows = stmt
            .query_map([fts_expr], |r| {
                let entry_type: String = r.get(0)?;
                let session_id: String = r.get(1)?;
                let message_id: String = r.get(2)?;
                Ok((entry_type, session_id, message_id))
            })
            .map_err(|e| DatabaseError::query_failed(format!("FTS5 query execution failed: {}", e)))?;

        let mut map: HashMap<String, CandidateHit> = HashMap::new();
        for row in rows {
            let (entry_type, session_id, message_id) = row
                .map_err(|e| DatabaseError::query_failed(format!("FTS5 row read failed: {}", e)))?;
            let entry = map.entry(session_id).or_default();
            if entry_type == "session" {
                entry.title_matched = true;
            } else if !message_id.is_empty() && !entry.message_ids.contains(&message_id) {
                entry.message_ids.push(message_id);
            }
        }

        Ok(map)
    }

    fn collect_sql_like_hits(
        conn: &Connection,
        raw_query: &str,
    ) -> Result<HashMap<String, CandidateHit>, DatabaseError> {
        let like_pattern = format!("%{}%", Self::escape_like_pattern(raw_query));
        let mut map: HashMap<String, CandidateHit> = HashMap::new();

        // 1. Session title matches
        let mut s_stmt = conn
            .prepare(
                r#"
                SELECT id
                FROM chat_sessions
                WHERE LOWER(title) LIKE LOWER(?1) ESCAPE '\'
                LIMIT 1000;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Fallback title search prepare failed: {}", e)))?;

        let s_rows = s_stmt
            .query_map([&like_pattern], |r| r.get::<_, String>(0))
            .map_err(|e| DatabaseError::query_failed(format!("Fallback title search failed: {}", e)))?;

        for row in s_rows {
            let sid = row.map_err(|e| DatabaseError::query_failed(format!("Fallback title row error: {}", e)))?;
            map.entry(sid).or_default().title_matched = true;
        }

        // 2. Message content matches
        let mut m_stmt = conn
            .prepare(
                r#"
                SELECT session_id, id
                FROM chat_messages
                WHERE LOWER(content) LIKE LOWER(?1) ESCAPE '\'
                ORDER BY created_at DESC, id DESC
                LIMIT 2000;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Fallback message search prepare failed: {}", e)))?;

        let m_rows = m_stmt
            .query_map([&like_pattern], |r| {
                Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
            })
            .map_err(|e| DatabaseError::query_failed(format!("Fallback message search failed: {}", e)))?;

        for row in m_rows {
            let (sid, mid) =
                row.map_err(|e| DatabaseError::query_failed(format!("Fallback message row error: {}", e)))?;
            let entry = map.entry(sid).or_default();
            if !entry.message_ids.contains(&mid) {
                entry.message_ids.push(mid);
            }
        }

        Ok(map)
    }

    fn fetch_message_previews_batch(
        conn: &Connection,
        message_ids: &[String],
        query: &str,
    ) -> Result<HashMap<String, HistoryMessageMatchPreview>, DatabaseError> {
        if message_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let mut placeholders = Vec::with_capacity(message_ids.len());
        let mut params: Vec<Value> = Vec::with_capacity(message_ids.len());
        for mid in message_ids {
            params.push(Value::Text(mid.clone()));
            placeholders.push(format!("?{}", params.len()));
        }

        let sql = format!(
            r#"
            SELECT id, session_id, sender, content, routed_provider, routed_model, created_at
            FROM chat_messages
            WHERE id IN ({})
            ORDER BY created_at DESC, id DESC;
            "#,
            placeholders.join(", ")
        );

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DatabaseError::query_failed(format!("Preview batch prepare failed: {}", e)))?;

        let rows = stmt
            .query_map(params_from_iter(params.iter()), |r| {
                let id: String = r.get(0)?;
                let session_id: String = r.get(1)?;
                let sender_str: String = r.get(2)?;
                let content: String = r.get(3)?;
                let routed_provider: Option<String> = r.get(4)?;
                let routed_model: Option<String> = r.get(5)?;
                let created_at: i64 = r.get(6)?;
                Ok((
                    id,
                    session_id,
                    sender_str,
                    content,
                    routed_provider,
                    routed_model,
                    created_at,
                ))
            })
            .map_err(|e| DatabaseError::query_failed(format!("Preview batch query failed: {}", e)))?;

        let mut result = HashMap::new();
        for row in rows {
            let (id, session_id, sender_str, content, routed_provider, routed_model, created_at) =
                row.map_err(|e| DatabaseError::query_failed(format!("Preview batch row error: {}", e)))?;

            let sender = MessageSender::from_str(&sender_str).unwrap_or(MessageSender::User);
            let (preview_text, match_start_offset, match_length) =
                Self::extract_safe_preview(&content, query);

            result.insert(
                id.clone(),
                HistoryMessageMatchPreview {
                    message_id: id,
                    session_id,
                    sender,
                    match_type: HistoryMatchType::MessageContent,
                    preview_text,
                    match_start_offset,
                    match_length,
                    routed_provider,
                    routed_model,
                    created_at,
                },
            );
        }

        Ok(result)
    }

    /// Queries distinct historical routed_provider & routed_model values stored in `chat_messages`.
    /// Works seamlessly even for deprecated or removed registry entries.
    pub fn list_filter_options(conn: &Connection) -> Result<HistoryFilterOptions, DatabaseError> {
        let mut prov_stmt = conn
            .prepare(
                r#"
                SELECT DISTINCT routed_provider
                FROM chat_messages
                WHERE routed_provider IS NOT NULL AND TRIM(routed_provider) != ''
                ORDER BY LOWER(routed_provider) ASC;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to query distinct providers: {}", e)))?;

        let prov_rows = prov_stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| DatabaseError::query_failed(format!("Failed to read distinct providers: {}", e)))?;

        let mut providers = Vec::new();
        for p in prov_rows {
            providers.push(p.map_err(|e| DatabaseError::query_failed(format!("Provider option row error: {}", e)))?);
        }

        let mut model_stmt = conn
            .prepare(
                r#"
                SELECT DISTINCT routed_model
                FROM chat_messages
                WHERE routed_model IS NOT NULL AND TRIM(routed_model) != ''
                ORDER BY LOWER(routed_model) ASC;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to query distinct models: {}", e)))?;

        let model_rows = model_stmt
            .query_map([], |r| r.get::<_, String>(0))
            .map_err(|e| DatabaseError::query_failed(format!("Failed to read distinct models: {}", e)))?;

        let mut models = Vec::new();
        for m in model_rows {
            models.push(m.map_err(|e| DatabaseError::query_failed(format!("Model option row error: {}", e)))?);
        }

        Ok(HistoryFilterOptions { providers, models })
    }

    /// Atomically deletes a bounded batch of sessions inside a single transaction,
    /// relying on FK `ON DELETE CASCADE` and FTS delete triggers.
    pub fn delete_sessions_bulk(
        conn: &mut Connection,
        session_ids: &[String],
    ) -> Result<BulkDeleteResult, DatabaseError> {
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|e| DatabaseError::transaction_failed(format!("Failed to start bulk delete transaction: {}", e)))?;

        let mut deleted_ids = Vec::new();
        let mut missing_ids = Vec::new();
        let mut seen = HashSet::new();

        for raw_id in session_ids {
            let sid = raw_id.trim();
            if sid.is_empty() || !seen.insert(sid.to_string()) {
                continue;
            }

            let affected = tx
                .execute("DELETE FROM chat_sessions WHERE id = ?1;", [sid])
                .map_err(|e| DatabaseError::execution_failed(format!("Failed deleting session in bulk transaction: {}", e)))?;

            if affected > 0 {
                deleted_ids.push(sid.to_string());
            } else {
                missing_ids.push(sid.to_string());
            }
        }

        tx.commit().map_err(|e| {
            DatabaseError::transaction_failed(format!("Failed to commit bulk delete transaction: {}", e))
        })?;

        Ok(BulkDeleteResult {
            requested_count: seen.len(),
            deleted_count: deleted_ids.len(),
            deleted_session_ids: deleted_ids,
            missing_session_ids: missing_ids,
        })
    }

    /// Deterministic recovery rebuild of the `history_search_fts` index from authoritative tables.
    pub fn rebuild_search_index(conn: &mut Connection) -> Result<u64, DatabaseError> {
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|e| DatabaseError::transaction_failed(format!("Failed to start FTS rebuild tx: {}", e)))?;

        tx.execute_batch(
            r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS history_search_fts USING fts5(
                entry_type UNINDEXED,
                session_id UNINDEXED,
                message_id UNINDEXED,
                text,
                tokenize = 'unicode61'
            );
            DELETE FROM history_search_fts;
            INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
                SELECT 'session', id, '', title FROM chat_sessions;
            INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
                SELECT 'message', session_id, id, content FROM chat_messages;
            "#,
        )
        .map_err(|e| DatabaseError::execution_failed(format!("Failed to rebuild FTS search index: {}", e)))?;

        let indexed_count: i64 = tx
            .query_row("SELECT COUNT(*) FROM history_search_fts;", [], |r| r.get(0))
            .unwrap_or(0);

        tx.commit().map_err(|e| {
            DatabaseError::transaction_failed(format!("Failed to commit FTS rebuild tx: {}", e))
        })?;

        Ok(indexed_count.max(0) as u64)
    }
}

#[derive(Default)]
struct CandidateHit {
    title_matched: bool,
    message_ids: Vec<String>,
}

fn split_csv_distinct(csv: &str) -> Vec<String> {
    if csv.is_empty() {
        return Vec::new();
    }
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for part in csv.split(',') {
        let trimmed = part.trim();
        if !trimmed.is_empty() && seen.insert(trimmed.to_string()) {
            out.push(trimmed.to_string());
        }
    }
    out
}

fn find_subslice_char_pos(haystack: &[char], needle: &str) -> Option<usize> {
    let needle_lower: Vec<char> = needle.trim().chars().flat_map(|c| c.to_lowercase()).collect();
    if needle_lower.is_empty() || haystack.len() < needle_lower.len() {
        return None;
    }

    // Build lowered char list while mapping back to original character start index
    let mut lowered = Vec::with_capacity(haystack.len());
    let mut orig_idx_map = Vec::with_capacity(haystack.len());
    for (idx, ch) in haystack.iter().enumerate() {
        for lc in ch.to_lowercase() {
            lowered.push(lc);
            orig_idx_map.push(idx);
        }
    }

    if lowered.len() < needle_lower.len() {
        return None;
    }

    for i in 0..=lowered.len() - needle_lower.len() {
        if lowered[i..i + needle_lower.len()] == needle_lower[..] {
            return Some(orig_idx_map[i]);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::{ChatMessage, ChatMessageMetadata, ChatSession};
    use crate::storage::migrations::MigrationRunner;
    use crate::storage::pragmas::SqlitePragmas;
    use crate::storage::repositories::{ChatMessageRepository, ChatSessionRepository};

    fn setup_db() -> Connection {
        let mut conn = Connection::open_in_memory().unwrap();
        SqlitePragmas::apply(&conn).unwrap();
        MigrationRunner::run(&mut conn).unwrap();
        conn
    }

    #[test]
    fn test_fts_triggers_and_cascade_sync() {
        let conn = setup_db();

        let s1 = ChatSession {
            id: "s1".to_string(),
            title: "Project Alpha Architecture".to_string(),
            created_at: 1000,
            updated_at: 1000,
            pinned: false,
        };
        ChatSessionRepository::insert(&conn, &s1).unwrap();

        let m1 = ChatMessage {
            id: "m1".to_string(),
            session_id: "s1".to_string(),
            sender: MessageSender::Assistant,
            content: "Rate limiting configured via token bucket".to_string(),
            metadata: ChatMessageMetadata {
                routed_provider: Some("anthropic".to_string()),
                routed_model: Some("claude-3-5-sonnet-20241022".to_string()),
                ..Default::default()
            },
            created_at: 1001,
        };
        ChatMessageRepository::insert(&conn, &m1).unwrap();

        // Title search
        let res = HistoryRepository::search(&conn, "Alpha", &HistoryFilter::default(), HistorySortMode::MostRecent, None, None, None).unwrap();
        assert_eq!(res.items.len(), 1);
        assert!(res.items[0].title_match);

        // Content search
        let res2 = HistoryRepository::search(&conn, "rate limiting", &HistoryFilter::default(), HistorySortMode::MostRecent, None, None, None).unwrap();
        assert_eq!(res2.items.len(), 1);
        assert_eq!(res2.items[0].matched_message_count, 1);

        // Rename updates index cleanly
        ChatSessionRepository::update_title(&conn, "s1", "Project Beta", 2000).unwrap();
        let old_res = HistoryRepository::search(&conn, "Alpha", &HistoryFilter::default(), HistorySortMode::MostRecent, None, None, None).unwrap();
        assert_eq!(old_res.items.len(), 0);
        let new_res = HistoryRepository::search(&conn, "Beta", &HistoryFilter::default(), HistorySortMode::MostRecent, None, None, None).unwrap();
        assert_eq!(new_res.items.len(), 1);

        // Cascade delete cleans up FTS
        ChatSessionRepository::delete(&conn, "s1").unwrap();
        let after_del = HistoryRepository::search(&conn, "rate limiting", &HistoryFilter::default(), HistorySortMode::MostRecent, None, None, None).unwrap();
        assert_eq!(after_del.items.len(), 0);
    }

    #[test]
    fn test_unicode_safe_preview_slicing() {
        let text = "Hello 🚀 café architecture typescript refactor example with multi-byte 日本語 characters";
        let (preview, start, len) = HistoryRepository::extract_safe_preview(text, "café");
        assert!(start.is_some());
        assert_eq!(len, Some(4));
        assert!(preview.contains("café"));
    }
}

