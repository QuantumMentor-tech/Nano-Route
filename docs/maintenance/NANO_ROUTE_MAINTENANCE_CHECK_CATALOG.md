# Nano Route Maintenance Check Catalog

## Authoritative Preventive Checks

| Check ID | Domain | Purpose | Trigger | Recommended Action | Auto Allowed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`MAINT-DB-001`** | `DATABASE` | SQLite & WAL overhead monitoring | Manual | `OPTIMIZE_DATABASE_PAGES` | No |
| **`MAINT-SEARCH-001`**| `SEARCH_INDEX`| FTS5 search index drift detection | Manual | `REBUILD_SEARCH_INDEX` | No |
| **`MAINT-TEMP-001`** | `TEMPORARY_FILES`| Abandoned staging files accumulation| Startup / Periodic | `CLEANUP_STALE_TEMP_FILES` | Yes |
| **`MAINT-NOTIF-001`** | `NOTIFICATION_STATE`| Resolved notification record history| Periodic | `PRUNE_EXPIRED_NOTIFICATIONS`| Yes |
| **`MAINT-IMPORT-001`**| `IMPORT_STATE` | Stale import markers & abandoned locks| Startup | `CLEAR_ABANDONED_IMPORT_MARKERS`| Yes |
| **`MAINT-SESS-001`** | `SESSION_STATE` | Session continuity snapshot overhead| Startup | `PRUNE_STALE_SESSION_SNAPSHOTS` | Yes |
| **`MAINT-ANALYTICS-001`**| `ANALYTICS_CACHE`| Derived summary freshness | Manual | `REFRESH_ANALYTICS_CACHE` | Yes |
| **`MAINT-TELEM-001`** | `TELEMETRY` | Telemetry volume & retention compliance| Manual | — (Step 45 Lifecycle) | No |

