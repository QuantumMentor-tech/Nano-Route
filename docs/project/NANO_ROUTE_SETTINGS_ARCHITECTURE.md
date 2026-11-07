# NANO ROUTE — APPLICATION SETTINGS & PROVIDER PREFERENCES ARCHITECTURE
## Architectural Specification & Configuration Layer (Step 20)

**Document Version:** 1.0.0  
**Application Architecture Version:** v1.18.0  
**Persistence Boundary:** SQLite (`app_settings`, `api_credentials`)  
**Security Boundary:** Step 19 Windows DPAPI Vault Isolation  
**Target Platform:** Windows 10 / Windows 11 (Desktop First)

---

## 1. Executive Summary & Purpose

Nano Route establishes a typed, validated, and persistent configuration architecture that strictly decouples:
- **Application Preferences** (`app_settings` key-value store, e.g. routing mode, telemetry flag, retention, window state).
- **Provider Preferences** (`api_credentials` metadata columns: `is_active`, `priority_weight`, `monthly_budget_limit`, `base_url`).
- **Provider Secrets** (DPAPI-protected binary ciphertext in `api_credentials.encrypted_api_key`, owned exclusively by Step 19).
- **Runtime-Derived State** (ephemeral health, active streams, loaded models in memory).

Plaintext credentials and DPAPI ciphertext blobs are strictly isolated from the settings layer and are never transmitted over configuration IPC channels.

---

## 2. Configuration Architecture Diagram

```text
                ┌───────────────────────┐
                │    Future Settings    │
                │          UI           │
                └───────────┬───────────┘
                            │
                            ▼
                ┌───────────────────────┐
                │      Settings IPC     │
                │ (Typed DTOs/Commands) │
                └───────────┬───────────┘
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
   ┌───────────────────┐       ┌────────────────────────┐
   │ AppSettingsService│       │ProviderPreferences     │
   │ (Virtual Defaults │       │Service                 │
   │  & In-Memory Cache│       │(Safe Metadata Updates) │
   └─────────┬─────────┘       └────────────┬───────────┘
             │                              │
             ▼                              ▼
   ┌───────────────────┐       ┌────────────────────────┐
   │ AppSettingsRepo   │       │ CredentialRepository   │
   │ (`app_settings`)  │       │ (`api_credentials`)   │
   └─────────┬─────────┘       └────────────┬───────────┘
             │                              │
             └──────────────┬───────────────┘
                            ▼
                  ┌───────────────────┐
                  │  DatabaseManager  │
                  └─────────┬─────────┘
                            ▼
                         SQLite

        Credential Secret Path:
        ProviderPreferences
               │
               ▼
        Step 19 Credential Vault
               │
               ▼
        Windows DPAPI
```

---

## 3. Data Ownership Matrix

| Data Classification | Owner Subsystem | Storage Mechanism | Plaintext Secret? | UI / IPC Exposure |
| :--- | :--- | :--- | :--- | :--- |
| **Provider API Key** | Step 19 Credential Vault | `api_credentials.encrypted_api_key` (DPAPI BLOB) | **YES** (Internal only) | **NEVER** exposed |
| **Provider Active State** | Provider Preferences Service | `api_credentials.is_active` (0 or 1) | No | Safe boolean |
| **Provider Priority Weight** | Provider Preferences Service | `api_credentials.priority_weight` (1..10) | No | Safe integer |
| **Provider Base URL** | Provider Preferences Service | `api_credentials.base_url` (validated string) | No | Safe URL |
| **Monthly Budget Limit** | Provider Preferences Service | `api_credentials.monthly_budget_limit` (float) | No | Safe currency value |
| **Current Month Spend** | Usage / Accounting Engine | `api_credentials.current_month_spend` (float) | No | Safe currency value |
| **Routing Preference Mode** | App Settings Service | `app_settings` ("routing.preference_mode") | No | Enum ("quality", "balanced", "cost_saving") |
| **Telemetry Opt-In** | App Settings Service | `app_settings` ("telemetry.enabled") | No | "true" / "false" |
| **History Retention Days** | App Settings Service | `app_settings` ("history.retention_days") | No | Integer string |
| **Window Start Maximized** | App Settings Service | `app_settings` ("window.start_maximized") | No | "true" / "false" |
| **Runtime Provider Health** | Provider Runtime | In-Memory (Tokio state) | No | Ephemeral status |

---

## 4. Application Settings Architecture

### 4.1 Schema Migration (`005_app_settings.sql`)
```sql
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### 4.2 Canonical Typed Keys & Enums
Raw string keys are centralized in `src-tauri/src/domain/settings.rs` via `AppSettingKey`:
1. `routing.preference_mode` -> `RoutingPreferenceMode` (`quality`, `balanced`, `cost_saving`), default `balanced`.
2. `telemetry.enabled` -> boolean (`true`, `false`), default `true`.
3. `history.retention_days` -> u32 (`0..=365`, `0` = unlimited), default `0`.
4. `window.start_maximized` -> boolean (`true`, `false`), default `false`.

### 4.3 Virtual Defaults Resolution
Nano Route utilizes **virtual default resolution** rather than database pre-seeding. On a fresh installation, the `app_settings` table contains 0 rows; reading a setting resolves the compiled code default. Settings are persisted to SQLite only when explicitly modified by the user.

When a setting is reset via `reset_setting(key)`, its row is deleted from SQLite, cleanly reverting it to the virtual code default.

### 4.4 Non-Secret In-Memory Caching
`AppSettingsService` maintains a thread-safe `RwLock<Option<HashMap<String, String>>>`:
- Populated lazily on first read from SQLite.
- Updated or invalidated on every write or reset.
- Contains only public application settings; secrets are strictly excluded.

---

## 5. Provider Preferences Architecture

### 5.1 Credential & Configuration Separation
The source schema defines `api_credentials` with both encrypted secret data and non-secret configuration columns. Step 20 provides safe metadata manipulation over this table:
- **`update_provider_preferences`**: Atomically updates `base_url`, `is_active`, `priority_weight`, and `monthly_budget_limit` in a targeted SQL `UPDATE` statement.
- **Mandatory Invariant**: `encrypted_api_key` and `current_month_spend` are strictly preserved and never mutated during preference updates.
- **`reset_provider_preferences`**: Restores documented defaults (`is_active = true`, `priority_weight = 5`, `monthly_budget_limit = null`, `base_url = null`) without deleting the encrypted credential.

### 5.2 Base URL Security Boundaries
Custom base URLs are validated to prevent Server-Side Request Forgery (SSRF) and credential sniffing:
- Must use `https://` for remote hosts, or `http://localhost` / `http://127.0.0.1` for safe local mock servers.
- Maximum length 512 characters.
- Rejects dangerous schemes (`javascript:`, `file:`, `data:`, `ftp:`).
- Rejects embedded user credentials (`user:password@host`).

---

## 6. Tauri IPC Interface & Frontend Client

### 6.1 Safe Command Handlers
Registered in `tauri::generate_handler![]`:
1. `cmd_get_app_settings` -> returns `AppSettingsSnapshot`
2. `cmd_get_app_setting(key)` -> returns string
3. `cmd_set_app_setting(key, value)` -> returns boolean
4. `cmd_reset_app_setting(key)` -> returns boolean
5. `cmd_get_provider_preferences(provider_id)` -> returns `Option<ProviderCredentialStatus>`
6. `cmd_list_provider_preferences` -> returns `Vec<ProviderCredentialStatus>`
7. `cmd_update_provider_preferences(input)` -> returns `ProviderCredentialStatus`
8. `cmd_reset_provider_preferences(provider_id)` -> returns `ProviderCredentialStatus`

### 6.2 Frontend Service (`src/services/ipc/settings.ts`)
Provides typed client functions with client-side domain validation, error normalization, and an in-memory mock store for development and headless testing without Tauri.

---

## 7. Configuration Precedence & Lifecycle

```text
1. Compiled Defaults (Virtual In-Code Defaults)
      ↓
2. Persisted SQLite Database (`app_settings`, `api_credentials`)
      ↓
3. Ephemeral Runtime Overrides (Development / Testing Mode)
```

Corrupted or invalid values stored in SQLite do not crash the application. `get_snapshot()` catches parse errors, logs a diagnostic warning, and gracefully falls back to the virtual default.

---

## 8. Architectural Boundaries & Deferred Work

- **Provider Registry (Step 21):** Defines static provider capabilities, supported model lists, token limits, and default endpoints. Preferences define user customization over those capabilities.
- **Routing Engine (Step 21+):** Consumes `priority_weight` and `routing.preference_mode` to rank models. The settings service does not evaluate routing scores.
- **Budget Enforcement (Step 27+):** Enforces `monthly_budget_limit` and updates `current_month_spend`. The settings service stores the limit without blocking requests.
- **Settings UI (Step 46):** Will render complete interactive controls. Current `SettingsPage.tsx` layout is preserved untouched.

