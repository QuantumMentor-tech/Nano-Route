# Nano Route — Step 82 Pre-Implementation Audit & Baseline
**Conversation Bookmarks, Highlights, Saved Notes, Anchors & Structured Chat Organization**

## 1. Current State Assessment
- **Message Rendering & Actions**:
  - `AssistantMessage.tsx` features copy buttons, metadata badge, routing explanation panel, and response variant navigation `< 1 / N >`.
  - `UserMessage.tsx` renders user prompt cards with retry action.
  - `MessageTimeline.tsx` renders full conversation streams and supports jumping to anchor messages via `focusMessageId`.
- **Search & History Systems**:
  - Step 41 History Explorer provides session listing, full-text message search, and pin controls.
  - Step 68 Session Continuity preserves recent workspace route and open sessions.
- **Identified Requirements (Step 82)**:
  - Add bookmarks, visual highlights, and private notes attached to message IDs without altering underlying message content.
  - SQLite migration `010_conversation_organization.sql` defining `conversation_bookmarks` and `conversation_notes`.
  - In-memory & SQLite-backed organization engine supporting search, filtering, and CRUD operations.
  - Visual bookmark action in message headers with active indicator.
  - Exact anchor navigation (`focusMessageId` scroll & brief highlight).

## 2. Inviolable Guarantees
1. **Never a Modified Message**: Canonical message text in `chat_messages` remains untouched.
2. **Zero Provider Context Exposure**: User-authored private notes and bookmarks are NEVER transmitted to external LLM providers, never included in prompt context, and never fed into SLM routing models.
3. **Cascading Safety**: Deleting a session or message automatically cascades to delete associated bookmarks and notes via foreign keys.
4. **Deterministic Lineage**: Bookmarks record both `session_id`, `message_id`, and optional `branch_id`.

