# Nano Route Preventive Maintenance Test Matrix

| Area | Scenario / Invariant | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **Catalog Integrity** | All required domains represented | Valid descriptors returned | Verified |
| **Numeric Thresholds** | Max temp age (24h), drift threshold (1) | Exact constants verified | Verified |
| **Healthy Evaluation** | Clean system evaluation | `HEALTHY`, 0 recommended actions | Verified |
| **Search Drift** | Mismatch $\ge 1$ entries | `MAINTENANCE_RECOMMENDED`, Rebuild recommended | Verified |
| **Stale Temp Files** | Stale staging files accumulated | Cleanup action available | Verified |
| **Import Zombie Locks**| Abandoned import lock detected | `ATTENTION_REQUIRED`, Clear recommended | Verified |
| **Session State** | Snapshot exceeds 64 KB limit | `MAINTENANCE_RECOMMENDED`, Prune recommended | Verified |
| **Temp File Cleanup** | Execution of cleanup action | Items processed, target status `HEALTHY` | Verified |
| **Search Rebuild** | Execution of search rebuild | FTS5 rebuilt, target status `HEALTHY` | Verified |
| **Snapshot Prune** | Execution of snapshot prune | Transients cleared, target status `HEALTHY` | Verified |
| **Concurrency Locks** | Maintenance during streaming / backup | Action blocked with safe message | Verified |
| **History Ring-Buffer**| Multiple housekeeping actions run | History bounded to $\le 50$ entries | Verified |
| **Quick Mode** | Lightweight evaluation mode | Only automatic / core checks executed | Verified |

