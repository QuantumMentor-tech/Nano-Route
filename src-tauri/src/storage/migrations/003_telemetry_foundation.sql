-- ============================================================================
-- Nano Route - Telemetry & Analytics Foundation Schema
-- Migration: 003_telemetry_foundation.sql
-- ============================================================================
-- Responsibility:
-- - Establishes durable, structured operational event ledger.
-- - Captures routing decisions, provider execution metrics, latencies, tokens, and costs.
-- - Zero prompt or response duplication; privacy-preserving local storage only.
-- - Cascades deletion when parent chat sessions are deleted.
-- ============================================================================

-- Table: telemetry_records
-- Authoritative operational observation ledger.
CREATE TABLE IF NOT EXISTS telemetry_records (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    occurred_at INTEGER NOT NULL,
    session_id TEXT NULL,
    message_id TEXT NULL,
    task_id TEXT NULL,
    stream_id TEXT NULL,
    provider_id TEXT NULL,
    model_id TEXT NULL,
    outcome TEXT NOT NULL,
    error_code TEXT NULL,
    latency_ms INTEGER NULL,
    prompt_tokens INTEGER NULL,
    completion_tokens INTEGER NULL,
    cost_usd REAL NULL,
    confidence REAL NULL,
    routing_reason TEXT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Query optimization indexes for timeline, provider, model, and outcome analytics
CREATE INDEX IF NOT EXISTS idx_telemetry_occurred_at 
    ON telemetry_records(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_provider_time 
    ON telemetry_records(provider_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_model_time 
    ON telemetry_records(model_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_event_outcome 
    ON telemetry_records(event_type, outcome);

CREATE INDEX IF NOT EXISTS idx_telemetry_session 
    ON telemetry_records(session_id);

