# Nano Route — Context Source Resolution Policy

## 1. Supported Source Types
1. **MESSAGE:** Full canonical turn (user or assistant) referencing `chat_messages.id`.
2. **MESSAGE_EXCERPT:** Specific user-selected passage from a message. The excerpt text is captured alongside the message ID; if the source message is deleted, the excerpt persists as a snapshot flagged as `STALE`.
3. **NOTE:** User-authored private notes from Step 82. Strictly requires explicit user addition and displays sensitivity warnings in the UI and materialization report.
4. **ATTACHMENT_REFERENCE:** Approved local file context from Step 79. Resolves text content or structured representation.

## 2. Staleness Lifecycle
- **VALID:** The source entity exists in the local database and its content is successfully resolved.
- **STALE:** The source entity was deleted, moved, or altered. The collection retains the reference and provides a human-readable fallback notice.
- **UNAVAILABLE:** The source system is temporarily inaccessible.
- **INVALID:** Corrupt or unknown source type.

## 3. Immutability Contract
Source resolution is read-only. Resolving a collection item never mutates the underlying `chat_messages`, `conversation_notes`, or attachment artifacts.

