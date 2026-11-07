// ============================================================================
// Nano Route - Chat Message Repository
// File: src-tauri/src/storage/repositories/chat_message_repo.rs
// ============================================================================
// Data access layer for conversational message persistence.
// Preserves message ordering, routing analytics, tokens, and cost attributes.
// ============================================================================

use crate::domain::{ChatMessage, ChatMessageMetadata, MessageSender};
use crate::storage::errors::DatabaseError;
use rusqlite::{params, Connection, Row};

pub struct ChatMessageRepository;

impl ChatMessageRepository {
    /// Maps a SQLite row into a ChatMessage domain model.
    fn map_row(row: &Row) -> Result<ChatMessage, rusqlite::Error> {
        let sender_str: String = row.get(2)?;
        let sender = MessageSender::from_str(&sender_str)
            .map_err(|e| rusqlite::Error::FromSqlConversionFailure(2, rusqlite::types::Type::Text, Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, e))))?;

        let prompt_tokens: i64 = row.get(8)?;
        let completion_tokens: i64 = row.get(9)?;
        let latency_ms: i64 = row.get(10)?;
        let cost_usd: f64 = row.get(11)?;

        let metadata = ChatMessageMetadata {
            routed_provider: row.get(4)?,
            routed_model: row.get(5)?,
            routing_reason: row.get(6)?,
            slm_confidence_score: row.get(7)?,
            prompt_tokens: prompt_tokens.max(0) as u32,
            completion_tokens: completion_tokens.max(0) as u32,
            latency_ms: latency_ms.max(0) as u64,
            cost_usd,
        };

        Ok(ChatMessage {
            id: row.get(0)?,
            session_id: row.get(1)?,
            sender,
            content: row.get(3)?,
            metadata,
            created_at: row.get(12)?,
        })
    }

    /// Persists a new chat message into SQLite.
    pub fn insert(conn: &Connection, message: &ChatMessage) -> Result<(), DatabaseError> {
        conn.execute(
            r#"
            INSERT INTO chat_messages (
                id,
                session_id,
                sender,
                content,
                routed_provider,
                routed_model,
                routing_reason,
                slm_confidence_score,
                prompt_tokens,
                completion_tokens,
                latency_ms,
                cost_usd,
                created_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13);
            "#,
            params![
                message.id,
                message.session_id,
                message.sender.as_str(),
                message.content,
                message.metadata.routed_provider,
                message.metadata.routed_model,
                message.metadata.routing_reason,
                message.metadata.slm_confidence_score,
                message.metadata.prompt_tokens as i64,
                message.metadata.completion_tokens as i64,
                message.metadata.latency_ms as i64,
                message.metadata.cost_usd,
                message.created_at,
            ],
        )
        .map_err(|e| DatabaseError::execution_failed(format!("Failed to insert chat message: {}", e)))?;

        Ok(())
    }

    /// Fetches a single message by ID.
    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Option<ChatMessage>, DatabaseError> {
        let mut stmt = conn
            .prepare(
                r#"
                SELECT 
                    id, session_id, sender, content,
                    routed_provider, routed_model, routing_reason, slm_confidence_score,
                    prompt_tokens, completion_tokens, latency_ms, cost_usd,
                    created_at
                FROM chat_messages
                WHERE id = ?1;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare get_message query: {}", e)))?;

        let message = stmt
            .query_row(params![id], Self::map_row)
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => None,
                other => Some(DatabaseError::query_failed(format!("Failed to fetch message: {}", other))),
            })
            .transpose()?;

        Ok(message)
    }

    /// Lists messages belonging to a session in strictly deterministic ascending chronological order.
    pub fn list_for_session(
        conn: &Connection,
        session_id: &str,
        limit: Option<u32>,
        offset: Option<u32>,
    ) -> Result<Vec<ChatMessage>, DatabaseError> {
        let limit_val = limit.unwrap_or(1000);
        let offset_val = offset.unwrap_or(0);

        let mut stmt = conn
            .prepare(
                r#"
                SELECT 
                    id, session_id, sender, content,
                    routed_provider, routed_model, routing_reason, slm_confidence_score,
                    prompt_tokens, completion_tokens, latency_ms, cost_usd,
                    created_at
                FROM chat_messages
                WHERE session_id = ?1
                ORDER BY created_at ASC, id ASC
                LIMIT ?2 OFFSET ?3;
                "#,
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to prepare list_messages query: {}", e)))?;

        let rows = stmt
            .query_map(params![session_id, limit_val, offset_val], Self::map_row)
            .map_err(|e| DatabaseError::query_failed(format!("Failed to execute list_messages query: {}", e)))?;

        let mut messages = Vec::new();
        for row in rows {
            messages.push(row.map_err(|e| DatabaseError::query_failed(format!("Failed to map message row: {}", e)))?);
        }

        Ok(messages)
    }

    /// Deletes a specific message by ID.
    pub fn delete(conn: &Connection, id: &str) -> Result<bool, DatabaseError> {
        let rows_affected = conn
            .execute(
                r#"
                DELETE FROM chat_messages
                WHERE id = ?1;
                "#,
                params![id],
            )
            .map_err(|e| DatabaseError::execution_failed(format!("Failed to delete chat message: {}", e)))?;

        Ok(rows_affected > 0)
    }

    /// Counts total messages associated with a session.
    pub fn count_for_session(conn: &Connection, session_id: &str) -> Result<u64, DatabaseError> {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM chat_messages WHERE session_id = ?1;",
                params![session_id],
                |r| r.get(0),
            )
            .map_err(|e| DatabaseError::query_failed(format!("Failed to count session messages: {}", e)))?;

        Ok(count.max(0) as u64)
    }
}

