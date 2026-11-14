# Nano Route Data Integrity Security Model

## Boundaries & Defenses

1. **Read-Only Verification Boundary**: Running tests never executes writes or updates to the SQLite database.
2. **Predefined Repair Dispatching**: The frontend cannot dispatch arbitrary SQL, shell commands, or custom repair payloads. All repairs invoke predefined native handlers.
3. **Pre-Repair Backup Snapshots**: Any repair categorized as `DATA_MUTATING` triggers an automated SQLite safety backup via Step 53 Disaster Recovery.
4. **Denial-of-Service Defense**: Bounded timeouts, indexed querying, and non-blocking background workers prevent UI freezing during large data audits.

