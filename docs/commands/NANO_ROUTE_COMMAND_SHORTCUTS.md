# Nano Route — Global Keyboard Shortcuts & Accelerators
**Step 65: Desktop Keyboard Navigation & Accelerator Reference**

Nano Route adheres to standard Windows desktop accelerator ergonomics. All primary workflows can be invoked directly from the keyboard without requiring pointer interaction.

---

## 1. Global Accelerators

| Shortcut | Scope | Action |
|---|---|---|
| `Ctrl+K` | Global | Toggle Global Command Palette modal |
| `F1` | Global | Open Command Palette pre-filtered to Help, or navigate directly to Help Center |
| `Ctrl+D` | Global | Open Diagnostics Center |
| `Ctrl+1` | Global | Navigate to Dashboard Overview |
| `Ctrl+2` | Global | Navigate to Chat Workspace |
| `Ctrl+3` | Global | Navigate to Analytics & Telemetry |
| `Ctrl+,` | Global | Open Application Settings |
| `Ctrl+N` | Global | Start a New Chat Session |
| `Ctrl+Shift+N`| Global | Toggle Unified Notification Center Drawer |
| `Ctrl+Shift+T`| Global | Toggle Application Theme (Dark / Light) |

---

## 2. Command Palette Modal Navigation

When the Command Palette modal is open:

| Key | Function |
|---|---|
| `Escape` | Close the Command Palette modal and restore focus to trigger |
| `ArrowDown` / `Tab` | Advance selection to next command item |
| `ArrowUp` / `Shift+Tab` | Move selection to previous command item |
| `Enter` | Execute selected command and close modal |
| `Home` / `End` | Jump to first / last command in filtered list |
| Typing text | Filters commands in real time with lexical scoring |

---

## 3. Conflict Prevention & OS Interoperability
- **Native Input Protection**: Single-key accelerators are suppressed when the user is focused inside an `HTMLInputElement` or `HTMLTextAreaElement` (except `Ctrl+K`, `F1`, and `Escape`).
- **No System Shadowing**: Shortcuts avoid collisions with Windows OS defaults (e.g. `Ctrl+Alt+Del`, `Win+L`, `Alt+F4`).
- **Standard Platform Alignment**: `Ctrl+,` matches Windows desktop settings conventions; `F1` conforms to standard Windows Help invocation.

