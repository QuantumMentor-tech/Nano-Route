# Nano Route Data Import Failure Recovery & Rollback

## Disaster Recovery Integration

Before applying any imported data modifications, the engine orchestrates a safety snapshot via Step 53 Disaster Recovery:
- Invocations of `createBackup({ scope: "full_database" })` generate a verified SHA-256 backup artifact before any writes.
- Should an import be cancelled or an unanticipated failure occur, the user can restore their pre-import database state in one click from the Reset & Recovery settings tab.
- Search index rebuilding (`rebuild_search_index`) is safely decoupled from the transaction loop so failures during re-indexing do not corrupt raw chat tables.

