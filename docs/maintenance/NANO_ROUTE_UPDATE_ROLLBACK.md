# Nano Route Update Rollback & Recovery Invariants (Step 52)

## 1. Principles of Rollback Safety

An application updater must be prepared to recover safely when an update fails midway (e.g., interrupted network, power failure, failed binary verification, or unhandled runtime crash on launch).

### Rollback Guarantees:

1. **No Overwrite Before Validation**: Target binaries are downloaded to an isolated staging directory (`staging/updates/`) and verified cryptographically before the active application files are touched.
2. **Pre-Update SQLite Snapshots**:
   Whenever an update requires schema migrations (`requiresDatabaseMigration === true`), Nano Route creates an uncorrupted SQLite snapshot:
   - Location: `%LOCALAPPDATA%\Nano Route\backups\pre_update_v{CURRENT_VERSION}_{TIMESTAMP}.db`
   - Verification: SQLite integrity check on the snapshot prior to launching the updater installer.
3. **DPAPI Credential Resilience**:
   Windows DPAPI master keys and ciphertexts are untouched by the updater binary. Even in the event of an update failure and executable rollback, user credentials stored in SQLite remains decipherable by the DPAPI subsystem.
4. **Fallback to Previous Executable**:
   If an in-place executable replacement fails or the new executable crashes during early startup, the staged `.old` or `.backup` executable is restored immediately.

