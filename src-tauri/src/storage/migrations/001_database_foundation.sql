-- ============================================================================
-- Nano Route - Baseline Database Foundation
-- Migration: 001_database_foundation.sql
-- ============================================================================
-- Responsibility:
-- - Establishes migration tracking infrastructure (`schema_migrations`).
-- - Establishes runtime database metadata store (`database_metadata`).
-- - Does NOT prematurely create chat, message, credential, or telemetry tables.
-- ============================================================================

-- Table: schema_migrations
-- Records all historical migrations applied to this database instance.
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    execution_duration_ms INTEGER NOT NULL
);

-- Table: database_metadata
-- Key-value store for application infrastructure state and initialization timestamps.
CREATE TABLE IF NOT EXISTS database_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Baseline initialization metadata
INSERT OR REPLACE INTO database_metadata (key, value, updated_at)
VALUES 
    ('schema_version', '1', datetime('now')),
    ('application_name', 'Nano Route', datetime('now')),
    ('created_at', datetime('now'));

