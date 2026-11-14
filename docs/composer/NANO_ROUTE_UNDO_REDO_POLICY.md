# Nano Route — Composer Undo & Redo Policy
**Step 78 — Authoritative Undo/Redo Specification**

## 1. Scope & In-Memory Stacks
Nano Route manages a dedicated in-memory history stack for the active Composer textarea:
- **Stack Limit**: Bounded at 50 snapshot states per session.
- **Trigger**: Recorded on distinct typing pauses or before non-continuous edits.
- **Shortcuts Supported**:
  - `Ctrl+Z`: Undo last text edit.
  - `Ctrl+Y` / `Ctrl+Shift+Z`: Redo previously undone edit.
- **Session Boundary**: Undo/redo history is strictly scoped to the active conversation draft and does not leak or cross over to other sessions.

## 2. Inviolable Isolation
Undo and redo operations ONLY affect the text currently within the Composer input. They never:
- Undo sent chat messages in the conversation timeline.
- Revert completed database transactions or settings.
- Cancel or undo provider streaming execution.

