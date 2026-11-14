# Nano Route — Branch Lineage Policy
**Step 81 — Authoritative Lineage Specification**

## 1. Lineage Representation
- A branch points to a `root_message_id` within an existing session.
- Subtree messages inherit the conversational context of all messages up to `root_message_id`, followed by branch-specific continuation messages.
- Shared ancestry is referenced, never duplicated into redundant database rows.

## 2. Cascading Lifecycle Rules
- Deleting an entire session cascades to remove all associated branches via SQLite `ON DELETE CASCADE`.
- Deleting a branch removes only branch-owned continuation nodes; shared parent messages are preserved.

