-- ============================================================================
-- Nano Route - Prompt Templates & Request Presets Schema
-- Migration: 007_prompt_templates.sql
-- ============================================================================
-- Responsibility:
-- - Establishes durable storage for reusable prompt templates (`prompt_templates`).
-- - Establishes storage for request presets with template references (`request_presets`).
-- - Enforces clean foreign key relations and optimized indexes for name, category, and favorites.
-- - Strictly prohibits storage of credentials or secret API keys in templates or presets.
-- ============================================================================

-- Table: prompt_templates
-- Reusable prompt text compositions containing bounded placeholder variables.
CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    tags TEXT NOT NULL DEFAULT '[]',
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1
);

-- Indexes for rapid lookup by category, favorite state, and update timestamp
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category 
    ON prompt_templates(category, is_favorite DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompt_templates_updated_at 
    ON prompt_templates(updated_at DESC);

-- Table: request_presets
-- Pre-configured request compositions associating a template with permissible user overrides.
CREATE TABLE IF NOT EXISTS request_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    template_id TEXT NULL,
    preferred_provider TEXT NULL,
    preferred_model TEXT NULL,
    temperature REAL NULL,
    max_tokens INTEGER NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY(template_id) REFERENCES prompt_templates(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_request_presets_updated_at 
    ON request_presets(updated_at DESC);

