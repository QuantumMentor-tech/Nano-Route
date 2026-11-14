# NANO ROUTE — NOTIFICATION STATE MODEL & TAXONOMY
## Step 64 Authoritative Notification Types, Severities & Delivery Modes

---

## 1. SEVERITY TAXONOMY

| Severity | Color & Icon Token | ARIA Role | Live Announcement | Default Delivery |
| :--- | :--- | :--- | :--- | :--- |
| **`info`** | Blue / `Info` | `status` | `polite` | Toast (4,000 ms) |
| **`success`** | Green / `CheckCircle2` | `status` | `polite` | Toast (4,000 ms) |
| **`warning`** | Yellow / `AlertTriangle` | `alert` | `polite` | Persistent Toast + Center |
| **`error`** | Red / `AlertCircle` | `alert` | `assertive` | Toast (6,000 ms) + Center |
| **`critical`** | Dark Red / `ShieldAlert` | `alert` | `assertive` | Top-Level Banner + Center |

---

## 2. DELIVERY MODES

1. **`toast`**: Transient, non-blocking feedback positioned at the bottom-right viewport. Automatically dismisses after `durationMs` (paused on mouse hover). Maximum stack limit: 5.
2. **`banner`**: Persistent top-level full-width alert bar rendered above application navigation for critical states (e.g. database locks, interrupted recovery).
3. **`dialog`**: Modal confirmation reserved for destructive actions (e.g. database wipe, backup restoration).
4. **`persistent`**: Silently enqueued into the Notification Center drawer without displaying a transient toast popup.

---

## 3. NOTIFICATION LIFECYCLE STATES

```
[Trigger Event]
       │
       ▼
 [ dedupeKey check ] ──(Match)──► Increment occurrenceCount & update timestamp
       │ (New)
       ▼
    [UNREAD] ──(User opens drawer)──► [READ]
       │                                │
       ▼ (User dismisses)               ▼ (User dismisses)
  [DISMISSED] ◄─────────────────────────┘
       │
       ▼ (Underlying issue clears via subsystem)
  [RESOLVED]
```

