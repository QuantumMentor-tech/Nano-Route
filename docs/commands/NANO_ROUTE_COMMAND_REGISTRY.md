# Nano Route — Command Palette Registry Specification
**Step 65: Authoritative Command Registry Reference**

The authoritative Command Registry is defined in `src/features/commands/registry.ts`. All commands are statically validated, unique by identifier, categorized, and decorated with search keywords and shortcut hints.

---

## 1. Registry Table

| ID | Title | Category | Shortcut | Target / Action | Required Context |
|---|---|---|---|---|---|
| `nav.dashboard` | Go to Dashboard Overview | Navigation | `Ctrl+1` | Tab: `overview` | `always` |
| `nav.chat` | Go to Chat Workspace | Navigation | `Ctrl+2` | Tab: `chat` | `always` |
| `nav.analytics` | Go to Analytics & Telemetry | Navigation | `Ctrl+3` | Tab: `analytics` | `always` |
| `nav.providers` | Go to Model Providers | Navigation | - | Tab: `providers` | `always` |
| `nav.diagnostics` | Open Diagnostics Center | Diagnostics | `Ctrl+D` | Tab: `diagnostics` | `always` |
| `nav.help` | Open Help Center | Help | `F1` | Tab: `help` | `always` |
| `nav.settings` | Open Settings | Settings | `Ctrl+,` | Tab: `settings` | `always` |
| `action.new_chat` | Start New Chat Session | Actions | `Ctrl+N` | Dispatch: `start_new_chat` | `always` |
| `action.toggle_notifications` | Toggle Notification Center | Actions | `Ctrl+Shift+N`| Dispatch: `toggle_notifications` | `always` |
| `action.run_diagnostics` | Run All Diagnostic Self-Tests | Diagnostics | - | Dispatch: `run_all_diagnostics` | `always` |
| `action.export_bundle` | Export Diagnostic Support Bundle | Diagnostics | - | Dispatch: `export_support_bundle` | `always` |
| `action.toggle_theme` | Toggle Dark / Light Theme | Actions | `Ctrl+Shift+T`| Dispatch: `toggle_theme` | `always` |
| `action.clear_chat` | Clear Current Chat | Actions | - | Dispatch: `clear_current_chat` | `chat_active` |
| `action.emergency_recovery` | Emergency Disaster Recovery | Recovery | - | Dispatch: `open_disaster_recovery`| `always` |
| `settings.general` | Settings: General Configuration | Settings | - | Tab: `settings.general` | `always` |
| `settings.providers` | Settings: API Providers & Keys | Settings | - | Tab: `settings.providers` | `always` |
| `settings.routing` | Settings: Routing Rules & Tiering| Settings | - | Tab: `settings.routing` | `always` |
| `settings.slm` | Settings: Local SLM Engine | Settings | - | Tab: `settings.slm` | `always` |
| `settings.privacy` | Settings: Privacy & Data Retention| Settings | - | Tab: `settings.privacy` | `always` |
| `settings.updates` | Settings: Software Updates | Settings | - | Tab: `settings.updates` | `always` |
| `help.quickstart` | Help: Quickstart Guide | Help | - | Tab: `help.quickstart` | `always` |
| `help.troubleshooting` | Help: Troubleshooting Knowledge Base | Help | - | Tab: `help.troubleshooting` | `always` |
| `help.providers` | Help: Provider Configuration Guides | Help | - | Tab: `help.providers` | `always` |
| `help.shortcuts` | Help: Keyboard Shortcuts Guide | Help | - | Tab: `help.shortcuts` | `always` |

---

## 2. Invariants
1. **Uniqueness**: Every command ID is unique across the entire application.
2. **Category Compliance**: Every command belongs strictly to one of the defined `CommandCategory` enums.
3. **No Dynamic Code Injection**: Targets represent predetermined string discriminators executed through existing application routing or state handlers.

