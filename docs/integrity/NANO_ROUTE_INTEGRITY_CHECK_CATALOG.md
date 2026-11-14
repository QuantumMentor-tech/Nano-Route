# Nano Route Integrity Check Catalog

## Authoritative Check Specifications

| Check ID | Domain | Expected Invariant | Severity | Safe Repair ID | Recovery Recommended |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`DB-001`** | `DATABASE` | SQLite responsive, Schema v6, WAL active | `CRITICAL` | — | Yes |
| **`DB-002`** | `DATABASE` | Zero foreign-key constraint violations | `HIGH` | `REMOVE_ORPHANED_MESSAGES` | Yes |
| **`HIST-001`**| `HISTORY` | Valid session IDs, titles, chronological timestamps | `HIGH` | — | No |
| **`HIST-002`**| `HISTORY` | All messages link to valid parent session | `HIGH` | `REMOVE_ORPHANED_MESSAGES` | No |
| **`SEARCH-001`**| `SEARCH_INDEX`| FTS5 entries match chat message rows 1:1 | `MEDIUM` | `REBUILD_SEARCH_INDEX` | No |
| **`PREF-001`**| `PREFERENCES`| Stored keys in allowlist, pass domain validation | `MEDIUM` | `RESET_INVALID_PREFERENCES` | No |
| **`PROF-001`**| `PROFILES` | Custom profiles JSON well-formed & schema v1 | `MEDIUM` | `PRUNE_CORRUPT_PROFILES` | No |
| **`SESS-001`**| `SESSION_STATE`| Configured startup and session routes in allowlist | `MEDIUM` | `REPAIR_INVALID_SESSION_ROUTE`| No |
| **`TELEM-001`**| `TELEMETRY` | Unique event IDs, non-future timestamps | `LOW` | — | No |
| **`ANALYTICS-001`**| `TOKEN_USAGE`| Non-negative tokens, non-negative cost, conf $\in [0, 1]$| `LOW`| — | No |
| **`LATENCY-001`**| `LATENCY` | Non-negative request latency in ms | `LOW` | — | No |
| **`PROV-001`** | `PROVIDER_METADATA` | Registered providers have valid descriptors | `MEDIUM` | — | No |
| **`IMPORT-001`**| `IMPORT_STATE` | Zero zombie or stale import locks | `LOW` | `CLEAR_STALE_IMPORT_MARKER`| No |

