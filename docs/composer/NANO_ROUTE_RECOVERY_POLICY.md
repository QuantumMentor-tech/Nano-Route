# Nano Route — Composer Draft Recovery Policy
**Step 78 — Authoritative Recovery Specification**

## 1. Crash Recovery & Session Continuity
Nano Route protects user work against unexpected crashes or OS restarts:
1. **Detection**: Upon mounting `ChatStudio` or activating a session, the draft engine queries `composer_drafts` for unsubmitted drafts.
2. **Recovered Status**: If an unsubmitted draft exists, it is loaded into the Composer and badged with `Draft recovered` (`RECOVERED`).
3. **User Agency**:
   - The user can review the restored text.
   - The user can edit the text further.
   - The user can click `Discard` to permanently delete the draft.
   - The user can click Send (`Enter`) to submit through Step 76 Context Preflight.
4. **Zero Auto-Send**: Nano Route NEVER submits a recovered draft automatically.

