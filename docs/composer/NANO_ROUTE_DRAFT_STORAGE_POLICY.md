# Nano Route — Composer Draft Storage Policy
**Step 78 — Authoritative Storage Specification**

## 1. Relational Database Schema
Migration: `src-tauri/src/storage/migrations/008_composer_drafts.sql`

```sql
CREATE TABLE IF NOT EXISTS composer_drafts (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NULL,
    content TEXT NOT NULL,
    template_id TEXT NULL,
    preset_id TEXT NULL,
    revision INTEGER NOT NULL DEFAULT 1,
    is_recovered INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY(template_id) REFERENCES prompt_templates(id) ON DELETE SET NULL,
    FOREIGN KEY(preset_id) REFERENCES request_presets(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_composer_drafts_session_unique
    ON composer_drafts(session_id);

CREATE INDEX IF NOT EXISTS idx_composer_drafts_updated_at
    ON composer_drafts(updated_at DESC);
```

## 2. Retention & Cleanup Invariants
1. **Single Draft Constraint**: Each conversation session possesses at most one active draft. At most one global scratchpad draft is retained for unassigned prompts.
2. **Cascading Deletion**: Removing a chat session automatically drops its associated draft through SQLite `ON DELETE CASCADE`.
3. **Empty String Pruning**: When draft text is emptied (length 0) or submitted, the draft record is cleared immediately from persistent storage.

