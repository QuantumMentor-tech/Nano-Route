# NANO ROUTE — CANONICAL SETTINGS & CONFIGURATION CATALOG
## Complete Specification of Application Settings & Provider Preferences (Step 20)

**Document Version:** 1.0.0  
**Application Architecture Version:** v1.18.0  
**Status:** AUTHORITATIVE CATALOG

---

## 1. Application Settings Catalog (`app_settings`)

### Setting: `routing.preference_mode`
- **Key:** `routing.preference_mode`
- **Type:** Enum (`RoutingPreferenceMode`: `"quality"`, `"balanced"`, `"cost_saving"`)
- **Default:** `"balanced"`
- **Storage:** SQLite `app_settings` (`key TEXT PRIMARY KEY, value TEXT NOT NULL`)
- **Validation:** Exact match against supported enum string identifiers (case-insensitive on parse, canonical lowercase on storage).
- **Owner:** `AppSettingsService`
- **UI Exposure:** Future Settings UI / Dashboard Routing Widget (Step 46)
- **Future Consumer:** Local SLM Router & Dynamic Provider Dispatcher (Step 21+)
- **Security Classification:** Public Application Preference (Non-Secret)

---

### Setting: `telemetry.enabled`
- **Key:** `telemetry.enabled`
- **Type:** Boolean (`"true"` | `"false"`)
- **Default:** `"true"` (Local telemetry enabled by default)
- **Storage:** SQLite `app_settings`
- **Validation:** Must be string `"true"` or `"false"`.
- **Owner:** `AppSettingsService`
- **UI Exposure:** Future Settings Privacy Section
- **Future Consumer:** `TelemetryService` (Step 18/27) to gate audit recording
- **Security Classification:** Public Application Preference (Non-Secret)

---

### Setting: `history.retention_days`
- **Key:** `history.retention_days`
- **Type:** Integer (`u32`, `0..=365`)
- **Default:** `0` (0 represents indefinite/unlimited local-first retention)
- **Storage:** SQLite `app_settings`
- **Validation:** Valid unsigned integer string between 0 and 365.
- **Owner:** `AppSettingsService`
- **UI Exposure:** Future Settings Data Storage Section
- **Future Consumer:** History Pruning & Storage Maintenance Worker (Step 28)
- **Security Classification:** Public Application Preference (Non-Secret)

---

### Setting: `window.start_maximized`
- **Key:** `window.start_maximized`
- **Type:** Boolean (`"true"` | `"false"`)
- **Default:** `"false"`
- **Storage:** SQLite `app_settings`
- **Validation:** Must be string `"true"` or `"false"`.
- **Owner:** `AppSettingsService`
- **UI Exposure:** Future Settings Display Section
- **Future Consumer:** Tauri Window Lifecycle Initializer (Step 7/46)
- **Security Classification:** Public Application Preference (Non-Secret)

---

## 2. Provider Preferences & Configuration Catalog (`api_credentials`)

| Field | Storage Column | Secret? | Mutable? | Validation Rule | Owner Subsystem | Consumed By |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`provider_id`** | `provider_id` (TEXT PRIMARY KEY) | No | No (Immutable key) | Lowercase ASCII `[a-z0-9._-]`, length 2..64 | Step 19 Credential Vault | Provider Registry, Router, Settings |
| **`encrypted_api_key`** | `encrypted_api_key` (BLOB NOT NULL) | **YES** | Yes (Rotate only via Vault) | DPAPI CryptProtectData binary ciphertext | Step 19 Credential Vault | Outbound HTTP Provider Client (Native only) |
| **`base_url`** | `base_url` (TEXT NULL) | No | Yes | HTTPS scheme or localhost/127.0.0.1 HTTP; max 512 chars; no `@` user credentials; no dangerous schemes | Provider Preferences Service | Outbound HTTP Provider Client |
| **`is_active`** | `is_active` (INTEGER NOT NULL DEFAULT 1) | No | Yes | Boolean (0 or 1) | Provider Preferences Service | Router Candidate Filter (Step 21+) |
| **`priority_weight`** | `priority_weight` (INTEGER NOT NULL DEFAULT 5) | No | Yes | Clamped integer `1..=10` | Provider Preferences Service | Router Candidate Scoring (Step 21+) |
| **`monthly_budget_limit`**| `monthly_budget_limit` (REAL NULL) | No | Yes | Non-negative finite float or `NULL` | Provider Preferences Service | Future Budget Enforcement & Warning Engine |
| **`current_month_spend`** | `current_month_spend` (REAL NOT NULL DEFAULT 0.0) | No | Yes (Via Accounting) | Non-negative float | Cost Accounting Subsystem | Dashboard Spending Meters, Budget Warning Engine |
| **`updated_at`** | `updated_at` (INTEGER NOT NULL) | No | Yes | Unix epoch timestamp in milliseconds | Credential & Preferences Services | UI Synchronization, Audit Trail |

---

## 3. Configuration Access Invariants

1. **Zero Secret Leakage:** The application settings table `app_settings` must NEVER contain provider API keys, tokens, or encryption passphrases.
2. **Ciphertext Separation:** Provider preferences queries and mutations return exclusively `ProviderCredentialStatus`, which contains non-secret metadata. `encrypted_api_key` is strictly omitted.
3. **Atomic Preference Updates:** Updating provider preferences (`base_url`, `is_active`, `priority_weight`, `monthly_budget_limit`) executes an isolated SQL `UPDATE` targeting only metadata columns, guaranteeing that `encrypted_api_key` and `current_month_spend` remain completely untouched.
4. **Independent Preference Reset:** Resetting provider preferences reverts user configuration to defaults (`is_active = true`, `priority_weight = 5`, `monthly_budget_limit = null`, `base_url = null`) without deleting or invalidating the stored DPAPI credential.

