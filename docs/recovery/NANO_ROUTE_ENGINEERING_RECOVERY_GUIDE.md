# Nano Route Engineering Recovery Guide (Step 53)

## 1. Storage Architecture & Directory Layout

Nano Route state is segregated across dedicated paths on Windows:

```
%LOCALAPPDATA%\Nano Route\
├── data\
│   ├── nano_route.db          # Primary SQLite database
│   ├── nano_route.db-wal      # Write-Ahead Log (WAL)
│   └── nano_route.db-shm      # Shared memory index
├── backups\
│   ├── backup_*.db            # Verified SQLite backup snapshots
│   ├── backup_*.manifest.json # Backup metadata manifests
│   └── safety_snapshot_*.db   # Automatic pre-operation recovery points
└── updates\
    └── staging\               # Isolated download and staging area
```

---

## 2. SQLite Recovery & Integrity Verification

To inspect and repair a suspect database at the engine level:

### Step 1: Check Database Integrity
Run SQLite integrity check:
```sql
PRAGMA integrity_check;
PRAGMA quick_check;
PRAGMA foreign_key_check;
```
If `PRAGMA integrity_check` returns anything other than `ok`, the database cannot be safely operated in-place.

### Step 2: Emergency SQLite Dump & Rebuild
If a database is damaged and no clean backup exists, run the SQLite CLI recovery command:
```powershell
sqlite3.exe nano_route.db ".recover" | sqlite3.exe nano_route_recovered.db
```
Then verify the schema migration level:
```sql
SELECT MAX(version) FROM schema_migrations;
```

---

## 3. Migration Recovery

If a schema migration fails midway:
1. Every migration is wrapped in an exclusive transaction (`TransactionBehavior::Exclusive`).
2. Failed statements automatically rollback within SQLite, leaving the previous `PRAGMA user_version` intact.
3. If corruption occurs due to unexpected disk exhaustion during migration:
   - Restore the automatic pre-migration backup (`safety_snapshot_pre_update_*.db`).
   - Fix underlying disk or constraint errors.
   - Re-run the migration runner.

---

## 4. Rebuilding Derived Search Indexes (FTS5)

The `history_search_fts` virtual table is completely derived from `chat_sessions` and `chat_messages`.
If the search index becomes out of sync or corrupted:
```sql
DELETE FROM history_search_fts;
INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
SELECT 'session', id, '', title FROM chat_sessions;
INSERT INTO history_search_fts (entry_type, session_id, message_id, text)
SELECT 'message', session_id, id, content FROM chat_messages;
```
The `RecoveryService` executes this rebuild automatically after every restore promotion.

