# Nano Route — Data Export Snapshot Consistency & Concurrency

**Document Reference:** `docs/export/NANO_ROUTE_DATA_EXPORT_CONSISTENCY.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 70  
**Authoritative Consistency Guide**  

---

## 1. Consistency Model & Snapshot Semantics

When exporting multi-table application data in a live desktop application:

1. **Point-in-Time Cutoff:** The manifest records an authoritative timestamp `exportedAtMs`.
2. **Read Isolation:** Data queries execute sequentially across categories (chat sessions $\rightarrow$ messages $\rightarrow$ preferences $\rightarrow$ profiles $\rightarrow$ telemetry).
3. **No Write Locking:** SQLite WAL (Write-Ahead Logging) mode allows read queries to execute concurrently with background database writes without blocking UI interactions or active token streaming.

---

## 2. Concurrency Scenarios

| Concurrent Action | System Behavior During Export |
| :--- | :--- |
| **Active Chat Streaming** | The prompt stream continues uninterrupted. The export query reads existing committed messages from SQLite up to the query timestamp. Partial streaming deltas not yet persisted to SQLite are omitted safely. |
| **New Preferences Saved** | Preferences read retrieves the current settings snapshot at the exact moment the preference category query runs. |
| **Telemetry Ingestion** | Telemetry recorded while export is serializing may either be included if already committed, or omitted. SQLite WAL guarantees zero database corruption. |
| **Data Cleanup (Step 45)** | If a user runs data cleanup while an export is running, the export query executes against its own read view. In practice, UI modal locks prevent triggering simultaneous destructive operations. |

