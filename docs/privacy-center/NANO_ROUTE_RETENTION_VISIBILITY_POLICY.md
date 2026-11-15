# Nano Route — Retention & Data Lifecycle Visibility Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Policy  
**Date:** 2026-11-15  

---

## 1. Local Retention Principles

Nano Route adheres strictly to the Step 45 and Step 66 retention model:

1. **Chat History Retention**:
   - Default: Automatic history retention cleanup is **disabled**. Conversations are retained indefinitely until the user explicitly deletes a session or initiates a data wipe.
   - User Configuration: If enabled in Settings, the user may specify a retention threshold (e.g., 30, 60, 90, or 365 days).
   - Pinned Sessions Protection: Sessions marked as "pinned" are automatically excluded from automated retention pruning unless explicitly unpinned.

2. **Telemetry Retention**:
   - Default: Automatic telemetry retention is optional (default 30 days when enabled).
   - Operational metadata older than the threshold is purged to prevent unbound database growth.

3. **Temporary Attachment Files**:
   - Caching: Parsed and transformed attachment payloads are stored in a temporary application cache folder.
   - Lifecycle: Purged upon application shutdown, manual cache clear, or database maintenance run.

---

## 2. Storage Semantics & Deletion Disclosures

### 2.1 SQLite Logical Deletion Semantics
When records are deleted in Nano Route (via session deletion, retention pruning, or reset):
- Records are deleted from SQLite tables using standard `DELETE` statements.
- SQLite marks the freed pages for reuse within the active database file and write-ahead log (WAL).
- Deletion does **not** constitute military-grade or cryptographic disk-sector erasure.
- Vacuuming during maintenance reclaims physical disk space by rebuilding the database file.

### 2.2 External AI Provider Boundary
- Local deletion removes records exclusively from the local machine's storage.
- Nano Route cannot delete or alter records previously transmitted to external AI providers. Once sent, third-party provider retention and privacy policies govern the data.

