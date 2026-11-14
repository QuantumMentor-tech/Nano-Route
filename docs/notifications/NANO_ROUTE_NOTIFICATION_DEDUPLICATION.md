# NANO ROUTE — NOTIFICATION DEDUPLICATION & FLOOD CONTROL
## Step 64 Deduplication Keys, Coalescing Rules & Spam Prevention

---

## 1. DEDUPLICATION KEY CONSTRUCTION

Every notification emitted in Nano Route is mapped to a deterministic deduplication key via `buildDedupeKey`:

$$\text{DedupeKey} = \text{source}.\text{toLowerCase()} + \text{"\_"} + \text{severity} + \text{"\_"} + \text{normalize}(\text{title}) + \text{normId}$$

Where:
- `normalize(title)`: Converts title to lowercase, trims whitespace, and replaces consecutive spaces with underscores.
- `normId`: Optional trailing identifier (e.g. `_openai`, `_db001`) to distinguish distinct entities under identical titles.

---

## 2. COALESCING RULES

When `publish()` is called with a deduplication key that matches an active, unresolved notification in state:

1. **Occurrence Increment**: The existing notification's `occurrenceCount` increments by 1 (e.g. `×2`, `×3`).
2. **Timestamp Refresh**: `createdAt` updates to the latest event timestamp.
3. **Message Update**: The message body and technical details update to the newest sanitized text.
4. **Unread Transition**: If previously marked read, it transitions back to `unread` to ensure user visibility.
5. **No Duplicate UI Stacking**: Zero new toast elements or duplicate list items are appended to the DOM.

---

## 3. FLOOD PROTECTION BOUNDARIES

- **Toast Stack Limit**: Exactly 5 toasts maximum visible at any moment. When a 6th toast arrives, the oldest is dropped.
- **Persistent Storage Limit**: Exactly 50 persistent notification records retained in `localStorage`. Older resolved notices are pruned FIFO.

