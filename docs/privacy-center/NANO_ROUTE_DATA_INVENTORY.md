# Nano Route — Local Data Inventory & Storage Specification
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Inventory Taxonomy

Nano Route stores all durable user content and operational data locally. The inventory comprises the following verified stores:

| Store ID | Category | Sensitivity Classification | Physical Location | Deletion Policy | Exportable |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sessions` | `user_content` | `USER_CONTENT` | SQLite (`sessions` table) | `user_only` | Yes |
| `messages` | `user_content` | `USER_CONTENT` | SQLite (`messages` table) | `user_only` | Yes |
| `drafts` | `user_content` | `USER_CONTENT` | SQLite / Local storage | `user_only` | Yes |
| `templates` | `user_content` | `USER_CONTENT` | SQLite (`templates` table) | `user_only` | Yes |
| `presets` | `configuration` | `INTERNAL` | SQLite (`presets` table) | `user_only` | Yes |
| `attachments_meta` | `user_content` | `SENSITIVE` | SQLite (`attachments` table) | `user_only` | Yes |
| `attachments_cache`| `user_content` | `SENSITIVE` | Local temporary cache | `retention_eligible` | No |
| `bookmarks` | `user_content` | `INTERNAL` | SQLite (`annotations` table) | `user_only` | Yes |
| `highlights` | `user_content` | `INTERNAL` | SQLite (`annotations` table) | `user_only` | Yes |
| `notes` | `user_content` | `SENSITIVE` | SQLite (`annotations` table) | `user_only` | Yes |
| `collections` | `user_content` | `SENSITIVE` | SQLite (`collections` table) | `user_only` | Yes |
| `credentials` | `secret` | `SECRET` | Windows DPAPI Store | `credential_sensitive`| **NO (Strictly Excluded)** |
| `telemetry_events` | `operational_telemetry` | `OPERATIONAL` | SQLite (`telemetry_events` table) | `retention_eligible` | Yes (Optional) |
| `settings` | `configuration` | `INTERNAL` | SQLite (`settings` table) | `user_only` | Yes |
| `workspace_profiles`| `configuration` | `INTERNAL` | SQLite (`profiles` table) | `user_only` | Yes |

---

## 2. Storage Semantics & Guarantees

1. **Zero Secret Persistence in SQLite**: The SQLite database never holds API keys, private auth headers, or raw DPAPI decryption blobs.
2. **Local Path Privacy**: Path disclosures in diagnostics and telemetry are sanitized to prevent revealing local Windows username paths.
3. **Cache Bounds**: Temporary attachment intake files are purged during routine data maintenance or session wipe.

