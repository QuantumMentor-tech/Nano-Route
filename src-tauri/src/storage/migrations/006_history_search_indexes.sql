-- ============================================================================
-- Nano Route - History Explorer Indexes & FTS5 Search Schema
-- Migration: 006_history_search_indexes.sql
-- ============================================================================
-- Responsibility:
-- - Adds composite indexes for deterministic History Explorer sorting & filtering.
-- - Establishes local SQLite FTS5 search index (`history_search_fts`) over session
--   titles and message contents while keeping `chat_sessions` & `chat_messages`
--   as the sole authoritative data source.
-- - Maintains index consistency via atomic SQLite triggers on insert, rename,
--   single-message delete, and session delete (including cascade children).
-- ============================================================================

-- 1. Session Sorting & Date Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_pinned_updated
    ON chat_sessions(pinned DESC, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at
    ON chat_sessions(created_at DESC, id DESC);

-- 2. Message Filter Indexes (Provider, Model, Timestamp)
CREATE INDEX IF NOT EXISTS idx_chat_messages_provider_session_created
    ON chat_messages(routed_provider, session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_model_session_created
    ON chat_messages(routed_model, session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
    ON chat_messages(created_at);

-- 3. Local SQLite FTS5 Search Index
-- UNINDEXED columns store exact IDs for deterministic joining without polluting token index.
CREATE VIRTUAL TABLE IF NOT EXISTS history_search_fts USING fts5(
    entry_type UNINDEXED,
    session_id UNINDEXED,
    message_id UNINDEXED,
    text,
    tokenize = 'unicode61'
);

-- 4. Initial Backfill from Authoritative History Tables
INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
SELECT 'session', id, '', title
FROM chat_sessions;

INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
SELECT 'message', session_id, id, content
FROM chat_messages;

-- 5. Atomic Synchronization Triggers
CREATE TRIGGER IF NOT EXISTS trg_fts_session_insert
AFTER INSERT ON chat_sessions
BEGIN
    INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
    VALUES ('session', NEW.id, '', NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS trg_fts_session_update_title
AFTER UPDATE OF title ON chat_sessions
BEGIN
    DELETE FROM history_search_fts
    WHERE entry_type = 'session' AND session_id = OLD.id;

    INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
    VALUES ('session', NEW.id, '', NEW.title);
END;

CREATE TRIGGER IF NOT EXISTS trg_fts_session_delete
AFTER DELETE ON chat_sessions
BEGIN
    DELETE FROM history_search_fts
    WHERE session_id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_fts_message_insert
AFTER INSERT ON chat_messages
BEGIN
    INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
    VALUES ('message', NEW.session_id, NEW.id, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_fts_message_delete
AFTER DELETE ON chat_messages
BEGIN
    DELETE FROM history_search_fts
    WHERE entry_type = 'message' AND message_id = OLD.id;
END;

