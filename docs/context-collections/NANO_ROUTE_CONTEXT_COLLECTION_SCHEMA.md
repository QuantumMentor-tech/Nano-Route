# Nano Route — Context Collections Schema Specification

## 1. Relational Schema Definition
Defined in `011_context_collections.sql`:

```sql
CREATE TABLE IF NOT EXISTS context_collections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_context_collections_favorite
    ON context_collections(is_favorite);

CREATE TABLE IF NOT EXISTS context_collection_items (
    id TEXT PRIMARY KEY NOT NULL,
    collection_id TEXT NOT NULL,
    source_type TEXT NOT NULL, -- 'MESSAGE', 'MESSAGE_EXCERPT', 'NOTE', 'ATTACHMENT_REFERENCE'
    source_id TEXT NOT NULL,
    session_id TEXT NULL,
    branch_id TEXT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    label TEXT NULL,
    excerpt_text TEXT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(collection_id) REFERENCES context_collections(id) ON DELETE CASCADE,
    FOREIGN KEY(session_id) REFERENCES chat_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY(branch_id) REFERENCES conversation_branches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_context_collection_items_coll
    ON context_collection_items(collection_id);

CREATE INDEX IF NOT EXISTS idx_context_collection_items_source
    ON context_collection_items(source_id);

CREATE INDEX IF NOT EXISTS idx_context_collection_items_session
    ON context_collection_items(session_id);
```

## 2. Integrity & Deletion Invariants
- Parent deletion of a `context_collection` cascades directly to its items in `context_collection_items`.
- Deletion of an underlying session in `chat_sessions` sets `session_id` to `NULL`, maintaining the item's historical record and flagging it as `STALE` on next resolution.
- Deletion of an item from a collection re-indexes all remaining item positions from `0` to `n - 1`.

