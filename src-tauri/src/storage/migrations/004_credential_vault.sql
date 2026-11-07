-- ============================================================================
-- Nano Route - Windows DPAPI Credential Vault Schema
-- Migration: 004_credential_vault.sql
-- ============================================================================
-- Responsibility:
-- - Establishes encrypted persistence for provider API credentials (`api_credentials`).
-- - Stores DPAPI-protected ciphertext strictly as binary BLOB data.
-- - Strictly prohibits plaintext API keys or unencrypted credential columns.
-- - Maintains provider activation state, priority weights, and monthly budget limits.
-- ============================================================================

-- Table: api_credentials
-- Canonical store for DPAPI-protected provider authentication secrets and metadata.
CREATE TABLE IF NOT EXISTS api_credentials (
    provider_id TEXT PRIMARY KEY,
    encrypted_api_key BLOB NOT NULL,
    base_url TEXT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    priority_weight INTEGER NOT NULL DEFAULT 5 CHECK(priority_weight >= 1 AND priority_weight <= 10),
    monthly_budget_limit REAL NULL CHECK(monthly_budget_limit IS NULL OR monthly_budget_limit >= 0.0),
    current_month_spend REAL NOT NULL DEFAULT 0.0 CHECK(current_month_spend >= 0.0),
    updated_at INTEGER NOT NULL
);

-- Primary key on provider_id automatically indexes lookup operations.

