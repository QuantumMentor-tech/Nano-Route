# Nano Route — Local Data Classification & Portability Taxonomy

**Document Reference:** `docs/export/NANO_ROUTE_DATA_CLASSIFICATION.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Classification Specification**  

---

## 1. Data Classification Tiers

Nano Route establishes 6 formal data classification tiers governing on-device storage, presentation, and export portability:

| Classification | Definition | Portability Policy | Justification & Architectural Boundary |
| :--- | :--- | :---: | :--- |
| **`USER_CONTENT`** | Personal, user-authored prompt inputs and AI assistant conversation texts. | **Exportable with Warning** | Belongs to the user. Full portability granted under explicit user request with privacy disclosure. |
| **`USER_CONFIGURATION`** | User-selected visual and functional choices (theme, typography, density, custom profiles). | **Exportable** | Allows users to inspect and migrate their custom workspace setup to other systems or backup files. |
| **`ANALYTICS_DATA`** | Aggregated, non-personal metrics on token volumes, monetary savings, and latency metrics. | **Exportable** | Allows users to analyze their AI provider spending and performance over time in spreadsheet tools. |
| **`METADATA_ONLY`** | Public, static facts regarding AI providers, context windows, and model descriptors. | **Exportable** | Contains no private user or secret data. Safe for inspection. |
| **`SECRET`** | Sensitive authentication material, including Windows DPAPI ciphertexts and API keys. | **NEVER EXPORTABLE** | Exporting secrets creates credential exposure vulnerabilities. Keys must remain in Windows DPAPI storage. |
| **`SYSTEM_INTERNAL`** | SQLite transaction files (WAL/SHM), task IDs, FTS5 indexes, and transient socket pointers. | **NEVER EXPORTABLE** | Process runtime internals that have no portability value and can compromise application integrity. |

---

## 2. Universal Local Data Entity Inventory

The following table documents every local storage artifact in Nano Route, its physical storage location, classification, and export eligibility:

| Entity Name | Storage Location | Classification | Exportable? | Notes |
| :--- | :--- | :---: | :---: | :--- |
| **Chat Sessions & Messages** | SQLite (`chat_sessions`, `chat_messages`) | `USER_CONTENT` | **YES** | Available via `chat_history`. |
| **FTS5 Search Index** | SQLite (`fts_messages`) | `SYSTEM_INTERNAL` | **NO** | Derivative search cache; omitted to avoid duplication. |
| **Telemetry & Metrics** | SQLite (`telemetry_records`) | `ANALYTICS_DATA` | **YES** | Available via `telemetry_and_analytics`. Zero prompt text stored. |
| **UI Preferences** | SQLite (`app_settings`) | `USER_CONFIGURATION` | **YES** | Available via `user_preferences` (allowlisted keys only). |
| **Custom Workspace Profiles** | SQLite (`app_settings`) | `USER_CONFIGURATION` | **YES** | Available via `workspace_profiles`. |
| **Provider Catalog Descriptors**| SQLite (`provider_descriptors`) | `METADATA_ONLY` | **YES** | Available via `provider_registry_metadata`. |
| **DPAPI Credentials & Keys** | Windows DPAPI Vault | `SECRET` | **NO** | **STRICTLY FORBIDDEN**. Never exported. |
| **Session Continuity Snapshot**| SQLite (`workspace.session_state`) | `SYSTEM_INTERNAL` | **NO** | Ephemeral layout context; omitted from data portability. |
| **Onboarding Progress Marker** | LocalStorage (`nr_onboarding_progress_v1`)| `SYSTEM_INTERNAL`| **NO** | Internal setup wizard state; omitted from data portability. |
| **SQLite WAL & SHM Files** | Disk Files (`nano_route.db-wal`) | `SYSTEM_INTERNAL` | **NO** | Database engine transaction internals. |
| **Database Backup Files** | Disk Files (`backups/*.db`) | `SYSTEM_INTERNAL` | **NO** | Managed independently via Step 53 Disaster Recovery. |

