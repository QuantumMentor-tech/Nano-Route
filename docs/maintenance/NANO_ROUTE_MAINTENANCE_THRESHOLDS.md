# Nano Route Maintenance Thresholds Specification

## Authoritative Thresholds & Engineering Rationale

| Threshold Parameter | Value | Rationale | Overridable |
| :--- | :--- | :--- | :--- |
| **`MAX_TEMP_FILE_AGE_MS`** | `86,400,000 ms` (24 hours) | Guarantees no active export/import task is actively reading the file. | No |
| **`MAX_RESOLVED_NOTIFICATIONS_COUNT`** | `100 entries` | Prevents unbounded notification center memory and SQLite growth. | Yes (Step 64) |
| **`MAX_NOTIFICATION_AGE_DAYS`** | `30 days` | Non-critical alerts older than 30 days are eligible for safe pruning. | Yes |
| **`SEARCH_INDEX_DRIFT_THRESHOLD`** | `1 entry` | Any discrepancy between virtual FTS5 tables and chat rows flags rebuild. | No |
| **`STALE_IMPORT_MARKER_AGE_MS`** | `3,600,000 ms` (1 hour) | Zombie lock threshold when no running background task exists. | No |
| **`MAX_SESSION_STATE_BYTES`** | `65,536 bytes` (64 KB) | Prevents corrupted or massive session snapshots from degrading launch speed. | No |
| **`MAX_MAINTENANCE_HISTORY_ENTRIES`**| `50 entries` | Fixed ring-buffer size for housekeeping history log. | No |

