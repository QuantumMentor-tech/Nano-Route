# Nano Route — Preference Catalog & Schema Specification
**Step 66: Authoritative User Preference Catalog**

The authoritative preferences catalog defines every user-configurable presentation and interaction setting in Nano Route.

---

## 1. Preferences Table

| Setting Key | Category | Type | Default | Allowed Values | Immediate / Restart | Security Classification |
|---|---|---|---|---|---|---|
| `appearance.theme_mode` | Appearance | ENUM | `"dark"` | `dark`, `light`, `system` | Immediate | Non-Sensitive |
| `appearance.density` | Appearance | ENUM | `"comfortable"` | `comfortable`, `compact` | Immediate | Non-Sensitive |
| `appearance.reduced_motion` | Appearance | ENUM | `"system"` | `system`, `reduced`, `standard` | Immediate | Non-Sensitive |
| `appearance.text_scale` | Appearance | ENUM | `"100%"` | `100%`, `110%`, `125%` | Immediate | Non-Sensitive |
| `appearance.enhanced_focus` | Appearance | BOOLEAN | `false` | `true`, `false` | Immediate | Non-Sensitive |
| `workspace.startup_route` | Workspace | ENUM | `"overview"` | `overview`, `chat` | Next Launch | Non-Sensitive |
| `workspace.sidebar_collapsed` | Workspace | BOOLEAN | `false` | `true`, `false` | Immediate | Non-Sensitive |
| `workspace.confirm_chat_clear` | Workspace | BOOLEAN | `true` | `true`, `false` | Immediate | Non-Sensitive |
| `chat.show_timestamps` | Chat | BOOLEAN | `false` | `true`, `false` | Immediate | Non-Sensitive |
| `chat.compact_spacing` | Chat | BOOLEAN | `false` | `true`, `false` | Immediate | Non-Sensitive |
| `chat.enter_to_send` | Chat | BOOLEAN | `true` | `true`, `false` | Immediate | Non-Sensitive |
| `chat.auto_scroll_to_bottom` | Chat | BOOLEAN | `true` | `true`, `false` | Immediate | Non-Sensitive |
| `notifications.enable_non_critical_toasts` | Notifications | BOOLEAN | `true` | `true`, `false` | Immediate | Non-Sensitive |
| `notifications.toast_duration_ms` | Notifications | NUMBER | `5000` | Integer: `1000..30000` | Immediate | Non-Sensitive |
| `palette.show_descriptions` | Palette | BOOLEAN | `true` | `true`, `false` | Immediate | Non-Sensitive |
| `palette.show_shortcuts` | Palette | BOOLEAN | `true` | `true`, `false` | Immediate | Non-Sensitive |

---

## 2. Invariants & Guardrails
- **Type Rigidity**: All preferences are strictly typed as enums, booleans, or bounded integers. Arbitrary free-form JSON strings or execution scripts are rejected.
- **Sensitive Separation**: Provider credentials, DPAPI keys, and secret authentication tokens never enter the preference catalog.

