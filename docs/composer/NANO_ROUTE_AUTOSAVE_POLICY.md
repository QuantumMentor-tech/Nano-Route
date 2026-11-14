# Nano Route — Composer Autosave Policy
**Step 78 — Authoritative Autosave Specification**

## 1. Debounced Lifecycle
To prevent write storms and UI stutter during rapid keystrokes:
1. **Debounce Interval**: 500 milliseconds.
2. **Lifecycle States**:
   - `IDLE`: Composer is blank or no unsaved edits exist.
   - `DIRTY`: User typed or modified content; autosave timer initiated.
   - `SAVING`: Debounce elapsed; persisting latest revision.
   - `SAVED`: Persistence confirmed; UI badge indicates checkmark.
   - `ERROR`: Persistence encountered an I/O failure; in-memory text preserved.
   - `RECOVERED`: Session restored an unsent draft after application restart.

## 2. Session Switching & Safe Flush
When switching between chat sessions:
- The hook flushes any dirty in-memory content of the previous session before loading the next session's draft.
- Undo/redo stacks are scoped to the active editing session and cleared on switch.

