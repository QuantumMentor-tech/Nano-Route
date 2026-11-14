-- ============================================================================
-- Nano Route - Conversation Branching & Response Variants Schema
-- Migration: 009_conversation_branches.sql
-- ============================================================================
-- Responsibility:
-- - Tracks non-destructive branching lineage and alternate response variants.
-- - Associates conversation branches with parent sessions and root fork points.
-- - Links messages to specific branch IDs and tracks response variant groups.
-- - Preserves 100% of historical message integrity without destructive overwriting.
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_branches (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    parent_branch_id TEXT NULL,
    root_message_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_branch_id) REFERENCES conversation_branches(id) ON DELETE SET NULL,
    FOREIGN KEY(root_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversation_branches_session
    ON conversation_branches(session_id);

CREATE INDEX IF NOT EXISTS idx_conversation_branches_root
    ON conversation_branches(root_message_id);

-- Response Variants Table
-- Groups multiple physical provider attempts/variants answering the same logical user message turn.
CREATE TABLE IF NOT EXISTS message_response_variants (
    id TEXT PRIMARY KEY NOT NULL,
    user_message_id TEXT NOT NULL,
    assistant_message_id TEXT NOT NULL,
    variant_index INTEGER NOT NULL DEFAULT 1,
    is_preferred INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(user_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
    FOREIGN KEY(assistant_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_message_response_variants_user
    ON message_response_variants(user_message_id);

CREATE INDEX IF NOT EXISTS idx_message_response_variants_assistant
    ON message_response_variants(assistant_message_id);

