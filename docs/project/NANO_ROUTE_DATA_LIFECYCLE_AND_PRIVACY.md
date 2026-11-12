# Nano Route — Data Lifecycle, Retention & Privacy Architecture (Step 45)

## 1. Local-First Data Lifecycle Overview

Nano Route is a local-first AI model routing desktop application. All persistent application data resides inside a single embedded SQLite database on the user's workstation, accompanied by Windows DPAPI-protected provider API credentials.

Step 45 completes **Phase 9: History & Telemetry** by establishing a deterministic, auditable, privacy-preserving data lifecycle architecture covering:
- **Local Data Inventory & Classification** (`DataCategory`, `DeletionPolicy`, live record counts, and safe non-secret credential metadata)
- **Read-Only Integrity & Privacy Auditing** (`Quick` and `Full` SQLite integrity checks, foreign-key verification, orphan detection, FTS5 search index consistency, and telemetry anomaly detection)
- **Safe Non-Destructive Repair** (deterministic FTS5 search index rebuild and orphaned row cleanup without touching valid user conversations or routing history)
- **User-Controlled Retention Policies** (disabled by default; configurable age thresholds with pinned-conversation exclusion, future-timestamp anomaly protection, and active-session streaming protection)
- **Dry-Run Cleanup Previews & Transactional Cleanup Execution**
- **High-Security Full Local Data Wipe** (`confirmationToken: "DELETE"` with post-wipe verification)

---

## 2. Local Data Inventory & Classification Model

| Store ID | SQLite Table | Data Category | Deletion Policy | Sensitive | Included in Retention | Included in Full Wipe |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: |
| `chat_sessions` | `chat_sessions` | `user_content` | `retention_eligible` | Yes | Yes | Yes |
| `chat_messages` | `chat_messages` | `user_content` | `retention_eligible` | Yes | Yes | Yes |
| `history_search_fts` | `history_search_fts` | `search_index` | `rebuildable` | Yes | Yes (rebuilt) | Yes |
| `telemetry_records` | `telemetry_records` | `operational_telemetry` | `retention_eligible` | No (no prompt text) | Yes | Yes |
| `app_settings` | `app_settings` | `configuration` | `selectively_deletable` | No | No | Yes (optional) |
| `api_credentials` | `api_credentials` | `secret` | `credential_sensitive` | Yes (DPAPI BLOB) | No | Yes (optional) |
| `schema_migrations` | `schema_migrations` / `database_metadata` | `application_metadata` | `system_owned` | No | No | No |

### Credential Inventory Privacy Boundary
- `getDataInventory()` returns `SafeCredentialInventoryItem` records containing only `providerId`, `isActive`, `hasCredential`, and `updatedAt`.
- Plaintext API keys and encrypted DPAPI ciphertext BLOBs **never** cross the IPC boundary in inventory, audit, preview, or cleanup reports.

---

## 3. Storage Semantics & Provider Privacy Boundary Disclosures

1. **SQLite Logical Deletion Semantics:**
   - Deleting sessions, messages, telemetry records, settings, or credentials executes transactional SQLite `DELETE` statements, synchronizes FTS5 virtual tables, and performs a `PRAGMA wal_checkpoint(PASSIVE)` on full wipe.
   - Nano Route reports completed removals accurately as **"Removed from application database"** and explicitly discloses that SQLite page reuse does not constitute cryptographic physical disk-sector erasure.
2. **External AI Provider Boundary:**
   - Local cleanup and Full Local Data Wipe remove records stored by Nano Route on the local device only.
   - Prompts or responses previously transmitted to external cloud AI providers (e.g., OpenAI, Anthropic, Google Gemini, DeepSeek) are governed by those providers' own retention policies.

---

## 4. Retention Policy Model & Safety Protections

- **Default State:** Both `historyRetentionEnabled` and `telemetryRetentionEnabled` default to `false`. Nano Route never deletes user conversations or telemetry automatically unless explicitly enabled by the user.
- **Validated Range:** Retention windows are strictly validated to integer values in `[1, 3650]` days (`1` day to `10` years). Invalid, negative, zero, or `NaN` values are rejected at both the TypeScript IPC boundary and the Rust `DataLifecycleService`.
- **Pinned Conversation Protection:** By default (`excludePinnedSessions = true`), pinned sessions are excluded from age-based history cleanup.
- **Active Execution & Streaming Protection:** Sessions with an in-flight request in `ExecutionManager` (`creating`, `validating`, `routing`, `route_resolved`, `executing`, `streaming`, `cancelling`, `recovering`) are automatically skipped during history cleanup (`skippedActiveSessionsCount`) and block Full Local Data Wipe (`ACTIVE_EXECUTION_IN_PROGRESS`) until completed or cancelled.
- **Future-Timestamp Anomaly Protection:** Records with timestamps more than 5 minutes in the future (`> now + 300,000 ms`, e.g., due to system clock skew) are flagged as `TIMESTAMP_ANOMALY_FUTURE_RECORDS` during audits and are protected from age-based retention deletion (`skippedFutureTimestampCount`).

