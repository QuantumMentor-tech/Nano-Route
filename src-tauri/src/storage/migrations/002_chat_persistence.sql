-- ============================================================================
-- Nano Route - Chat Persistence Schema
-- Migration: 002_chat_persistence.sql
-- ============================================================================
-- Responsibility:
-- - Establishes durable storage for chat sessions and conversational messages.
-- - Enforces foreign-key relationship with cascade deletion on session removal.
-- - Persists routing intelligence metadata, SLM confidence, tokens, latency, cost.
-- ============================================================================

-- Table: chat_sessions
-- Tracks high-level conversation threads, titles, pinning, and update timestamps.
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    pinned INTEGER NOT NULL DEFAULT 0
);

-- Table: chat_messages
-- Stores individual conversation turns with routing decisions, performance metrics, and token usage.
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL CHECK(sender IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    routed_provider TEXT NULL,
    routed_model TEXT NULL,
    routing_reason TEXT NULL,
    slm_confidence_score REAL NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    cost_usd REAL NOT NULL DEFAULT 0.0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Indexes for deterministic message sequencing and rapid session list retrieval
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created 
    ON chat_messages(session_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at 
    ON chat_sessions(updated_at DESC);

