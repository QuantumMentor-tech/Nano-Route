# Nano Route — Audit Trail Retention & Lifecycle Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Policy  
**Date:** 2026-11-15  

---

## 1. Local Bounded Retention

Audit event storage must not grow unbounded on the user's local disk:

1. **Storage Ceiling**: The in-memory / local audit store maintains a hard capacity ceiling of **5,000 events** (`MAX_AUDIT_EVENTS_LIMIT`).
2. **Automated FIFO Eviction**: When the ceiling is reached upon recording a new event, the oldest non-security events are automatically evicted to maintain performance and storage bounds.
3. **Time-Based Retention**: Users can configure or execute retention pruning (default: prune events older than **30 days**).
4. **Security Event Preservation**: High-severity `SECURITY` events are prioritized and preserved during routine non-critical evictions where capacity allows.

---

## 2. User-Controlled Pruning & Reset

Users maintain complete sovereignty over their audit records:
- **Targeted Pruning**: The Audit Explorer provides a &ldquo;Prune History&rdquo; action to purge records older than 30 days without touching active configurations or conversation data.
- **Application Reset Integration**:
  - `RESET_PREFERENCES` does not erase audit logs.
  - `CLEAR_SELECTED_USER_DATA` provides optional selection to clear audit logs.
  - `FULL_LOCAL_DATA_RESET` and `FACTORY_RESET` completely clear the audit store.
- **Independence from Chat History**: Clearing the audit trail never modifies, archives, or deletes chat sessions, prompts, or notes.

