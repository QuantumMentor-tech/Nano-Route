# NANO ROUTE — NOTIFICATION RETENTION & CLEANUP
## Step 64 Storage Limits, Pruning Policies & Privacy Lifecycle

---

## 1. RETENTION LIMITS

| Record Type | In-Memory Bounds | Persistent Storage Bounds | Expiration / Pruning Policy |
| :--- | :--- | :--- | :--- |
| **Transient Toasts** | Max 5 concurrent | Not persisted (transient) | Dismissed after 4–6s or on manual click |
| **Warning / Error Notices** | Full array | Max 50 records in `localStorage` | Retained until marked dismissed or resolved |
| **Critical System Banners** | 1 active banner | Persisted until resolved | Stays pinned until root cause is fixed |

---

## 2. PRIVACY & DATA WIPE INTEGRATION

When the user initiates a full data wipe or privacy reset from Settings (`/settings?tab=privacy`), the notification subsystem integrates seamlessly:

- `clearAll()` empties in-memory notification arrays and wipes `nr_persistent_notifications_v1` from `localStorage`.
- Resetting notification state does not touch SQLite conversation records, DPAPI credentials, or telemetry databases.

