# Nano Route — Workspace Session Restore Policy

**Document Reference:** `docs/session/NANO_ROUTE_SESSION_RESTORE_POLICY.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 68  
**Authoritative Operational Policy**  

---

## 1. Overview & Policy Objective

This policy defines the precise boundaries, criteria, and precedence rules governing the restoration of workspace state in Nano Route. The objective is to restore user presentation context predictably across desktop sessions while guaranteeing zero persistence of sensitive secrets, zero restoration of transient runtime connections, and absolute protection against crash loops.

---

## 2. Restored vs. Non-Restored State Matrix

| State Category | Restored On Startup? | Justification & Architectural Boundary |
| :--- | :---: | :--- |
| **Last Safe Route** | **YES** | Restores user location (e.g., `/chat`, `/history`, `/settings`, `/help`) if allowlisted. |
| **Sidebar Layout** | **YES** | Restores collapsed/expanded visual presentation state. |
| **Active Profile ID** | **YES** | Preserves user's chosen workspace profile identifier (`default`, `focus`, `compact`, etc.). |
| **Selected Settings Tab** | **YES** | Returns user to the specific settings section they were configuring (`general`, `models`, etc.). |
| **Selected History Filter** | **YES** | Restores sanitized search/filter query in the conversation history explorer. |
| **Active Chat Stream** | **NO (FORBIDDEN)** | Active SSE network streams, Tokio task handles, and socket connections are never resumed. |
| **Inference Runtime Engine** | **NO (FORBIDDEN)** | DirectML session state, ONNX weights, and GPU execution contexts are re-initialized clean. |
| **Uncommitted DB Locks** | **NO (FORBIDDEN)** | In-flight SQLite transactions roll back safely via WAL journal on process restart. |
| **API Keys & DPAPI Data** | **NO (FORBIDDEN)** | Credentials, bearer tokens, and DPAPI ciphertexts are strictly barred from session JSON. |
| **Conversation Messages** | **NO (DECOUPLED)** | History messages reside in the authoritative SQLite `conversations` table, not session snapshots. |
| **Unsent Prompt Drafts** | **NO** | In accordance with Section 6, no prompt draft persistence existed prior to Step 68, and none is introduced. |

---

## 3. Strict Startup Precedence Hierarchy

On desktop boot, the session initialization engine evaluates conditions in strict sequence. Lower-numbered conditions unconditionally preempt higher-numbered conditions:

```
[Level 1: Critical System Recovery]
   └─ Step 53 Disaster Recovery or Step 52 Update Rollback active?
      └─ YES -> Suppress all session restoration. Route to recovery/update workflow.

[Level 2: Mandatory First-Run Onboarding]
   └─ Step 61 Onboarding incomplete (settings.onboarding_completed == false)?
      └─ YES -> Route to '/' and present mandatory Onboarding Wizard.

[Level 3: User Opt-Out Preference]
   └─ User set workspace.restore_previous_session == false?
      └─ YES -> Honor workspace.startup_route ('overview' -> '/', 'chat' -> '/chat').

[Level 4: Crash Marker & Unexpected Exit]
   └─ workspace.last_exit_status == 'unexpected_exit'?
      └─ YES -> If route was a complex configuration view (/settings, /models, /providers),
                fall back to '/' (Dashboard) to prevent repeat crashes.

[Level 5: Valid Allowlisted Session Snapshot]
   └─ Valid payload, correct schema ('nano-route-workspace-session-v1'), route allowlisted?
      └─ YES -> Restore route, active profile, sidebar state, and view parameters.

[Level 6: Safe System Default]
   └─ Missing, corrupted, invalid, or expired session snapshot?
      └─ YES -> Route to '/' (Dashboard).
```

---

## 4. Route Allowlist & Parameter Sanitization

To eliminate URL manipulation, script injection, and invalid deep-linking:
- Only routes explicitly enumerated in `ROUTE_ALLOWLIST` are accepted:
  - `/` (Overview / Dashboard)
  - `/chat` (Chat Workspace)
  - `/history` (Conversation History)
  - `/analytics` (Cost & Latency Analytics)
  - `/models` (Model Registry)
  - `/providers` (Provider Management)
  - `/settings` (Application Settings)
  - `/help` (Help & Knowledge Base)
- Paths containing HTML/script tags (`<script>`, `</script>`, etc.) or unknown route stems are immediately rejected and replaced with `/`.
- Query parameters are strictly sanitized:
  - `/settings?tab=<val>`: Tab value must match known setting panel identifiers.
  - `/help?article=<id>`: Article ID must be an alphanumeric/hyphenated slug.
  - `/history?q=<filter>`: Filter string must not exceed 256 characters and is stripped of markup tags.

---

## 5. Streaming & Task Safety Rules

1. **Previous Streams are Terminated:** Any generation that was underway when the application closed or crashed is treated as permanently ended.
2. **No Falsely Active UI Indicators:** The UI must never display "Generating...", "Thinking...", or an active abort button on startup.
3. **Partial Message Handling:** Any partial response persisted by the streaming chunk accumulator prior to termination remains in SQLite history as a completed or interrupted message, with no active network reconnection attempt.

