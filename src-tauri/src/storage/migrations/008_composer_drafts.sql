-- ============================================================================
-- Nano Route - Composer Draft Persistence Schema
-- Migration: 008_composer_drafts.sql
-- ============================================================================
-- Responsibility:
-- - Establishes durable local-only storage for unfinished composer drafts.
-- - Supports per-session drafts (with cascading deletion on session removal)
--   as well as global scratchpad drafts (session_id IS NULL).
-- - Tracks revision count, timestamps, template/preset linkage, and recovery status.
-- - ZERO credentials or secret material are ever stored in drafts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS composer_drafts (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NULL,
    content TEXT NOT NULL,
    template_id TEXT NULL,
    preset_id TEXT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    is_recovered INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(template_id) REFERENCES prompt_templates(id) ON DELETE SET NULL,
    FOREIGN KEY(preset_id) REFERENCES request_presets(id) ON DELETE SET NULL
);

-- Unique index to guarantee at most one draft per session (and at most one global draft with session_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_composer_drafts_session_unique
    ON composer_drafts(session_id);

CREATE INDEX IF NOT EXISTS idx_composer_drafts_updated_at
    ON composer_drafts(updated_at DESC);

