# Nano Route Keyboard-First Navigation & Shortcut Guide

## 1. Overview
Nano Route is fully operational via keyboard alone, adhering to standard Windows desktop interaction paradigms. Users who cannot or prefer not to use a pointing device can perform every task — including prompt submission, session history search, provider configuration, model selection, backup creation, and update installation.

---

## 2. Standard Navigation Key Mappings

| Key / Shortcut | Context | Action |
|:---|:---|:---|
| **Tab** | Global | Moves keyboard focus forward to the next interactive control in natural DOM order. |
| **Shift + Tab** | Global | Moves keyboard focus backward to the previous interactive control. |
| **Enter** | Buttons / Links / Dialogs | Activates the focused button or link. In single-line forms, submits the form. |
| **Space** | Buttons / Checkboxes | Toggles checkboxes, expands accordions, or triggers buttons. |
| **Escape** | Modals / Menus / Dropdowns | Closes the open overlay, dialog, or dropdown and restores focus to the trigger. |
| **Arrow Down / Up** | Dropdowns / Menus / Lists | Traverses through enabled options in menus, tabs, and model catalogs. |
| **Home / End** | Menus / Text inputs | Jumps to the first or last item in a list; jumps to start/end of a text input line. |
| **Ctrl + Enter** | Chat Prompt Textarea | Submits the active chat prompt to the routing engine. |
| **Shift + Enter** | Chat Prompt Textarea | Inserts a newline character without submitting the prompt. |

---

## 3. Core Keyboard Workflow Audits

### 3.1 Chat Studio Workflow
1. Press `Tab` until focus enters the Sidebar Navigation.
2. Select **Chat** (`Enter`).
3. Focus moves to the Chat Prompt textarea.
4. Type user prompt: `"Explain SQLite write-ahead logging"`.
5. Press `Ctrl + Enter` (or `Tab` to Send Button and press `Enter`).
6. Assistant begins streaming. Screen reader announces: *"Assistant response started..."*.
7. Focus remains in the prompt area or on the Cancel button.
8. Upon completion, screen reader announces: *"Assistant response completed. Generated 142 tokens."*.

### 3.2 History Search & Filter Workflow
1. Navigate to **History** via Sidebar.
2. Search input receives initial focus.
3. Type query: `"SQLite"`. List filters in real time.
4. Press `Tab` to enter the filtered sessions list.
5. Use `Arrow Down / Up` to highlight a session.
6. Press `Enter` to load the session in the Chat view.

### 3.3 Settings & Provider Configuration
1. Navigate to **Settings** via Sidebar.
2. `Tab` between section headers: General, Providers, Models, Privacy, Security.
3. Under Providers, `Tab` to API Key input field.
4. Type or paste credential. `aria-describedby` announces DPAPI protection guarantee.
5. `Tab` to Save Credential button and press `Enter`.
6. Toast announcement confirms: *"Provider credential saved securely via DPAPI."*. Focus remains on the Save button.

