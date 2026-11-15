# Nano Route — Audit Trail Export & Portability Policy
**Document Version:** 1.0.0  
**Phase:** Post-Roadmap Product Capability Expansion  
**Status:** Authoritative Specification  
**Date:** 2026-11-15  

---

## 1. Export Bundle Specification

The audit trail supports direct, sanitized JSON export through the Audit Explorer UI or programmatic APIs:

```typescript
export interface AuditExportBundle {
  schemaVersion: number;
  exportedAtMs: number;
  totalEvents: number;
  events: AuditEvent[];
  redactionNote: string;
}
```

---

## 2. Export Sanitization Guarantees

1. **Filtered Portability**: When filters (category, severity, outcome) are active in the UI, the exported file honors those boundaries.
2. **Zero Plaintext Secrets**: The exported JSON bundle contains exclusively sanitized event strings.
3. **No Private Prompt Blobs**: Prompts, messages, notes, and attachments are strictly absent.
4. **Deterministic Formatting**: Exported JSON is structured with standardized 2-space indentation and ISO-8601 timestamps.

