-- ============================================================================
-- Nano Route - Application Settings Schema
-- Migration: 005_app_settings.sql
-- ============================================================================
-- Responsibility:
-- - Establishes key-value persistence for typed application settings (`app_settings`).
-- - Stores user preferences (routing mode, telemetry flag, retention, window state).
-- - Separates application preferences from provider configuration and credentials.
-- - Plaintext provider secrets are strictly prohibited from this table.
-- ============================================================================

-- Table: app_settings
-- Canonical key-value store for application-level user preferences.
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

