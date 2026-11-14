# Nano Route — Workspace Session Schema Migration & Compatibility

**Document Reference:** `docs/session/NANO_ROUTE_SESSION_MIGRATION.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 68  
**Authoritative Migration Specification**  

---

## 1. Schema Versioning Design

Session continuity snapshots in Nano Route use an explicit envelope format and integer schema versioning:

- **Format Identifier:** `nano-route-workspace-session-v1`
- **Schema Version:** `1` (Integer)
- **Payload Size Ceiling:** 8,192 bytes (`MAX_SESSION_PAYLOAD_BYTES = 8192`)
- **Storage Target:** SQLite table `app_settings`, key `workspace.session_state`

### Snapshot Structure (v1)

```json
{
  "format": "nano-route-workspace-session-v1",
  "version": 1,
  "timestamp": 1731580000000,
  "route": "/settings",
  "activeProfileId": "default",
  "sidebarCollapsed": false,
  "settingsTab": "general",
  "historyFilter": "",
  "metadata": {
    "appVersion": "0.1.0",
    "platform": "windows"
  }
}
```

---

## 2. Forward & Backward Compatibility Rules

1. **Unknown Format Rejection:** If `format` is unrecognized or missing, the parser treats the session payload as invalid, emits an audit diagnostic, and falls back to `/`.
2. **Schema Version Compatibility:**
   - **`version === 1`:** Full validation against v1 schema.
   - **`version < 1`:** Considered legacy/obsolete; automatically discarded and replaced with default session snapshot.
   - **`version > 1` (Future Schema):** If a newer minor version is encountered that maintains top-level shape, valid known fields are retained and unknown fields are safely ignored without throwing. If major breaking alterations exist, safe fallback to `/` occurs.
3. **Obsolete or Renamed Fields:**
   - Any property in the JSON object not recognized in the active schema is stripped during parsing and will not be re-serialized.
   - Renamed fields in future migrations must specify explicit transform functions in `engine.ts`.

---

## 3. Corruption Recovery & Sanitization Pipeline

When reading `workspace.session_state` from SQLite at startup:

```
[Raw SQLite String]
       │
       ▼ (Length Check: length > 8192 bytes?)
  YES ──► Reject (oversized) -> Reset to default snapshot -> Log warning
       │
       ▼ (JSON.parse())
  SYNTAX ERROR ──► Reject (malformed JSON) -> Reset to default snapshot
       │
       ▼ (Shape & Type Validation)
  INVALID ENVELOPE ──► Format != 'nano-route-workspace-session-v1' or Version != 1
                       └─► Reset to default snapshot
       │
       ▼ (Route Validation & Sanitization)
  ROUTE NOT ALLOWLISTED / MALICIOUS ──► Replace route with SAFE_DEFAULT_ROUTE ('/')
       │
       ▼ (Field-Level Range Checks)
  INVALID TAB / MALFORMED QUERY ──► Sanitize / Strip invalid parameters
       │
       ▼
[Clean WorkspaceSessionSnapshot Loaded]
```

---

## 4. Reset & Cleanup Semantics

- **Command Palette Action:** Users can invoke `action-reset-workspace-session` ("Reset Workspace Session to Dashboard") at any time. This overwrites `workspace.session_state` with a blank string, effectively clearing saved navigation state while preserving all preferences and profiles.
- **Privacy Clear Data:** When executing a Step 50 / Step 60 privacy cleanup, `workspace.session_state` is included in the optional presentation cache cleanup targets.

