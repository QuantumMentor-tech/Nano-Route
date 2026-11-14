# Nano Route — Private Note Policy
**Step 82 — Authoritative Note Specification**

## 1. Storage & Boundaries
- User notes are stored in `conversation_notes` referenced by `message_id` and `session_id`.
- Notes represent personal annotations and thoughts of the user.
- Notes are strictly isolated from prompts: they are NEVER sent to cloud LLMs or local SLMs as request context.

## 2. Invariants
- Editing a note updates only `conversation_notes.content` and `updated_at`.
- Deleting a note leaves the referenced chat message completely intact.

