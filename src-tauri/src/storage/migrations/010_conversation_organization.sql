-- ============================================================================
-- Nano Route - Conversation Bookmarks, Highlights & Notes Schema
-- Migration: 010_conversation_organization.sql
-- ============================================================================
-- Responsibility:
-- - Tracks user-authored bookmarks, private notes, and visual highlights.
-- - Links directly to canonical messages without modifying message text.
-- - Preserves branch and session context for accurate jump navigation.
-- - Cascading deletion when parent sessions or messages are removed.
-- - Zero credentials or secrets stored.
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_bookmarks (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    branch_id TEXT NULL,
    label TEXT NULL,
    category TEXT NOT NULL DEFAULT 'important',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES conversation_branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_bookmarks_session
    ON conversation_bookmarks(session_id);

CREATE INDEX IF NOT EXISTS idx_conversation_bookmarks_message
    ON conversation_bookmarks(message_id);

CREATE TABLE IF NOT EXISTS conversation_notes (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    branch_id TEXT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY(branch_id) REFERENCES conversation_branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_conversation_notes_message
    ON conversation_notes(message_id);

