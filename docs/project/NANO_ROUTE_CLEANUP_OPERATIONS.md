# Nano Route — Audit, Safe Repair, Cleanup & Full Wipe Operations (Step 45)

## 1. Narrow Purpose-Built IPC Command Surface

Nano Route strictly prohibits generic SQL execution (`execute_sql`) or arbitrary filesystem path deletion (`delete_directory`) over IPC. All Step 45 operations use narrow, validated commands:

| IPC Command | Rust Handler | TypeScript Wrapper | Mutates DB? |
| :--- | :--- | :--- | :---: |
| `cmd_get_data_inventory` | `commands::privacy::cmd_get_data_inventory` | `getDataInventory()` | No |
| `cmd_run_data_audit` | `commands::privacy::cmd_run_data_audit` | `runDataAudit(mode)` | No |
| `cmd_run_safe_data_repair` | `commands::privacy::cmd_run_safe_data_repair` | `runSafeDataRepair(action)` | Yes (Safe Repair only) |
| `cmd_get_retention_policy` | `commands::privacy::cmd_get_retention_policy` | `getRetentionPolicy()` | No |
| `cmd_update_retention_policy` | `commands::privacy::cmd_update_retention_policy` | `updateRetentionPolicy(policy)` | Yes (`app_settings`) |
| `cmd_preview_data_cleanup` | `commands::privacy::cmd_preview_data_cleanup` | `previewDataCleanup(request)` | No (100% Dry-Run) |
| `cmd_execute_data_cleanup` | `commands::privacy::cmd_execute_data_cleanup` | `executeDataCleanup(request)` | Yes (Transactional) |
| `cmd_preview_full_data_wipe` | `commands::privacy::cmd_preview_full_data_wipe` | `previewFullDataWipe()` | No (100% Dry-Run) |
| `cmd_execute_full_data_wipe` | `commands::privacy::cmd_execute_full_data_wipe` | `executeFullDataWipe(request)` | Yes (Requires `"DELETE"`) |

---

## 2. Read-Only Audit vs. Safe Repair Separation

### Read-Only Audit (`runDataAudit`)
- **Quick Mode (`quick`):** Executes `PRAGMA quick_check`, `PRAGMA foreign_key_check`, table row counts, orphan detection (`chat_messages` without parent `chat_sessions`), FTS5 search index drift check (`history_search_fts` vs `chat_sessions + chat_messages`), and telemetry consistency checks.
- **Full Mode (`full`):** Executes full `PRAGMA integrity_check`, `PRAGMA foreign_key_check`, schema version verification, WAL status check, orphan/FTS checks, telemetry anomaly checks, and DPAPI credential ciphertext non-empty verification.
- **Canonical Health States:**
  - `healthy`: All SQLite checks pass, 0 orphans, FTS5 in sync, 0 telemetry anomalies.
  - `healthy_with_warnings`: SQLite and FKs are valid, but FTS5 search index is out of sync or telemetry contains future-dated/numeric anomalies.
  - `needs_attention`: Foreign-key violations, orphaned message rows, or invalid credential records detected.
  - `corrupted`: SQLite `integrity_check` / `quick_check` failed.
  - `unavailable`: Database connection unreachable.

### Safe Repair (`runSafeDataRepair`)
- Strictly separated from `runDataAudit` so running an audit never modifies any row.
- Supports `rebuild_search_index` and `remove_orphaned_records_and_rebuild_index`.
- Rebuilds `history_search_fts` deterministically from `chat_sessions` and `chat_messages` inside an immediate SQLite transaction and verifies `actualSearchIndexEntries === expectedSearchIndexEntries`.

---

## 3. Dry-Run Preview & Transactional Cleanup Workflow

1. **Dry-Run Preview (`previewDataCleanup`):**
   - Calculates exact counts of `eligibleSessionsCount`, `eligibleMessagesCount`, `eligibleTelemetryRecordsCount`, `affectedSearchIndexEntriesCount`, `excludedPinnedSessionsCount`, `skippedActiveSessionsCount`, and `skippedFutureTimestampCount` without mutating the database.
2. **Batched Transactional Execution (`executeDataCleanup`):**
   - Requires `confirmed: true` and acquires an atomic operation lock (`OperationGuard`) so concurrent cleanup/wipe operations cannot overlap.
   - Deletes eligible sessions in bounded transactional batches (`CLEANUP_BATCH_SIZE = 500`), cascading to `chat_messages` and session-correlated `telemetry_records`.
   - Deletes eligible standalone/retention telemetry records while preserving `api_credentials` and `app_settings`.
   - Rebuilds `history_search_fts` and verifies post-cleanup counts (`verified`, `verified_with_warnings`, `verification_failed`).
   - Strictly idempotent: running the same cleanup a second time deletes `0` rows and returns `verified`.

---

## 4. Full Local Data Wipe Workflow

1. **Preview (`previewFullDataWipe`):**
   - Inspects total counts across all user stores and checks `ExecutionManager::get_active_count()`. If any chat or stream execution is active, `canProceed` is `false` with an explicit `blockReason`.
2. **High-Friction Confirmation & Execution (`executeFullDataWipe`):**
   - Requires `confirmed: true` and exact case-sensitive `confirmationToken: "DELETE"`. Any other token (`"delete"`, `""`, `"CONFIRM"`) is rejected with `INVALID_INPUT`.
   - Rejects execution if an active request is running (`ACTIVE_EXECUTION_IN_PROGRESS`).
   - Atomically clears `chat_messages`, `chat_sessions`, `telemetry_records`, `history_search_fts`, `app_settings` (when `includeSettings: true`), and `api_credentials` (when `includeCredentials: true`), invalidates `AppSettingsService` cache, updates `ProviderHealthManager` credential status flags, and verifies `0` remaining rows.

