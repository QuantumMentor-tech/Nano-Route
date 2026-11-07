// ============================================================================
// Nano Route - Chat Session Repository
// File: src-tauri/src/storage/repositories/chat_session_repo.rs
// ============================================================================
// Data access layer for chat session persistence.
// Strictly parameterized SQL queries; zero string interpolations.
// ============================================================================

use crate::domain::ChatSession;
use crate::storage::errors::DatabaseError;
use rusqlite::{params, Connection, Row};

pub struct ChatSessionRepository;

impl ChatSessionRepository {
    /// Maps a SQLite row into a strongly-typed ChatSession domain entity.
    fn map_row(row: &Row) -> Result<ChatSession, rusqlite::Error> {
        let pinned_int: i64 = row.get(4)?;
        Ok(ChatSession {
            id: row.get(0)?,
            title: row.get(1)?,
            created_at: row.get(2)?,
            updated_at: row.get(3)?,
            pinned: pinned_int != 0,
        })
    }

    /// Persists a new chat session to SQLite.
    pub fn insert(conn: &Connection, session: &ChatSession) -> Result<(), DatabaseError> {
        conn.execute(
            r#"
            INSERT INTO chat_sessions (id, title, created_at, updated_at, pinned)
            VALUES (?1, ?2, ?3, ?4, ?5);
            "#,
            params![
                session.id,
                session.title,
                session.created_at,
                session.updated_at,
                if session.pinned { 1 } else { 0 },
            ],
        )
        .map_err(|e| DatabaseError::execution_failed(format!("Failed to insert chat session: {}", e)))?;

        Ok(())
    }

    /// Fetches a single chat session by ID.
    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<ChatSession>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, title, created_at, updated_at, pinned
                FROM chat_sessions
                WHERE id = ?1;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare get_session query: {}", e)))?;

        let session = stmt
            .query_row(params![id], Self::map_row)
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => None,
                other => Some(DatabaseError::query_failed(format!("Failed to fetch session: {}", other))),
            })
            .transpose()?;

        Ok(session)
    }

    /// Lists recent chat sessions ordered by pinned first, then updated_at descending.
    pub fn list(conn: &Connection, limit: u32, offset: u32) -> Result<Vec<ChatSession>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, title, created_at, updated_at, pinned
                FROM chat_sessions
                ORDER BY pinned DESC, updated_at DESC
                LIMIT ?1 OFFSET ?2;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare list_sessions query: {}", e)))?;

        let rows = stmt
            .query_map(params![limit, offset], Self::map_row)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute list_sessions query: {}", e)))?;

        let mut sessions = Vec::new();
        for row in rows {
            sessions.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map session row: {}", e)))?);
        }

        Ok(sessions)
    }

    /// Updates the title of an existing chat session.
    pub fn update_title(conn: &Connection, id: &str, title: &str, updated_at: i64) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                UPDATE chat_sessions
                SET title = ?2, updated_at = ?3
                WHERE id = ?1;
                "#,
                params![id, title, updated_at],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to update session title: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Updates the pinned state of an existing chat session.
    pub fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                UPDATE chat_sessions
                SET pinned = ?2
                WHERE id = ?1;
                "#,
                params![id, if pinned { 1 } else { 0 }],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to update session pinned state: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Updates the updated_at timestamp when new messages arrive.
    pub fn touch_updated_at(conn: &Connection, id: &str, updated_at: i64) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                UPDATE chat_sessions
                SET updated_at = ?2
                WHERE id = ?1;
                "#,
                params![id, updated_at],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to touch session updated_at: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Deletes a chat session by ID. Dependent messages are removed via CASCADE.
    pub fn delete(conn: &Connection, id: &str) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                DELETE FROM chat_sessions
                WHERE id = ?1;
                "#,
                params![id],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete session: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Counts total sessions stored in the database.
    pub fn count(conn: &Connection) -> Result<u64, DatabaseError> {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM chat_sessions;", [], |r| r.get(0))
            .map_err(|e| DatabaseError::query_failed(format!("Failed to count sessions: {}", e)))?;

        Ok(count.max(0) as u64)
    }
}

