# Nano Route — SQLite Database Foundation & Persistence Infrastructure
**Document ID:** `NANO_ROUTE_DATABASE_ARCHITECTURE`  
**Version:** `1.0.0` (Milestone 16 / Step 16 of 50)  
**Status:** `APPROVED & VALIDATED`  
**Classification:** Core System Architecture Specification  

---

## 1. Database Purpose

Nano Route is designed from first principles as a local-first Windows desktop AI orchestration application. Persistence in Nano Route is required for:
- Chat session state and message history
- External AI provider configuration metadata and preferences
- Routing decisions, latency metrics, and local SLM analytics
- Native application settings and state caches
- Secure encrypted credential metadata (stored separately in Windows DPAPI)

Step 16 establishes the production-grade SQLite foundation, connection configuration, migration framework, and execution boundaries. It does not prematurely create feature-specific tables (chat messages, telemetry, or credentials), which belong to subsequent roadmap steps.

---

## 2. Database Location & Path Resolution

The production database is located in a dedicated, application-owned subdirectory under the Windows Local AppData directory:

```text
%LOCALAPPDATA%\Nano Route\data\nano_route.db
```

### Path Invariants:
1. **No Application Root Storage:** The database is never stored beside the executable, in project root, or inside source trees.
2. **Dynamic Resolution:** Derived dynamically via `DatabasePathResolver` (`LOCALAPPDATA` or OS equivalent).
3. **Environment Override:** Supports `NANO_ROUTE_DB_PATH` for testing and development isolation.
4. **Directory Bootstrap:** Parent directory creation (`fs::create_dir_all`) occurs deterministically before connection open.

---

## 3. Connection Ownership

`rusqlite::Connection` is managed exclusively by `DatabaseManager`:
- Connections are encapsulated behind `Arc<Mutex<Connection>>`.
- Direct `Connection` handles are never leaked to IPC commands, frontend components, or background workers.
- Raw database access from React or frontend plugins is strictly prohibited.

---

## 4. Threading Model

SQLite connections in `rusqlite` are `Send + !Sync`:
- `DatabaseManager` serializes operations across threads using an internal synchronization lock.
- Blocking SQLite operations are dispatched through dedicated execution boundaries to protect the Tokio asynchronous runtime.

---

## 5. Async Execution Strategy

To ensure zero worker thread starvation on Tokio:
```text
Async Application Service
           │
           ▼
DatabaseManager::execute_async
           │
           ▼
tokio::task::spawn_blocking
           │
           ▼
  rusqlite::Connection
```
Future repositories execute queries through `execute_async`, preventing synchronous disk I/O from stalling asynchronous network or streaming tasks.

---

## 6. Migration Architecture

Migrations in Nano Route are:
- **Compiled & Packaged:** SQL files are embedded into the native binary via `include_str!` to eliminate packaging failures in release builds (`tauri build`).
- **Strictly Ordered:** Enforces ascending positive integer versions (`1, 2, 3...`).
- **Deterministic:** Migration catalogs are validated for duplicate versions and version ordering before execution.
- **Auditable:** Recorded in `schema_migrations`.

---

## 7. Migration Naming Convention

Migrations follow the standard versioned convention:
```text
001_database_foundation.sql
002_chat_persistence.sql
003_telemetry.sql
004_credentials_metadata.sql
...
```

---

## 8. Versioning Strategy

Nano Route synchronizes two version tracking mechanisms:
1. `schema_migrations` table: Records `version`, `name`, `checksum`, `applied_at`, and `execution_duration_ms`.
2. `PRAGMA user_version`: Updated to match the latest applied migration version for fast external inspection.

---

## 9. Transaction Strategy

All migrations and multi-operation repository writes execute inside atomic transactions:
- `BEGIN EXCLUSIVE` ensures isolated execution during schema changes.
- Automatic `ROLLBACK` on error ensures failed migrations or partial writes never leave the database in an inconsistent state.

---

## 10. SQLite Pragma Policy

Every connection automatically applies authoritative pragmas:
```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store = MEMORY;
PRAGMA cache_size = -2000;
```

---

## 11. Write-Ahead Logging (WAL) Policy

Nano Route utilizes SQLite Write-Ahead Logging (`WAL`):
- Enables concurrent readers without blocking writers.
- Generates sidecar files `nano_route.db-wal` and `nano_route.db-shm`.
- Checkpointed cleanly during `DatabaseManager::shutdown()` via `PRAGMA wal_checkpoint(TRUNCATE)`.

---

## 12. Error Handling & Sanitization

Database failures map into `DatabaseError`:
- 9 discrete error categories (`ConnectionFailed`, `MigrationFailed`, `TamperedMigration`, `ConstraintViolation`, `CorruptionSuspected`, `ExecutionFailed`, `BusyTimeout`, `TransactionFailed`, `InvalidPath`).
- **Secret Scrubbing:** All error text passes through `sanitize_error_text()` to prevent API keys or credentials from entering logs.
- Safe mapping into application-wide `AppError`.

---

## 13. Security Boundaries

- **Zero SQL from Frontend:** The IPC registry exposes zero generic SQL execution commands.
- **Parameterized Queries:** All queries must use bound parameters. String formatting with user inputs is strictly forbidden.
- **No Plaintext Secrets:** SQLite is not an encryption vault. API keys are encrypted with Windows DPAPI before persistence.

---

## 14. Backup Requirements

Because WAL mode is active:
- Direct file copies of `nano_route.db` while active are unsafe without sidecar files (`-wal` and `-shm`).
- Future backup systems must use SQLite's native backup API (`VACUUM INTO` or `sqlite3_backup`) or checkpoint WAL prior to copying.

---

## 15. Corruption Handling

- Startup executes `PRAGMA integrity_check;`.
- If corruption is detected, the database enters `DatabaseStatus::Failed`.
- Automatic destructive resets or file deletions are strictly forbidden to protect user data.

---

## 16. Shutdown Behavior

On application exit:
1. `DatabaseManager::shutdown()` is invoked by the lifecycle coordinator.
2. An active WAL checkpoint (`TRUNCATE`) flushes remaining transactions into the primary `.db` file.
3. Locks and memory structures are cleanly released.

---

## 17. Repository Boundary

```text
                 ┌──────────────────────┐
                 │      React / TS      │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │      Tauri IPC       │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │ Application Service  │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │      Repository      │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │   DatabaseManager    │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │      rusqlite        │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │     SQLite File      │
                 │    nano_route.db     │
                 └──────────────────────┘
```

---

## 18. Future Schema Roadmap

- **Step 17:** Chat Sessions & Messages (`chat_sessions`, `chat_messages`)
- **Step 18:** Telemetry & Routing Analytics (`routing_metrics`, `token_usage`)
- **Step 19:** Encrypted Provider Credentials Metadata (`provider_credentials`)
- **Step 20:** Application Settings & Preferences (`user_preferences`)

---

## 19. Test Strategy

1. **In-Memory Isolation:** Unit tests run against `DatabaseManager::in_memory()` with zero disk residue.
2. **File-Backed Reopen:** Tests verify that data and schema persist across connection close and reopen.
3. **Rollback Verification:** Multi-statement transactions are tested to confirm complete rollback on failure.
4. **Tamper Detection:** Modifying historical migration SQL triggers checksum validation errors.

---

## 20. Known Limitations

- Feature tables are intentionally deferred to Step 17+.
- Windows DPAPI encryption is deferred to Step 19.
- Cloud sync / remote database replication is out of scope (local-first design).

