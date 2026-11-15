# Nano Route — Execution Recovery Policy

## 1. Crash & Shutdown Recovery Philosophy
When the Nano Route desktop application closes, crashes, or is restarted while background operations or chat requests are in-flight, the system must recover reliably without causing accidental data loss, duplicate provider billing, or phantom background loops.

## 2. Recovery Rules
1. **Never Resubmit In-Flight Operations Automatically**:
   - Resubmitting prompt executions automatically could trigger duplicate provider charges, execute unintended side-effects, or send stale prompts.
   - All in-flight tasks detected on startup are safely marked `INTERRUPTED`.
2. **Explicit Recovery Flag (`recoverable: true`)**:
   - The user is presented with the interrupted task in the Active Request Center.
   - A direct "Retry" button allows the user to re-invoke the prompt manually with full awareness.
3. **Session State Cleanup**:
   - Any transient placeholder assistant messages are cleanly marked `isCancelled` or converted to safe error states in the chat session.
4. **Stale Task Sweeper (`detectAndMarkStaleTasks`)**:
   - Invoked during app initialization to purge orphaned active tasks and record diagnostic events.

