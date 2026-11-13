# Nano Route Disaster Recovery Runbook (Step 53)

## 1. Overview & Classification

This runbook defines deterministic standard operating procedures (SOPs) for responding to local data corruption, failed software updates, damaged filesystem structures, or accidental deletion of Nano Route state.

### Incident Classification:

| Category | Typical Symptoms | Immediate Danger | Primary Recovery Route |
|---|---|---|---|
| **Class A: SQLite DB Corruption** | "SQL logic error", `PRAGMA integrity_check` fails, unreadable tables | Immediate data loss if overwritten | Staged restore from latest verified backup |
| **Class B: Accidental Session Deletion** | User accidentally wiped session or history | None (isolated deletion) | Restore from pre-operation backup snapshot |
| **Class C: Failed Migration** | Migration script fails midway during startup or update | Database left in partial schema state | Rollback to pre-update snapshot & investigate SQL error |
| **Class D: Update Crash on Startup** | App crashes on boot after update | App inaccessible | Restore pre-update binary & database snapshot |
| **Class E: DPAPI Context Invalidation** | User moved database to new machine or changed OS user account | Credentials fail to decrypt | Prompt user to re-enter provider API keys; retain history |

---

## 2. Cardinal Disaster Recovery Rule

> **NEVER DELETE CURRENT DATA TO ATTEMPT REPAIR.**
>
> Always adhere to the established pipeline:
> `Detect -> Preserve -> Snapshot -> Validate -> Stage Recovery -> Verify -> Promote -> Reopen -> Validate Again`

---

## 3. Incident Response Procedures

### Procedure 1: Responding to SQLite Database Corruption (Class A)
1. **Preserve State**: Immediately copy the existing corrupted database file and its sidecars (`nano_route.db`, `nano_route.db-wal`, `nano_route.db-shm`) to an isolated quarantine folder:
   `%LOCALAPPDATA%\Nano Route\quarantine\nano_route_corrupt_{timestamp}\`
2. **Locate Latest Verified Backup**:
   Check `%LOCALAPPDATA%\Nano Route\backups\` for the newest `.manifest.json` where `isValid: true`.
3. **Execute Preflight Preview**:
   Run `previewRestore(backupId)` to verify SHA-256 and validate SQLite structure.
4. **Initiate Staged Restore**:
   Pass `RESTORE` confirmation token to `restoreBackup({ backupId, confirmationToken: "RESTORE" })`.
5. **Verify Historical Consistency**:
   Confirm row counts in `chat_sessions`, `chat_messages`, and `telemetry_records`.
6. **Verify Search Index Rebuild**:
   Ensure `history_search_fts` queries return expected results.

### Procedure 2: Rollback After Failed Software Update (Class C/D)
1. Ensure the updater stopped all active prompt executions.
2. Locate the automatic pre-update safety backup:
   `%LOCALAPPDATA%\Nano Route\backups\safety_snapshot_pre_update_{version}.db`.
3. Restore the pre-update database using the staging pipeline.
4. Launch the previous stable executable (`v0.1.0`).

### Procedure 3: Handling Machine / User-Account Migrations (Class E)
1. Restore the SQLite database file on the new machine.
2. Note that Windows DPAPI encryption keys are tied to the local Windows user profile.
3. Chat sessions, messages, telemetry, and non-secret settings are fully preserved.
4. The user must re-enter their provider API keys (OpenAI, Anthropic, Gemini, etc.) in the Settings page.

