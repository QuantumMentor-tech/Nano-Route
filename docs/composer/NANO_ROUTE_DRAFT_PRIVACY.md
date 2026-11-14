# Nano Route — Composer Draft Privacy Specification
**Step 78 — Authoritative Privacy Specification**

## 1. Local-Only Persistence
- **No Cloud Synchronization**: Drafts reside strictly in the local SQLite database and memory.
- **Zero Third-Party Telemetry**: Autosave frequency and draft lengths are not logged to remote servers.
- **Secret Sanitization**: Draft text is omitted from standard diagnostic support bundles.
- **Controlled Lifecycle**: Drafts are purged immediately upon sending a message or clicking `Discard`.

