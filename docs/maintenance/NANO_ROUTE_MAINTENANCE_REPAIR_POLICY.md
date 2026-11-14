# Nano Route Preventive Maintenance Repair Policy

## Policy & Classification Rules

1. **`SAFE_HOUSEKEEPING`**:
   - Includes clearing abandoned temporary staging files (`CLEANUP_STALE_TEMP_FILES`) and clearing stale import locks (`CLEAR_ABANDONED_IMPORT_MARKERS`).
   - May execute automatically during lightweight startup or idle periods.
2. **`REGENERATIVE`**:
   - Includes rebuilding FTS5 indexes (`REBUILD_SEARCH_INDEX`) and refreshing analytics summaries (`REFRESH_ANALYTICS_CACHE`).
   - Reconstructs caches entirely from authoritative source tables with zero data loss.
3. **`STORAGE_RECLAMATION`**:
   - Includes database free page optimization (`OPTIMIZE_DATABASE_PAGES`) and pruning resolved notifications (`PRUNE_EXPIRED_NOTIFICATIONS`).
   - Requires explicit user initiation and pre-action safety backup if disk pages are compacted.
4. **Operation Concurrency Guards**:
   - Maintenance actions are strictly blocked if streaming, database writes, backups, or updates are in-flight.

