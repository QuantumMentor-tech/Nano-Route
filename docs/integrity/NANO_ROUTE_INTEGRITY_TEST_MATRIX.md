# Nano Route Data Integrity Test Matrix

| Area | Invariant Verified | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| **Database Core** | Schema version, WAL active, responsive | `PASS` | Verified |
| **Foreign Keys** | Orphan message rows detected | `INCONSISTENT` | Verified |
| **Foreign Keys Repair** | Safe orphan cleanup and re-verification | `PASS` | Verified |
| **Search Index** | FTS5 drift count detected | `INCONSISTENT` | Verified |
| **Search Index Repair** | Index rebuild and re-verification | `PASS` | Verified |
| **Preferences** | Stored settings in allowlist | `PASS` | Verified |
| **Profiles** | Custom profile structure and schema v1 | `PASS` | Verified |
| **Session State** | Startup and session route in allowlist | `PASS` | Verified |
| **Route Repair** | Bad route reset to safe default | `PASS` | Verified |
| **Telemetry** | Event IDs and non-future timestamps | `PASS` | Verified |
| **Analytics Metrics** | Non-negative tokens, cost, latency | `PASS` | Verified |
| **Full Suite Aggregation** | Multi-domain check run without mutations | `PASS` | Verified |
| **Quick Check Mode** | Bounded high/critical severity focus | `PASS` | Verified |

