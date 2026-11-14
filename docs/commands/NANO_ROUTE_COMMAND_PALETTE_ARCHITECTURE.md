# Nano Route — Command Palette Architecture
**Step 65: Global Command Palette, Quick Actions, Application Search & Unified Navigation**

## 1. Architectural Role & Boundary

The Global Command Palette in Nano Route serves exclusively as a **navigation, discovery, and controlled-action layer**. It acts as a single, keyboard-first dispatch center mapping user intent directly to established application workflows.

```text
┌──────────────────────────────────────────────────────────────┐
│                    Global Key Listeners                      │
│            Ctrl+K / F1 / Ctrl+D / Ctrl+1..3                  │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 CommandPaletteProvider                       │
│     (State: isOpen, query, selectedCategory, activeIndex)    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 searchCommands(query, cat)                   │
│   (Static In-Memory Registry • Tokenized Prefix Matching)    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  Controlled Dispatch Layer                   │
│  ┌─────────────────┬───────────────────┬──────────────────┐  │
│  │   Navigation    │     Settings      │   Diagnostics    │  │
│  │   navigateTo()  │ openSettingsTab() │ runAllTests()    │  │
│  └─────────────────┴───────────────────┴──────────────────┘  │
│  ┌─────────────────┬───────────────────┬──────────────────┐  │
│  │  Notifications  │       Help        │     Recovery     │  │
│  │ openDrawer()    │ openTopic()       │ openRecovery()   │  │
│  └─────────────────┴───────────────────┴──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Strict Non-Goals & Invariants
- **No Arbitrary Shell/CLI Execution**: The palette cannot execute PowerShell, bash, or operating system binaries.
- **No Arbitrary SQL Engine**: The search field does not issue raw queries against the local SQLite database.
- **No Arbitrary Remote Network Invocation**: Searching does not trigger network calls or third-party API lookups.
- **No Chat History Full-Text Search**: The command palette indexes only application destinations, commands, and settings, preserving database performance and privacy.
- **Zero Secret Exposure**: Passwords, DPAPI-protected API tokens, and private keys are never included in command definitions, search results, or descriptions.

---

## 2. Component Structure

The Command Palette subsystem is organized cleanly within `src/features/commands/`:

- **`types.ts`**: Strict TypeScript interfaces specifying `CommandCategory`, `CommandAvailability`, `CommandActionType`, `CommandDefinition`, `CommandMatch`, and `CommandPaletteContextValue`.
- **`registry.ts`**: Static registry defining 24 canonical commands across `Navigation`, `Actions`, `Settings`, `Diagnostics`, `Help`, and `Recovery`.
- **`search.ts`**: Deterministic, offline lexical scoring engine that matches against command titles, keywords, descriptions, and category tags without external dependencies.
- **`CommandPaletteContext.tsx`**: React context provider managing keyboard accelerators, search input, active selection state, and dispatch execution.
- **`components/CommandPaletteModal.tsx`**: Accessible desktop modal dialog implementing WAI-ARIA combobox patterns with category filter chips, keyboard traversal, and high-contrast styling.
- **`components/CommandPaletteTrigger.tsx`**: Header trigger component providing accessible mouse launch and showing the `Ctrl+K` accelerator hint.
- **`index.ts`**: Public barrel exports for integration across the application shell.

---

## 3. Integration with Existing Systems

1. **Dashboard & Routing**: Integrates with `useDashboardState` to navigate across tabs (`overview`, `chat`, `analytics`, `diagnostics`, `help`, `providers`, `settings`).
2. **Settings**: Maps directly to settings categories (`general`, `providers`, `routing`, `slm`, `appearance`, `privacy`, `updates`).
3. **Diagnostics & Self-Tests**: Triggers the Diagnostics Center or direct self-test suites (`useDiagnosticsStore`).
4. **Notifications**: Interacts with `useNotificationStore` to toggle the Notification Center drawer.
5. **Help Center**: Dispatches direct navigation to contextual troubleshooting guides and documentation topics.
6. **Recovery**: Dispatches to the Safe Mode and Emergency Disaster Recovery consoles.

