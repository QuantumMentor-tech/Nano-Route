# Nano Route — Authoritative Session State Classification Catalog

**Document Reference:** `docs/session/NANO_ROUTE_SESSION_STATE_CATALOG.md`  
**Application:** Nano Route Desktop (Windows 10/11 x64, Tauri v2)  
**Implementation Phase:** Step 68  
**Authoritative Taxonomy & Field Specification**  

---

## 1. Five-Tier Architectural State Classification

Every state field across Nano Route is categorized into one of five architectural tiers:

1. **`PERSISTENT_PREFERENCE`:** Long-lived user configurations saved in SQLite `app_settings` and managed by Step 66 (e.g. Theme, Font Scale, Notification Durations).
2. **`SESSION_STATE`:** Lightweight, non-sensitive context captured in the Step 68 session snapshot (`workspace.session_state`) to restore the user's active view after restart.
3. **`DERIVED_STATE`:** Ephemeral values computed on demand at runtime (e.g. background health indicators, candidate model scores, filtered lists).
4. **`TRANSIENT_RUNTIME_STATE`:** Active in-flight operations that terminate upon process exit and must **never** be restored (e.g. live SSE streaming flags, open modals, dropdown menus).
5. **`FORBIDDEN_TO_RESTORE`:** Sensitive data structures, credentials, or OS handles that must never participate in session persistence (e.g. DPAPI keys, access tokens, Tokio tasks, native memory pointers).

---

## 2. Complete Field Specification Catalog

| Field | Tier | Type | Allowed Values | Persistence Rule | Restoration Rule | Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`route`** | `SESSION_STATE` | `string` | Safe allowlisted routes: `/`, `/chat`, `/history`, `/settings`, `/license`, `/about`, `/contact`, `/diagnostics`, `/help` (with sanitized query params) | Debounced write upon route change. | Restored if route is in allowlist; otherwise fallback to `/`. | `'/'` |
| **`activeProfileId`** | `SESSION_STATE` | `string` | Valid profile ID matching `/^[a-zA-Z0-9_.-]+$/` | Saved on profile switch. | Restored if profile exists; fallback to default preset. | `'prof_default'` |
| **`sidebarCollapsed`** | `SESSION_STATE` | `boolean` | `true`, `false` | Saved on sidebar toggle. | Restored if viewport allows. | `false` |
| **`activeChatSessionId`**| `SESSION_STATE` | `string` | UUID or alphanumeric ID | Saved on session switch. | Re-selected if session exists in SQLite. | `undefined` |
| **`settingsTab`** | `SESSION_STATE` | `string` | `general`, `appearance`, `chat`, `notifications`, `profiles`, `providers`, `models`, `privacy`, `security` | Saved on tab switch. | Restored if tab is in allowlist. | `'general'` |
| **`historyFilter`** | `SESSION_STATE` | `string` | String `<= 64` chars | Debounced write. | Restored as search input filter. | `''` |
| **`helpArticleId`** | `SESSION_STATE` | `string` | Valid slug in `HELP_ARTICLES` | Saved on article selection. | Restored if slug exists in catalog. | `undefined` |
| **`windowState`** | `SESSION_STATE` | `object` | Maximized flag, bounds coordinates intersecting active monitor | Saved on controlled shutdown. | Restored if bounds are on active monitor. | Centered window |
| **`theme_mode`** | `PERSISTENT_PREFERENCE` | `string` | `dark`, `light`, `system` | Step 66 `app_settings` | Governed by PreferencesContext. | `'dark'` |
| **`density`** | `PERSISTENT_PREFERENCE` | `string` | `comfortable`, `compact` | Step 66 `app_settings` | Governed by PreferencesContext. | `'comfortable'` |
| **`restore_previous_session`** | `PERSISTENT_PREFERENCE` | `boolean`| `true`, `false` | Step 66 `app_settings` | Governs whether Step 68 session restore executes on startup. | `true` |
| **`systemHealth`** | `DERIVED_STATE` | `object` | `Ready`, `Degraded`, `Failed` | NEVER persisted. | Computed dynamically on boot. | `Initializing` |
| **`candidateScores`** | `DERIVED_STATE` | `array` | Computed floats `[0.0 - 1.0]` | NEVER persisted. | Computed on demand per prompt submission. | `[]` |
| **`isStreaming`** | `TRANSIENT_RUNTIME_STATE`| `boolean`| `N/A` | NEVER persisted. | ALWAYS resets to `false` on restart. | `false` |
| **`commandPaletteOpen`**| `TRANSIENT_RUNTIME_STATE`| `boolean`| `N/A` | NEVER persisted. | ALWAYS false on startup. | `false` |
| **`toastQueue`** | `TRANSIENT_RUNTIME_STATE`| `array` | `N/A` | NEVER persisted. | ALWAYS empty on startup. | `[]` |
| **`dpapi_keys`** | `FORBIDDEN_TO_RESTORE` | `bytes` | `N/A` | Windows DPAPI Vault ONLY. | NEVER in session snapshots. | `N/A` |
| **`tokio_tasks`** | `FORBIDDEN_TO_RESTORE` | `handle`| `N/A` | NEVER persisted. | Native process handles cannot be serialized. | `N/A` |
| **`prompt_drafts`** | `FORBIDDEN_TO_RESTORE` | `string` | `N/A` | NEVER persisted. | Prompt input box starts empty. | `''` |

