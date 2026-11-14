# Nano Route — User Preferences & Workspace Personalization Architecture
**Step 66: Architectural Specification & Implementation Invariants**

## 1. Architectural Role & Boundary

The User Preferences system in Nano Route operates strictly as an **interaction, presentation, and user experience configuration layer**. It empowers users to tailor the desktop interface to their ergonomics, display environments, accessibility requirements, and workspace habits without ever altering core application business logic.

```text
┌────────────────────────────────────────────────────────┐
│                   Desktop User Actions                 │
│         Settings UI / Command Palette / Hotkeys        │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             PreferencesProvider (React Context)        │
│   • Live Reactive State (AppSettingsSnapshot)          │
│   • Real-time DOM attribute updates (data-theme, etc.) │
│   • System Media Query Watchers (Theme, Motion)        │
└───────────────┬───────────────────────────┬────────────┘
                │                           │
                ▼                           ▼
┌──────────────────────────────┐ ┌──────────────────────┐
│  IPC / SQLite Persistence    │ │  Document Root (CSS) │
│  app_settings (key, value)   │ │  Tokens & Densities  │
└──────────────────────────────┘ └──────────────────────┘
```

### Strict Non-Negotiable Invariants
- **No Business Logic Alteration**: Preferences never modify automatic routing scoring, model candidate selection, provider priority weightings, local SLM inference parameters, or DPAPI credential encryption.
- **Single Source of Truth**: The existing `app_settings` key-value table in SQLite serves as the authoritative persistence store. No fragmented `localStorage` configurations or conflicting stores are introduced.
- **Zero Secret Exposure**: Credentials, API keys, decrypted tokens, and security nonces are strictly barred from preference files, logs, telemetry, and export payloads.
- **Safe Fallback Resilience**: Malformed, missing, or corrupted persisted values always fallback safely to documented virtual defaults without throwing unhandled exceptions or crashing the startup lifecycle.

---

## 2. Preference Taxonomy

Preferences are logically grouped into five cohesive sections within the Settings Workspace:

1. **Appearance & Display**:
   - `appearance.theme_mode`: `"dark"` | `"light"` | `"system"`
   - `appearance.density`: `"comfortable"` | `"compact"`
   - `appearance.reduced_motion`: `"system"` | `"reduced"` | `"standard"`
   - `appearance.text_scale`: `"100%"` | `"110%"` | `"125%"`
   - `appearance.enhanced_focus`: `boolean`
2. **Workspace & Startup Behavior**:
   - `workspace.startup_route`: `"overview"` | `"chat"`
   - `workspace.sidebar_collapsed`: `boolean`
   - `workspace.confirm_chat_clear`: `boolean`
3. **Chat Presentation**:
   - `chat.show_timestamps`: `boolean`
   - `chat.compact_spacing`: `boolean`
   - `chat.enter_to_send`: `boolean`
   - `chat.auto_scroll_to_bottom`: `boolean`
4. **Notifications (Step 64 Integration)**:
   - `notifications.enable_non_critical_toasts`: `boolean`
   - `notifications.toast_duration_ms`: `1000..30000` (integer milliseconds)
5. **Command Palette (Step 65 Integration)**:
   - `palette.show_descriptions`: `boolean`
   - `palette.show_shortcuts`: `boolean`

---

## 3. Reactive Token Driving Mechanism

Presentation preferences are applied directly to `document.documentElement` attributes, driving centralized CSS variables defined in `src/styles/tokens.css`:

| Preference Key | Root Attribute | Effect on UI Tokens |
|---|---|---|
| `appearance.theme_mode` | `data-theme="dark\|light"` | Swaps surface, card, background, border, and text contrast tokens |
| `appearance.density` | `data-density="comfortable\|compact"` | Scales spacing tokens (`--nr-space-1..6`) |
| `appearance.reduced_motion` | `data-reduced-motion="reduced\|standard"` | Forces animation & transition duration to `0.001ms` |
| `appearance.text_scale` | `data-text-scale="100%\|110%\|125%"` | Scales global root typography scale |
| `appearance.enhanced_focus` | `data-enhanced-focus="true\|false"` | Renders prominent `3px` solid focus rings with offset |

