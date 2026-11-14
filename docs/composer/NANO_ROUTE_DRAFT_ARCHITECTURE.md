# Nano Route — Composer Draft Architecture Specification
**Step 78 — Authoritative Architecture Specification**

## 1. Architectural Scope & Positioning
Composer Draft Persistence operates strictly within the local composition environment of Nano Route:

```
+-----------------------------------------------------------------------------------+
|                        COMPOSER DRAFT SUBSYSTEM (STEP 78)                         |
|                                                                                   |
|  [ User Typing / Keyboard Input ]                                                 |
|          |                                                                        |
|          v                                                                        |
|  [ In-Memory Undo/Redo Stacks ] (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)                  |
|          |                                                                        |
|          v                                                                        |
|  [ Debounced Autosave Pipeline (500ms) ]                                          |
|          |                                                                        |
|          v                                                                        |
|  [ SQLite `composer_drafts` / Draft Engine ]                                      |
|  - Per-session association (CASCADE delete)                                       |
|  - Global scratchpad draft (session_id IS NULL)                                   |
|  - Status: SAVED, SAVING, DIRTY, RECOVERED, ERROR                                 |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                   | (Explicit Send Button / Enter)
                                   v
+-----------------------------------------------------------------------------------+
|                     DOWNSTREAM PIPELINE (STEPS 74 - 77)                           |
|                                                                                   |
|  [ Step 76 Context Preflight ] -> [ Step 75 Budget Enforcement ]                  |
|                                   |                                               |
|                                   v                                               |
|  [ SLM Routing / Override ] -> [ Network Execution ] -> [ Clear Draft ]           |
|                                                                                   |
+-----------------------------------------------------------------------------------+
```

## 2. Inviolable Guarantees
1. **Never a Submitted Request**: An autosaved draft remains purely an unsent composition draft. It is never routed to cloud providers or local SLMs.
2. **Zero Premature Costs**: No tokens, latency, cost, or budget reservations are incurred during draft typing or persistence.
3. **Cascading Safety**: Deleting a session in Nano Route automatically cascades to purge its associated draft via SQLite foreign-key constraints.
4. **Isolated Credentials**: Draft persistence never interacts with Windows DPAPI or secret stores.

