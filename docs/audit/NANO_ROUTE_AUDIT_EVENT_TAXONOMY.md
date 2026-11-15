# Nano Route — Audit Event Taxonomy & Classification
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Event Category Taxonomy

Nano Route restricts audit events to 15 bounded operational categories:

| Category | Primary Subsystems | Description & Scope |
| :--- | :--- | :--- |
| `SECURITY` | Step 19, Step 48, Step 74 | DPAPI vault state, secret isolation checks, integrity alerts |
| `CREDENTIAL` | Step 19, Step 74 | Key additions, rotations, replacements, and revocations |
| `PROVIDER` | Step 21, Step 56, Step 87 | Provider activation, endpoint updates, health state changes |
| `ROUTING` | Step 29, Step 30 | Routing policy changes, manual overrides, eligibility blocks |
| `BUDGET` | Step 75 | Spend limit alterations, threshold warnings, budget blocks |
| `DATA` | Step 45, Step 70, Step 71, Step 73 | Data export, import, wipe, and vacuum operations |
| `PRIVACY` | Step 66, Step 88 | Retention policy modifications, telemetry preference changes |
| `EXECUTION` | Step 85 | Request failovers, cancellations, timeouts, and critical failures |
| `CONNECTIVITY` | Step 86 | Online/offline transitions, provider reachability state shifts |
| `RECOVERY` | Step 53 | Database backup restorations, interrupted task recovery |
| `UPDATE` | Step 52 | Application update checks, downloads, verifications |
| `DIAGNOSTICS` | Step 62 | System diagnostic runs and support bundle generation |
| `MAINTENANCE` | Step 73 | Schema optimizations, orphaned cache purges, index rebuilds |
| `CONFIGURATION` | Step 66, Step 67 | Workspace profile creation, setting adjustments |
| `SYSTEM` | Core Lifecycle | Application startup, shutdown, and hydration milestones |

---

## 2. Event Severity Hierarchy

- `INFO`: Normal, expected operational milestones (e.g. `SYSTEM_INITIALIZED`, `MODEL_REGISTRY_LOADED`).
- `NOTICE`: User-visible state changes (e.g. `ROUTING_OVERRIDE_SET`, `WORKSPACE_PROFILE_ACTIVATED`).
- `WARNING`: Recoverable anomalies or thresholds (e.g. `BUDGET_WARNING`, `REQUEST_FAILOVER`).
- `ERROR`: Operations that failed or were blocked (e.g. `REQUEST_FAILED`, `IMPORT_SCHEMA_REJECTED`).
- `SECURITY`: Critical authentication, credential, or vault actions (e.g. `CREDENTIAL_ROTATED`, `DPAPI_VAULT_VERIFIED`).

---

## 3. Standard Outcomes

- `SUCCESS`: Operation concluded normally without fault.
- `FAILED`: Operation encountered an error and could not complete.
- `BLOCKED`: Operation was prevented by policy (e.g. Budget ceiling or eligibility filter).
- `CANCELLED`: Operation was halted cooperatively by user or system token.
- `REJECTED`: Operation failed preconditions or input validation.

