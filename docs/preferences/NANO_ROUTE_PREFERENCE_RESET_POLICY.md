# Nano Route — Preference Reset Policy & Scope Separation
**Step 66: Scope Separation & Data Safety Guarantees**

## 1. Reset Scopes & Boundaries

Nano Route strictly segregates **UI preference resets** from **data-destructive operations**. Users can safely reset appearance or workspace settings without fear of losing credentials, chat history, or local telemetry.

---

## 2. Reset Operations Matrix

| Operation | Affected Settings | Preserved Data | User Confirmation Required |
|---|---|---|---|
| **Reset Appearance** | `appearance.*` (theme, density, motion, text scale, focus ring) | All other settings, credentials, chat history, telemetry | Inline confirmation |
| **Reset Chat** | `chat.*` (timestamps, compact spacing, enter to send, auto-scroll) | Chat history messages, credentials, telemetry | Inline confirmation |
| **Reset Notifications** | `notifications.*` (toast suppression, toast duration) | Notification history, credentials, telemetry | Inline confirmation |
| **Reset Workspace** | `workspace.*` (startup route, sidebar state, confirmation prompts) | Credentials, chat history, telemetry | Inline confirmation |
| **Reset All Preferences** | All `appearance.*`, `workspace.*`, `chat.*`, `notifications.*`, `palette.*`, `general.*` | **API Credentials (DPAPI)**, **Chat History**, **Telemetry Records**, **Model Registry**, **Backups** | Modal dialog confirmation |
| **Data Lifecycle Wipe** (Step 45) | Chat messages, session records, telemetry tables | Explicit separate operation in Privacy panel | High-friction typing confirmation |

---

## 3. Strict Safety Invariants
1. `resetSettingsSection()` and `resetAllUserPreferences()` only execute `DELETE FROM app_settings WHERE key = ?`.
2. Provider credential rows in DPAPI storage are NEVER dropped or touched.
3. Conversation sessions and message records are NEVER purged during a preference reset.
4. Telemetry logs and analytics metrics remain intact.

