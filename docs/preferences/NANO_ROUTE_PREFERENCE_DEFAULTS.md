# Nano Route — Preference Defaults & Ergonomic Justification
**Step 66: Virtual Defaults Specification**

Every user preference in Nano Route is backed by a virtual default in `DEFAULT_APP_SETTINGS`. Defaults are carefully chosen to satisfy accessibility criteria, preserve existing product ergonomics, and maintain application security.

---

## 1. Defaults Table & Rationale

| Key | Default Value | Engineering & Ergonomic Justification |
|---|---|---|
| `appearance.theme_mode` | `"dark"` | Maintains Nano Route's primary visual identity with high-contrast surfaces (`#09090b`) minimizing eye strain. |
| `appearance.density` | `"comfortable"` | Ensures accessible touch targets (minimum 44px) and comfortable reading rhythm. |
| `appearance.reduced_motion` | `"system"` | Automatically respects Windows OS accessibility settings (`prefers-reduced-motion`) without requiring manual setup. |
| `appearance.text_scale` | `"100%"` | Standard typography scale matching high-DPI Windows desktop conventions. |
| `appearance.enhanced_focus` | `false` | Default subtle focus ring; high-visibility 3px focus ring available for motor/visual impairments. |
| `workspace.startup_route` | `"overview"` | Lands user on the comprehensive dashboard health and status overview on launch. |
| `workspace.sidebar_collapsed` | `false` | Displays full navigation labels for discoverability during routine navigation. |
| `workspace.confirm_chat_clear` | `true` | Prevents accidental loss of active conversation context. |
| `chat.show_timestamps` | `false` | Keeps conversation turns uncluttered by default while allowing audit precision when toggled. |
| `chat.compact_spacing` | `false` | Preserves standard conversational white space. |
| `chat.enter_to_send` | `true` | Standard desktop chat behavior (Enter sends, Shift+Enter adds newline). |
| `chat.auto_scroll_to_bottom` | `true` | Follows real-time streaming tokens without requiring manual scrolling, pausing when user scrolls up. |
| `notifications.enable_non_critical_toasts` | `true` | Informs user of routine completions and status changes while permitting quiet focus mode. |
| `notifications.toast_duration_ms` | `5000` | Sufficient time (5 seconds) to read short notifications comfortably. |
| `palette.show_descriptions` | `true` | Provides context on what each command performs. |
| `palette.show_shortcuts` | `true` | Aides shortcut discovery for keyboard-first efficiency. |

